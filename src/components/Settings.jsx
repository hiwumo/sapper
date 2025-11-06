import { useState, useEffect } from "react";
import { X, FolderOpen, Download, Upload } from "lucide-react";
import { themes, saveTheme } from "../themes";
import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useToast } from "./ToastContainer";
import "./Settings.css";

function Settings({ isOpen, onClose, currentTheme, onThemeChange, imports, onImportComplete }) {
  const toast = useToast();
  const [exportMode, setExportMode] = useState("all");
  const [selectedConversations, setSelectedConversations] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [importQueue, setImportQueue] = useState([]);
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const version = await invoke("get_app_version");
        setAppVersion(version);
      } catch (error) {
        console.error("Failed to fetch app version:", error);
      }
    };

    if (isOpen) {
      fetchVersion();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleThemeChange = (themeName) => {
    saveTheme(themeName);
    onThemeChange(themeName);
  };

  const handleOpenLogs = async () => {
    try {
      const logDir = await invoke("get_log_directory");
      await openPath(logDir);
    } catch (error) {
      console.error("Failed to open log directory:", error);
      toast.error(`Failed to open log directory: ${error}`);
    }
  };

  const handleToggleConversation = (importId) => {
    setSelectedConversations((prev) =>
      prev.includes(importId)
        ? prev.filter((id) => id !== importId)
        : [...prev, importId]
    );
  };

  const handleSelectAll = () => {
    setSelectedConversations(imports.map((imp) => imp.id));
  };

  const handleDeselectAll = () => {
    setSelectedConversations([]);
  };

  const handleExport = async () => {
    try {
      // Ask user to select a directory
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select folder to save backup",
      });

      if (!selected) return;

      setIsExporting(true);

      if (exportMode === "all") {
        await invoke("export_all_conversations", { destPath: selected });
        toast.success("All conversations exported successfully!");
      } else {
        if (selectedConversations.length === 0) {
          toast.warning("Please select at least one conversation to export");
          setIsExporting(false);
          return;
        }
        await invoke("export_selected_conversations", {
          destPath: selected,
          importIds: selectedConversations,
        });
        toast.success(`${selectedConversations.length} conversation(s) exported successfully!`);
      }

      setIsExporting(false);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(`Export failed: ${error}`);
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    try {
      // Ask user to select a directory
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select backup folder to import",
      });

      if (!selected) return;

      // Add to queue immediately - user can queue multiple imports
      const importId = Date.now();
      setImportQueue((prev) => [...prev, { id: importId, path: selected, status: "pending" }]);

      // Show initial toast
      toast.info("Import started in background...", 3000);

      // Process import asynchronously
      processImport(importId, selected);
    } catch (error) {
      console.error("Import failed:", error);
      toast.error(`Import failed: ${error}`);
    }
  };

  const processImport = async (importId, sourcePath) => {
    try {
      // Update status to processing
      setImportQueue((prev) =>
        prev.map((item) =>
          item.id === importId ? { ...item, status: "processing" } : item
        )
      );

      // Call the detailed import command
      const result = await invoke("import_backup_detailed", { sourcePath });

      // Remove from queue
      setImportQueue((prev) => prev.filter((item) => item.id !== importId));

      // Show detailed results
      if (result.successCount > 0) {
        toast.success(
          `Successfully imported ${result.successCount} conversation(s)!`,
          6000
        );
      }

      if (result.failedCount > 0) {
        // Show error summary
        const errorSummary = result.failed
          .slice(0, 3)
          .map((f) => `${f.conversationName}: ${f.error}`)
          .join("\n");
        const moreErrors = result.failed.length > 3 ? `\n...and ${result.failed.length - 3} more` : "";

        toast.error(
          `Failed to import ${result.failedCount} conversation(s):\n${errorSummary}${moreErrors}`,
          10000
        );
      }

      if (result.successCount === 0 && result.failedCount === 0) {
        toast.info("No new conversations to import (all already exist)");
      }

      // Notify parent to reload imports
      if (onImportComplete && result.successCount > 0) {
        onImportComplete();
      }
    } catch (error) {
      console.error("Import failed:", error);
      toast.error(`Import failed: ${error}`, 8000);

      // Remove from queue
      setImportQueue((prev) => prev.filter((item) => item.id !== importId));
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-section app-info">
            <h3>Sapper</h3>
            <p className="settings-description version-info">
              Version {appVersion || "loading..."}
            </p>
          </div>

          <div className="settings-section">
            <h3>Theme</h3>
            <p className="settings-description">
              Choose your preferred color scheme
            </p>

            <div className="theme-options">
              {Object.entries(themes).map(([key, theme]) => (
                <button
                  key={key}
                  className={`theme-option ${currentTheme === key ? "active" : ""}`}
                  onClick={() => handleThemeChange(key)}
                >
                  <div className="theme-preview">
                    <div
                      className="theme-color"
                      style={{ background: theme.colors.background }}
                    />
                    <div
                      className="theme-color"
                      style={{ background: theme.colors.backgroundSecondary }}
                    />
                    <div
                      className="theme-color"
                      style={{ background: theme.colors.textPrimary }}
                    />
                  </div>
                  <span className="theme-name">{theme.name}</span>
                  {currentTheme === key && (
                    <div className="theme-check">✓</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-section">
            <h3>Export Conversations</h3>
            <p className="settings-description">
              Back up your conversations and settings
            </p>

            <div className="export-mode-selector">
              <label className="export-mode-option">
                <input
                  type="radio"
                  name="exportMode"
                  value="all"
                  checked={exportMode === "all"}
                  onChange={() => setExportMode("all")}
                />
                <span>Export everything (all conversations + settings)</span>
              </label>
              <label className="export-mode-option">
                <input
                  type="radio"
                  name="exportMode"
                  value="selected"
                  checked={exportMode === "selected"}
                  onChange={() => setExportMode("selected")}
                />
                <span>Export selected conversations</span>
              </label>
            </div>

            {exportMode === "selected" && (
              <div className="conversation-selector">
                <div className="selector-header">
                  <button className="select-all-button" onClick={handleSelectAll}>
                    Select All
                  </button>
                  <button className="select-all-button" onClick={handleDeselectAll}>
                    Deselect All
                  </button>
                </div>
                <div className="conversation-list">
                  {imports.map((imp) => (
                    <label key={imp.id} className="conversation-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedConversations.includes(imp.id)}
                        onChange={() => handleToggleConversation(imp.id)}
                      />
                      <span>{imp.alias}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button
              className="export-button"
              onClick={handleExport}
              disabled={isExporting}
            >
              <Download size={20} />
              {isExporting ? "Exporting..." : "Export"}
            </button>
          </div>

          <div className="settings-section">
            <h3>Import Conversations</h3>
            <p className="settings-description">
              Restore conversations from a backup. You can queue multiple imports at once.
            </p>

            {importQueue.length > 0 && (
              <div className="import-queue-status">
                {importQueue.length} import(s) in progress...
              </div>
            )}

            <button
              className="import-button"
              onClick={handleImport}
            >
              <Upload size={20} />
              Import Backup
            </button>
          </div>

          <div className="settings-section">
            <h3>Logging & Debugging</h3>
            <p className="settings-description">
              Access application logs for debugging and troubleshooting
            </p>

            <button className="open-logs-button" onClick={handleOpenLogs}>
              <FolderOpen size={20} />
              Open Log Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
