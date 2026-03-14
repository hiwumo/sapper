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
import Navbar from "./components/Navbar";
import Home from "./components/Home";
import ConversationViewer from "./components/ConversationViewer";
import ProgressDialog from "./components/ProgressDialog";
import ImportDialog from "./components/ImportDialog";
import Dialog from "./components/Dialog";
import Settings from "./components/Settings";
import MissingAssetsDialog from "./components/MissingAssetsDialog";
import Changelog from "./components/Changelog";
import { ToastProvider, useToast } from "./components/ToastContainer";
import { getSavedTheme } from "./themes";

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function AppContent() {
  const toast = useToast();
  const [activeView, setActiveView] = useState("home");
  const [openTabs, setOpenTabs] = useState([]);
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
  const [updating, setUpdating] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);

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

  function setupConsoleLogging() {
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    console.error = (...args) => {
      originalConsoleError(...args);
      const message = args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg) : String(arg)
        )
        .join(" ");
      invoke("log_frontend_error", { message }).catch(() => { });
    };

    console.warn = (...args) => {
      originalConsoleWarn(...args);
      const message = args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg) : String(arg)
        )
        .join(" ");
      invoke("log_frontend_warning", { message }).catch(() => { });
    };

    window.addEventListener("error", (event) => {
      const message = `Unhandled error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
      invoke("log_frontend_error", { message }).catch(() => { });
    });

    window.addEventListener("unhandledrejection", (event) => {
      const message = `Unhandled promise rejection: ${event.reason}`;
      invoke("log_frontend_error", { message }).catch(() => { });
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
      setImports(importsList);

      const incompatible = importsList.filter(
        (imp) => !imp.compatibility.isCompatible && imp.compatibility.needsUpdate
      );
      setIncompatibleImports(incompatible);
    } catch (error) {
      console.error("Failed to load imports:", error);
    }
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

      // Get previews for all files
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

      // Check total attachments size
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

      // For single file, check missing assets
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

      // Start import
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
        // Mark remaining as cancelled
        setImportState((prev) => ({
          ...prev,
          files: prev.files.map((f, idx) =>
            idx >= i ? { ...f, status: "cancelled" } : f
          ),
        }));
        break;
      }

      // Mark current as importing
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

    // Reload imports
    await loadImports();

    // Send notification
    if (importedEntries.length > 0) {
      const body =
        importedEntries.length === 1
          ? `"${importedEntries[0].alias}" has been imported.`
          : `${importedEntries.length} conversations imported successfully.`;
      sendAppNotification("Import Complete", body);
    }

    // If single file imported successfully, open it
    if (files.length === 1 && importedEntries.length === 1) {
      openConversation(importedEntries[0].id);
    }
  }

  async function handleCancelImport() {
    const allFinished = importState.files.every(
      (f) => f.status === "done" || f.status === "failed" || f.status === "cancelled"
    );

    if (allFinished) {
      // Just close the dialog
      setImportState({ active: false, files: [] });
      return;
    }

    // Cancel in-progress import
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
    const existingTab = openTabs.find((tab) => tab.id === importId);
    if (existingTab) {
      setActiveView(importId);
      return;
    }

    const importEntry = imports.find((imp) => imp.id === importId);
    if (importEntry) {
      setOpenTabs([...openTabs, { id: importId, name: importEntry.alias }]);
      setActiveView(importId);
    }
  }

  function closeTab(tabId) {
    setOpenTabs(openTabs.filter((tab) => tab.id !== tabId));
    if (activeView === tabId) {
      setActiveView("home");
    }
  }

  async function deleteImport(importId) {
    try {
      await invoke("delete_import", { importId });
      await loadImports();
      closeTab(importId);
    } catch (error) {
      console.error("Unimport failed:", error);
      toast.error(`Unimport failed: ${error}`);
    }
  }

  async function updateImport(updatedImport) {
    try {
      await invoke("update_import", {
        importId: updatedImport.id,
        alias: updatedImport.alias,
      });
      await loadImports();

      setOpenTabs(
        openTabs.map((tab) =>
          tab.id === updatedImport.id
            ? { ...tab, name: updatedImport.alias }
            : tab
        )
      );
    } catch (error) {
      console.error("Update failed:", error);
      toast.error(`Update failed: ${error}`);
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
      <div className="app">
        <div className="loading">Loading Sapper...</div>
      </div>
    );
  }

  return (
    <div className="app">
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

      <Changelog
        isOpen={showChangelog}
        onClose={handleCloseChangelog}
        version={currentVersion}
      />

      <Navbar
        activeView={activeView}
        openTabs={openTabs}
        onTabClick={setActiveView}
        onCloseTab={closeTab}
        onSettingsClick={() => setSettingsOpen(true)}
      />

      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentTheme={theme}
        onThemeChange={setTheme}
        imports={imports}
        onImportComplete={loadImports}
        onShowChangelog={() => setShowChangelog(true)}
        currentVersion={currentVersion}
      />

      <main className="content">
        {activeView === "home" ? (
          <Home
            imports={imports}
            onOpenConversation={openConversation}
            onDeleteImport={deleteImport}
            onUpdateImport={updateImport}
            onImport={handleImport}
            onBatchUpdate={handleBatchUpdate}
            incompatibleCount={incompatibleImports.length}
          />
        ) : (
          <ConversationViewer
            importId={activeView}
            theme={theme}
            key={activeView}
          />
        )}
      </main>
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
