.PHONY: help dev build release release-auto release-github clean check-env

help:
	@echo make dev             - Run development server
	@echo make build           - Build the app (no signing)
	@echo make release         - Build signed release with updater artifacts
	@echo make release-auto    - Automated release (build + update manifest)
	@echo make release-github  - Automated release with GitHub upload
	@echo make clean           - Clean build artifacts
	@echo make check-env       - Check if environment variables are set
	@echo.

# Run development server
dev:
	npm run tauri dev

# Build the app without signing (for testing)
build:
	npm run tauri build

# Requires TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD to be set
release:
	@powershell -Command "\
		if (Test-Path .env) { \
			Write-Host 'Loading environment variables from .env file...' -ForegroundColor Cyan; \
			Get-Content .env | ForEach-Object { \
				if ($$_ -match '^([^#][^=]+)=(.*)$$') { \
					$$name = $$matches[1].Trim(); \
					$$value = $$matches[2].Trim(); \
					[Environment]::SetEnvironmentVariable($$name, $$value, 'Process'); \
					Write-Host \"  Loaded: $$name\" -ForegroundColor Green; \
				} \
			}; \
			Write-Host ''; \
		}; \
		if (-not $$env:TAURI_SIGNING_PRIVATE_KEY) { \
			Write-Host 'ERROR: TAURI_SIGNING_PRIVATE_KEY not set' -ForegroundColor Red; \
			Write-Host ''; \
			Write-Host 'Please either:' -ForegroundColor Yellow; \
			Write-Host '  1. Create a .env file with TAURI_SIGNING_PRIVATE_KEY=.key/myapp.key' -ForegroundColor Cyan; \
			Write-Host '  2. Or set manually: $$env:TAURI_SIGNING_PRIVATE_KEY=\".key/myapp.key\"' -ForegroundColor Cyan; \
			exit 1; \
		}; \
		Write-Host 'Building signed release...' -ForegroundColor Green; \
		Write-Host ''; \
		npm run tauri build; \
		if ($$LASTEXITCODE -eq 0) { \
			Write-Host ''; \
			Write-Host '========================================' -ForegroundColor Green; \
			Write-Host 'Release build complete!' -ForegroundColor Green; \
			Write-Host '========================================' -ForegroundColor Green; \
			Write-Host ''; \
			Write-Host 'Updater artifacts created:' -ForegroundColor Cyan; \
			Write-Host '  - Setup installer: src-tauri\target\release\bundle\nsis\*.exe' -ForegroundColor White; \
			Write-Host '  - Signature file: src-tauri\target\release\bundle\nsis\*.exe.sig' -ForegroundColor White; \
			Write-Host ''; \
			Write-Host 'Next steps:' -ForegroundColor Yellow; \
			Write-Host '  1. Upload the .exe and .sig files to GitHub releases' -ForegroundColor White; \
			Write-Host '  2. Update update-manifest.json with the new version info' -ForegroundColor White; \
			Write-Host '  3. Commit and push update-manifest.json to your repo' -ForegroundColor White; \
			Write-Host '========================================' -ForegroundColor Green; \
		} \
	"

# Check if required environment variables are set
check-env:
	@powershell -Command "\
		if (Test-Path .env) { \
			Write-Host 'Found .env file, loading variables...' -ForegroundColor Cyan; \
			Get-Content .env | ForEach-Object { \
				if ($$_ -match '^([^#][^=]+)=(.*)$$') { \
					$$name = $$matches[1].Trim(); \
					$$value = $$matches[2].Trim(); \
					[Environment]::SetEnvironmentVariable($$name, $$value, 'Process'); \
				} \
			}; \
		}; \
		if (-not $$env:TAURI_SIGNING_PRIVATE_KEY) { \
			Write-Host 'ERROR: TAURI_SIGNING_PRIVATE_KEY not set' -ForegroundColor Red; \
			Write-Host ''; \
			Write-Host 'Please set the environment variable:' -ForegroundColor Yellow; \
			Write-Host '  $$env:TAURI_SIGNING_PRIVATE_KEY=\".key/myapp.key\"' -ForegroundColor Cyan; \
			Write-Host '  $$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD=\"your_password\"' -ForegroundColor Cyan; \
			Write-Host ''; \
			Write-Host 'Or create a .env file based on .env.example' -ForegroundColor Yellow; \
			exit 1; \
		}; \
		Write-Host 'Environment variables are set correctly.' -ForegroundColor Green; \
	"

# Clean build artifacts
clean:
	@echo Cleaning build artifacts...
	@if exist "src-tauri\target" rmdir /s /q "src-tauri\target"
	@if exist "dist" rmdir /s /q "dist"
	@if exist "target" rmdir /s /q "target"
	@echo Clean complete!

# Automated release: build, sign, and update manifest
release-auto:
	@powershell -ExecutionPolicy Bypass -File .\scripts\release.ps1

# Automated release with GitHub upload
release-github:
	@powershell -ExecutionPolicy Bypass -File .\scripts\release.ps1 -CreateGitHubRelease
