use crate::message_storage::StoredMessage;
use std::io;
use std::path::Path;
use std::ops::Bound;
use tantivy::collector::TopDocs;
use tantivy::query::{BooleanQuery, BoostQuery, Occur, Query, QueryParser, RangeQuery};
use tantivy::schema::*;
use tantivy::tokenizer::*;
use tantivy::{doc, Index, IndexWriter, ReloadPolicy, Term};

pub struct MessageSearchIndex {
    index: Index,
    schema: Schema,
}

// Custom edge-ngram tokenizer filter
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
            current_token: String::new(),
            current_ngram: 0,
            token_offset_from: 0,
        }
    }
}

struct EdgeNgramTokenStream<T> {
    inner: T,
    min_gram: usize,
    max_gram: usize,
    current_token: String,
    current_ngram: usize,
    token_offset_from: usize,
}

impl<T: TokenStream> TokenStream for EdgeNgramTokenStream<T> {
    fn advance(&mut self) -> bool {
        // If we have a current token and haven't exhausted its ngrams
        if !self.current_token.is_empty() {
            // Count characters, not bytes
            let char_count = self.current_token.chars().count();

            if self.current_ngram < self.max_gram && self.current_ngram < char_count {
                self.current_ngram += 1;
                if self.current_ngram >= self.min_gram {
                    // Take first N characters (Unicode-aware)
                    let ngram: String = self.current_token.chars().take(self.current_ngram).collect();
                    let ngram_byte_len = ngram.len();

                    self.token_mut().text.clear();
                    self.token_mut().text.push_str(&ngram);
                    self.token_mut().offset_from = self.token_offset_from;
                    self.token_mut().offset_to = self.token_offset_from + ngram_byte_len;
                    return true;
                }
                // Skip ngrams that are too short
                if self.current_ngram < char_count {
                    return self.advance();
                }
            }
        }

        // Get next token from inner stream
        if self.inner.advance() {
            self.current_token = self.inner.token().text.clone();
            self.token_offset_from = self.inner.token().offset_from;
            self.current_ngram = 0;
            // Start generating ngrams for this token
            return self.advance();
        }

        false
    }

    fn token(&self) -> &Token {
        self.inner.token()
    }

    fn token_mut(&mut self) -> &mut Token {
        self.inner.token_mut()
    }
}

impl MessageSearchIndex {
    pub fn create(index_dir: &Path) -> io::Result<Self> {
        let mut schema_builder = Schema::builder();

        // Exact match tokenizer: lowercase + stemming
        let exact_options = TextOptions::default()
            .set_indexing_options(
                TextFieldIndexing::default()
                    .set_tokenizer("exact")
                    .set_index_option(IndexRecordOption::WithFreqsAndPositions),
            )
            .set_stored();

        // Fuzzy match tokenizer: lowercase + edge-ngrams (3-12 chars)
        let fuzzy_options = TextOptions::default()
            .set_indexing_options(
                TextFieldIndexing::default()
                    .set_tokenizer("fuzzy")
                    .set_index_option(IndexRecordOption::WithFreqsAndPositions),
            );

        // Sender uses exact tokenizer only (lower weight)
        let sender_options = TextOptions::default()
            .set_indexing_options(
                TextFieldIndexing::default()
                    .set_tokenizer("exact")
                    .set_index_option(IndexRecordOption::WithFreqsAndPositions),
            )
            .set_stored();

        schema_builder.add_u64_field("id", STORED | INDEXED);
        schema_builder.add_u64_field("timestamp", STORED | INDEXED);
        schema_builder.add_text_field("sender", sender_options);
        schema_builder.add_text_field("content_exact", exact_options);
        schema_builder.add_text_field("content_fuzzy", fuzzy_options);

        let schema = schema_builder.build();

        let index = Index::create_in_dir(index_dir, schema.clone())
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

        // Register exact tokenizer: lowercase + stemming
        let exact_tokenizer = TextAnalyzer::builder(SimpleTokenizer::default())
            .filter(RemoveLongFilter::limit(40))
            .filter(LowerCaser)
            .filter(Stemmer::new(Language::English))
            .build();

        // Register fuzzy tokenizer: lowercase + edge-ngrams (3-12 chars)
        let fuzzy_tokenizer = TextAnalyzer::builder(SimpleTokenizer::default())
            .filter(RemoveLongFilter::limit(40))
            .filter(LowerCaser)
            .filter(EdgeNgramTokenFilter::new(3, 12))
            .build();

        index.tokenizers().register("exact", exact_tokenizer);
        index.tokenizers().register("fuzzy", fuzzy_tokenizer);

        Ok(Self { index, schema })
    }

