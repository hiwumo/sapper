use crate::models::{Attachment, Author, MessageReference};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

const CHUNK_SIZE: usize = 500;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredMessage {
    pub id: u64,
    pub original_id: String,
    #[serde(rename = "type")]
    pub message_type: String,
    pub timestamp: u64,
    pub timestamp_edited: Option<String>,
    pub call_ended_timestamp: Option<String>,
    pub is_pinned: bool,
    pub content: String,
    pub author: Author,
    pub attachments: Vec<Attachment>,
    pub embeds: Vec<serde_json::Value>,
    pub stickers: Vec<serde_json::Value>,
    pub reactions: Vec<serde_json::Value>,
    pub mentions: Vec<serde_json::Value>,
    pub inline_emojis: Vec<serde_json::Value>,
    pub media_refs: Vec<String>, // paths to media files (computed field)
    pub reference: Option<MessageReference>,
    pub referenced_message: Option<Box<StoredMessage>>, // The actual message being replied to
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkMeta {
    pub chunk_id: usize,
    pub start_id: u64,
    pub end_id: u64,
    pub message_count: usize,
    pub file_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChunkIndex {
    pub chunks: Vec<ChunkMeta>,
    pub total_messages: usize,
}

impl ChunkIndex {
    pub fn new() -> Self {
        Self {
            chunks: Vec::new(),
            total_messages: 0,
        }
    }

    #[allow(unused)] // we may need this?
    pub fn find_chunk_for_message(&self, message_id: u64) -> Option<&ChunkMeta> {
        self.chunks
            .iter()
            .find(|chunk| message_id >= chunk.start_id && message_id <= chunk.end_id)
    }

    pub fn save(&self, path: &Path) -> io::Result<()> {
        let json = serde_json::to_string(self)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        fs::write(path, json)?;
        Ok(())
    }

    pub fn load(path: &Path) -> io::Result<Self> {
        let contents = fs::read_to_string(path)?;
        serde_json::from_str(&contents).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
    }
}

pub struct MessageStorage {
    import_dir: PathBuf,
}

impl MessageStorage {
    pub fn new(import_dir: PathBuf) -> Self {
        Self { import_dir }
    }

    pub fn create_chunks(&self, messages: Vec<StoredMessage>) -> io::Result<ChunkIndex> {
        let chunks_dir = self.import_dir.join("chunks");
        fs::create_dir_all(&chunks_dir)?;

        let mut chunk_index = ChunkIndex::new();
        chunk_index.total_messages = messages.len();

        for (chunk_id, chunk) in messages.chunks(CHUNK_SIZE).enumerate() {
            let start_id = chunk.first().map(|m| m.id).unwrap_or(0);
            let end_id = chunk.last().map(|m| m.id).unwrap_or(0);
            let file_name = format!("chunk_{}.json", chunk_id);
            let file_path = chunks_dir.join(&file_name);

            // Serialize and write chunk as JSON
            let json = serde_json::to_string(&chunk)
                .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
            fs::write(&file_path, json)?;

            // Add to index
            chunk_index.chunks.push(ChunkMeta {
                chunk_id,
                start_id,
                end_id,
                message_count: chunk.len(),
                file_path: file_path.to_string_lossy().to_string(),
            });
        }

        // Save index
        let index_path = self.import_dir.join("chunk_index.json");
        chunk_index.save(&index_path)?;

        Ok(chunk_index)
    }

    pub fn load_chunk(&self, chunk_meta: &ChunkMeta) -> io::Result<Vec<StoredMessage>> {
        let contents = fs::read_to_string(&chunk_meta.file_path)?;
        serde_json::from_str(&contents).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
    }

    pub fn load_chunk_index(&self) -> io::Result<ChunkIndex> {
        let index_path = self.import_dir.join("chunk_index.json");
        ChunkIndex::load(&index_path)
    }

    pub fn load_messages_range(
        &self,
        start_idx: usize,
        count: usize,
    ) -> io::Result<Vec<StoredMessage>> {
        let index = self.load_chunk_index()?;
        let mut messages = Vec::new();
        let mut collected = 0;
        let mut current_idx = 0;

        for chunk_meta in &index.chunks {
            if current_idx + chunk_meta.message_count <= start_idx {
                current_idx += chunk_meta.message_count;
                continue;
            }

            let chunk_messages = self.load_chunk(chunk_meta)?;
            let skip_in_chunk = if current_idx < start_idx {
                start_idx - current_idx
            } else {
                0
            };

            for (i, msg) in chunk_messages.iter().enumerate() {
                if i < skip_in_chunk {
                    continue;
                }
                if collected >= count {
                    return Ok(messages);
                }
                messages.push(msg.clone());
                collected += 1;
            }

            current_idx += chunk_meta.message_count;
        }

        Ok(messages)
    }
}
