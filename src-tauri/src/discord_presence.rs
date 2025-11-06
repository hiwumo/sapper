use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::{Arc, Mutex};
use tracing::{error, info, warn};

pub struct DiscordPresence {
    client: Arc<Mutex<Option<DiscordIpcClient>>>,
}

impl DiscordPresence {
    pub fn new() -> Self {
        Self {
            client: Arc::new(Mutex::new(None)),
        }
    }

    /// Initialize and connect to Discord
    pub fn connect(&self) {
        let client = self.client.clone();

        // Spawn a thread to handle Discord connection (non-blocking)
        std::thread::spawn(move || {
            let client_id = "1436027714690744582";

            let mut discord_client = DiscordIpcClient::new(client_id);

            match discord_client.connect() {
                Ok(_) => {
                    info!("Successfully connected to Discord Rich Presence");

                    // Set initial activity
                    let activity = activity::Activity::new()
                        .state("Playing Sapper");

                    if let Err(e) = discord_client.set_activity(activity) {
                        error!("Failed to set Discord activity: {}", e);
                    } else {
                        info!("Discord Rich Presence activity set");
                    }

                    // Store the client
                    *client.lock().unwrap() = Some(discord_client);
                }
                Err(e) => {
                    warn!("Failed to connect to Discord: {}. Discord may not be running.", e);
                }
            }
        });
    }

    /// Update the activity to show "Reading a Conversation"
    pub fn set_reading_conversation(&self, conversation_name: Option<&str>) {
        if let Some(ref mut client) = *self.client.lock().unwrap() {
            let mut activity = activity::Activity::new()
                .state("Reading a Conversation");

            if let Some(name) = conversation_name {
                activity = activity.details(name);
            }

            if let Err(e) = client.set_activity(activity) {
                error!("Failed to update Discord activity: {}", e);
            }
        }
    }

    /// Update the activity back to "Playing Sapper"
    pub fn set_idle(&self) {
        if let Some(ref mut client) = *self.client.lock().unwrap() {
            let activity = activity::Activity::new()
                .state("Playing Sapper");

            if let Err(e) = client.set_activity(activity) {
                error!("Failed to update Discord activity: {}", e);
            }
        }
    }

    /// Clear the activity
    pub fn clear(&self) {
        if let Some(ref mut client) = *self.client.lock().unwrap() {
            if let Err(e) = client.clear_activity() {
                error!("Failed to clear Discord activity: {}", e);
            }
        }
    }
}

impl Drop for DiscordPresence {
    fn drop(&mut self) {
        if let Some(ref mut client) = *self.client.lock().unwrap() {
            let _ = client.close();
        }
    }
}