    pub fn open(index_dir: &Path) -> io::Result<Self> {
        let index =
            Index::open_in_dir(index_dir).map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;
        let schema = index.schema();

        // Register exact tokenizer: lowercase + stemming
        let exact_tokenizer = TextAnalyzer::builder(SimpleTokenizer::default())
            .filter(RemoveLongFilter::limit(40))
            .filter(LowerCaser)
            .filter(Stemmer::new(Language::English))
            .build();

        // Register fuzzy tokenizer: lowercase + edge-ngrams (3-12 chars)
        let fuzzy_tokenizer = TextAnalyzer::builder(SimpleTokenizer::default())
            .filter(RemoveLongFilter::limit(40))
            .filter(LowerCaser)
            .filter(EdgeNgramTokenFilter::new(3, 12))
            .build();

        index.tokenizers().register("exact", exact_tokenizer);
        index.tokenizers().register("fuzzy", fuzzy_tokenizer);

        Ok(Self { index, schema })
    }

    pub fn index_messages(&self, messages: &[StoredMessage]) -> io::Result<()> {
        let id_field = self.schema.get_field("id").unwrap();
        let timestamp_field = self.schema.get_field("timestamp").unwrap();
        let sender_field = self.schema.get_field("sender").unwrap();
        let content_exact_field = self.schema.get_field("content_exact").unwrap();
        let content_fuzzy_field = self.schema.get_field("content_fuzzy").unwrap();

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
                    content_exact_field => msg.content.clone(),
                    content_fuzzy_field => msg.content.clone(),
                ))
                .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;
        }

        writer
            .commit()
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

        Ok(())
    }

    /// Search messages with optional date filtering
    ///
    /// # Arguments
    /// * `query_str` - The search query
    /// * `limit` - Maximum number of results
    /// * `after_timestamp` - Optional: only return messages after this timestamp (milliseconds)
    /// * `before_timestamp` - Optional: only return messages before this timestamp (milliseconds)
    pub fn search(
        &self,
        query_str: &str,
        limit: usize,
        after_timestamp: Option<u64>,
        before_timestamp: Option<u64>,
    ) -> io::Result<Vec<u64>> {
        eprintln!("Search called with query: '{}', after: {:?}, before: {:?}", query_str, after_timestamp, before_timestamp);

        let reader = self
            .index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

        let searcher = reader.searcher();
        eprintln!("Number of documents in index: {}", searcher.num_docs());

        // Check if this is the new schema with content_exact and content_fuzzy fields
        let content_exact_field = match self.schema.get_field("content_exact") {
            Ok(field) => field,
            Err(_) => {
                eprintln!("Old schema detected (missing content_exact field)");
                return Err(io::Error::new(
                    io::ErrorKind::Other,
                    "Search index schema is outdated. Please re-import this conversation to enable search with the improved algorithm.",
                ));
            }
        };

        let content_fuzzy_field = self.schema.get_field("content_fuzzy").map_err(|_| {
            io::Error::new(
                io::ErrorKind::Other,
                "Search index schema is outdated. Please re-import this conversation to enable search.",
            )
        })?;

        let sender_field = self.schema.get_field("sender").unwrap();
        let timestamp_field = self.schema.get_field("timestamp").unwrap();
        let id_field = self.schema.get_field("id").unwrap();

        // Stage 1: Try exact match (content_exact + sender)
        eprintln!("Stage 1: Attempting exact match search");

        // Build weighted query for exact match
        // content_exact: weight 2.0, sender: weight 0.3
        let exact_text_query = self.build_weighted_query(
            query_str,
            content_exact_field,
            sender_field,
            2.0,
            0.3,
        ).map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?;

        // Combine text query with date filter if present
        let exact_query = self.combine_with_date_filter(
            exact_text_query,
            timestamp_field,
            after_timestamp,
            before_timestamp,
        );

        let exact_results = searcher
            .search(&exact_query, &TopDocs::with_limit(limit * 2))
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

        eprintln!("Exact match found {} results", exact_results.len());

        let results = if !exact_results.is_empty() {
            // Stage 1 succeeded: use exact matches
            eprintln!("Using exact match results");
            exact_results
        } else {
            // Stage 2: Fallback to fuzzy match
            eprintln!("Stage 2: Falling back to fuzzy match");
            let fuzzy_parser = QueryParser::for_index(&self.index, vec![content_fuzzy_field]);

            let fuzzy_text_query = fuzzy_parser.parse_query(query_str).map_err(|e| {
                eprintln!("Fuzzy query parse error: {}", e);
                io::Error::new(io::ErrorKind::InvalidInput, e)
            })?;

            // Fuzzy match with reduced weight (0.5)
            let fuzzy_boosted: Box<dyn Query> = Box::new(BoostQuery::new(fuzzy_text_query, 0.5));

            // Combine with date filter if present
            let fuzzy_query = self.combine_with_date_filter(
                fuzzy_boosted,
                timestamp_field,
                after_timestamp,
                before_timestamp,
            );

            let fuzzy_results = searcher
                .search(&fuzzy_query, &TopDocs::with_limit(limit * 2))
                .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

            eprintln!("Fuzzy match found {} results", fuzzy_results.len());
            fuzzy_results
        };

        // Apply time decay and re-rank
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut scored_results = Vec::new();
        for (bm25_score, doc_address) in results {
            let retrieved_doc: tantivy::TantivyDocument = searcher
                .doc(doc_address)
                .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

            if let Some(id_value) = retrieved_doc.get_first(id_field) {
                if let Some(id) = id_value.as_u64() {
                    // Get timestamp
                    let timestamp = retrieved_doc
                        .get_first(timestamp_field)
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0);

                    // Calculate age in days
                    let age_seconds = now.saturating_sub(timestamp / 1000);
                    let age_days = age_seconds as f32 / 86400.0;

                    // Time decay: 1 / (1 + λ * age_in_days)
                    // λ = 0.01 gives gentle decay (50% score after ~100 days)
                    let time_decay = 1.0 / (1.0 + 0.01 * age_days);

                    // Final score: BM25 + time_decay_weight * time_decay
                    // Give time decay a weight of 0.5 relative to BM25
                    let final_score = bm25_score + 0.5 * time_decay;

                    eprintln!(
                        "Result: id={}, bm25={:.4}, age_days={:.2}, time_decay={:.4}, final_score={:.4}",
                        id, bm25_score, age_days, time_decay, final_score
                    );

                    scored_results.push((final_score, id));
                }
            }
        }

        // Sort by final score (descending)
        scored_results.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

        // Return top results
        let message_ids: Vec<u64> = scored_results
            .into_iter()
            .take(limit)
            .map(|(_, id)| id)
            .collect();

        eprintln!("Returning {} message IDs", message_ids.len());
        Ok(message_ids)
    }

    fn build_weighted_query(
        &self,
        query_str: &str,
        content_field: Field,
        sender_field: Field,
        content_weight: f32,
        sender_weight: f32,
    ) -> Result<Box<dyn Query>, tantivy::TantivyError> {
        let content_parser = QueryParser::for_index(&self.index, vec![content_field]);
        let sender_parser = QueryParser::for_index(&self.index, vec![sender_field]);

        let content_query = content_parser.parse_query(query_str)?;
        let sender_query = sender_parser.parse_query(query_str)?;

        // Boost queries with different weights
        let content_boosted = Box::new(BoostQuery::new(content_query, content_weight));
        let sender_boosted = Box::new(BoostQuery::new(sender_query, sender_weight));

        // Combine with OR (at least one should match)
        let combined = BooleanQuery::new(vec![
            (Occur::Should, content_boosted),
            (Occur::Should, sender_boosted),
        ]);

        Ok(Box::new(combined))
    }

    /// Combine a text query with an optional date range filter
    fn combine_with_date_filter(
        &self,
        text_query: Box<dyn Query>,
        timestamp_field: Field,
        after_timestamp: Option<u64>,
        before_timestamp: Option<u64>,
    ) -> Box<dyn Query> {
        // If no date constraints, return the text query as-is
        if after_timestamp.is_none() && before_timestamp.is_none() {
            return text_query;
        }

        eprintln!("Date filter: after={:?}, before={:?}", after_timestamp, before_timestamp);

        // Build lower bound term
        let lower_bound = if let Some(ts) = after_timestamp {
            Bound::Included(Term::from_field_u64(timestamp_field, ts))
        } else {
            Bound::Unbounded
        };

        // Build upper bound term
        let upper_bound = if let Some(ts) = before_timestamp {
            Bound::Included(Term::from_field_u64(timestamp_field, ts))
        } else {
            Bound::Unbounded
        };

        let range_query = RangeQuery::new(lower_bound, upper_bound);

        // Combine text query with date range (both must match)
        let combined = BooleanQuery::new(vec![
            (Occur::Must, text_query),
            (Occur::Must, Box::new(range_query)),
        ]);

        Box::new(combined)
    }
}
