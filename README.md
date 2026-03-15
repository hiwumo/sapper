# Sapper

A desktop application for viewing and managing Discord conversation exports. Built with Tauri, React, and Rust.

## Overview

A fast, searchable interface for [exported Discord Chats](https://github.com/Tyrrrz/DiscordChatExporter) if you're looking for a simple way to keep and manage memories.

The design for this app promises to:
1. Never touch or modify your chats -- even if it messes up, the originals stay intact
2. Keep copies of your chats and assets
3. Be easy to use -- similar to Discord itself!

## Setup

Simply go to [releases](https://github.com/hiwumo/sapper/releases) and download the latest version! Currently only Windows 10/11 is supported.

**Latest version right now**: [v0.4.0](https://github.com/hiwumo/sapper/releases/download/v0.4.0/sapper_0.4.0_x64-setup.exe)

## Usage

> [!NOTE] 
> The app has a built-in guide! Click on the question mark on the top-left for an in-depth explanation for everything.

1. Export a conversation from Discord using Discord Chat Exporter
2. Click "Import Conversation" in Sapper
3. Select the exported JSON file
4. If assets are missing, you'll be prompted to select the folder containing them
5. The conversation will be processed and indexed for searching

## Installation (for nerds)

### Prerequisites

- Node.js 18 or later
- Rust 1.70 or later
- npm or yarn

### Build from Source

1. Clone the repository
```bash
git clone https://github.com/yourusername/sapper.git
cd sapper
```

2. Install dependencies
```bash
make install
# or: npm install
```

3. Run in development mode
```bash
make dev
# or: npm run tauri dev
```

4. Build for production

**Option A: Unsigned build (for testing)**
```bash
make build-unsigned
```
This creates a quick unsigned build in `src-tauri/target/release/bundle/`. Unsigned builds do NOT support auto-updates.

**Option B: Signed build (for distribution)**
```bash
make build-signed
```
This creates a signed build with auto-update support. Requires signing key setup (see below).

The compiled application will be in `src-tauri/target/release/bundle/nsis/`.

### Creating Releases

For detailed release instructions, see [RELEASE.md](RELEASE.md).

**Prerequisites:**
1. Copy `.env.example` to `.env`
2. Add your Tauri signing key to `.env` (see [RELEASE.md](RELEASE.md) for key generation)

**Quick release commands:**

```bash
# Build signed app and update manifest
make release

# Build, update manifest, AND create GitHub release (requires gh CLI)
make release-full
```

**Other useful commands:**
```bash
make help          # Show all available commands
make check-env     # Verify your environment is set up correctly
make clean         # Remove build artifacts
```

The app includes automatic update functionality - users will be notified when new versions are available.

## Data Storage

Sapper stores all data in `~/.sapper/`:

```
~/.sapper/
├── data/
│   ├── metadata.json          # List of imported conversations
│   ├── config.json            # Application settings
│   └── imports/
│       └── [import-id]/
│           ├── export.json    # Original Discord export
│           ├── chunks/        # Optimized message storage
│           └── search_index/  # Full-text search index
└── logs/
    └── sapper.log            # Application logs (rotated daily)
```

Application settings are stored in `~/.sapper/data/config.json`:

```json
{
  "theme": "default",
  "search_limit": 100,
  "chunk_size": 1000
}
```

Modify through Settings UI or edit the file directly (requires app restart).

## Privacy

Sapper operates entirely locally. No data is transmitted to external servers. Log files sanitize personal information while maintaining debugging utility.

Thanks to Claude for this README ^-^

> [!WARNING] 
> Versions v0.3.1 and earlier have been pulled (security reasons). Make sure to keep Sapper up to date!
