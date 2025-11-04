import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { AlertTriangle, FolderOpen, X } from "lucide-react";
import "./MissingAssetsDialog.css";

function MissingAssetsDialog({
  isOpen,
  missingAssets,
  jsonPath,
  onContinue,
  onCancel,
}) {
  const [isCopyingAssets, setIsCopyingAssets] = useState(false);
  const [copyProgress, setCopyProgress] = useState({ current: 0, total: 0, filename: "" });

  useEffect(() => {
    let unlisten;

    const setupListener = async () => {
      unlisten = await listen("copy-progress", (event) => {
        setCopyProgress(event.payload);
      });
    };

    if (isOpen) {
      setupListener();
    }

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectFolder = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select folder containing assets",
      });

      if (!selected) return;

      setIsCopyingAssets(true);
      setCopyProgress({ current: 0, total: 0, filename: "" });

      // Copy assets from selected folder to JSON directory
      const copiedCount = await invoke("copy_assets_to_json_dir", {
        jsonPath,
        sourceFolder: selected,
      });

      setIsCopyingAssets(false);
      setCopyProgress({ current: 0, total: 0, filename: "" });

      // Continue with import
      onContinue();
    } catch (error) {
      console.error("Failed to copy assets:", error);
      alert(`Failed to copy assets: ${error}`);
      setIsCopyingAssets(false);
      setCopyProgress({ current: 0, total: 0, filename: "" });
    }
  };

  return (
    <div className="missing-assets-overlay">
      <div className="missing-assets-dialog">
        <div className="missing-assets-header">
          <div className="missing-assets-title">
            <AlertTriangle size={24} color="#f0ad4e" />
            <h2>Missing Assets</h2>
          </div>
          <button className="missing-assets-close" onClick={onCancel}>
            <X size={24} />
          </button>
        </div>

        <div className="missing-assets-content">
          <p className="missing-assets-description">
            {missingAssets.length} asset{missingAssets.length !== 1 ? "s are" : " is"} missing from the conversation export:
          </p>

          <div className="missing-assets-list">
            {missingAssets.map((asset, idx) => (
              <div key={idx} className="missing-asset-item">
                <span className="asset-bullet">•</span>
                <span className="asset-name">{asset}</span>
              </div>
            ))}
          </div>

          {isCopyingAssets && copyProgress.total > 0 && (
            <div className="copy-progress-container">
              <div className="copy-progress-header">
                <span className="copy-progress-text">
                  Copying assets: {copyProgress.current} / {copyProgress.total}
                </span>
                <span className="copy-progress-percent">
                  {Math.round((copyProgress.current / copyProgress.total) * 100)}%
                </span>
              </div>
              {copyProgress.filename && (
                <div className="copy-progress-filename">
                  Currently copying: <span className="filename">{copyProgress.filename}</span>
                </div>
              )}
              <div className="copy-progress-bar">
                <div
                  className="copy-progress-fill"
                  style={{
                    width: `${(copyProgress.current / copyProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="missing-assets-actions">
            <button
              className="action-button select-folder-button"
              onClick={handleSelectFolder}
              disabled={isCopyingAssets}
            >
              <FolderOpen size={20} />
              <div className="button-content">
                <span className="button-label">
                  {isCopyingAssets ? "Copying Assets..." : "Select Folder with Assets"}
                </span>
                <span className="button-subtext">
                  Make sure all assets are in here!
                </span>
              </div>
            </button>

            <button
              className="action-button continue-button"
              onClick={onContinue}
              disabled={isCopyingAssets}
            >
              Continue Without Assets
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MissingAssetsDialog;
