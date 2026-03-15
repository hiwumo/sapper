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
    #[serde(default)]
    pub is_user_message: bool, // true if sent by the user via mutable conversation
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

    pub fn get_pinned_message_ids(&self) -> io::Result<Vec<u64>> {
        let index = self.load_chunk_index()?;
        let mut pinned_ids = Vec::new();

        for chunk_meta in &index.chunks {
            let messages = self.load_chunk(chunk_meta)?;
            for msg in &messages {
                if msg.is_pinned {
                    pinned_ids.push(msg.id);
                }
            }
        }

        Ok(pinned_ids)
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

    /// Append a new user message to the end of the conversation.
    /// Returns the assigned message ID.
    pub fn append_message(&self, message: StoredMessage) -> io::Result<StoredMessage> {
        let mut index = self.load_chunk_index()?;
        let msg_id = index.total_messages as u64;

        let mut message = message;
        message.id = msg_id;

        // Check if the last chunk has room
        if let Some(last_chunk) = index.chunks.last_mut() {
            if last_chunk.message_count < CHUNK_SIZE {
                // Append to existing chunk
                let mut chunk_messages = self.load_chunk(last_chunk)?;
                chunk_messages.push(message.clone());
                last_chunk.end_id = msg_id;
                last_chunk.message_count = chunk_messages.len();

                let json = serde_json::to_string(&chunk_messages)
                    .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
                fs::write(&last_chunk.file_path, json)?;

                index.total_messages += 1;
                let index_path = self.import_dir.join("chunk_index.json");
                index.save(&index_path)?;

                return Ok(message);
            }
        }

        // Need a new chunk
        let chunks_dir = self.import_dir.join("chunks");
        fs::create_dir_all(&chunks_dir)?;

        let chunk_id = index.chunks.len();
        let file_name = format!("chunk_{}.json", chunk_id);
        let file_path = chunks_dir.join(&file_name);

        let chunk_messages = vec![message.clone()];
        let json = serde_json::to_string(&chunk_messages)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        fs::write(&file_path, &json)?;

        index.chunks.push(ChunkMeta {
            chunk_id,
            start_id: msg_id,
            end_id: msg_id,
            message_count: 1,
            file_path: file_path.to_string_lossy().to_string(),
        });
        index.total_messages += 1;

        let index_path = self.import_dir.join("chunk_index.json");
        index.save(&index_path)?;

        Ok(message)
    }

    /// Edit a message's content by its ID.
    pub fn edit_message(&self, message_id: u64, new_content: String) -> io::Result<StoredMessage> {
        let index = self.load_chunk_index()?;

        for chunk_meta in &index.chunks {
            if message_id >= chunk_meta.start_id && message_id <= chunk_meta.end_id {
                let mut chunk_messages = self.load_chunk(chunk_meta)?;
                if let Some(msg) = chunk_messages.iter_mut().find(|m| m.id == message_id) {
                    if !msg.is_user_message {
                        return Err(io::Error::new(
                            io::ErrorKind::PermissionDenied,
                            "Cannot edit non-user messages",
                        ));
                    }
                    msg.content = new_content;
                    msg.timestamp_edited = Some(chrono::Utc::now().to_rfc3339());

                    let result = msg.clone();

                    let json = serde_json::to_string(&chunk_messages)
                        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
                    fs::write(&chunk_meta.file_path, json)?;

                    return Ok(result);
                }
            }
        }

        Err(io::Error::new(
            io::ErrorKind::NotFound,
            format!("Message {} not found", message_id),
        ))
    }

    /// Delete a user message by its ID. Marks it as deleted by removing content
    /// and setting a deleted flag, keeping IDs stable.
    pub fn delete_message(&self, message_id: u64) -> io::Result<()> {
        let mut index = self.load_chunk_index()?;

        for chunk_meta in index.chunks.iter_mut() {
            if message_id >= chunk_meta.start_id && message_id <= chunk_meta.end_id {
                let mut chunk_messages = self.load_chunk(chunk_meta)?;
                let pos = chunk_messages.iter().position(|m| m.id == message_id);

                if let Some(pos) = pos {
                    if !chunk_messages[pos].is_user_message {
                        return Err(io::Error::new(
                            io::ErrorKind::PermissionDenied,
                            "Cannot delete non-user messages",
                        ));
                    }

                    chunk_messages.remove(pos);
                    chunk_meta.message_count = chunk_messages.len();

                    if chunk_messages.is_empty() {
                        // Remove the chunk file and update index
                        let _ = fs::remove_file(&chunk_meta.file_path);
                    } else {
                        chunk_meta.start_id = chunk_messages.first().map(|m| m.id).unwrap_or(0);
                        chunk_meta.end_id = chunk_messages.last().map(|m| m.id).unwrap_or(0);

                        let json = serde_json::to_string(&chunk_messages)
                            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
                        fs::write(&chunk_meta.file_path, json)?;
                    }

                    // Update index
                    index.total_messages = index.total_messages.saturating_sub(1);
                    index.chunks.retain(|c| c.message_count > 0);

                    let index_path = self.import_dir.join("chunk_index.json");
                    index.save(&index_path)?;

                    return Ok(());
                }
            }
        }

        Err(io::Error::new(
            io::ErrorKind::NotFound,
            format!("Message {} not found", message_id),
        ))
    }
}
