import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { FileText, Check, X, Loader, AlertCircle } from "lucide-react";
import "./ImportDialog.css";

function ImportDialog({ isOpen, files, onCancel }) {
  const [currentProgress, setCurrentProgress] = useState(null);

  useEffect(() => {
    let unlisten;

    const setupListener = async () => {
      unlisten = await listen("import-progress", (event) => {
        setCurrentProgress(event.payload);
      });
    };

    if (isOpen) {
      setupListener();
      setCurrentProgress(null);
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, [isOpen]);

  if (!isOpen || !files || files.length === 0) return null;

  const doneCount = files.filter((f) => f.status === "done").length;
  const failedCount = files.filter((f) => f.status === "failed").length;
  const cancelledCount = files.filter((f) => f.status === "cancelled").length;
  const allFinished = files.every(
    (f) => f.status === "done" || f.status === "failed" || f.status === "cancelled"
  );

  const getStatusIcon = (status) => {
    switch (status) {
      case "done":
        return <Check size={18} className="status-icon done" />;
      case "importing":
        return <Loader size={18} className="status-icon importing" />;
      case "failed":
        return <AlertCircle size={18} className="status-icon failed" />;
      case "cancelled":
        return <X size={18} className="status-icon cancelled" />;
      default:
        return <FileText size={18} className="status-icon pending" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "done":
        return <span className="import-status-badge done">Done</span>;
      case "importing":
        return <span className="import-status-badge importing">Importing</span>;
      case "failed":
        return <span className="import-status-badge failed">Failed</span>;
      case "cancelled":
        return <span className="import-status-badge cancelled">Cancelled</span>;
      default:
        return <span className="import-status-badge pending">Pending</span>;
    }
  };

  return (
    <div className="import-dialog-overlay">
      <div className="import-dialog">
        <div className="import-dialog-header">
          <h2>
            {allFinished
              ? "Import Complete"
              : `Importing ${files.length > 1 ? "Conversations" : "Conversation"}`}
          </h2>
          <br />
          {allFinished && (
            <button className="import-dialog-close" onClick={onCancel}>
              <X size={20} />
            </button>
          )}
        </div>

        <div className="import-dialog-content">
          <div className="import-file-list">
            {files.map((file, idx) => (
              <div key={idx} className={`import-file-item ${file.status}`}>
                <div className="import-file-icon">{getStatusIcon(file.status)}</div>
                <div className="import-file-info">
                  <span className="import-file-name">
                    {file.preview
                      ? file.preview.guildId === "0"
                        ? file.preview.channelName
                        : `${file.preview.channelName} in ${file.preview.guildName}`
                      : file.name}
                  </span>
                  {file.preview && (
                    <span className="import-file-details">
                      {file.preview.messageCount.toLocaleString()} messages
                    </span>
                  )}
                  {file.error && (
                    <span className="import-file-error">{file.error}</span>
                  )}
                </div>
                <div className="import-file-status">{getStatusBadge(file.status)}</div>
              </div>
            ))}
          </div>

          {!allFinished && (
            <p className="import-tab-hint">Feel free to tab out, we'll notify you when it's ready!</p>
          )}

          {/* Current phase progress */}
          {currentProgress && !allFinished && (
            <div className="import-current-progress">
              <div className="import-progress-label">{currentProgress.message}</div>
              {currentProgress.total && (
                <div className="import-progress-bar-container">
                  <div
                    className="import-progress-bar-fill"
                    style={{
                      width: `${Math.round(
                        (currentProgress.current / currentProgress.total) * 100
                      )}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Overall progress for bulk */}
          {files.length > 1 && (
            <div className="import-overall-progress">
              <div className="import-overall-label">
                <span>
                  {doneCount} of {files.length} complete
                  {failedCount > 0 && ` (${failedCount} failed)`}
                </span>
                <span className="import-overall-percent">
                  {Math.round((doneCount / files.length) * 100)}%
                </span>
              </div>
              <div className="import-progress-bar-container overall">
                <div
                  className="import-progress-bar-fill"
                  style={{ width: `${(doneCount / files.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Summary when done */}
          {allFinished && (
            <div className="import-summary">
              {doneCount > 0 && (
                <span className="summary-item success">
                  {doneCount} imported successfully
                </span>
              )}
              {failedCount > 0 && (
                <span className="summary-item failed">
                  {failedCount} failed
                </span>
              )}
              {cancelledCount > 0 && (
                <span className="summary-item cancelled">
                  {cancelledCount} cancelled
                </span>
              )}
            </div>
          )}
        </div>

        <div className="import-dialog-footer">
          {allFinished ? (
            <button className="import-dialog-btn close" onClick={onCancel}>
              Close
            </button>
          ) : (
            <button className="import-dialog-btn cancel" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImportDialog;
