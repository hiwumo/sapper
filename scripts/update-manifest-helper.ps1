# Helper script to update the manifest with signature from .sig file
# Usage: .\scripts\update-manifest-helper.ps1 -Version "0.2.0" -SigFile "path\to\file.exe.sig" -ExeUrl "https://github.com/..."

param(
    [Parameter(Mandatory=$true)]
    [string]$Version,

    [Parameter(Mandatory=$true)]
    [string]$SigFile,

    [Parameter(Mandatory=$true)]
    [string]$ExeUrl,

    [string]$Notes = "Bug fixes and improvements"
)

# Read the signature file
if (-not (Test-Path $SigFile)) {
    Write-Host "Error: Signature file not found: $SigFile" -ForegroundColor Red
    exit 1
}

$signature = Get-Content -Path $SigFile -Raw
$signature = $signature.Trim()

# Get current date in ISO 8601 format
$pubDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

# Create the manifest JSON
$manifest = @{
    version = $Version
    notes = $Notes
    pub_date = $pubDate
    platforms = @{
        "windows-x86_64" = @{
            signature = $signature
            url = $ExeUrl
        }
    }
} | ConvertTo-Json -Depth 10

# Write to update-manifest.json
$manifestPath = Join-Path $PSScriptRoot "..\update-manifest.json"
$manifest | Set-Content -Path $manifestPath

Write-Host "`nManifest updated successfully!" -ForegroundColor Green
Write-Host "`nContents:" -ForegroundColor Cyan
Write-Host $manifest

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Review update-manifest.json" -ForegroundColor White
Write-Host "2. Commit and push to GitHub: git add update-manifest.json && git commit -m 'Release v$Version' && git push" -ForegroundColor White
Write-Host "3. Verify the manifest is accessible at: https://raw.githubusercontent.com/hiwumo/sapper/main/update-manifest.json" -ForegroundColor White
