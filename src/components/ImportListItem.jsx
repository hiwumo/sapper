import { ExternalLink, MoreVertical, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { convertFileSrc } from '@tauri-apps/api/core';
import DropdownMenu from "./DropdownMenu";
import Dialog from "./Dialog";
import "./ImportListItem.css";

function ImportListItem({ importEntry, onOpen, onEdit, onUnimport }) {
  const [showMenu, setShowMenu] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Extract entry and compatibility (if present)
  const entry = importEntry.entry || importEntry;
  const compatibility = importEntry.compatibility || null;
  const isIncompatible = compatibility && !compatibility.isCompatible && compatibility.needsUpdate;

  const getDefaultName = (imp) => {
    if (imp.guildName === "Direct Messages") {
      return `${imp.channelName} in DMs`;
    }
    return `${imp.channelName} in ${imp.guildName}`;
  };

  const getDisplayName = (imp) => {
    const defaultName = getDefaultName(imp);
    return imp.alias || defaultName;
  };

  const getAvatarText = (imp) => {
    if (imp.guildName === "Direct Messages") {
      return imp.channelName[0]?.toUpperCase() || "?";
    }
    return imp.guildName[0]?.toUpperCase() || "?";
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  const handleUnimport = () => {
    setShowMenu(false);
    setConfirmDialogOpen(true);
  };

  const confirmUnimport = () => {
    onUnimport(entry.id);
  };

  const menuItems = [
    {
      label: "Edit",
      onClick: () => {
        setShowMenu(false);
        onEdit(importEntry);
      }
    },
    {
      label: "Unimport",
      onClick: handleUnimport,
      danger: true
    }
  ];

  const getAvatarSrc = () => {
    if (entry.avatarPath && !avatarError) {
      return convertFileSrc(entry.avatarPath);
    }
    return null;
  };

  return (
    <div className={`import-item ${isIncompatible ? 'incompatible' : ''}`}>
      <div className="import-avatar">
        {getAvatarSrc() && !avatarError ? (
          <img
            src={getAvatarSrc()}
            alt={getDisplayName(entry)}
            onError={() => setAvatarError(true)}
          />
        ) : (
          <span className="avatar-fallback">{getAvatarText(entry)}</span>
        )}
      </div>

      <div className="import-info">
        <div className="import-name">
          {getDisplayName(entry)}
          {isIncompatible && (
            <span className="incompatible-badge" title="Incompatible version - needs update">
              <AlertTriangle size={16} />
            </span>
          )}
        </div>
        <div className="import-meta">
          <span className="meta-text">
            Imported at {formatDate(entry.createdAt)}
          </span>
          <span className="meta-separator">•</span>
          <span className="meta-text">
            {entry.messageCount.toLocaleString()} messages
          </span>
          {compatibility && (
            <>
              <span className="meta-separator"> </span>
              <span className="meta-text version-text">
                v{compatibility.importVersion}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="import-actions">
        <button
          className="action-btn open-btn"
          onClick={() => !isIncompatible && onOpen(entry.id)}
          disabled={isIncompatible}
          title={isIncompatible ? "Cannot open - incompatible version" : "Open conversation"}
        >
          <ExternalLink size={18} />
        </button>
        <div className="menu-container">
          <button
            className="action-btn menu-btn"
            onClick={() => setShowMenu(!showMenu)}
            title="More options"
          >
            <MoreVertical size={18} />
          </button>
          {showMenu && (
            <DropdownMenu
              items={menuItems}
              onClose={() => setShowMenu(false)}
            />
          )}
        </div>
      </div>

      <Dialog
        isOpen={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        title="Unimport Conversation"
        message="Are you sure you want to unimport this conversation? The original folder you imported from will remain, but our copy will be permanently erased."
        confirmText="Unimport"
        cancelText="Cancel"
        onConfirm={confirmUnimport}
        type="danger"
      />
    </div>
  );
}

export default ImportListItem;
