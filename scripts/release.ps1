# Automated Release Script for Sapper
# This script handles the entire release process: build, sign, update manifest

param(
    [Parameter(Mandatory=$false)]
    [string]$Version,

    [Parameter(Mandatory=$false)]
    [string]$Notes = "Bug fixes and improvements",

    [Parameter(Mandatory=$false)]
    [switch]$CreateGitHubRelease,

    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

# Color output functions
function Write-Step { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "✓ $msg" -ForegroundColor Green }
function Write-Error { param($msg) Write-Host "✗ $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "  $msg" -ForegroundColor White }

Write-Host @"
╔═══════════════════════════════════════════════════════════════╗
║                  SAPPER RELEASE AUTOMATION                    ║
╚═══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

# Load .env file if exists
if (Test-Path ".env") {
    Write-Step "Loading environment variables from .env"
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, 'Process')
            Write-Success "Loaded: $name"
        }
    }
}

# Check for signing key
if (-not $env:TAURI_SIGNING_PRIVATE_KEY) {
    Write-Error "TAURI_SIGNING_PRIVATE_KEY not set"
    Write-Host "`nPlease either:" -ForegroundColor Yellow
    Write-Info "1. Create a .env file with TAURI_SIGNING_PRIVATE_KEY=path/to/key"
    Write-Info "2. Set: `$env:TAURI_SIGNING_PRIVATE_KEY=`"path/to/key`""
    exit 1
}

# Read version from tauri.conf.json if not provided
if (-not $Version) {
    Write-Step "Reading version from tauri.conf.json"
    $tauriConfig = Get-Content "src-tauri/tauri.conf.json" -Raw | ConvertFrom-Json
    $Version = $tauriConfig.version
    Write-Success "Version: $Version"
}

# Build the release
if (-not $SkipBuild) {
    Write-Step "Building signed release for version $Version"
    npm run tauri build

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build failed"
        exit 1
    }
    Write-Success "Build completed"
} else {
    Write-Step "Skipping build (using existing artifacts)"
}

# Find the generated files
Write-Step "Locating release artifacts"

$bundleDir = "src-tauri\target\release\bundle\nsis"
$exeFile = Get-ChildItem -Path $bundleDir -Filter "sapper_${Version}_x64-setup.exe" | Select-Object -First 1
$sigFile = Get-ChildItem -Path $bundleDir -Filter "sapper_${Version}_x64-setup.exe.sig" | Select-Object -First 1

if (-not $exeFile) {
    Write-Error "Could not find .exe file: sapper_${Version}_x64-setup.exe"
    Write-Info "Available files in $bundleDir:"
    Get-ChildItem -Path $bundleDir -Filter "*.exe" | ForEach-Object { Write-Info "  - $($_.Name)" }
    exit 1
}

if (-not $sigFile) {
    Write-Error "Could not find .sig file: sapper_${Version}_x64-setup.exe.sig"
    exit 1
}

Write-Success "Found: $($exeFile.Name)"
Write-Success "Found: $($sigFile.Name)"

# Read signature
Write-Step "Reading signature from $($sigFile.Name)"
$signature = Get-Content -Path $sigFile.FullName -Raw
$signature = $signature.Trim()
Write-Success "Signature read successfully"

# Update manifest
Write-Step "Updating update-manifest.json"

$exeUrl = "https://github.com/hiwumo/sapper/releases/download/v${Version}/sapper_${Version}_x64-setup.exe"
$pubDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

$manifest = @{
    version = $Version
    notes = $Notes
    pub_date = $pubDate
    platforms = @{
        "windows-x86_64" = @{
            signature = $signature
            url = $exeUrl
        }
    }
}

$manifestJson = $manifest | ConvertTo-Json -Depth 10
$manifestPath = "update-manifest.json"
$manifestJson | Set-Content -Path $manifestPath

Write-Success "Manifest updated successfully"
Write-Info "Version: $Version"
Write-Info "Date: $pubDate"

# Display file sizes
$exeSize = [math]::Round($exeFile.Length / 1MB, 2)
Write-Info "Installer size: ${exeSize} MB"

# Create GitHub release if requested
if ($CreateGitHubRelease) {
    Write-Step "Creating GitHub release"

    # Check if gh CLI is installed
    $ghInstalled = Get-Command gh -ErrorAction SilentlyContinue
    if (-not $ghInstalled) {
        Write-Error "GitHub CLI (gh) not installed"
        Write-Info "Install from: https://cli.github.com/"
        Write-Info "After installing, run: gh auth login"
        exit 1
    }

    # Create release and upload files
    $releaseTag = "v$Version"

    Write-Info "Creating release $releaseTag..."
    gh release create $releaseTag `
        --title "Release $Version" `
        --notes $Notes `
        $exeFile.FullName `
        $sigFile.FullName

    if ($LASTEXITCODE -eq 0) {
        Write-Success "GitHub release created successfully"

        # Commit and push manifest
        Write-Step "Committing and pushing manifest"
        git add update-manifest.json
        git commit -m "Update manifest for v$Version"
        git push

        Write-Success "Manifest pushed to repository"
    } else {
        Write-Error "Failed to create GitHub release"
        exit 1
    }
}

# Final summary
Write-Host @"

╔═══════════════════════════════════════════════════════════════╗
║                     RELEASE READY                             ║
╚═══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Green

Write-Host "📦 Release Artifacts:" -ForegroundColor Cyan
Write-Info "Installer: $($exeFile.FullName)"
Write-Info "Signature: $($sigFile.FullName)"
Write-Info "Manifest:  $((Resolve-Path $manifestPath).Path)"

if (-not $CreateGitHubRelease) {
    Write-Host "`n📋 Next Steps:" -ForegroundColor Yellow
    Write-Info "1. Create GitHub release:"
    Write-Host "   gh release create v$Version --title `"Release $Version`" --notes `"$Notes`" `"$($exeFile.FullName)`" `"$($sigFile.FullName)`"" -ForegroundColor DarkGray
    Write-Info ""
    Write-Info "2. Commit and push manifest:"
    Write-Host "   git add update-manifest.json && git commit -m `"Update manifest for v$Version`" && git push" -ForegroundColor DarkGray
    Write-Info ""
    Write-Info "3. Verify manifest is accessible:"
    Write-Host "   https://raw.githubusercontent.com/hiwumo/sapper/main/update-manifest.json" -ForegroundColor DarkGray

    Write-Host "`n💡 Tip:" -ForegroundColor Cyan
    Write-Info "Run with -CreateGitHubRelease to automate GitHub release and manifest push"
    Write-Host "   .\scripts\release.ps1 -CreateGitHubRelease" -ForegroundColor DarkGray
} else {
    Write-Host "`n✅ Release Complete!" -ForegroundColor Green
    Write-Info "Your app will now auto-update from this release"
    Write-Info ""
    Write-Info "Verify at: https://github.com/hiwumo/sapper/releases/tag/v$Version"
}

Write-Host ""
