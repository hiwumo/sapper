use crate::message_storage::{MessageStorage, StoredMessage};
use crate::models::*;
use crate::search::MessageSearchIndex;
use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub struct SapperCore {
    pub sapper_dir: PathBuf,
}

impl SapperCore {
    pub fn new() -> io::Result<Self> {
        let sapper_dir = if let Some(home) = directories::UserDirs::new() {
            home.home_dir().join(".sapper")
        } else {
            PathBuf::from(".sapper")
        };

        let core = Self { sapper_dir };
        core.init()?;
        Ok(core)
    }

    fn init(&self) -> io::Result<()> {
        // Create main .sapper directory
        fs::create_dir_all(&self.sapper_dir)?;

        // Create subdirectories
        fs::create_dir_all(self.sapper_dir.join("imports"))?;
        fs::create_dir_all(self.sapper_dir.join("cache/parsed"))?;
        fs::create_dir_all(self.sapper_dir.join("cache/avatars"))?;
        fs::create_dir_all(self.sapper_dir.join("logs"))?;

        // Initialize metadata.json if it doesn't exist
        let metadata_path = self.sapper_dir.join("metadata.json");
        if !metadata_path.exists() {
            let metadata = ImportMetadata::default();
            self.save_metadata(&metadata)?;
        }

        // Initialize config.json if it doesn't exist
        let config_path = self.sapper_dir.join("config.json");
        if !config_path.exists() {
            let config = AppConfig::default();
            self.save_config(&config)?;
        }

        Ok(())
    }

    pub fn load_metadata(&self) -> io::Result<ImportMetadata> {
        let metadata_path = self.sapper_dir.join("metadata.json");
        let contents = fs::read_to_string(metadata_path)?;
        serde_json::from_str(&contents).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
    }

    pub fn save_metadata(&self, metadata: &ImportMetadata) -> io::Result<()> {
        let metadata_path = self.sapper_dir.join("metadata.json");
        let temp_path = self.sapper_dir.join("metadata.json.tmp");

        let contents = serde_json::to_string_pretty(metadata)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

        fs::write(&temp_path, contents)?;
        fs::rename(temp_path, metadata_path)?;

        Ok(())
    }

    pub fn load_config(&self) -> io::Result<AppConfig> {
        let config_path = self.sapper_dir.join("config.json");
        let contents = fs::read_to_string(config_path)?;
        serde_json::from_str(&contents).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
    }

    pub fn save_config(&self, config: &AppConfig) -> io::Result<()> {
        let config_path = self.sapper_dir.join("config.json");
        let temp_path = self.sapper_dir.join("config.json.tmp");

        let contents = serde_json::to_string_pretty(config)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

        fs::write(&temp_path, contents)?;
        fs::rename(temp_path, config_path)?;

        Ok(())
    }

    pub fn import_conversation(
        &self,
        json_path: &str,
        alias: Option<String>,
    ) -> io::Result<ImportEntry> {
        let json_path_buf = PathBuf::from(json_path);

        // Validate the JSON file exists
        if !json_path_buf.exists() {
            return Err(io::Error::new(
                io::ErrorKind::NotFound,
                "JSON file not found",
            ));
        }

        // Read and parse the JSON
        let export_data = self.parse_export(&json_path_buf)?;

        // Calculate file hash
        let file_hash = self.calculate_file_hash(&json_path_buf)?;

        // Generate unique ID
        let import_id = Uuid::new_v4().to_string();

        // Determine alias
        let final_alias = alias.unwrap_or_else(|| {
            if export_data.guild.id == "0" {
                format!("{}", export_data.channel.name)
            } else {
                format!("{} in {}", export_data.channel.name, export_data.guild.name)
            }
        });

        // Create import directory
        let import_dir = self.sapper_dir.join("imports").join(&import_id);
        fs::create_dir_all(&import_dir)?;

        // Copy the JSON file
        let dest_json = import_dir.join("export.json");
        fs::copy(&json_path_buf, &dest_json)?;

        // Copy attachments directory if it exists
        let source_dir = json_path_buf.parent().unwrap();
        let attachments_dir = import_dir.join("attachments");

        if source_dir.exists() {
            self.copy_attachments(source_dir, &attachments_dir)?;
        }

        // Extract and copy avatar to import directory
        let avatar_path =
            self.extract_avatar(&export_data, &import_id, &json_path_buf, &import_dir)?;

        // Convert messages to stored format
        let stored_messages = self.convert_messages_to_stored(&export_data, &import_dir)?;

        // Create message chunks
        let storage = MessageStorage::new(import_dir.clone());
        storage.create_chunks(stored_messages.clone())?;

        // Create search index
        let index_dir = import_dir.join("search_index");
        fs::create_dir_all(&index_dir)?;
        let search_index = MessageSearchIndex::create(&index_dir)?;
        search_index.index_messages(&stored_messages)?;

        // Extract and store members
        let members = self.extract_members(&export_data)?;
        self.save_members(&import_dir, &members)?;

        // Create import entry
        let import_entry = ImportEntry {
            id: import_id.clone(),
            alias: final_alias,
            import_path: import_dir.to_string_lossy().to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
            file_hash,
            channel_name: export_data.channel.name.clone(),
            guild_name: export_data.guild.name.clone(),
            guild_id: export_data.guild.id.clone(),
            message_count: export_data.messages.len(),
            avatar_path,
        };

        // Load metadata and add entry
        let mut metadata = self.load_metadata()?;
        metadata.imports.push(import_entry.clone());
        self.save_metadata(&metadata)?;

        Ok(import_entry)
    }

