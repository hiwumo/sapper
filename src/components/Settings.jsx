import { useState, useEffect } from "react";
import { X, FolderOpen, Download, Upload, FileText, Bell, AlertTriangle, Bug, Settings2, Palette, Database, Wrench, HardDrive, ChevronRight } from "lucide-react";
import { themes, saveTheme } from "../themes";
import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useToast } from "./ToastContainer";
import "./Settings.css";

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function Settings({ isOpen, onClose, currentTheme, onThemeChange, imports, onImportComplete, onShowChangelog, currentVersion, debugMode, onDebugModeChange }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("general");
  const [dataSubTab, setDataSubTab] = useState("storage");
  const [exportMode, setExportMode] = useState("all");
  const [selectedConversations, setSelectedConversations] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [importQueue, setImportQueue] = useState([]);
  const [appVersion, setAppVersion] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [skipLargeImportWarning, setSkipLargeImportWarning] = useState(false);
  const [diskUsage, setDiskUsage] = useState(null);
  const [loadingDiskUsage, setLoadingDiskUsage] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const version = await invoke("get_app_version");
        setAppVersion(version);
        const config = await invoke("get_config");
        setNotificationsEnabled(config.notificationsEnabled ?? true);
        setSkipLargeImportWarning(config.skipLargeImportWarning ?? false);
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      }
    };

    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === "data" && dataSubTab === "storage" && !diskUsage) {
      fetchDiskUsage();
    }
  }, [isOpen, activeTab, dataSubTab]);

  const fetchDiskUsage = async () => {
    setLoadingDiskUsage(true);
    try {
      const usage = await invoke("get_disk_usage");
      setDiskUsage(usage);
    } catch (error) {
      console.error("Failed to fetch disk usage:", error);
    }
    setLoadingDiskUsage(false);
  };

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
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select backup folder to import",
      });

      if (!selected) return;

      const importId = Date.now();
      setImportQueue((prev) => [...prev, { id: importId, path: selected, status: "pending" }]);

      toast.info("Import started in background...", 3000);

      processImport(importId, selected);
    } catch (error) {
      console.error("Import failed:", error);
      toast.error(`Import failed: ${error}`);
    }
  };

  const processImport = async (importId, sourcePath) => {
    try {
      setImportQueue((prev) =>
        prev.map((item) =>
          item.id === importId ? { ...item, status: "processing" } : item
        )
      );

      const result = await invoke("import_backup_detailed", { sourcePath });

      setImportQueue((prev) => prev.filter((item) => item.id !== importId));

      if (result.successCount > 0) {
        toast.success(
          `Successfully imported ${result.successCount} conversation(s)!`,
          6000
        );
      }

      if (result.failedCount > 0) {
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

      if (onImportComplete && result.successCount > 0) {
        onImportComplete();
      }
    } catch (error) {
      console.error("Import failed:", error);
      toast.error(`Import failed: ${error}`, 8000);

      setImportQueue((prev) => prev.filter((item) => item.id !== importId));
    }
  };

  const tabs = [
    { id: "general", label: "General", icon: Settings2 },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "data", label: "Data", icon: Database },
    { id: "advanced", label: "Advanced", icon: Wrench },
  ];

  const renderGeneralTab = () => (
    <div className="settings-tab-content">
      <div className="settings-section app-info-section">
        <h3>About Sapper</h3>
        <p className="settings-version">
          Version {currentVersion || appVersion || "loading..."}
        </p>
        <button className="changelog-button" onClick={() => { onShowChangelog(); onClose(); }}>
          <FileText size={18} />
          View Changelog
        </button>
      </div>

      <div className="settings-section">
        <h3>Notifications</h3>
        <div className="settings-toggle-list">
          <label className="settings-toggle">
            <div className="toggle-info">
              <Bell size={18} />
              <div>
                <span className="toggle-label">Desktop Notifications</span>
                <span className="toggle-description">
                  Show notifications when imports or updates complete
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={async (e) => {
                const val = e.target.checked;
                setNotificationsEnabled(val);
                try {
                  const config = await invoke("get_config");
                  config.notificationsEnabled = val;
                  await invoke("update_config", { config });
                } catch (err) {
                  console.error("Failed to save notification setting:", err);
                }
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );

  const renderAppearanceTab = () => (
    <div className="settings-tab-content">
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
    </div>
  );

  const renderDiskUsage = () => {
    if (loadingDiskUsage) {
      return (
        <div className="disk-usage-loading">
          <div className="disk-spinner" />
          Calculating disk usage...
        </div>
      );
    }

    if (!diskUsage) return null;

    const maxBytes = diskUsage.conversations.length > 0
      ? diskUsage.conversations[0].totalBytes
      : 1;

    return (
      <div className="disk-usage">
        <div className="disk-total">
          <HardDrive size={20} />
          <div className="disk-total-info">
            <span className="disk-total-label">Total Sapper Usage</span>
            <span className="disk-total-value">{formatBytes(diskUsage.totalBytes)}</span>
          </div>
        </div>

        <div className="disk-breakdown">
          <div className="disk-breakdown-row">
            <span>Conversations</span>
            <span>{formatBytes(diskUsage.importsBytes)}</span>
          </div>
          <div className="disk-breakdown-row">
            <span>Cache</span>
            <span>{formatBytes(diskUsage.cacheBytes)}</span>
          </div>
          <div className="disk-breakdown-row">
            <span>Logs</span>
            <span>{formatBytes(diskUsage.logsBytes)}</span>
          </div>
        </div>

        {diskUsage.conversations.length > 0 && (
          <div className="disk-conversations">
            <h4>By Conversation</h4>
            <div className="disk-conversation-list">
              {diskUsage.conversations.map((conv) => (
                <div key={conv.importId} className="disk-conversation-item">
                  <div className="disk-conv-info">
                    <span className="disk-conv-name" title={conv.alias}>{conv.alias}</span>
                    <span className="disk-conv-meta">
                      {conv.messageCount.toLocaleString()} msgs
                    </span>
                  </div>
                  <div className="disk-conv-bar-container">
                    <div
                      className="disk-conv-bar"
                      style={{ width: `${Math.max((conv.totalBytes / maxBytes) * 100, 2)}%` }}
                    />
                  </div>
                  <span className="disk-conv-size">{formatBytes(conv.totalBytes)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button className="disk-refresh-button" onClick={fetchDiskUsage}>
          Refresh
        </button>
      </div>
    );
  };

  const renderDataTab = () => (
    <div className="settings-tab-content">
      <div className="data-sub-tabs">
        <button
          className={`data-sub-tab ${dataSubTab === "storage" ? "active" : ""}`}
          onClick={() => setDataSubTab("storage")}
        >
          Storage
        </button>
        <button
          className={`data-sub-tab ${dataSubTab === "imports-exports" ? "active" : ""}`}
          onClick={() => setDataSubTab("imports-exports")}
        >
          Imports & Exports
        </button>
      </div>

      {dataSubTab === "storage" && (
        <>
          <div className="settings-section">
            <h3>Import Behavior</h3>
            <div className="settings-toggle-list">
              <label className="settings-toggle">
                <div className="toggle-info">
                  <AlertTriangle size={18} />
                  <div>
                    <span className="toggle-label">Skip Large Import Warning</span>
                    <span className="toggle-description">
                      Don't warn when attachments exceed 3 GB
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={skipLargeImportWarning}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setSkipLargeImportWarning(val);
                    try {
                      const config = await invoke("get_config");
                      config.skipLargeImportWarning = val;
                      await invoke("update_config", { config });
                    } catch (err) {
                      console.error("Failed to save import warning setting:", err);
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div className="settings-section">
            <h3>Disk Space Usage</h3>
            {renderDiskUsage()}
          </div>
        </>
      )}

      {dataSubTab === "imports-exports" && (
        <>
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
        </>
      )}
    </div>
  );

  const renderAdvancedTab = () => (
    <div className="settings-tab-content">
      <div className="settings-section">
        <h3>Debugging</h3>
        <div className="settings-toggle-list">
          <label className="settings-toggle">
            <div className="toggle-info">
              <Bug size={18} />
              <div>
                <span className="toggle-label">Debug Mode</span>
                <span className="toggle-description">
                  Enables trace logging, asset source info, message payload inspection, and chunk debug data
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={debugMode}
              onChange={async (e) => {
                const val = e.target.checked;
                onDebugModeChange(val);
                try {
                  await invoke("set_debug_mode", { enabled: val });
                } catch (err) {
                  console.error("Failed to set debug mode:", err);
                }
              }}
            />
          </label>
        </div>

        <button className="open-logs-button" onClick={handleOpenLogs} style={{ marginTop: "1rem" }}>
          <FolderOpen size={20} />
          Open Log Folder
        </button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "general": return renderGeneralTab();
      case "appearance": return renderAppearanceTab();
      case "data": return renderDataTab();
      case "advanced": return renderAdvancedTab();
      default: return renderGeneralTab();
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

        <div className="settings-body">
          <div className="settings-sidebar">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={`settings-tab-button ${activeTab === tab.id ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                  <ChevronRight size={14} className="tab-arrow" />
                </button>
              );
            })}
          </div>

          <div className="settings-content">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
