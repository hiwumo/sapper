use crate::message_storage::StoredMessage;
use std::collections::HashMap;
use std::io;
use std::ops::Bound;
use std::path::Path;
use tantivy::collector::TopDocs;
use tantivy::query::{
    BooleanQuery, BoostQuery, FuzzyTermQuery, Occur, Query, QueryParser, RangeQuery,
};
use tantivy::schema::*;
use tantivy::tokenizer::*;
use tantivy::{doc, Index, IndexReader, IndexWriter, ReloadPolicy, Term};

pub struct MessageSearchIndex {
    index: Index,
    schema: Schema,
    reader: IndexReader,
}

// ---------------------------------------------------------------------------
// Edge-ngram tokenizer (for prefix/autocomplete matching)
// ---------------------------------------------------------------------------

#[derive(Clone)]
struct EdgeNgramTokenFilter {
    min_gram: usize,
    max_gram: usize,
}

impl EdgeNgramTokenFilter {
    fn new(min_gram: usize, max_gram: usize) -> Self {
        Self { min_gram, max_gram }
    }
}

impl TokenFilter for EdgeNgramTokenFilter {
    type Tokenizer<T: Tokenizer> = EdgeNgramTokenizer<T>;

    fn transform<T: Tokenizer>(self, tokenizer: T) -> Self::Tokenizer<T> {
        EdgeNgramTokenizer {
            inner: tokenizer,
            min_gram: self.min_gram,
            max_gram: self.max_gram,
        }
    }
}

#[derive(Clone)]
struct EdgeNgramTokenizer<T> {
    inner: T,
    min_gram: usize,
    max_gram: usize,
}

impl<T: Tokenizer> Tokenizer for EdgeNgramTokenizer<T> {
    type TokenStream<'a> = EdgeNgramTokenStream<T::TokenStream<'a>>;

    fn token_stream<'a>(&'a mut self, text: &'a str) -> Self::TokenStream<'a> {
        EdgeNgramTokenStream {
            inner: self.inner.token_stream(text),
            min_gram: self.min_gram,
            max_gram: self.max_gram,
            current_token_chars: Vec::new(),
            current_ngram: 0,
            token_offset_from: 0,
            needs_next_token: true,
        }
    }
}

struct EdgeNgramTokenStream<T> {
    inner: T,
    min_gram: usize,
    max_gram: usize,
    current_token_chars: Vec<char>,
    current_ngram: usize,
    token_offset_from: usize,
    needs_next_token: bool,
}

impl<T: TokenStream> TokenStream for EdgeNgramTokenStream<T> {
    fn advance(&mut self) -> bool {
        loop {
            if self.needs_next_token {
                if !self.inner.advance() {
                    return false;
                }
                self.current_token_chars = self.inner.token().text.chars().collect();
                self.token_offset_from = self.inner.token().offset_from;
                self.current_ngram = self.min_gram.saturating_sub(1);
                self.needs_next_token = false;
            }

            self.current_ngram += 1;

            if self.current_ngram > self.max_gram
                || self.current_ngram > self.current_token_chars.len()
            {
                self.needs_next_token = true;
                continue;
            }

            if self.current_ngram >= self.min_gram {
                let ngram: String =
                    self.current_token_chars[..self.current_ngram].iter().collect();
                let ngram_byte_len = ngram.len();
                self.token_mut().text.clear();
                self.token_mut().text.push_str(&ngram);
                self.token_mut().offset_from = self.token_offset_from;
                self.token_mut().offset_to = self.token_offset_from + ngram_byte_len;
                return true;
            }
        }
    }

    fn token(&self) -> &Token {
        self.inner.token()
    }

