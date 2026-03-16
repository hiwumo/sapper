import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Plus, Settings, AlertTriangle, X, HelpCircle } from "lucide-react";
import SidebarItem from "./SidebarItem";
import "./Sidebar.css";

function reorder(items, fromIndex, toIndex) {
  if (fromIndex === toIndex) return null;
  const reordered = [...items];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  return reordered;
}

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
  onReimport,
  incompatibleImports,
  onBatchUpdate,
  onReorder,
  onGuideClick,
}) {
  const [showOutdatedBanner, setShowOutdatedBanner] = useState(true);
  const [dragItemIdx, setDragItemIdx] = useState(null);
  const [targetIdx, setTargetIdx] = useState(null);

  const dragItemIndexRef = useRef(null);
  const targetIdxRef = useRef(null);
  const importsRef = useRef(imports);
  const onReorderRef = useRef(onReorder);
  const wrapperRefs = useRef([]);
  // Snapshot of item midpoints taken at drag start — immune to reorder shifting
  const slotMidpoints = useRef([]);

  importsRef.current = imports;
  onReorderRef.current = onReorder;

  const outdatedCount = incompatibleImports.length;

  const resetDrag = useCallback(() => {
    setDragItemIdx(null);
    setTargetIdx(null);
    dragItemIndexRef.current = null;
    targetIdxRef.current = null;
    slotMidpoints.current = [];
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (dragItemIndexRef.current === null) return;
    const fromIndex = dragItemIndexRef.current;
    const midpoints = slotMidpoints.current;
    if (midpoints.length === 0) return;

    // Find which slot the cursor belongs to
    let newTarget = fromIndex;
    const y = e.clientY;

    if (y <= midpoints[0]) {
      newTarget = 0;
    } else if (y >= midpoints[midpoints.length - 1]) {
      newTarget = midpoints.length - 1;
    } else {
      for (let i = 0; i < midpoints.length - 1; i++) {
        if (y >= midpoints[i] && y < midpoints[i + 1]) {
          // Closer to i or i+1?
          newTarget = (y - midpoints[i] < midpoints[i + 1] - y) ? i : i + 1;
          break;
        }
      }
    }

    if (newTarget !== targetIdxRef.current) {
      targetIdxRef.current = newTarget;
      setTargetIdx(newTarget);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);

    const fromIndex = dragItemIndexRef.current;
    const toIndex = targetIdxRef.current;

    if (fromIndex !== null && toIndex !== null && fromIndex !== toIndex) {
      const reordered = reorder(importsRef.current, fromIndex, toIndex);
      if (reordered) {
        const orderedIds = reordered.map((imp) => imp.id);
        onReorderRef.current(orderedIds);
      }
    }

    resetDrag();
  }, [handleMouseMove, resetDrag]);

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleGripMouseDown = (index) => {
    // Snapshot midpoints of all items before anything moves
    const midpoints = [];
    for (let i = 0; i < imports.length; i++) {
      const el = wrapperRefs.current[i];
      if (el) {
        const rect = el.getBoundingClientRect();
        midpoints.push(rect.top + rect.height / 2);
      }
    }
    slotMidpoints.current = midpoints;

    dragItemIndexRef.current = index;
    targetIdxRef.current = index;
    setDragItemIdx(index);
    setTargetIdx(index);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Compute the visual order preview during drag
  const displayImports = useMemo(() => {
    if (dragItemIdx === null || targetIdx === null || dragItemIdx === targetIdx) {
      return imports;
    }
    return reorder(imports, dragItemIdx, targetIdx) || imports;
  }, [imports, dragItemIdx, targetIdx]);

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

      <div className="sidebar-list">
        {imports.length === 0 ? (
          <div className="sidebar-empty">
            <p>No conversations yet</p>
            <button className="sidebar-import-btn" onClick={onImport}>
              Import a conversation
            </button>
          </div>
        ) : (
          displayImports.map((imp) => {
            const isDragged = dragItemIdx !== null && imp === imports[dragItemIdx];
            // Use stable index from original array for refs
            const origIdx = imports.indexOf(imp);
            return (
              <div
                key={imp.id}
                className="sidebar-item-wrapper"
                ref={(el) => { wrapperRefs.current[origIdx] = el; }}
              >
                <SidebarItem
                  importEntry={imp}
                  isActive={activeView === imp.id}
                  isOutdated={
                    !imp.compatibility?.isCompatible &&
                    imp.compatibility?.needsUpdate
                  }
                  isDragging={isDragged}
                  onClick={() => onOpenConversation(imp.id)}
                  onEdit={() => onEditImport(imp)}
                  onDelete={() => onDeleteImport(imp.id)}
                  onExport={() => onExportConversation(imp.id)}
                  onInfo={() => onInfoClick(imp)}
                  onReimport={() => onReimport(imp.id)}
                  onGripMouseDown={() => handleGripMouseDown(origIdx)}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default Sidebar;
