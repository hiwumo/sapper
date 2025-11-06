
.PHONY: help install dev build-unsigned build-signed release release-full clean check-env version

# Read version from tauri.conf.json
VERSION := $(shell powershell -NoProfile -Command "(Get-Content src-tauri/tauri.conf.json | ConvertFrom-Json).version")

# GitHub repository info
GITHUB_REPO := hiwumo/sapper
MANIFEST_URL := https://raw.githubusercontent.com/$(GITHUB_REPO)/main/update-manifest.json

# Default target - show help
help:
	@echo Sapper Build System
	@echo ===================
	@echo.
	@echo Available targets:
	@echo   make install          - Install dependencies
	@echo   make dev              - Run development server
	@echo   make build-unsigned   - Build unsigned app (for testing)
	@echo   make build-signed     - Build signed app (requires signing key)
	@echo   make release          - Build signed app and update manifest
	@echo   make release-full     - Build, update manifest, and create GitHub release
	@echo   make clean            - Clean build artifacts
	@echo   make check-env        - Verify environment setup
	@echo   make version          - Show current version
	@echo.
	@echo Examples:
	@echo   make build-unsigned             # Quick unsigned build for testing
	@echo   make release                    # Build signed release
	@echo   make release-full               # Full release with GitHub upload
	@echo.

# Show current version
version:
	@echo Current version: $(VERSION)

# Install dependencies
install:
	@echo Installing dependencies...
	@npm install
	@echo Dependencies installed successfully!

# Run development server
dev:
	@echo Starting development server...
	@npm run tauri dev

# Build unsigned app (for development/testing)
build-unsigned:
	@echo ===============================================
	@echo Building UNSIGNED application
	@echo This build will NOT support auto-updates
	@echo ===============================================
	@echo.
	@set TAURI_SIGNING_PRIVATE_KEY= && npm run tauri build
	@echo.
	@echo ===============================================
	@echo Unsigned build complete!
	@echo Location: src-tauri\target\release\bundle\
	@echo ===============================================

# Build signed app (for production)
build-signed: check-env
	@echo ===============================================
	@echo Building SIGNED application (v$(VERSION))
	@echo ===============================================
	@echo.
	@powershell -NoProfile -Command "$$ErrorActionPreference='Stop'; if (Test-Path .env) { Get-Content .env | ForEach-Object { if ($$_ -match '^([^#][^=]+)=(.*)$$') { $$name = $$matches[1].Trim(); $$value = $$matches[2].Trim(); [Environment]::SetEnvironmentVariable($$name, $$value, 'Process') } } }; npm run tauri build; if ($$LASTEXITCODE -ne 0) { exit $$LASTEXITCODE }"
	@echo.
	@echo ===============================================
	@echo Signed build complete!
	@echo Location: src-tauri\target\release\bundle\nsis\
	@echo ===============================================

# Build and create update manifest
release: build-signed
	@echo.
	@echo ===============================================
	@echo Creating update manifest
	@echo ===============================================
	@powershell -NoProfile -Command "$$ErrorActionPreference='Stop'; \
		$$version = '$(VERSION)'; \
		$$bundleDir = 'src-tauri/target/release/bundle/nsis'; \
		$$exeFile = Get-ChildItem -Path $$bundleDir -Filter \"sapper_$${version}_x64-setup.exe\" -ErrorAction Stop; \
		$$sigFile = Get-ChildItem -Path $$bundleDir -Filter \"sapper_$${version}_x64-setup.exe.sig\" -ErrorAction Stop; \
		$$signature = (Get-Content -Path $$sigFile.FullName -Raw).Trim(); \
		$$exeUrl = \"https://github.com/$(GITHUB_REPO)/releases/download/v$${version}/sapper_$${version}_x64-setup.exe\"; \
		$$pubDate = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'); \
		$$manifest = @{ \
			version = $$version; \
			notes = 'Bug fixes and improvements'; \
			pub_date = $$pubDate; \
			platforms = @{ \
				'windows-x86_64' = @{ \
					signature = $$signature; \
					url = $$exeUrl \
				} \
			} \
		}; \
		$$manifestJson = $$manifest | ConvertTo-Json -Depth 10; \
		$$manifestJson | Set-Content -Path 'update-manifest.json'; \
		Write-Host ''; \
		Write-Host 'Manifest created successfully!' -ForegroundColor Green; \
		Write-Host 'Version: ' -NoNewline; Write-Host $$version -ForegroundColor Cyan; \
		Write-Host 'Installer: ' -NoNewline; Write-Host $$exeFile.Name -ForegroundColor Cyan; \
		Write-Host 'Signature: ' -NoNewline; Write-Host $$sigFile.Name -ForegroundColor Cyan; \
		Write-Host 'Size: ' -NoNewline; Write-Host ([math]::Round($$exeFile.Length / 1MB, 2).ToString() + ' MB') -ForegroundColor Cyan"
	@echo.
	@echo ===============================================
	@echo Release artifacts ready!
	@echo ===============================================
	@echo.
	@echo Next steps:
	@echo 1. Create GitHub release:
	@echo    gh release create v$(VERSION) --title "Release $(VERSION)" --notes "Bug fixes and improvements" src-tauri\target\release\bundle\nsis\sapper_$(VERSION)_x64-setup.exe src-tauri\target\release\bundle\nsis\sapper_$(VERSION)_x64-setup.exe.sig
	@echo.
	@echo 2. Commit and push manifest:
	@echo    git add update-manifest.json
	@echo    git commit -m "Update manifest for v$(VERSION)"
	@echo    git push
	@echo.
	@echo Or run 'make release-full' to automate both steps