    fn convert_messages_to_stored(
        &self,
        export: &DiscordExport,
        import_dir: &Path,
    ) -> io::Result<Vec<StoredMessage>> {
        let mut stored_messages = Vec::new();

        for (idx, msg) in export.messages.iter().enumerate() {
            let timestamp = chrono::DateTime::parse_from_rfc3339(&msg.timestamp)
                .map(|dt| dt.timestamp() as u64)
                .unwrap_or(0);

            // Collect only attachments into media_refs (stickers are handled separately)
            let media_refs: Vec<String> = msg
                .attachments
                .iter()
                .map(|att| {
                    // Use att.url which contains the actual filename with suffix
                    let attachment_path = import_dir.join("attachments").join(&att.url);
                    attachment_path.to_string_lossy().to_string()
                })
                .collect();

            stored_messages.push(StoredMessage {
                id: idx as u64,
                original_id: msg.id.clone(),
                message_type: msg.message_type.clone(),
                timestamp,
                timestamp_edited: msg.timestamp_edited.clone(),
                call_ended_timestamp: msg.call_ended_timestamp.clone(),
                is_pinned: msg.is_pinned,
                content: msg.content.clone(),
                author: msg.author.clone(),
                attachments: msg.attachments.clone(),
                embeds: msg.embeds.clone(),
                stickers: msg.stickers.clone(),
                reactions: msg.reactions.clone(),
                mentions: msg.mentions.clone(),
                inline_emojis: msg.inline_emojis.clone(),
                media_refs,
                reference: msg.reference.clone(),
                referenced_message: None, // Will be populated in second pass
            });
        }

        // Second pass: populate referenced messages
        for i in 0..stored_messages.len() {
            if let Some(ref reference) = stored_messages[i].reference {
                // Find the referenced message by original_id
                if let Some(referenced) = stored_messages
                    .iter()
                    .find(|m| m.original_id == reference.message_id)
                {
                    stored_messages[i].referenced_message = Some(Box::new(referenced.clone()));
                }
            }
        }

        Ok(stored_messages)
    }

    fn parse_export(&self, path: &Path) -> io::Result<DiscordExport> {
        let contents = fs::read_to_string(path)?;
        serde_json::from_str(&contents).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
    }

    fn calculate_file_hash(&self, path: &Path) -> io::Result<String> {
        let mut file = fs::File::open(path)?;
        let mut contents = Vec::new();
        file.read_to_end(&mut contents)?;

        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        contents.hash(&mut hasher);
        let hash = hasher.finish();

        Ok(format!("{:x}", hash))
    }

    fn copy_attachments(&self, source: &Path, dest: &Path) -> io::Result<()> {
        fs::create_dir_all(dest)?;

        for entry in walkdir::WalkDir::new(source)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.is_file() {
                if let Ok(relative) = path.strip_prefix(source) {
                    let dest_path = dest.join(relative);
                    if let Some(parent) = dest_path.parent() {
                        fs::create_dir_all(parent)?;
                    }
                    fs::copy(path, dest_path)?;
                }
            }
        }