    fn token_mut(&mut self) -> &mut Token {
        self.inner.token_mut()
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Parse `from:username` filters out of the query string.
/// Returns (content_query, optional_sender_filter).
fn parse_query_syntax(query_str: &str) -> (String, Option<String>) {
    let mut content_parts = Vec::new();
    let mut sender_filter = None;

    for token in query_str.split_whitespace() {
        if let Some(sender) = token.strip_prefix("from:") {
            if !sender.is_empty() {
                sender_filter = Some(sender.to_lowercase());
            }
        } else {
            content_parts.push(token);
        }
    }

    (content_parts.join(" "), sender_filter)
}

/// If the entire query is wrapped in double quotes, return the inner text.
fn extract_phrase(query_str: &str) -> Option<&str> {
    let trimmed = query_str.trim();
    if trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() > 2 {
        Some(&trimmed[1..trimmed.len() - 1])
    } else {
        None
    }
}

/// Register all tokenizers on an index (both new and legacy names).
fn register_tokenizers(index: &Index) {
    // "raw": lowercase only — for exact literal matching & phrase queries
    let raw_tokenizer = TextAnalyzer::builder(SimpleTokenizer::default())
        .filter(RemoveLongFilter::limit(100))
        .filter(LowerCaser)
        .build();

    // "stemmed": lowercase + English stemmer
    let stemmed_tokenizer = TextAnalyzer::builder(SimpleTokenizer::default())
        .filter(RemoveLongFilter::limit(100))
        .filter(LowerCaser)
        .filter(Stemmer::new(Language::English))
        .build();

    // "prefix": lowercase + edge-ngrams (2-10 chars)
    let prefix_tokenizer = TextAnalyzer::builder(SimpleTokenizer::default())
        .filter(RemoveLongFilter::limit(100))
        .filter(LowerCaser)
        .filter(EdgeNgramTokenFilter::new(2, 10))
        .build();

    // "sender_raw": lowercase only
    let sender_tokenizer = TextAnalyzer::builder(SimpleTokenizer::default())
        .filter(RemoveLongFilter::limit(60))
        .filter(LowerCaser)
        .build();

    index.tokenizers().register("raw", raw_tokenizer);
    index.tokenizers().register("stemmed", stemmed_tokenizer);
    index.tokenizers().register("prefix", prefix_tokenizer);
    index.tokenizers().register("sender_raw", sender_tokenizer);

    // Legacy tokenizer names so opening an old index doesn't panic
    let exact_compat = TextAnalyzer::builder(SimpleTokenizer::default())
        .filter(RemoveLongFilter::limit(40))
        .filter(LowerCaser)
        .filter(Stemmer::new(Language::English))
        .build();
    let fuzzy_compat = TextAnalyzer::builder(SimpleTokenizer::default())
        .filter(RemoveLongFilter::limit(40))
        .filter(LowerCaser)
        .filter(EdgeNgramTokenFilter::new(3, 12))
        .build();
    index.tokenizers().register("exact", exact_compat);
    index.tokenizers().register("fuzzy", fuzzy_compat);
}

/// Build the v2 schema.
fn build_schema() -> Schema {
    let mut sb = Schema::builder();

    // content_raw: lowercase only, positions for phrase queries, stored
    let raw_opts = TextOptions::default()
        .set_indexing_options(
            TextFieldIndexing::default()
                .set_tokenizer("raw")
                .set_index_option(IndexRecordOption::WithFreqsAndPositions),
        )
        .set_stored();

    // content_stemmed: lowercase + stemmer, positions
    let stemmed_opts = TextOptions::default().set_indexing_options(
        TextFieldIndexing::default()
            .set_tokenizer("stemmed")
            .set_index_option(IndexRecordOption::WithFreqsAndPositions),
    );

    // content_prefix: edge-ngram, freqs only (no positions needed)
    let prefix_opts = TextOptions::default().set_indexing_options(
        TextFieldIndexing::default()
            .set_tokenizer("prefix")
            .set_index_option(IndexRecordOption::WithFreqs),
    );

    // sender: lowercase only, stored
    let sender_opts = TextOptions::default()
        .set_indexing_options(
            TextFieldIndexing::default()
                .set_tokenizer("sender_raw")
                .set_index_option(IndexRecordOption::WithFreqsAndPositions),
        )
        .set_stored();

    sb.add_u64_field("id", STORED | INDEXED);
    sb.add_u64_field("timestamp", STORED | INDEXED);
    sb.add_text_field("sender", sender_opts);
    sb.add_text_field("content_raw", raw_opts);
    sb.add_text_field("content_stemmed", stemmed_opts);
    sb.add_text_field("content_prefix", prefix_opts);

    sb.build()
}

// ---------------------------------------------------------------------------
// MessageSearchIndex
// ---------------------------------------------------------------------------

impl MessageSearchIndex {
    pub fn create(index_dir: &Path) -> io::Result<Self> {
        let schema = build_schema();
        let index = Index::create_in_dir(index_dir, schema.clone())
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;
        register_tokenizers(&index);

        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

        Ok(Self { index, schema, reader })
    }

    pub fn open(index_dir: &Path) -> io::Result<Self> {
        let index =
            Index::open_in_dir(index_dir).map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;
        let schema = index.schema();
        register_tokenizers(&index);

        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

        Ok(Self { index, schema, reader })
    }

    pub fn index_messages(&self, messages: &[StoredMessage]) -> io::Result<()> {
        let id_field = self.schema.get_field("id").unwrap();
        let timestamp_field = self.schema.get_field("timestamp").unwrap();
        let sender_field = self.schema.get_field("sender").unwrap();
        let content_raw_field = self.schema.get_field("content_raw").unwrap();
        let content_stemmed_field = self.schema.get_field("content_stemmed").unwrap();
        let content_prefix_field = self.schema.get_field("content_prefix").unwrap();

        let mut writer: IndexWriter = self
            .index
            .writer(50_000_000)
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

        for msg in messages {
            writer
                .add_document(doc!(
                    id_field => msg.id,
                    timestamp_field => msg.timestamp,
                    sender_field => msg.author.nickname.clone(),
                    content_raw_field => msg.content.clone(),
                    content_stemmed_field => msg.content.clone(),
                    content_prefix_field => msg.content.clone(),
                ))
                .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;
        }

        writer
            .commit()
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

        Ok(())
    }

    /// Search messages with optional date filtering.
    ///
    /// Supports:
    /// - Multi-field ranking: raw exact > phrase > stemmed > prefix > fuzzy typo > sender
    /// - `from:username` syntax to filter by sender
    /// - Quoted `"exact phrase"` searches
    /// - Real typo tolerance via edit-distance fuzzy queries (for terms >= 4 chars)
    /// - Multiplicative freshness factor (relevance stays primary)
    pub fn search(
        &self,
        query_str: &str,
        limit: usize,
        after_timestamp: Option<u64>,
        before_timestamp: Option<u64>,
    ) -> io::Result<Vec<u64>> {
        let searcher = self.reader.searcher();

        // Resolve fields — fail gracefully for old schema
        let content_raw_field = self.schema.get_field("content_raw").map_err(|_| {
            io::Error::new(
                io::ErrorKind::Other,
                "Search index schema is outdated. Please re-import this conversation to enable search with the improved algorithm.",
            )
        })?;
        let content_stemmed_field = self.schema.get_field("content_stemmed").map_err(|_| {
            io::Error::new(
                io::ErrorKind::Other,
                "Search index schema is outdated. Please re-import this conversation to enable search.",
            )
        })?;
        let content_prefix_field = self.schema.get_field("content_prefix").map_err(|_| {
            io::Error::new(
                io::ErrorKind::Other,
                "Search index schema is outdated. Please re-import this conversation to enable search.",
            )
        })?;
        let sender_field = self.schema.get_field("sender").unwrap();
        let timestamp_field = self.schema.get_field("timestamp").unwrap();
        let id_field = self.schema.get_field("id").unwrap();

        // ---- Parse query syntax ----
        let (content_query_str, sender_filter) = parse_query_syntax(query_str);

        if content_query_str.is_empty() && sender_filter.is_none() {
            return Ok(Vec::new());
        }

        // ---- Build sub-queries ----
        let mut sub_queries: Vec<(Occur, Box<dyn Query>)> = Vec::new();

        if !content_query_str.is_empty() {
            if let Some(phrase_text) = extract_phrase(&content_query_str) {
                // Explicit quoted phrase → phrase query on raw field, highest weight
                let raw_parser =
                    QueryParser::for_index(&self.index, vec![content_raw_field]);
                if let Ok(pq) = raw_parser.parse_query(&format!("\"{}\"", phrase_text)) {
                    sub_queries.push((Occur::Should, Box::new(BoostQuery::new(pq, 5.0))));
                }
            } else {
                let words: Vec<&str> = content_query_str.split_whitespace().collect();

                // 1. Raw exact term matches (highest content weight)
                let raw_parser =
                    QueryParser::for_index(&self.index, vec![content_raw_field]);
                if let Ok(q) = raw_parser.parse_query(&content_query_str) {
                    sub_queries.push((Occur::Should, Box::new(BoostQuery::new(q, 3.0))));
                }

                // 2. Implicit phrase boost for multi-word queries
                if words.len() > 1 {
                    let raw_parser2 =
                        QueryParser::for_index(&self.index, vec![content_raw_field]);
                    if let Ok(pq) =
                        raw_parser2.parse_query(&format!("\"{}\"", content_query_str))
                    {
                        sub_queries
                            .push((Occur::Should, Box::new(BoostQuery::new(pq, 4.0))));
                    }
                }

                // 3. Stemmed matches (medium weight)
                let stemmed_parser =
                    QueryParser::for_index(&self.index, vec![content_stemmed_field]);
                if let Ok(q) = stemmed_parser.parse_query(&content_query_str) {
                    sub_queries.push((Occur::Should, Box::new(BoostQuery::new(q, 1.5))));
                }

                // 4. Prefix matches (low weight)
                let prefix_parser =
                    QueryParser::for_index(&self.index, vec![content_prefix_field]);
                if let Ok(q) = prefix_parser.parse_query(&content_query_str) {
                    sub_queries.push((Occur::Should, Box::new(BoostQuery::new(q, 0.5))));
                }

                // 5. Fuzzy typo-tolerant queries (edit distance 1, terms >= 4 chars)
                for word in &words {
                    let lower = word.to_lowercase();
                    if lower.len() >= 4 {
                        let term = Term::from_field_text(content_raw_field, &lower);
                        let fuzzy_q = FuzzyTermQuery::new(term, 1, true);
                        sub_queries.push((
                            Occur::Should,
                            Box::new(BoostQuery::new(Box::new(fuzzy_q), 1.0)),
                        ));
                    }
                }
            }
        }

        // ---- Sender handling ----
        if let Some(ref sender_name) = sender_filter {
            // Explicit from:name → must-match filter
            let sender_parser = QueryParser::for_index(&self.index, vec![sender_field]);
            if let Ok(sq) = sender_parser.parse_query(sender_name) {
                sub_queries.push((Occur::Must, sq));
            }
        } else if !content_query_str.is_empty() {
            // Implicit sender signal — very low weight, tiebreaker only
            let sender_parser = QueryParser::for_index(&self.index, vec![sender_field]);
            if let Ok(sq) = sender_parser.parse_query(&content_query_str) {
                sub_queries.push((Occur::Should, Box::new(BoostQuery::new(sq, 0.1))));
            }
        }

        if sub_queries.is_empty() {
            return Ok(Vec::new());
        }

        let combined_text_query: Box<dyn Query> = Box::new(BooleanQuery::new(sub_queries));

        // ---- Date filter ----
        let final_query = self.combine_with_date_filter(
            combined_text_query,
            timestamp_field,
            after_timestamp,
            before_timestamp,
        );

        // ---- Retrieve wider candidate pool for reranking ----
        let candidate_limit = limit * 4;
        let results = searcher
            .search(&final_query, &TopDocs::with_limit(candidate_limit))
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

        // ---- Multiplicative freshness reranking + dedup ----
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut scored: HashMap<u64, f32> = HashMap::new();

        for (score, doc_address) in results {
            let retrieved_doc: tantivy::TantivyDocument = searcher
                .doc(doc_address)
                .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

            if let Some(id_value) = retrieved_doc.get_first(id_field) {
                if let Some(id) = id_value.as_u64() {
                    let timestamp = retrieved_doc
                        .get_first(timestamp_field)
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0);

                    let age_seconds = now.saturating_sub(timestamp / 1000);
                    let age_days = age_seconds as f32 / 86400.0;

                    // Gentle multiplicative decay: keeps relevance primary,
                    // freshness acts as a tiebreaker among similarly-scored docs.
                    // At 0 days: factor ≈ 1.0, at 200 days: factor ≈ 0.85
                    let freshness = 1.0 / (1.0 + 0.001 * age_days);
                    let final_score = score * (0.7 + 0.3 * freshness);

                    // Keep best score per doc (dedup across retrieval strategies)
                    let entry = scored.entry(id).or_insert(0.0);
                    if final_score > *entry {
                        *entry = final_score;
                    }
                }
            }
        }

        // Sort descending by score
        let mut scored_vec: Vec<(f32, u64)> =
            scored.into_iter().map(|(id, s)| (s, id)).collect();
        scored_vec.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

        let message_ids: Vec<u64> = scored_vec
            .into_iter()
            .take(limit)
            .map(|(_, id)| id)
            .collect();

        Ok(message_ids)
    }

    /// Combine a text query with an optional date range filter.
    fn combine_with_date_filter(
        &self,
        text_query: Box<dyn Query>,
        timestamp_field: Field,
        after_timestamp: Option<u64>,
        before_timestamp: Option<u64>,
    ) -> Box<dyn Query> {
        if after_timestamp.is_none() && before_timestamp.is_none() {
            return text_query;
        }

        let lower_bound = if let Some(ts) = after_timestamp {
            Bound::Included(Term::from_field_u64(timestamp_field, ts))
        } else {
            Bound::Unbounded
        };

        let upper_bound = if let Some(ts) = before_timestamp {
            Bound::Included(Term::from_field_u64(timestamp_field, ts))
        } else {
            Bound::Unbounded
        };

        let range_query = RangeQuery::new(lower_bound, upper_bound);

        let combined = BooleanQuery::new(vec![
            (Occur::Must, text_query),
            (Occur::Must, Box::new(range_query)),
        ]);

        Box::new(combined)
    }
}
