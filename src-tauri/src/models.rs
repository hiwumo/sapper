use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordExport {
    pub guild: Guild,
    pub channel: Channel,
    pub date_range: DateRange,
    pub exported_at: String,
    pub messages: Vec<Message>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Guild {
    pub id: String,
    pub name: String,
    pub icon_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Channel {
    pub id: String,
    #[serde(rename = "type")]
    pub channel_type: String,
    pub category_id: Option<String>,
    pub category: Option<String>,
    pub name: String,
    pub topic: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DateRange {
    pub after: Option<String>,
    pub before: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: String,
    #[serde(rename = "type")]
    pub message_type: String,
    pub timestamp: String,
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
    pub reference: Option<MessageReference>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageReference {
    pub message_id: String,
    pub channel_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Author {
    pub id: String,
    pub name: String,
    pub discriminator: String,
    pub nickname: String,
    pub color: Option<String>,
    pub is_bot: bool,
    pub roles: Vec<serde_json::Value>,
    pub avatar_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub id: String,
    pub url: String,
    pub file_name: String,
    pub file_size_bytes: u64,
}

// Metadata structures for .sapper directory
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportMetadata {
    pub imports: Vec<ImportEntry>,
}

impl Default for ImportMetadata {
    fn default() -> Self {
        Self {
            imports: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportEntry {
    pub id: String,
    pub alias: String,
    pub import_path: String,
    pub created_at: String,
    pub file_hash: String,
    pub channel_name: String,
    pub guild_name: String,
    pub guild_id: String,
    pub message_count: usize,
    pub avatar_path: String,
}

// Member storage for conversations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Member {
    pub id: String,            // Discord user ID
    pub name: String,          // Original username
    pub discriminator: String, // Discord discriminator (e.g., "0001")
    pub nickname: String,      // Display name (editable)
    pub avatar_url: String,    // Path to avatar file (editable)
    pub color: Option<String>, // Role color
    pub is_bot: bool,
    pub roles: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemberStorage {
    pub members: Vec<Member>,
}

impl Default for MemberStorage {
    fn default() -> Self {
        Self {
            members: Vec::new(),
        }
    }
}

// New unified import data structure (replaces members.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportData {
    pub import_version: String,
    pub members: Vec<Member>,
    pub created_at: String,
    pub last_updated: String,
}

impl Default for ImportData {
    fn default() -> Self {
        Self {
            import_version: "0.3.0".to_string(), // Current version
            members: Vec::new(),
            created_at: chrono::Utc::now().to_rfc3339(),
            last_updated: chrono::Utc::now().to_rfc3339(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub theme: String,
    pub last_opened_chat: Option<String>,
    #[serde(default)]
    pub conversation_positions: std::collections::HashMap<String, ConversationPosition>,
    #[serde(default)]
    pub last_changelog_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationPosition {
    pub message_id: u64,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            last_opened_chat: None,
            conversation_positions: std::collections::HashMap::new(),
            last_changelog_version: None,
        }
    }
}

// Import backup result structures
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportBackupResult {
    pub successful: Vec<ImportedConversation>,
    pub failed: Vec<FailedImport>,
    pub total_count: usize,
    pub success_count: usize,
    pub failed_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedConversation {
    pub conversation_name: String,
    pub message_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FailedImport {
    pub conversation_name: String,
    pub error: String,
}

// Version compatibility structures
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
pub enum CompatibilityStatus {
    Compatible,
    Incompatible,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionCompatibility {
    pub is_compatible: bool,
    pub current_version: String,
    pub import_version: String,
    pub needs_update: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportEntryWithCompatibility {
    #[serde(flatten)]
    pub entry: ImportEntry,
    pub compatibility: VersionCompatibility,
}
