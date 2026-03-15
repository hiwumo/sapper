import { useState, useRef } from "react";
import { MoreVertical, AlertTriangle, GripVertical } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import DropdownMenu from "./DropdownMenu";
import "./SidebarItem.css";

function SidebarItem({
  importEntry,
  isActive,
  isOutdated,
  onClick,
  onEdit,
  onDelete,
  onExport,
  onInfo,
  onGripMouseDown,
  isDragging,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef(null);

  const entry = importEntry.entry || importEntry;

  const getDisplayName = () => {
    if (entry.alias) return entry.alias;
    if (entry.guildName === "Direct Messages") {
      return `${entry.channelName} in DMs`;
    }
    return `${entry.channelName} in ${entry.guildName}`;
  };

  const getAvatar = () => {
    if (entry.avatarPath) {
      try {
        return convertFileSrc(entry.avatarPath);
      } catch {
        return null;
      }
    }
    return null;
  };

  const avatarSrc = getAvatar();
  const initial = (entry.guildName || entry.channelName || "?")[0].toUpperCase();

  const menuItems = [
    { label: "Info", onClick: () => { setMenuOpen(false); onInfo(); } },
    { label: "Edit", onClick: () => { setMenuOpen(false); onEdit(); } },
    { label: "Export", onClick: () => { setMenuOpen(false); onExport(); } },
    { label: "Unimport", danger: true, onClick: () => { setMenuOpen(false); onDelete(); } },
  ];

  return (
    <div
      className={`sidebar-item ${isActive ? "active" : ""} ${isOutdated ? "outdated" : ""} ${isDragging ? "dragging" : ""}`}
      onClick={onClick}
    >
      <div
        className="sidebar-item-drag-handle"
        onMouseDown={(e) => {
          e.preventDefault();
          onGripMouseDown(e);
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={14} />
      </div>

      <div className="sidebar-item-avatar">
        {avatarSrc ? (
          <img src={avatarSrc} alt="" />
        ) : (
          <div className="sidebar-item-avatar-fallback">{initial}</div>
        )}
      </div>

      <div className="sidebar-item-content">
        <div className="sidebar-item-name">
          {getDisplayName()}
          {isOutdated && (
            <AlertTriangle size={12} className="sidebar-item-outdated-icon" />
          )}
        </div>
        {entry.description && (
          <div className="sidebar-item-description">{entry.description}</div>
        )}
      </div>

      <div
        className="sidebar-item-menu-container"
        style={{ position: "relative" }}
      >
        <button
          ref={menuBtnRef}
          className="sidebar-item-menu-btn"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
        >
          <MoreVertical size={16} />
        </button>
        {menuOpen && (
          <DropdownMenu items={menuItems} onClose={() => setMenuOpen(false)} />
        )}
      </div>
    </div>
  );
}

export default SidebarItem;
