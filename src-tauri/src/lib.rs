mod message_storage;
mod models;
mod sapper_core;
mod search;
mod logger;

use message_storage::StoredMessage;
use models::*;
use sapper_core::SapperCore;
use std::sync::Mutex;
use std::path::PathBuf;
use tauri::{State, Window, Emitter};
use tracing::{info, error, warn, debug};

// Global state for SapperCore
struct AppState {
    core: Mutex<Option<SapperCore>>,
    log_dir: PathBuf,
}

#[tauri::command]
fn init_sapper(state: State<AppState>) -> Result<(), String> {
    info!("Initializing Sapper");
    let core = SapperCore::new().map_err(|e| {
        error!("Failed to initialize SapperCore: {}", e);
        e.to_string()
    })?;
    *state.core.lock().unwrap() = Some(core);
    info!("Sapper initialized successfully");
    Ok(())
}

#[tauri::command]
fn get_imports(state: State<AppState>) -> Result<Vec<ImportEntry>, String> {
    debug!("Getting imports list");
    let core_lock = state.core.lock().unwrap();
    let core = core_lock.as_ref().ok_or("SapperCore not initialized")?;

    let metadata = core.load_metadata().map_err(|e| {
        error!("Failed to load metadata: {}", e);
        e.to_string()
    })?;
    info!("Retrieved {} imports", metadata.imports.len());
    Ok(metadata.imports)
}

#[tauri::command]
fn import_conversation(
    state: State<AppState>,
    path: String,
    alias: Option<String>,
) -> Result<ImportEntry, String> {
    info!("Importing conversation from path: {}", logger::sanitize_string(&path));
    if let Some(ref a) = alias {
        debug!("Using alias: {}", logger::sanitize_string(a));
    }

    let core_lock = state.core.lock().unwrap();
    let core = core_lock.as_ref().ok_or("SapperCore not initialized")?;

    let result = core.import_conversation(&path, alias)
        .map_err(|e| {
            error!("Failed to import conversation: {}", e);
            e.to_string()
        })?;

    info!("Successfully imported conversation with ID: {}", logger::sanitize_string(&result.id));
    Ok(result)
}

#[tauri::command]
fn load_conversation(state: State<AppState>, import_id: String) -> Result<DiscordExport, String> {
    info!("Loading conversation with ID: {}", logger::sanitize_string(&import_id));
    let core_lock = state.core.lock().unwrap();
    let core = core_lock.as_ref().ok_or("SapperCore not initialized")?;

    core.load_export(&import_id).map_err(|e| {
        error!("Failed to load conversation {}: {}", logger::sanitize_string(&import_id), e);
        e.to_string()
    })
}

#[tauri::command]
fn delete_import(state: State<AppState>, import_id: String) -> Result<(), String> {
    info!("Deleting import with ID: {}", logger::sanitize_string(&import_id));
    let core_lock = state.core.lock().unwrap();
    let core = core_lock.as_ref().ok_or("SapperCore not initialized")?;

    core.delete_import(&import_id).map_err(|e| {
        error!("Failed to delete import {}: {}", logger::sanitize_string(&import_id), e);
        e.to_string()
    })
}

#[tauri::command]
fn update_import(state: State<AppState>, import_id: String, alias: String) -> Result<(), String> {
    info!("Updating import {} with new alias", logger::sanitize_string(&import_id));
    let core_lock = state.core.lock().unwrap();
    let core = core_lock.as_ref().ok_or("SapperCore not initialized")?;

    core.update_import_alias(&import_id, alias)
        .map_err(|e| {
            error!("Failed to update import {}: {}", logger::sanitize_string(&import_id), e);
            e.to_string()
        })
}

#[tauri::command]
fn get_config(state: State<AppState>) -> Result<AppConfig, String> {
    let core_lock = state.core.lock().unwrap();
    let core = core_lock.as_ref().ok_or("SapperCore not initialized")?;

    core.load_config().map_err(|e| e.to_string())
}

