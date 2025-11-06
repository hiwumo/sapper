# Release Process

This document describes how to create and publish releases for Sapper with auto-update support.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Steps](#detailed-steps)
- [Build Types](#build-types)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### 1. Signing Key Setup

Auto-updates require code signing. You need a Tauri signing key pair.

**Generate a new signing key:**
```bash
npm run tauri signer generate -- -w ~/.tauri/sapper.key
```

This creates two files:
- `~/.tauri/sapper.key` - Your **private key** (keep this secret!)
- `~/.tauri/sapper.key.pub` - Your **public key**

**Important:**
- Never commit the private key to git
- Store the private key securely (e.g., password manager)
- If you lose the private key, existing app installations won't be able to auto-update

### 2. Environment Configuration

Create a `.env` file in your project root:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` and add your signing key:

```env
TAURI_SIGNING_PRIVATE_KEY=dW50cnVzdGVkIGNvbW1lbnQ6...your_full_private_key_here

# Optional: Add password if your key is encrypted
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=your_password
```

**Get your private key content:**
```bash
# On Windows (PowerShell)
Get-Content ~/.tauri/sapper.key

# On Linux/Mac
cat ~/.tauri/sapper.key
```

Copy the entire output (including the "untrusted comment" line) into your `.env` file.

### 3. Update the Public Key in Config

Copy your public key to `tauri.conf.json`:

```bash
# On Windows (PowerShell)
$pubkey = Get-Content ~/.tauri/sapper.key.pub -Raw
# Then manually copy to tauri.conf.json

# On Linux/Mac
cat ~/.tauri/sapper.key.pub
```

Update `src-tauri/tauri.conf.json`:
```json
{
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6...your_public_key_here"
    }
  }
}
```

### 4. GitHub CLI (Optional, for automated releases)

Install GitHub CLI from: https://cli.github.com/

Authenticate:
```bash
gh auth login
```

## Quick Start

```bash
# 1. Verify environment
make check-env

# 2. Check current version
make version

# 3. Choose your release method:

# Option A: Build and update manifest (manual GitHub upload)
make release

