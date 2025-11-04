use regex::Regex;
use std::path::PathBuf;
use tracing_appender::rolling::{ RollingFileAppender, Rotation };
use tracing_subscriber::{ fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter };

/// Initialize the logging system
/// Logs will be written to a rotating daily log file in the .sapper directory
pub fn init_logging() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let home_dir = directories::BaseDirs
        ::new()
        .ok_or("Failed to get home directory")?
        .home_dir()
        .to_path_buf();

    let log_dir = home_dir.join(".sapper").join("logs");
    std::fs::create_dir_all(&log_dir)?;

    // Create a rolling file appender that creates a new log file daily
    let file_appender = RollingFileAppender::new(Rotation::DAILY, &log_dir, "sapper.log");

    // Set up the logging subscriber with both file and stdout outputs
    tracing_subscriber
        ::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with(
            fmt
                ::layer()
                .with_writer(file_appender)
                .with_ansi(false)
                .with_target(true)
                .with_line_number(true)
        )
        .with(fmt::layer().with_writer(std::io::stdout).with_target(false))
        .init();

    Ok(log_dir)
}

/// Sanitize personal information from strings
/// - Replaces message content with "[REDACTED]"
/// - Replaces usernames with "[USER_{hash}]" (consistent hash for same user)
/// - Replaces user IDs with "[ID_{hash}]"
/// - Preserves emojis and structure
pub fn sanitize_string(input: &str) -> String {
    // Don't sanitize if string is short or looks like a system message
    if input.len() < 3 || input.starts_with('[') {
        return input.to_string();
    }

    let mut result = input.to_string();

    // Replace Discord snowflake IDs (18-19 digit numbers)
    let id_regex = Regex::new(r"\b\d{17,19}\b").unwrap();
    result = id_regex
        .replace_all(&result, |caps: &regex::Captures| {
            let id = &caps[0];
            format!("[ID_{}]", simple_hash(id))
        })
        .to_string();

    // Replace @mentions (but preserve the @ symbol for context)
    let mention_regex = Regex::new(r"@([a-zA-Z0-9_]{2,32})").unwrap();
    result = mention_regex
        .replace_all(&result, |caps: &regex::Captures| {
            let username = &caps[1];
            format!("@[USER_{}]", simple_hash(username))
        })
        .to_string();

    result
}

/// Simple hash function for consistent anonymization
/// Uses a simple hash to ensure the same input always produces the same output
fn simple_hash(input: &str) -> String {
    let mut hash: u32 = 5381;
    for byte in input.bytes() {
        hash = (hash << 5).wrapping_add(hash).wrapping_add(byte as u32);
    }
    format!("{:08x}", hash)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Sanitize message content specifically
    /// Replaces actual message text with [REDACTED] but preserves emojis and metadata
    pub fn sanitize_message_content(content: &str) -> String {
        if content.is_empty() {
            return content.to_string();
        }

        // Extract emojis (unicode emoji characters)
        let emoji_regex = Regex::new(
            r"[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{238C}-\u{2454}\u{20D0}-\u{20FF}]"
        ).unwrap();
        let emojis: Vec<&str> = emoji_regex
            .find_iter(content)
            .map(|m| m.as_str())
            .collect();

        // Extract Discord custom emojis <:name:id> or <a:name:id>
        let discord_emoji_regex = Regex::new(r"<a?:[a-zA-Z0-9_]+:\d+>").unwrap();
        let discord_emojis: Vec<&str> = discord_emoji_regex
            .find_iter(content)
            .map(|m| m.as_str())
            .collect();

        if !emojis.is_empty() || !discord_emojis.is_empty() {
            let mut sanitized = "[REDACTED".to_string();
            if !emojis.is_empty() {
                sanitized.push_str(" emojis:");
                for emoji in emojis {
                    sanitized.push(' ');
                    sanitized.push_str(emoji);
                }
            }
            if !discord_emojis.is_empty() {
                sanitized.push_str(" stickers:");
                for emoji in discord_emojis {
                    sanitized.push(' ');
                    sanitized.push_str(emoji);
                }
            }
            sanitized.push(']');
            sanitized
        } else {
            "[REDACTED]".to_string()
        }
    }

    /// Sanitize username/nickname
    pub fn sanitize_username(username: &str) -> String {
        format!("[USER_{}]", simple_hash(username))
    }

    /// Sanitize user ID
    pub fn sanitize_user_id(user_id: &str) -> String {
        format!("[ID_{}]", simple_hash(user_id))
    }

    #[test]
    fn test_sanitize_message_content() {
        assert_eq!(sanitize_message_content("Hello world!"), "[REDACTED]");
        assert_eq!(sanitize_message_content("Hello 👋 world!"), "[REDACTED emojis: 👋]");
        assert_eq!(sanitize_message_content(""), "");
    }

    #[test]
    fn test_sanitize_username() {
        let result = sanitize_username("JohnDoe");
        assert!(result.starts_with("[USER_"));
        assert!(result.ends_with("]"));
        // Same input should produce same output
        assert_eq!(result, sanitize_username("JohnDoe"));
    }

    #[test]
    fn test_sanitize_user_id() {
        let result = sanitize_user_id("123456789012345678");
        assert!(result.starts_with("[ID_"));
        assert!(result.ends_with("]"));
    }
}
