use crate::message_storage::StoredMessage;
use std::io;
use std::path::Path;
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::*;
use tantivy::tokenizer::*;
use tantivy::{doc, Index, IndexWriter, ReloadPolicy};

pub struct MessageSearchIndex {
    index: Index,
    schema: Schema,
}

impl MessageSearchIndex {
    pub fn create(index_dir: &Path) -> io::Result<Self> {
        let mut schema_builder = Schema::builder();

        // Create text options with stemming tokenizer
        let text_options = TextOptions::default()
            .set_indexing_options(
                TextFieldIndexing::default()
                    .set_tokenizer("en_stem")
                    .set_index_option(IndexRecordOption::WithFreqsAndPositions),
            )
            .set_stored();

        schema_builder.add_u64_field("id", STORED | INDEXED);
        schema_builder.add_u64_field("timestamp", STORED | INDEXED);
        schema_builder.add_text_field("sender", text_options.clone());
        schema_builder.add_text_field("content", text_options);

        let schema = schema_builder.build();

        let index = Index::create_in_dir(index_dir, schema.clone())
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

        // Register the English stemming tokenizer
        let tokenizer = TextAnalyzer::builder(SimpleTokenizer::default())
            .filter(RemoveLongFilter::limit(40))
            .filter(LowerCaser)
            .filter(Stemmer::new(Language::English))
            .build();

        index.tokenizers().register("en_stem", tokenizer);

        Ok(Self { index, schema })
    }

    pub fn open(index_dir: &Path) -> io::Result<Self> {
        let index =
            Index::open_in_dir(index_dir).map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;
        let schema = index.schema();

        // Register the English stemming tokenizer
        let tokenizer = TextAnalyzer::builder(SimpleTokenizer::default())
            .filter(RemoveLongFilter::limit(40))
            .filter(LowerCaser)
            .filter(Stemmer::new(Language::English))
            .build();

        index.tokenizers().register("en_stem", tokenizer);

        Ok(Self { index, schema })
    }

    pub fn index_messages(&self, messages: &[StoredMessage]) -> io::Result<()> {
        let id_field = self.schema.get_field("id").unwrap();
        let timestamp_field = self.schema.get_field("timestamp").unwrap();
        let sender_field = self.schema.get_field("sender").unwrap();
        let content_field = self.schema.get_field("content").unwrap();

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
                    content_field => msg.content.clone(),
                ))
                .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;
        }

        writer
            .commit()
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

        Ok(())
    }

    pub fn search(&self, query_str: &str, limit: usize) -> io::Result<Vec<u64>> {
        eprintln!("Search called with query: '{}'", query_str);

        let reader = self
            .index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

        let searcher = reader.searcher();
        eprintln!("Number of documents in index: {}", searcher.num_docs());

        let content_field = self.schema.get_field("content").unwrap();
        let sender_field = self.schema.get_field("sender").unwrap();

        let mut query_parser =
            QueryParser::for_index(&self.index, vec![content_field, sender_field]);

        // Enable fuzzy search with edit distance of 1 (more conservative)
        query_parser.set_field_fuzzy(content_field, true, 1, true);
        query_parser.set_field_fuzzy(sender_field, true, 1, true);

        // Try regular search first, then fuzzy if user adds ~
        let query = query_parser.parse_query(query_str).map_err(|e| {
            eprintln!("Query parse error: {}", e);
            io::Error::new(io::ErrorKind::InvalidInput, e)
        })?;

        eprintln!("Parsed query: {:?}", query);

        let top_docs = searcher
            .search(&query, &TopDocs::with_limit(limit))
            .map_err(|e| {
                eprintln!("Search execution error: {}", e);
                io::Error::new(io::ErrorKind::Other, e)
            })?;

        eprintln!("Found {} documents", top_docs.len());

        let id_field = self.schema.get_field("id").unwrap();
        let mut message_ids = Vec::new();

        for (score, doc_address) in top_docs {
            let retrieved_doc: tantivy::TantivyDocument = searcher
                .doc(doc_address)
                .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

            if let Some(id_value) = retrieved_doc.get_first(id_field) {
                if let Some(id) = id_value.as_u64() {
                    eprintln!("Result: id={}, score={}", id, score);
                    message_ids.push(id);
                }
            }
        }

        eprintln!("Returning {} message IDs", message_ids.len());
        Ok(message_ids)
    }
}
