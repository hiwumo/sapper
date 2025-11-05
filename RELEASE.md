# Release Process

This document describes how to create and publish releases for Sapper.

## Prerequisites

1. **Signing Key**: You need a Tauri signing key pair
   - Generate one: `npm run tauri signer generate -- -w ~/.tauri/myapp.key`
   - Set the key path in `.env` file (see `.env.example`)

2. **Environment Variables**:
   ```
   TAURI_SIGNING_PRIVATE_KEY=path/to/your/signing.key
   TAURI_SIGNING_PRIVATE_KEY_PASSWORD=your_password (optional)
   ```

3. **GitHub CLI** (optional, for automated GitHub releases):
   - Install from: https://cli.github.com/
   - Authenticate: `gh auth login`

## Release Methods

### Method 1: Fully Automated (Recommended)

Create a release with automatic GitHub upload and manifest update:

```bash
make release-github
```

This will:
1. Build and sign the installer
2. Find the generated `.exe` and `.sig` files
3. Update `update-manifest.json` with the signature
4. Create a GitHub release with the installer attached
5. Commit and push the updated manifest

### Method 2: Semi-Automated

Build, sign, and update manifest locally (no GitHub upload):

```bash
make release-auto
```

Then manually:
1. Create GitHub release and upload the files shown in output
2. Commit and push `update-manifest.json`

### Method 3: Manual (Original)

Build with signing only:

```bash
make release
```

Then manually:
1. Find files in `src-tauri/target/release/bundle/nsis/`
2. Run the manifest helper script:
   ```powershell
   .\scripts\update-manifest-helper.ps1 `
     -Version "0.2.0" `
     -SigFile "src-tauri\target\release\bundle\nsis\sapper_0.2.0_x64-setup.exe.sig" `
     -ExeUrl "https://github.com/hiwumo/sapper/releases/download/v0.2.0/sapper_0.2.0_x64-setup.exe"
   ```
3. Create GitHub release and upload files
4. Commit and push manifest

## Advanced Options

The release script supports additional parameters:

```powershell
# Specify version and release notes
.\scripts\release.ps1 -Version "0.3.0" -Notes "Added new features"

# Skip build (use existing artifacts)
.\scripts\release.ps1 -SkipBuild

# Create GitHub release
.\scripts\release.ps1 -CreateGitHubRelease
```

## Version Management

The version is managed in `src-tauri/tauri.conf.json`:

```json
{
  "version": "0.2.0",
  ...
}
```

Update this before running `make release-auto` or `make release-github`.

## How Updates Work

1. **Update Manifest**: `update-manifest.json` is hosted on GitHub
   - URL: https://raw.githubusercontent.com/hiwumo/sapper/main/update-manifest.json

2. **App Checks**: On startup and periodically, the app checks the manifest
   - Compares current version with manifest version
   - Verifies signature using the public key in `tauri.conf.json`

3. **Download & Install**: If update available:
   - Downloads the new installer from GitHub releases
   - Verifies signature matches
   - Installs update (requires app restart)

## Troubleshooting

### "TAURI_SIGNING_PRIVATE_KEY not set"
Create a `.env` file based on `.env.example` with your key path.

### "Could not find .exe file"
Check that the version in `tauri.conf.json` matches the version you're building.

### "GitHub CLI not installed"
Install from https://cli.github.com/ and run `gh auth login`.

### Update not detected by app
1. Verify manifest is accessible: https://raw.githubusercontent.com/hiwumo/sapper/main/update-manifest.json
2. Check that version in manifest is higher than app version
3. Verify public key in `tauri.conf.json` matches your signing key
4. Check app logs in `~/.sapper/logs/` for update errors

## Security Notes

- **Never commit** your private signing key to git
- Keep signing key password secure
- The `.sig` files ensure users only install authentic updates
- The updater only accepts installers signed with your private key