#[tauri::command]
fn update_config(state: State<AppState>, config: AppConfig) -> Result<(), String> {
    let core_lock = state.core.lock().unwrap();
    let core = core_lock.as_ref().ok_or("SapperCore not initialized")?;

    core.save_config(&config).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_messages(
    state: State<AppState>,
    import_id: String,
    start_index: usize,
    count: usize,
) -> Result<Vec<StoredMessage>, String> {
    use std::path::PathBuf;

    debug!("Loading messages for import {} (start: {}, count: {})",
           logger::sanitize_string(&import_id), start_index, count);

    let core_lock = state.core.lock().unwrap();
    let core = core_lock.as_ref().ok_or("SapperCore not initialized")?;

    let metadata = core.load_metadata().map_err(|e| {
        error!("Failed to load metadata: {}", e);
        e.to_string()
    })?;
    let import_entry = metadata
        .imports
        .iter()
        .find(|e| e.id == import_id)
        .ok_or_else(|| {
            error!("Import not found: {}", logger::sanitize_string(&import_id));
            "Import not found".to_string()
        })?;

    let import_dir = PathBuf::from(&import_entry.import_path);
    let storage = message_storage::MessageStorage::new(import_dir);

    let result = storage
        .load_messages_range(start_index, count)
        .map_err(|e| {
            error!("Failed to load messages for {}: {}", logger::sanitize_string(&import_id), e);
            e.to_string()
        })?;

    debug!("Successfully loaded {} messages", result.len());
    Ok(result)
}

#[tauri::command]
fn search_messages(
    state: State<AppState>,
    import_id: String,
    query: String,
    limit: usize,
) -> Result<Vec<u64>, String> {
    use std::path::PathBuf;

    info!("Searching messages in {} with query (sanitized): {} (limit: {})",
          logger::sanitize_string(&import_id), logger::sanitize_string(&query), limit);

    let core_lock = state.core.lock().unwrap();
    let core = core_lock.as_ref().ok_or("SapperCore not initialized")?;

    let metadata = core.load_metadata().map_err(|e| {
        error!("Failed to load metadata: {}", e);
        e.to_string()
    })?;
    let import_entry = metadata
        .imports
        .iter()
        .find(|e| e.id == import_id)
        .ok_or_else(|| {
            error!("Import not found: {}", logger::sanitize_string(&import_id));
            "Import not found".to_string()
        })?;

    let import_dir = PathBuf::from(&import_entry.import_path);
    let index_dir = import_dir.join("search_index");

    let search_index = search::MessageSearchIndex::open(&index_dir).map_err(|e| {
        error!("Failed to open search index: {}", e);
        e.to_string()
    })?;

    let result = search_index
        .search(&query, limit)
        .map_err(|e| {
            error!("Search failed: {}", e);
            e.to_string()
        })?;

    info!("Search returned {} results", result.len());
    Ok(result)
}

#[tauri::command]
fn get_total_message_count(state: State<AppState>, import_id: String) -> Result<usize, String> {
    use std::path::PathBuf;

    let core_lock = state.core.lock().unwrap();
    let core = core_lock.as_ref().ok_or("SapperCore not initialized")?;

    let metadata = core.load_metadata().map_err(|e| e.to_string())?;
    let import_entry = metadata
        .imports
        .iter()
        .find(|e| e.id == import_id)
        .ok_or("Import not found")?;

    let import_dir = PathBuf::from(&import_entry.import_path);
    let storage = message_storage::MessageStorage::new(import_dir);

    let index = storage.load_chunk_index().map_err(|e| e.to_string())?;
    Ok(index.total_messages)
}

#[tauri::command]
fn get_import_path(state: State<AppState>, import_id: String) -> Result<String, String> {
    let core_lock = state.core.lock().unwrap();
    let core = core_lock.as_ref().ok_or("SapperCore not initialized")?;

    let metadata = core.load_metadata().map_err(|e| e.to_string())?;
    let import_entry = metadata
        .imports
        .iter()
        .find(|e| e.id == import_id)
        .ok_or("Import not found")?;

    Ok(import_entry.import_path.clone())
}

#[tauri::command]
fn get_conversation_info(state: State<AppState>, import_id: String) -> Result<ImportEntry, String> {
    let core_lock = state.core.lock().unwrap();
    let core = core_lock.as_ref().ok_or("SapperCore not initialized")?;

    let metadata = core.load_metadata().map_err(|e| e.to_string())?;
    let import_entry = metadata
        .imports
        .iter()
        .find(|e| e.id == import_id)
        .ok_or("Import not found")?;

    Ok(import_entry.clone())
}

#[tauri::command]
fn get_log_directory(state: State<AppState>) -> Result<String, String> {
    info!("Getting log directory path");
    Ok(state.log_dir.to_string_lossy().to_string())
}

#[tauri::command]
fn log_frontend_error(message: String) {
    error!("[FRONTEND] {}", logger::sanitize_string(&message));
}

#[tauri::command]
fn log_frontend_warning(message: String) {
    warn!("[FRONTEND] {}", logger::sanitize_string(&message));
}

#[tauri::command]
fn log_frontend_info(message: String) {
    info!("[FRONTEND] {}", logger::sanitize_string(&message));
}

#[tauri::command]
fn export_all_conversations(state: State<AppState>, dest_path: String) -> Result<(), String> {
    info!("Exporting all conversations to: {}", logger::sanitize_string(&dest_path));
    let core_lock = state.core.lock().unwrap();
    let core = core_lock.as_ref().ok_or("SapperCore not initialized")?;

    core.export_all(&dest_path).map_err(|e| {
        error!("Failed to export all conversations: {}", e);
        e.to_string()
    })?;

    info!("Successfully exported all conversations");
    Ok(())
}

#[tauri::command]
fn export_selected_conversations(
    state: State<AppState>,
    dest_path: String,
    import_ids: Vec<String>,
) -> Result<(), String> {
    info!(
        "Exporting {} selected conversations to: {}",
        import_ids.len(),
        logger::sanitize_string(&dest_path)
    );
    let core_lock = state.core.lock().unwrap();
    let core = core_lock.as_ref().ok_or("SapperCore not initialized")?;

    core.export_selected(&dest_path, import_ids).map_err(|e| {
        error!("Failed to export selected conversations: {}", e);
        e.to_string()
    })?;

    info!("Successfully exported selected conversations");
    Ok(())
}

#[tauri::command]
fn import_backup(state: State<AppState>, source_path: String) -> Result<usize, String> {
    info!("Importing backup from: {}", logger::sanitize_string(&source_path));
    let core_lock = state.core.lock().unwrap();
    let core = core_lock.as_ref().ok_or("SapperCore not initialized")?;

    // Get count before import
    let metadata_before = core.load_metadata().map_err(|e| e.to_string())?;
    let count_before = metadata_before.imports.len();

    core.import_backup(&source_path).map_err(|e| {
        error!("Failed to import backup: {}", e);
        e.to_string()
    })?;

    // Get count after import
    let metadata_after = core.load_metadata().map_err(|e| e.to_string())?;
    let count_after = metadata_after.imports.len();
    let imported_count = count_after - count_before;

    info!("Successfully imported {} new conversations", imported_count);
    Ok(imported_count)
}

#[tauri::command]
fn check_missing_assets(state: State<AppState>, json_path: String) -> Result<Vec<String>, String> {
    info!("Checking for missing assets in: {}", logger::sanitize_string(&json_path));
    let core_lock = state.core.lock().unwrap();
    let core = core_lock.as_ref().ok_or("SapperCore not initialized")?;

    let missing = core.check_missing_assets(&json_path).map_err(|e| {
        error!("Failed to check missing assets: {}", e);
        e.to_string()
    })?;

    info!("Found {} missing assets", missing.len());
    Ok(missing)
}

#[tauri::command]
async fn copy_assets_to_json_dir(
    window: Window,
    json_path: String,
    source_folder: String,
) -> Result<usize, String> {
    info!(
        "Copying assets from {} to JSON directory",
        logger::sanitize_string(&source_folder)
    );

    // Run the blocking operation in a separate thread
    let result = tokio::task::spawn_blocking(move || {
        // Create a new SapperCore instance (it's cheap, just holds the sapper_dir path)
        let core = SapperCore::new().map_err(|e| e.to_string())?;

        // Perform the copy with progress callbacks
        core.copy_assets_to_json_dir(&json_path, &source_folder, move |current, total, filename| {
            // Emit progress event with filename
            let _ = window.emit("copy-progress", serde_json::json!({
                "current": current,
                "total": total,
                "filename": filename,
            }));
        })
        .map_err(|e| {
            error!("Failed to copy assets: {}", e);
            e.to_string()
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    info!("Copied {} assets", result);
    Ok(result)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging first
    let log_dir = logger::init_logging()
        .unwrap_or_else(|e| {
            eprintln!("Failed to initialize logging: {}", e);
            std::path::PathBuf::from(".")
        });

    info!("Sapper application starting");
    info!("Log directory: {}", log_dir.display());

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            core: Mutex::new(None),
            log_dir,
        })
        .invoke_handler(tauri::generate_handler![
            init_sapper,
            get_imports,
            import_conversation,
            load_conversation,
            delete_import,
            update_import,
            get_config,
            update_config,
            load_messages,
            search_messages,
            get_total_message_count,
            get_import_path,
            get_conversation_info,
            get_log_directory,
            log_frontend_error,
            log_frontend_warning,
            log_frontend_info,
            export_all_conversations,
            export_selected_conversations,
            import_backup,
            check_missing_assets,
            copy_assets_to_json_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
