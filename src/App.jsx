import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { ToastContainer as ReactToastifyContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import Sidebar from "./components/Sidebar";
import ConversationViewer from "./components/ConversationViewer";
import ProgressDialog from "./components/ProgressDialog";
import ImportDialog from "./components/ImportDialog";
import Dialog from "./components/Dialog";
import EditDialog from "./components/EditDialog";
import InfoDialog from "./components/InfoDialog";
import Settings from "./components/Settings";
import MissingAssetsDialog from "./components/MissingAssetsDialog";
import Changelog from "./components/Changelog";
import Guide from "./components/Guide";
import { ToastProvider, useToast } from "./components/ToastContainer";
import { getSavedTheme, themes } from "./themes";

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function AppContent() {
  const toast = useToast();
  const [activeView, setActiveView] = useState(null);
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState(getSavedTheme());
  const [missingAssetsDialog, setMissingAssetsDialog] = useState({
    isOpen: false,
    missingAssets: [],
    jsonPath: null,
  });
  const [incompatibleImports, setIncompatibleImports] = useState([]);
  const [missingImports, setMissingImports] = useState([]);
  const [showMissingImportsDialog, setShowMissingImportsDialog] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [debugMode, setDebugMode] = useState(false);
  const [conversationOrder, setConversationOrder] = useState([]);

  // Edit/Info dialogs
  const [editingImport, setEditingImport] = useState(null);
  const [infoImport, setInfoImport] = useState(null);
  const [confirmDeleteImport, setConfirmDeleteImport] = useState(null);

  // Outdated prompt
  const [outdatedPrompt, setOutdatedPrompt] = useState(null);

  // Import state
  const [importState, setImportState] = useState({
    active: false,
    files: [],
  });
  const importCancelledRef = useRef(false);

  // Size warning dialog
  const [sizeWarning, setSizeWarning] = useState({
    isOpen: false,
    totalSize: 0,
    attachmentsSize: 0,
    dontAskAgain: false,
    resolve: null,
  });

  useEffect(() => {
    initApp();
    setupConsoleLogging();
  }, []);

  // Apply theme CSS variables to root
  const themeColors = themes[theme]?.colors || themes.dark.colors;
  const themeStyle = {};
  for (const [key, value] of Object.entries(themeColors)) {
    themeStyle[`--${key}`] = value;
  }

  function setupConsoleLogging() {
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    const originalConsoleLog = console.log;

    console.error = (...args) => {
      originalConsoleError(...args);
      const message = args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg) : String(arg)
        )
        .join(" ");
      invoke("log_frontend_error", { message }).catch(() => {});
    };

    console.warn = (...args) => {
      originalConsoleWarn(...args);
      const message = args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg) : String(arg)
        )
        .join(" ");
      invoke("log_frontend_warning", { message }).catch(() => {});
    };

    console.log = (...args) => {
      originalConsoleLog(...args);
      const message = args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg) : String(arg)
        )
        .join(" ");
      invoke("log_frontend_trace", { message }).catch(() => {});
    };

    window.addEventListener("error", (event) => {
      const message = `Unhandled error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
      invoke("log_frontend_error", { message }).catch(() => {});
    });

    window.addEventListener("unhandledrejection", (event) => {
      const message = `Unhandled promise rejection: ${event.reason}`;
      invoke("log_frontend_error", { message }).catch(() => {});
    });
  }

  async function initApp() {
    try {
      await invoke("init_sapper");
      await loadImports();
      await checkChangelog();
    } catch (error) {
      console.error("Failed to initialize:", error);
    } finally {
      setLoading(false);
    }
  }

  async function checkChangelog() {
    try {
      const version = await invoke("get_app_version");
      setCurrentVersion(version);

      const config = await invoke("get_config");
      setDebugMode(config.debugMode ?? false);
      setConversationOrder(config.conversationOrder || []);
      const lastChangelogVersion = config.lastChangelogVersion;

      if (!lastChangelogVersion || lastChangelogVersion !== version) {
        setShowChangelog(true);
      }
    } catch (error) {
      console.error("Failed to check changelog:", error);
    }
  }

  async function handleCloseChangelog() {
    setShowChangelog(false);

    try {
      const config = await invoke("get_config");
      config.lastChangelogVersion = currentVersion;
      await invoke("update_config", { config });
    } catch (error) {
      console.error("Failed to update changelog version:", error);
    }
  }

  async function loadImports() {
    try {
      const importsList = await invoke("get_imports_with_compatibility");
      console.log("imports list with compatibility:", importsList);

      const missing = importsList.filter((imp) => imp.missing);
      const valid = importsList.filter((imp) => !imp.missing);

      setImports(valid);
      setMissingImports(missing);

      if (missing.length > 0) {
        setShowMissingImportsDialog(true);
      }

      const incompatible = valid.filter(
        (imp) => !imp.compatibility.isCompatible && imp.compatibility.needsUpdate
      );
      setIncompatibleImports(incompatible);

      // Load conversation order
      const config = await invoke("get_config");
      setConversationOrder(config.conversationOrder || []);
    } catch (error) {
      console.error("Failed to load imports:", error);
    }
  }

  // Sort imports by saved order
  function getSortedImports() {
    if (!conversationOrder.length) return imports;

    const orderMap = {};
    conversationOrder.forEach((id, idx) => {
      orderMap[id] = idx;
    });

    return [...imports].sort((a, b) => {
      const aId = a.id || a.entry?.id;
      const bId = b.id || b.entry?.id;
      const aIdx = orderMap[aId] ?? Infinity;
      const bIdx = orderMap[bId] ?? Infinity;
      return aIdx - bIdx;
    });
  }

  async function sendAppNotification(title, body) {
    try {
      const config = await invoke("get_config");
      if (!config.notificationsEnabled) return;

      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === "granted";
      }
      if (granted) {
        sendNotification({ title, body });
      }
    } catch (error) {
      console.error("Failed to send notification:", error);
    }
  }

  async function handleImport() {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: "JSON",
            extensions: ["json"],
          },
        ],
      });

      if (!selected || selected.length === 0) return;

      const paths = Array.isArray(selected) ? selected : [selected];

      const filesWithPreviews = [];
      for (const path of paths) {
        try {
          const preview = await invoke("get_import_preview", { jsonPath: path });
          const name = path.split(/[/\\]/).pop() || path;
          filesWithPreviews.push({ path, name, preview, status: "pending", error: null });
        } catch (error) {
          const name = path.split(/[/\\]/).pop() || path;
          filesWithPreviews.push({ path, name, preview: null, status: "pending", error: null });
          console.warn("Failed to get preview for", path, error);
        }
      }

      const totalAttachmentsSize = filesWithPreviews.reduce(
        (sum, f) => sum + (f.preview?.attachmentsSize || 0),
        0
      );
      const totalJsonSize = filesWithPreviews.reduce(
        (sum, f) => sum + (f.preview?.jsonSize || 0),
        0
      );
      const totalSpaceNeeded = totalAttachmentsSize + totalJsonSize * 3;
      const THREE_GB = 3 * 1024 * 1024 * 1024;

      const config = await invoke("get_config");

      if (totalAttachmentsSize > THREE_GB && !config.skipLargeImportWarning) {
        const confirmed = await new Promise((resolve) => {
          setSizeWarning({
            isOpen: true,
            totalSize: totalSpaceNeeded,
            attachmentsSize: totalAttachmentsSize,
            dontAskAgain: false,
            resolve,
          });
        });

        if (!confirmed) return;
      }

      if (paths.length === 1) {
        const missingAssets = await invoke("check_missing_assets", {
          jsonPath: paths[0],
        });

        if (missingAssets.length > 0) {
          setMissingAssetsDialog({
            isOpen: true,
            missingAssets,
            jsonPath: paths[0],
            pendingFiles: filesWithPreviews,
          });
          return;
        }
      }

      await performBulkImport(filesWithPreviews);
    } catch (error) {
      console.error("Import failed:", error);
      toast.error(`Import failed: ${error}`);
    }
  }

  async function performBulkImport(files) {
    importCancelledRef.current = false;

    setImportState({
      active: true,
      files: files.map((f) => ({ ...f, status: "pending" })),
    });

    const importedEntries = [];

    for (let i = 0; i < files.length; i++) {
      if (importCancelledRef.current) {
        setImportState((prev) => ({
          ...prev,
          files: prev.files.map((f, idx) =>
            idx >= i ? { ...f, status: "cancelled" } : f
          ),
        }));
        break;
      }

      setImportState((prev) => ({
        ...prev,
        files: prev.files.map((f, idx) =>
          idx === i ? { ...f, status: "importing" } : f
        ),
      }));

      try {
        const result = await invoke("import_conversation", {
          path: files[i].path,
          alias: null,
        });
        importedEntries.push(result);

        setImportState((prev) => ({
          ...prev,
          files: prev.files.map((f, idx) =>
            idx === i ? { ...f, status: "done" } : f
          ),
        }));
      } catch (error) {
        const errorStr = String(error);
        if (errorStr.includes("cancelled") || errorStr.includes("Interrupted")) {
          setImportState((prev) => ({
            ...prev,
            files: prev.files.map((f, idx) =>
              idx >= i ? { ...f, status: "cancelled" } : f
            ),
          }));
          break;
        }

        setImportState((prev) => ({
          ...prev,
          files: prev.files.map((f, idx) =>
            idx === i ? { ...f, status: "failed", error: errorStr } : f
          ),
        }));
      }
    }

    await loadImports();

    if (importedEntries.length > 0) {
      const body =
        importedEntries.length === 1
          ? `"${importedEntries[0].alias}" has been imported.`
          : `${importedEntries.length} conversations imported successfully.`;
      sendAppNotification("Import Complete", body);
    }

    if (files.length === 1 && importedEntries.length === 1) {
      setActiveView(importedEntries[0].id);
    }
  }

  async function handleCancelImport() {
    const allFinished = importState.files.every(
      (f) => f.status === "done" || f.status === "failed" || f.status === "cancelled"
    );

    if (allFinished) {
      setImportState({ active: false, files: [] });
      return;
    }

    importCancelledRef.current = true;
    try {
      await invoke("cancel_import");
    } catch (error) {
      console.error("Failed to cancel import:", error);
    }
  }

  function handleSizeWarningConfirm() {
    const { resolve, dontAskAgain } = sizeWarning;

    if (dontAskAgain) {
      invoke("get_config")
        .then((config) => {
          config.skipLargeImportWarning = true;
          return invoke("update_config", { config });
        })
        .catch((e) => console.error("Failed to save config:", e));
    }

    setSizeWarning((prev) => ({ ...prev, isOpen: false }));
    resolve?.(true);
  }

  function handleSizeWarningCancel() {
    const { resolve } = sizeWarning;
    setSizeWarning((prev) => ({ ...prev, isOpen: false }));
    resolve?.(false);
  }

  function handleMissingAssetsCancel() {
    setMissingAssetsDialog({ isOpen: false, missingAssets: [], jsonPath: null });
  }

  function handleMissingAssetsContinue() {
    const pendingFiles = missingAssetsDialog.pendingFiles;
    setMissingAssetsDialog({ isOpen: false, missingAssets: [], jsonPath: null });
    if (pendingFiles) {
      performBulkImport(pendingFiles);
    }
  }

  function openConversation(importId) {
    // Check if outdated
    const imp = imports.find((i) => {
      const id = i.id || i.entry?.id;
      return id === importId;
    });
    if (
      imp &&
      !imp.compatibility?.isCompatible &&
      imp.compatibility?.needsUpdate
    ) {
      setOutdatedPrompt(imp);
      return;
    }
    setActiveView(importId);
  }

  async function handleSingleUpdate() {
    if (!outdatedPrompt) return;
    const importId = outdatedPrompt.id || outdatedPrompt.entry?.id;
    setOutdatedPrompt(null);

    try {
      setUpdating(true);
      await invoke("batch_reimport_conversations", {
        importIds: [importId],
      });
      toast.success("Conversation updated successfully");
      await loadImports();
      setActiveView(importId);
    } catch (error) {
      console.error("Update failed:", error);
      toast.error(`Update failed: ${error}`);
    } finally {
      setUpdating(false);
    }
  }

  async function deleteImport(importId) {
    setConfirmDeleteImport(importId);
  }

  async function confirmDelete() {
    if (!confirmDeleteImport) return;
    try {
      await invoke("delete_import", { importId: confirmDeleteImport });
      await loadImports();
      if (activeView === confirmDeleteImport) {
        setActiveView(null);
      }
    } catch (error) {
      console.error("Unimport failed:", error);
      toast.error(`Unimport failed: ${error}`);
    }
    setConfirmDeleteImport(null);
  }

  async function updateImport(updatedImport) {
    try {
      await invoke("update_import", {
        importId: updatedImport.id,
        alias: updatedImport.alias,
        description: updatedImport.description || null,
      });
      await loadImports();
      setEditingImport(null);
    } catch (error) {
      console.error("Update failed:", error);
      toast.error(`Update failed: ${error}`);
    }
  }

  async function exportConversation(importId) {
    try {
      const destPath = await open({
        directory: true,
        multiple: false,
        title: "Select folder to save export",
      });
      if (!destPath) return;

      await invoke("export_selected_conversations", {
        destPath,
        importIds: [importId],
      });
      toast.success("Conversation exported successfully");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(`Export failed: ${error}`);
    }
  }

  async function reorderImports(orderedIds) {
    setConversationOrder(orderedIds);
    try {
      await invoke("reorder_imports", { orderedIds });
    } catch (error) {
      console.error("Reorder failed:", error);
    }
  }

  async function handleRemoveMissingImports() {
    try {
      for (const imp of missingImports) {
        await invoke("delete_import", { importId: imp.id });
      }
      toast.success(`Removed ${missingImports.length} missing conversation(s)`);
      setMissingImports([]);
      setShowMissingImportsDialog(false);
      await loadImports();
    } catch (error) {
      console.error("Failed to remove missing imports:", error);
      toast.error(`Failed to remove missing imports: ${error}`);
    }
  }

  async function handleBatchUpdate() {
    try {
      setUpdating(true);

      const importIds = incompatibleImports.map((imp) => imp.id);
      console.log("Batch updating imports:", importIds);

      const results = await invoke("batch_reimport_conversations", {
        importIds,
      });

      console.log("Batch update results:", results);

      const successes = results.filter(
        ([_, result]) => result.hasOwnProperty("Ok")
      ).length;
      const failures = results.filter(
        ([_, result]) => !result.hasOwnProperty("Ok")
      ).length;

      if (successes > 0) {
        toast.success(`Successfully updated ${successes} conversation(s)`);
        sendAppNotification(
          "Update Complete",
          `${successes} conversation(s) updated successfully.`
        );
      }
      if (failures > 0) {
        toast.error(`Failed to update ${failures} conversation(s)`);
      }

      await loadImports();
      setUpdating(false);
    } catch (error) {
      setUpdating(false);
      console.error("Batch update failed:", error);
      toast.error(`Batch update failed: ${error}`);
    }
  }

  if (loading) {
    return (
      <div className="app" style={themeStyle}>
        <div className="loading">Loading Sapper...</div>
      </div>
    );
  }

  const sortedImports = getSortedImports();

  return (
    <div className="app" style={themeStyle}>
      {updating && <ProgressDialog message="Updating conversations..." />}

      <ImportDialog
        isOpen={importState.active}
        files={importState.files}
        onCancel={handleCancelImport}
      />

      <Dialog
        isOpen={sizeWarning.isOpen}
        onClose={handleSizeWarningCancel}
        title="Large Import Warning"
        confirmText="Continue Import"
        cancelText="Cancel"
        onConfirm={handleSizeWarningConfirm}
        onCancel={handleSizeWarningCancel}
        type="default"
      >
        <div className="dialog-message">
          <p>
            The attachments folder is{" "}
            <strong>{formatBytes(sizeWarning.attachmentsSize)}</strong>, which
            exceeds 3 GB.
          </p>
          <p>
            Total space needed:{" "}
            <strong>{formatBytes(sizeWarning.totalSize)}</strong>
          </p>
          <label className="custom-checkbox" style={{ marginTop: "1rem" }}>
            <input
              type="checkbox"
              checked={sizeWarning.dontAskAgain}
              onChange={(e) =>
                setSizeWarning((prev) => ({
                  ...prev,
                  dontAskAgain: e.target.checked,
                }))
              }
            />
            <span className="checkmark" />
            Don't ask me again
          </label>
        </div>
      </Dialog>

      <MissingAssetsDialog
        isOpen={missingAssetsDialog.isOpen}
        missingAssets={missingAssetsDialog.missingAssets}
        jsonPath={missingAssetsDialog.jsonPath}
        onContinue={handleMissingAssetsContinue}
        onCancel={handleMissingAssetsCancel}
      />

      <Dialog
        isOpen={showMissingImportsDialog}
        onClose={() => setShowMissingImportsDialog(false)}
        title="Missing Conversations"
        confirmText="Remove All"
        cancelText="Dismiss"
        onConfirm={handleRemoveMissingImports}
        onCancel={() => setShowMissingImportsDialog(false)}
        type="danger"
      >
        <div className="dialog-message">
          <p>
            {missingImports.length} conversation{missingImports.length !== 1 ? "s have" : " has"} missing data folders. The original import folder may have been moved or deleted.
          </p>
          <div style={{ marginTop: "0.75rem", maxHeight: "200px", overflowY: "auto" }}>
            {missingImports.map((imp) => {
              const entry = imp.entry || imp;
              const name = entry.alias || entry.channelName || "Unknown";
              return (
                <div key={entry.id} style={{
                  padding: "0.5rem 0.75rem",
                  marginBottom: "0.25rem",
                  background: "var(--backgroundTertiary)",
                  borderRadius: "4px",
                  fontSize: "0.875rem",
                }}>
                  <div style={{ fontWeight: 500, color: "var(--textPrimary)" }}>{name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--textMuted)", marginTop: "2px" }}>
                    {entry.channelName} in {entry.guildName} &bull; {entry.messageCount.toLocaleString()} messages
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--textMuted)", marginTop: "2px", wordBreak: "break-all" }}>
                    {entry.importPath}
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--textMuted)" }}>
            You can remove these entries to clean up your list, or dismiss to keep them.
          </p>
        </div>
      </Dialog>

      {/* Outdated conversation prompt */}
      <Dialog
        isOpen={!!outdatedPrompt}
        onClose={() => setOutdatedPrompt(null)}
        title="Outdated Conversation"
        confirmText="Update Now"
        cancelText="Cancel"
        onConfirm={handleSingleUpdate}
        onCancel={() => setOutdatedPrompt(null)}
        type="default"
      >
        <div className="dialog-message">
          <p>
            This conversation needs to be updated before it can be opened. Would you like to update it now?
          </p>
        </div>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        isOpen={!!confirmDeleteImport}
        onClose={() => setConfirmDeleteImport(null)}
        title="Unimport Conversation"
        message="Are you sure you want to unimport this conversation? The original folder you imported from will remain, but our copy will be permanently erased."
        confirmText="Unimport"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteImport(null)}
        type="danger"
      />

      <Guide
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
      />

      <Changelog
        isOpen={showChangelog}
        onClose={handleCloseChangelog}
        version={currentVersion}
      />

      {editingImport && (
        <EditDialog
          importEntry={editingImport}
          onClose={() => setEditingImport(null)}
          onSave={updateImport}
          onUnimport={(id) => {
            setEditingImport(null);
            deleteImport(id);
          }}
        />
      )}

      {infoImport && (
        <InfoDialog
          importEntry={infoImport}
          onClose={() => setInfoImport(null)}
        />
      )}

      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentTheme={theme}
        onThemeChange={setTheme}
        imports={imports}
        onImportComplete={loadImports}
        onShowChangelog={() => setShowChangelog(true)}
        currentVersion={currentVersion}
        debugMode={debugMode}
        onDebugModeChange={setDebugMode}
      />

      <div className="app-layout">
        <Sidebar
          imports={sortedImports}
          activeView={activeView}
          onOpenConversation={openConversation}
          onImport={handleImport}
          onSettingsClick={() => setSettingsOpen(true)}
          onEditImport={setEditingImport}
          onDeleteImport={deleteImport}
          onExportConversation={exportConversation}
          onInfoClick={setInfoImport}
          incompatibleImports={incompatibleImports}
          onBatchUpdate={handleBatchUpdate}
          onReorder={reorderImports}
          onGuideClick={() => setShowGuide(true)}
        />

        <main className="content">
          {activeView ? (
            <ConversationViewer
              importId={activeView}
              theme={theme}
              key={activeView}
              debugMode={debugMode}
            />
          ) : (
            <div className="empty-state">
              <div className="empty-state-content">
                <h2 className="title">Welcome to Sapper</h2>
                <p>Select a conversation from the sidebar or import a new one.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
      <ReactToastifyContainer
        theme="dark"
        position="bottom-right"
        style={{
          "--toastify-color-dark": "#2b2d31",
          "--toastify-text-color-dark": "#dbdee1",
        }}
      />
    </ToastProvider>
  );
}

export default App;