        Ok(())
    }

    pub fn get_export_path(&self, import_entry: &ImportEntry) -> PathBuf {
        PathBuf::from(&import_entry.import_path).join("export.json")
    }

    pub fn load_export(&self, import_id: &str) -> io::Result<DiscordExport> {
        let metadata = self.load_metadata()?;
        let import_entry = metadata
            .imports
            .iter()
            .find(|e| e.id == import_id)
            .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Import not found"))?;

        let export_path = self.get_export_path(import_entry);
        self.parse_export(&export_path)
    }

    pub fn delete_import(&self, import_id: &str) -> io::Result<()> {
        let mut metadata = self.load_metadata()?;

        if let Some(index) = metadata.imports.iter().position(|e| e.id == import_id) {
            let entry = metadata.imports.remove(index);

            // Delete the import directory
            let import_dir = PathBuf::from(&entry.import_path);
            if import_dir.exists() {
                fs::remove_dir_all(import_dir)?;
            }

            // Clean up cache for this import
            let cache_dir = self.sapper_dir.join("cache/parsed").join(import_id);
            if cache_dir.exists() {
                fs::remove_dir_all(cache_dir)?;
            }

            self.save_metadata(&metadata)?;
        }

        Ok(())
    }

    pub fn update_import_alias(&self, import_id: &str, new_alias: String) -> io::Result<()> {
        let mut metadata = self.load_metadata()?;

        if let Some(entry) = metadata.imports.iter_mut().find(|e| e.id == import_id) {
            entry.alias = new_alias;
            self.save_metadata(&metadata)?;
        } else {
            return Err(io::Error::new(io::ErrorKind::NotFound, "Import not found"));
        }

        Ok(())
    }

    // Extract unique members from export messages
    fn extract_members(&self, export: &DiscordExport) -> io::Result<MemberStorage> {
        use std::collections::HashMap;

        let mut members_map: HashMap<String, Member> = HashMap::new();

        for msg in &export.messages {
            let author_id = msg.author.id.clone();

            // Only add if we haven't seen this author before
            if !members_map.contains_key(&author_id) {
                members_map.insert(
                    author_id.clone(),
                    Member {
                        id: author_id,
                        name: msg.author.name.clone(),
                        discriminator: msg.author.discriminator.clone(),
                        nickname: msg.author.nickname.clone(),
                        avatar_url: msg.author.avatar_url.clone(),
                        color: msg.author.color.clone(),
                        is_bot: msg.author.is_bot,
                        roles: msg.author.roles.clone(),
                    },
                );
            }
        }

        let mut members: Vec<Member> = members_map.into_values().collect();
        // Sort by ID for consistency
        members.sort_by(|a, b| a.id.cmp(&b.id));

        Ok(MemberStorage { members })
    }

    // Save members to import directory
    fn save_members(&self, import_dir: &Path, members: &MemberStorage) -> io::Result<()> {
        let members_path = import_dir.join("members.json");
        let temp_path = import_dir.join("members.json.tmp");

        let contents = serde_json::to_string_pretty(members)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

        fs::write(&temp_path, contents)?;
        fs::rename(temp_path, members_path)?;

        Ok(())
    }

    // Load members from import directory
    pub fn load_members(&self, import_id: &str) -> io::Result<MemberStorage> {
        let metadata = self.load_metadata()?;
        let import_entry = metadata
            .imports
            .iter()
            .find(|e| e.id == import_id)
            .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Import not found"))?;

        let members_path = PathBuf::from(&import_entry.import_path).join("members.json");

        if !members_path.exists() {
            // If members.json doesn't exist (old imports), create it from the export
            let export = self.load_export(import_id)?;
            let members = self.extract_members(&export)?;
            self.save_members(&PathBuf::from(&import_entry.import_path), &members)?;
            return Ok(members);
        }

        let contents = fs::read_to_string(members_path)?;
        serde_json::from_str(&contents).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
    }

    // Update a specific member's information
    pub fn update_member(
        &self,
        import_id: &str,
        member_id: &str,
        nickname: Option<String>,
        avatar_url: Option<String>,
    ) -> io::Result<()> {
        let metadata = self.load_metadata()?;
        let import_entry = metadata
            .imports
            .iter()
            .find(|e| e.id == import_id)
            .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Import not found"))?;

        let import_dir = PathBuf::from(&import_entry.import_path);
        let mut members = self.load_members(import_id)?;

        if let Some(member) = members.members.iter_mut().find(|m| m.id == member_id) {
            if let Some(nick) = nickname {
                member.nickname = nick;
            }
            if let Some(avatar) = avatar_url {
                member.avatar_url = avatar;
            }
            self.save_members(&import_dir, &members)?;
            Ok(())
        } else {
            Err(io::Error::new(
                io::ErrorKind::NotFound,
                "Member not found",
            ))
        }
    }

    fn extract_avatar(
        &self,
        export: &DiscordExport,
        _import_id: &str,
        json_path: &Path,
        import_dir: &Path,
    ) -> io::Result<String> {
        let source_dir = json_path.parent().unwrap_or_else(|| Path::new("."));

        // Check if it's a DM (guild.id == "0")
        let avatar_source = if export.guild.id == "0" {
            // It's a DM - find the other user's avatar
            // The channel name is the other user's name
            // Check up to 50 messages to find a match
            let limit = 50.min(export.messages.len());
            if let Some(message) = export
                .messages
                .iter()
                .take(limit)
                .find(|m| m.author.nickname == export.channel.name)
            {
                Some(message.author.avatar_url.clone())
            } else {
                // Fallback: use first message's author avatar
                export.messages.first().map(|m| m.author.avatar_url.clone())
            }
        } else {
            // It's a server - use guild icon
            export.guild.icon_url.clone()
        };

        if let Some(avatar_url) = avatar_source {
            // Copy avatar to import directory
            let source_avatar_path = source_dir.join(&avatar_url);
            if source_avatar_path.exists() {
                // Get file extension
                let extension = source_avatar_path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("png");

                let dest_avatar = import_dir.join(format!("avatar.{}", extension));
                fs::copy(&source_avatar_path, &dest_avatar)?;

                return Ok(dest_avatar.to_string_lossy().to_string());
            }
        }

        // Return empty string if no avatar found
        Ok(String::new())
    }

    /// Export everything (all conversations + settings) to a directory
    pub fn export_all(&self, dest_path: &str) -> io::Result<()> {
        let dest = PathBuf::from(dest_path);
        fs::create_dir_all(&dest)?;

        // Copy metadata.json
        let metadata_path = self.sapper_dir.join("metadata.json");
        if metadata_path.exists() {
            fs::copy(&metadata_path, dest.join("metadata.json"))?;
        }

        // Copy config.json
        let config_path = self.sapper_dir.join("config.json");
        if config_path.exists() {
            fs::copy(&config_path, dest.join("config.json"))?;
        }

        // Copy all imports
        let imports_dir = self.sapper_dir.join("imports");
        if imports_dir.exists() {
            self.copy_directory(&imports_dir, &dest.join("imports"))?;
        }

        Ok(())
    }

    /// Export selected conversations to a directory
    pub fn export_selected(&self, dest_path: &str, import_ids: Vec<String>) -> io::Result<()> {
        let dest = PathBuf::from(dest_path);
        fs::create_dir_all(&dest)?;

        // Load current metadata
        let metadata = self.load_metadata()?;

        // Filter to only selected imports
        let selected_imports: Vec<ImportEntry> = metadata
            .imports
            .into_iter()
            .filter(|entry| import_ids.contains(&entry.id))
            .collect();

        // Create filtered metadata
        let filtered_metadata = ImportMetadata {
            imports: selected_imports.clone(),
        };

        // Save filtered metadata
        let metadata_json = serde_json::to_string_pretty(&filtered_metadata)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        fs::write(dest.join("metadata.json"), metadata_json)?;

        // Copy config.json
        let config_path = self.sapper_dir.join("config.json");
        if config_path.exists() {
            fs::copy(&config_path, dest.join("config.json"))?;
        }

        // Copy selected import directories
        let dest_imports = dest.join("imports");
        fs::create_dir_all(&dest_imports)?;

        for entry in selected_imports {
            let import_dir = PathBuf::from(&entry.import_path);
            if import_dir.exists() {
                let dest_import_dir = dest_imports.join(&entry.id);
                self.copy_directory(&import_dir, &dest_import_dir)?;
            }
        }

        Ok(())
    }

    /// Import backup (merge with existing data)
    pub fn import_backup(&self, source_path: &str) -> io::Result<()> {
        let source = PathBuf::from(source_path);

        // Validate backup structure
        if !source.join("metadata.json").exists() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "Invalid backup: missing metadata.json",
            ));
        }

        // Load source metadata
        let source_metadata_contents = fs::read_to_string(source.join("metadata.json"))?;
        let source_metadata: ImportMetadata = serde_json::from_str(&source_metadata_contents)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

        // Load current metadata
        let mut current_metadata = self.load_metadata()?;

        // Merge imports (avoid duplicates by file_hash)
        let existing_hashes: std::collections::HashSet<String> = current_metadata
            .imports
            .iter()
            .map(|e| e.file_hash.clone())
            .collect();

        for source_entry in source_metadata.imports {
            // Skip if already exists (same file hash)
            if existing_hashes.contains(&source_entry.file_hash) {
                continue;
            }

            // Generate new ID to avoid conflicts
            let new_id = Uuid::new_v4().to_string();
            let source_import_dir = source.join("imports").join(&source_entry.id);
            let dest_import_dir = self.sapper_dir.join("imports").join(&new_id);

            // Copy import directory
            if source_import_dir.exists() {
                self.copy_directory(&source_import_dir, &dest_import_dir)?;
            }

            // Create new entry with new ID and path
            let new_entry = ImportEntry {
                id: new_id.clone(),
                import_path: dest_import_dir.to_string_lossy().to_string(),
                ..source_entry
            };

            current_metadata.imports.push(new_entry);
        }

        // Save merged metadata
        self.save_metadata(&current_metadata)?;

        // Import config if it exists (don't overwrite, just merge)
        let source_config_path = source.join("config.json");
        if source_config_path.exists() {
            // For now, we'll skip config import to avoid overwriting user settings
            // Could be enhanced later to merge specific fields
        }

        Ok(())
    }

    /// Helper function to recursively copy a directory
    fn copy_directory(&self, src: &Path, dest: &Path) -> io::Result<()> {
        fs::create_dir_all(dest)?;

        for entry in walkdir::WalkDir::new(src)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if let Ok(relative) = path.strip_prefix(src) {
                let dest_path = dest.join(relative);

                if path.is_dir() {
                    fs::create_dir_all(&dest_path)?;
                } else if path.is_file() {
                    if let Some(parent) = dest_path.parent() {
                        fs::create_dir_all(parent)?;
                    }
                    fs::copy(path, dest_path)?;
                }
            }
        }

        Ok(())
    }

    /// Check for missing assets in a JSON export
    pub fn check_missing_assets(&self, json_path: &str) -> io::Result<Vec<String>> {
        let json_path_buf = PathBuf::from(json_path);
        let export_data = self.parse_export(&json_path_buf)?;
        let source_dir = json_path_buf.parent().unwrap_or_else(|| Path::new("."));

        let mut missing_assets = Vec::new();

        // Check guild icon
        if let Some(icon_url) = &export_data.guild.icon_url {
            let icon_path = source_dir.join(icon_url);
            if !icon_path.exists() {
                missing_assets.push(icon_url.clone());
            }
        }

        // Check message attachments and author avatars
        for message in &export_data.messages {
            // Check attachments
            for attachment in &message.attachments {
                let attachment_path = source_dir.join(&attachment.url);
                if !attachment_path.exists() {
                    missing_assets.push(attachment.url.clone());
                }
            }

            // Check author avatar
            let avatar_path = source_dir.join(&message.author.avatar_url);
            if !avatar_path.exists() && !missing_assets.contains(&message.author.avatar_url) {
                missing_assets.push(message.author.avatar_url.clone());
            }
        }

        Ok(missing_assets)
    }

    /// Copy assets from source folder to destination folder (where JSON is located)
    /// Returns (total_files, files_to_copy) for progress tracking
    pub fn count_files_to_copy(&self, source_folder: &str) -> io::Result<usize> {
        let source_folder_buf = PathBuf::from(source_folder);

        if !source_folder_buf.exists() {
            return Err(io::Error::new(
                io::ErrorKind::NotFound,
                "Source folder not found",
            ));
        }

        let mut file_count = 0;

        // Only count files in the immediate directory, not subdirectories
        for entry in fs::read_dir(&source_folder_buf)? {
            let entry = entry?;
            if entry.path().is_file() {
                file_count += 1;
            }
        }

        Ok(file_count)
    }

    /// Copy assets from source folder to destination folder (where JSON is located)
    pub fn copy_assets_to_json_dir(
        &self,
        json_path: &str,
        source_folder: &str,
        progress_callback: impl Fn(usize, usize, &str),
    ) -> io::Result<usize> {
        let json_path_buf = PathBuf::from(json_path);
        let source_folder_buf = PathBuf::from(source_folder);
        let dest_dir = json_path_buf
            .parent()
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "Invalid JSON path"))?;

        if !source_folder_buf.exists() {
            return Err(io::Error::new(
                io::ErrorKind::NotFound,
                "Source folder not found",
            ));
        }

        // First, count total files
        let total_files = self.count_files_to_copy(source_folder)?;
        let mut copied_count = 0;

        // Copy only files from the immediate directory (not subdirectories)
        for entry in fs::read_dir(&source_folder_buf)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_file() {
                // Get filename for progress display
                let filename = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown");

                // Copy directly to destination directory
                let dest_path = dest_dir.join(filename);

                // Copy the file
                fs::copy(&path, &dest_path)?;
                copied_count += 1;

                // Report progress with filename
                progress_callback(copied_count, total_files, filename);
            }
        }

        Ok(copied_count)
    }
}
