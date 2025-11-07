import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ToastContainer as ReactToastifyContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import Navbar from "./components/Navbar";
import Home from "./components/Home";
import ConversationViewer from "./components/ConversationViewer";
import ProgressDialog from "./components/ProgressDialog";
import Settings from "./components/Settings";
import MissingAssetsDialog from "./components/MissingAssetsDialog";
import Changelog from "./components/Changelog";
import { ToastProvider, useToast } from "./components/ToastContainer";
import { getSavedTheme } from "./themes";

function AppContent() {
  const toast = useToast();
  const [activeView, setActiveView] = useState("home");
  const [openTabs, setOpenTabs] = useState([]);
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
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

  useEffect(() => {
    initApp();
    setupConsoleLogging();
  }, []);

  function setupConsoleLogging() {
    // Store original console methods
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    const originalConsoleLog = console.log;

    // Override console.error to also log to Rust backend
    console.error = (...args) => {
      originalConsoleError(...args);
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      invoke("log_frontend_error", { message }).catch(() => {});
    };

    // Override console.warn to also log to Rust backend
    console.warn = (...args) => {
      originalConsoleWarn(...args);
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      invoke("log_frontend_warning", { message }).catch(() => {});
    };

    // Also capture unhandled errors
    window.addEventListener('error', (event) => {
      const message = `Unhandled error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
      invoke("log_frontend_error", { message }).catch(() => {});
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
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
      const lastChangelogVersion = config.lastChangelogVersion;

      // Show changelog if version is different from last shown
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

      // Check for incompatible imports
      const incompatible = importsList.filter(
        (imp) => !imp.compatibility.isCompatible && imp.compatibility.needsUpdate
      );
      if (incompatible.length > 0) {
        console.log("incompatible:", incompatible);
        setIncompatibleImports(incompatible);
      }
    } catch (error) {
      console.error("Failed to load imports:", error);
    }
  }

  async function handleImport() {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "JSON",
            extensions: ["json"],
          },
        ],
      });

      if (selected) {
        // Check for missing assets first
        const missingAssets = await invoke("check_missing_assets", {
          jsonPath: selected,
        });

        if (missingAssets.length > 0) {
          // Show missing assets dialog
          setMissingAssetsDialog({
            isOpen: true,
            missingAssets,
            jsonPath: selected,
          });
        } else {
          // No missing assets, proceed with import
          await performImport(selected);
        }
      }
    } catch (error) {
      console.error("Import failed:", error);
      toast.error(`Import failed: ${error}`);
    }
  }

  async function performImport(jsonPath) {
    try {
      setImporting(true);
      setMissingAssetsDialog({ isOpen: false, missingAssets: [], jsonPath: null });

      const importEntry = await invoke("import_conversation", {
        path: jsonPath,
        alias: null,
      });
      console.log("import entry:", importEntry);

      await loadImports();
      console.log("loaded imports");
      setImporting(false);
      openConversation(importEntry.id);
    } catch (error) {
      setImporting(false);
      console.error("Import failed:", error);
      toast.error(`Import failed: ${error}`);
    }
  }

  function handleMissingAssetsCancel() {
    setMissingAssetsDialog({ isOpen: false, missingAssets: [], jsonPath: null });
  }

  function handleMissingAssetsContinue() {
    performImport(missingAssetsDialog.jsonPath);
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

      // Update tab name if it's open
      setOpenTabs(openTabs.map(tab =>
        tab.id === updatedImport.id
          ? { ...tab, name: updatedImport.alias }
          : tab
      ));
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

      // Count successes and failures
      const successes = results.filter(([_, result]) => result.hasOwnProperty('Ok')).length;
      const failures = results.filter(([_, result]) => !result.hasOwnProperty('Ok')).length;

      if (successes > 0) {
        toast.success(`Successfully updated ${successes} conversation(s)`);
      }
      if (failures > 0) {
        toast.error(`Failed to update ${failures} conversation(s)`);
      }

      // Reload imports to get updated compatibility info
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
      {importing && <ProgressDialog message="Importing conversation..." />}
      {updating && <ProgressDialog message="Updating conversations..." />}

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
          '--toastify-color-dark': '#2b2d31',
          '--toastify-text-color-dark': '#dbdee1',
        }}
      />
    </ToastProvider>
  );
}

export default App;