# Option B: Fully automated (build, manifest, GitHub release)
make release-full
```

## Detailed Steps

### Step 1: Update Version

Edit `src-tauri/tauri.conf.json`:
```json
{
  "version": "0.3.0"
}
```

Also update `package.json`:
```json
{
  "version": "0.3.0"
}
```

**Tip:** Keep both version numbers in sync!

### Step 2: Build and Sign

#### Method 1: Using Make (Recommended)

```bash
# Full automated release (easiest!)
make release-full
```

This will:
1. Build the signed installer
2. Generate `.sig` signature file
3. Create `update-manifest.json`
4. Create GitHub release with installer + signature
5. Commit and push the manifest

**Or build without GitHub upload:**

```bash
# Just build and create manifest
make release
```

This builds everything but doesn't create the GitHub release, giving you more control.

#### Method 2: Manual Build

```bash
# Load environment variables and build (PowerShell)
Get-Content .env | ForEach-Object { if ($_ -match '^([^#][^=]+)=(.*)$') { $name = $matches[1].Trim(); $value = $matches[2].Trim(); [Environment]::SetEnvironmentVariable($name, $value, 'Process') } }
npm run tauri build
```

Files will be in: `src-tauri/target/release/bundle/nsis/`

### Step 3: Verify Build Artifacts

You should have:
- `sapper_0.3.0_x64-setup.exe` - The installer
- `sapper_0.3.0_x64-setup.exe.sig` - The signature (critical for updates!)

**Check signature file:**
```powershell
Get-Content src-tauri/target/release/bundle/nsis/sapper_0.3.0_x64-setup.exe.sig
```

Should contain a base64-encoded signature starting with "dW50cnVzdGVkIGNvbW1lbnQ6..."

### Step 4: Create GitHub Release

#### Using GitHub CLI (Automated)

Already done if you used `make release-full`!

#### Manual via GitHub Web UI

1. Go to https://github.com/yourusername/sapper/releases/new
2. Tag: `v0.3.0`
3. Title: `Release 0.3.0`
4. Upload both files:
   - `sapper_0.3.0_x64-setup.exe`
   - `sapper_0.3.0_x64-setup.exe.sig`
5. Publish release

### Step 5: Update and Commit Manifest

The `update-manifest.json` file tells existing installations about new versions.

**Structure:**
```json
{
  "version": "0.3.0",
  "notes": "Bug fixes and improvements",
  "pub_date": "2024-01-15T10:30:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6...",
      "url": "https://github.com/yourusername/sapper/releases/download/v0.3.0/sapper_0.3.0_x64-setup.exe"
    }
  }
}
```

**Commit and push:**
```bash
git add update-manifest.json
git commit -m "Update manifest for v0.3.0"
git push
```

### Step 6: Verify Update Works

1. Install the previous version of the app
2. Run it
3. The app should detect and prompt for the update
4. Click "Update" and verify it installs correctly

**Check manifest is accessible:**
```
https://raw.githubusercontent.com/yourusername/sapper/main/update-manifest.json
```

## Build Types

### Unsigned Build (Development/Testing)

```bash
make build-unsigned
```

**Characteristics:**
- Fast build
- No signing key required
- **Cannot auto-update**
- Good for testing UI/features

**Use when:**
- Testing features locally
- Sharing with testers who don't need updates
- Quick iteration during development

### Signed Build (Production)

```bash
make build-signed
# or
make release
```

**Characteristics:**
- Requires signing key
- Generates `.sig` file
- **Supports auto-updates**
- Required for public releases

**Use when:**
- Creating public releases
- Distributing to end users
- Need auto-update functionality

## Makefile Reference

```bash
make help           # Show all available commands
make version        # Show current version from tauri.conf.json
make install        # Install dependencies
make dev            # Run dev server
make build-unsigned # Build unsigned (no updates)
make build-signed   # Build signed (with updates)
make release        # Build + update manifest
make release-full   # Build + manifest + GitHub release
make clean          # Clean build artifacts
make check-env      # Verify environment setup
```

**Note:** All commands use inline PowerShell where needed - no external scripts required!

## Troubleshooting

### "TAURI_SIGNING_PRIVATE_KEY not set"

**Solution:** Create `.env` file with your signing key:
```bash
cp .env.example .env
# Edit .env and add your key
```

### ".sig file not found"

**Cause:** Build wasn't signed properly.

**Solution:**
1. Verify `.env` has `TAURI_SIGNING_PRIVATE_KEY`
2. Check `tauri.conf.json` has `"createUpdaterArtifacts": true`
3. Rebuild with `make build-signed`

### "Updates not working"

**Checklist:**
1. Is `update-manifest.json` accessible at the URL in `tauri.conf.json`?
2. Does the manifest have the correct signature from the `.sig` file?
3. Does the installer URL in manifest match the GitHub release URL?
4. Is the public key in `tauri.conf.json` correct?
5. Is the version in manifest higher than the installed version?

### "Signature verification failed"

**Cause:** Public/private key mismatch.

**Solution:**
1. Regenerate both keys
2. Update public key in `tauri.conf.json`
3. Update private key in `.env`
4. Rebuild and create new release

### "GitHub CLI not found"

**Solution:**
```bash
# Install from: https://cli.github.com/
# Then authenticate:
gh auth login
```

Or use `make release` instead (manual GitHub upload).

## Security Best Practices

1. **Never commit private key** - Add `.env` to `.gitignore`
2. **Store private key securely** - Use password manager or secure vault
3. **Backup private key** - Store encrypted backup in safe location
4. **Use strong passwords** - If encrypting the key file
5. **Rotate keys periodically** - Consider key rotation policy

## Additional Resources

- [Tauri Updater Documentation](https://v2.tauri.app/plugin/updater/)
- [Code Signing Best Practices](https://v2.tauri.app/distribute/sign/)
- [GitHub CLI Documentation](https://cli.github.com/manual/)

## Release Checklist

- [ ] Version updated in `tauri.conf.json`
- [ ] Version updated in `package.json`
- [ ] `.env` file has signing key
- [ ] Run `make check-env` passes
- [ ] Build with `make release-full` or `make release`
- [ ] GitHub release created with .exe and .sig files
- [ ] `update-manifest.json` committed and pushed
- [ ] Manifest accessible at public URL
- [ ] Tested update on previous version
- [ ] Release notes written
