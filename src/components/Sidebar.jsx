import { useState, useRef } from "react";
import { Plus, Settings, AlertTriangle, X, HelpCircle } from "lucide-react";
import SidebarItem from "./SidebarItem";
import "./Sidebar.css";

function Sidebar({
  imports,
  activeView,
  onOpenConversation,
  onImport,
  onSettingsClick,
  onEditImport,
  onDeleteImport,
  onExportConversation,
  onInfoClick,
  incompatibleImports,
  onBatchUpdate,
  onReorder,
  onGuideClick,
}) {
  const [showOutdatedBanner, setShowOutdatedBanner] = useState(true);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragItemIndex = useRef(null);

  const outdatedCount = incompatibleImports.length;

  const handleDragStart = (index) => {
    dragItemIndex.current = index;
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (dragItemIndex.current === null) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const fromIndex = dragItemIndex.current;
    if (fromIndex === null || fromIndex === dropIndex) {
      setDragOverIndex(null);
      dragItemIndex.current = null;
      return;
    }

    const reordered = [...imports];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    const orderedIds = reordered.map((imp) => imp.id);
    onReorder(orderedIds);

    setDragOverIndex(null);
    dragItemIndex.current = null;
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
    dragItemIndex.current = null;
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title title">Sapper</span>
        <div className="sidebar-header-actions">
          <button
            className="sidebar-icon-btn"
            onClick={onImport}
            title="Import conversation"
          >
            <Plus size={18} />
          </button>
          <button
            className="sidebar-icon-btn"
            onClick={onGuideClick}
            title="Guide"
          >
            <HelpCircle size={18} />
          </button>
          <button
            className="sidebar-icon-btn"
            onClick={onSettingsClick}
            title="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {outdatedCount > 0 && showOutdatedBanner && (
        <div className="sidebar-outdated-banner">
          <AlertTriangle size={14} />
          <span>
            {outdatedCount} outdated
          </span>
          <button className="sidebar-banner-btn" onClick={onBatchUpdate}>
            Update
          </button>
          <button
            className="sidebar-banner-dismiss"
            onClick={() => setShowOutdatedBanner(false)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="sidebar-list" onDragEnd={handleDragEnd}>
        {imports.length === 0 ? (
          <div className="sidebar-empty">
            <p>No conversations yet</p>
            <button className="sidebar-import-btn" onClick={onImport}>
              Import a conversation
            </button>
          </div>
        ) : (
          imports.map((imp, index) => (
            <div
              key={imp.id}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
            >
              {dragOverIndex === index && dragItemIndex.current !== index && (
                <div className="sidebar-drop-indicator" />
              )}
              <SidebarItem
                importEntry={imp}
                isActive={activeView === imp.id}
                isOutdated={
                  !imp.compatibility?.isCompatible &&
                  imp.compatibility?.needsUpdate
                }
                onClick={() => onOpenConversation(imp.id)}
                onEdit={() => onEditImport(imp)}
                onDelete={() => onDeleteImport(imp.id)}
                onExport={() => onExportConversation(imp.id)}
                onInfo={() => onInfoClick(imp)}
                onDragStart={() => handleDragStart(index)}
                index={index}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Sidebar;