# Full release with GitHub upload
release-full: release
	@echo.
	@echo ===============================================
	@echo Creating GitHub release
	@echo ===============================================
	@powershell -NoProfile -Command "$$ErrorActionPreference='Stop'; \
		$$version = '$(VERSION)'; \
		$$ghInstalled = Get-Command gh -ErrorAction SilentlyContinue; \
		if (-not $$ghInstalled) { \
			Write-Host 'ERROR: GitHub CLI (gh) not installed' -ForegroundColor Red; \
			Write-Host 'Install from: https://cli.github.com/' -ForegroundColor Yellow; \
			Write-Host 'After installing, run: gh auth login' -ForegroundColor Yellow; \
			exit 1 \
		}; \
		$$bundleDir = 'src-tauri/target/release/bundle/nsis'; \
		$$exeFile = Get-ChildItem -Path $$bundleDir -Filter \"sapper_$${version}_x64-setup.exe\" -ErrorAction Stop; \
		$$sigFile = Get-ChildItem -Path $$bundleDir -Filter \"sapper_$${version}_x64-setup.exe.sig\" -ErrorAction Stop; \
		Write-Host 'Creating release v' -NoNewline; Write-Host $$version -ForegroundColor Cyan; \
		gh release create \"v$$version\" --title \"Release $$version\" --notes \"Bug fixes and improvements\" $$exeFile.FullName $$sigFile.FullName; \
		if ($$LASTEXITCODE -eq 0) { \
			Write-Host ''; \
			Write-Host 'GitHub release created successfully!' -ForegroundColor Green; \
			Write-Host ''; \
			Write-Host 'Committing and pushing manifest...' -ForegroundColor Cyan; \
			git add update-manifest.json; \
			git commit -m \"Update manifest for v$$version\"; \
			git push; \
			Write-Host ''; \
			Write-Host '===============================================' -ForegroundColor Green; \
			Write-Host 'Release Complete!' -ForegroundColor Green; \
			Write-Host '===============================================' -ForegroundColor Green; \
			Write-Host ''; \
			Write-Host 'Release URL: https://github.com/$(GITHUB_REPO)/releases/tag/v' -NoNewline; Write-Host $$version -ForegroundColor Cyan; \
			Write-Host 'Manifest URL: $(MANIFEST_URL)' -ForegroundColor Cyan; \
			Write-Host ''; \
			Write-Host 'Your app will now auto-update from this release!' -ForegroundColor Green \
		} else { \
			Write-Host ''; \
			Write-Host 'ERROR: Failed to create GitHub release' -ForegroundColor Red; \
			exit 1 \
		}"

# Clean build artifacts
clean:
	@echo Cleaning build artifacts...
	@if exist src-tauri\target rmdir /s /q src-tauri\target
	@if exist dist rmdir /s /q dist
	@echo Clean complete!

# Check environment setup
check-env:
	@echo Checking environment setup...
	@powershell -NoProfile -Command "$$ErrorActionPreference='Stop'; \
		if (-not (Test-Path .env)) { \
			Write-Host 'WARNING: .env file not found' -ForegroundColor Yellow; \
			Write-Host 'Copy .env.example to .env and add your signing key for signed builds' -ForegroundColor Yellow; \
			Write-Host '' \
		} else { \
			Write-Host 'v .env file found' -ForegroundColor Green \
		}; \
		if (-not (Test-Path src-tauri/tauri.conf.json)) { \
			Write-Host 'ERROR: tauri.conf.json not found' -ForegroundColor Red; \
			exit 1 \
		} else { \
			Write-Host 'v tauri.conf.json found' -ForegroundColor Green \
		}; \
		$$config = Get-Content src-tauri/tauri.conf.json -Raw | ConvertFrom-Json; \
		Write-Host ('v Version: ' + $$config.version) -ForegroundColor Green; \
		Write-Host ('v Identifier: ' + $$config.identifier) -ForegroundColor Green; \
		if ($$config.bundle.createUpdaterArtifacts) { \
			Write-Host 'v Updater artifacts: enabled' -ForegroundColor Green \
		} else { \
			Write-Host 'WARNING: createUpdaterArtifacts is not enabled in tauri.conf.json' -ForegroundColor Yellow \
		}"
	@echo.
