import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { toast } from "react-toastify";

function UpdateNotification() {
  const toastIdRef = useRef(null);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (!hasCheckedRef.current) {
      hasCheckedRef.current = true;
      checkForUpdates();
    }
  }, []);

  const checkForUpdates = async () => {
    try {
      const update = await invoke("check_for_update");
      if (update) {
        showUpdateToast(update);
      }
    } catch (err) {
      console.error("Failed to check for updates:", err);
    }
  };

  const showUpdateToast = (updateInfo) => {
    toastIdRef.current = toast.info(
      <UpdateContent updateInfo={updateInfo} onInstall={() => handleInstall(updateInfo)} />,
      {
        position: "bottom-right",
        autoClose: false,
        closeOnClick: false,
        draggable: false,
        closeButton: true,
        style: {
          background: "#2b2d31",
          color: "#dbdee1",
        },
      }
    );
  };

  const handleInstall = async (updateInfo) => {
    // Update the toast to show installing state
    toast.update(toastIdRef.current, {
      render: <InstallingContent />,
      closeButton: false,
      style: {
        background: "#2b2d31",
        color: "#dbdee1",
      },
    });

    try {
      // Listen for download progress
      const { listen } = await import("@tauri-apps/api/event");
      const unlisten = await listen("update-download-progress", (event) => {
        const { chunk_length, content_length } = event.payload;
        if (content_length) {
          const percentage = Math.round((chunk_length / content_length) * 100);
          toast.update(toastIdRef.current, {
            render: <DownloadingContent percentage={percentage} />,
            closeButton: false,
            style: {
              background: "#2b2d31",
              color: "#dbdee1",
            },
          });
        }
      });

      // Download and install the update
      await invoke("download_and_install_update");

      // Cleanup listener
      unlisten();

      // On Windows, the app will automatically exit during installation
      // So we attempt to relaunch, but it may not be necessary
      try {
        await relaunch();
      } catch (e) {
        // Relaunch might fail on Windows because the app exits during install
        console.log("Relaunch not needed or failed:", e);
      }
    } catch (err) {
      console.error("Failed to install update:", err);
      toast.update(toastIdRef.current, {
        render: <ErrorContent error={err.toString()} />,
        type: "error",
        closeButton: true,
        style: {
          background: "#2b2d31",
          color: "#dbdee1",
        },
      });
    }
  };

  return null;
}

function UpdateContent({ updateInfo, onInstall }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div>
        <div style={{ fontWeight: 600, marginBottom: "4px", fontSize: "15px" }}>
          Update Available
        </div>
        <div style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.8)" }}>
          Version {updateInfo.version} is now available. <br/><br/>It's best to keep Sapper up to date for security and better features.
        </div>
        {updateInfo.body && (
          <div
            style={{
              marginTop: "8px",
              paddingTop: "8px",
              borderTop: "1px solid rgba(255, 255, 255, 0.1)",
              fontSize: "12px",
              color: "rgba(255, 255, 255, 0.7)",
              maxHeight: "80px",
              overflowY: "auto",
            }}
          >
            {updateInfo.body}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        <button
          onClick={onInstall}
          style={{
            padding: "6px 16px",
            borderRadius: "6px",
            border: "none",
            background: "#4CAF50",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "13px",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => (e.target.style.background = "#45a049")}
          onMouseLeave={(e) => (e.target.style.background = "#4CAF50")}
        >
          Install Now
        </button>
      </div>
    </div>
  );
}

function DownloadingContent({ percentage }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ fontWeight: 600, fontSize: "15px" }}>
        ⬇️ Downloading Update...
      </div>
      <div style={{ width: "100%", height: "6px", background: "rgba(255, 255, 255, 0.2)", borderRadius: "3px", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            background: "#4CAF50",
            width: `${percentage}%`,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <div style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.8)", textAlign: "center" }}>
        {percentage}%
      </div>
    </div>
  );
}

function InstallingContent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ fontWeight: 600, fontSize: "15px" }}>
        ⚙️ Installing Update...
      </div>
      <div style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.8)" }}>
        Please wait while the update is being installed.
      </div>
    </div>
  );
}

function ErrorContent({ error }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ fontWeight: 600, fontSize: "15px" }}>
        ⚠️ Update Error
      </div>
      <div style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.9)" }}>
        {error}
      </div>
    </div>
  );
}

export default UpdateNotification;
