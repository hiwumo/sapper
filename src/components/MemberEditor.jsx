import { useState, useEffect } from "react";
import { X, Upload } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import "./MemberEditor.css";

function MemberEditor({ isOpen, onClose, member, importId, importPath, onUpdate }) {
  const [nickname, setNickname] = useState("");
  const [avatarPath, setAvatarPath] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (member) {
      setNickname(member.name || "");
      setAvatarPath(member.avatar || "");
    }
  }, [member]);

  if (!isOpen || !member) return null;

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Update member in backend
      await invoke("update_member", {
        importId,
        memberId: member.id,
        nickname: nickname !== member.name ? nickname : null,
        avatarUrl: avatarPath !== member.avatar ? avatarPath : null,
      });

      // Notify parent to reload
      if (onUpdate) {
        onUpdate();
      }

      onClose();
    } catch (error) {
      console.error("Failed to update member:", error);
      alert(`Failed to update member: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectAvatar = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "Images",
            extensions: ["png", "jpg", "jpeg", "gif", "webp"],
          },
        ],
        title: "Select Avatar Image",
      });

      if (selected) {
        setAvatarPath(selected);
      }
    } catch (error) {
      console.error("Failed to select avatar:", error);
      alert(`Failed to select avatar: ${error}`);
    }
  };

  // Properly handle avatar path - check if it's already a full path or relative
  const avatarUrl = avatarPath
    ? (avatarPath.includes('\\') || avatarPath.includes('/'))
      ? convertFileSrc(avatarPath)  // Full path
      : convertFileSrc(`${importPath}\\attachments\\${avatarPath}`)  // Relative path
    : null;

  return (
    <div className="member-editor-overlay" onClick={onClose}>
      <div className="member-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="member-editor-header">
          <h2>Edit Member</h2>
          <button className="member-editor-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="member-editor-content">
          <div className="member-preview">
            {avatarUrl ? (
              <img src={avatarUrl} alt={nickname} className="member-avatar-large" />
            ) : (
              <div className="member-avatar-placeholder">No Avatar</div>
            )}
          </div>

          <div className="member-field">
            <label>Discord ID</label>
            <input type="text" value={member.id} disabled className="member-input-disabled" />
            <span className="field-description">Read-only Discord user ID</span>
          </div>

          <div className="member-field">
            <label>Display Name</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="member-input"
              placeholder="Enter display name"
            />
            <span className="field-description">
              This name will be shown in all messages from this user
            </span>
          </div>

          <div className="member-field">
            <label>Avatar Path</label>
            <div className="avatar-input-group">
              <input
                type="text"
                value={avatarPath}
                onChange={(e) => setAvatarPath(e.target.value)}
                className="member-input"
                placeholder="Path to avatar image"
              />
              <button className="avatar-browse-button" onClick={handleSelectAvatar}>
                <Upload size={18} />
                Browse
              </button>
            </div>
            <span className="field-description">
              Select a custom avatar image for this user
            </span>
          </div>

          {member.isBot && (
            <div className="member-badge">
              <span className="bot-badge">BOT</span>
            </div>
          )}

          <div className="member-info">
            {member.color && (
              <p>
                <strong>Role Color:</strong>{" "}
                <span
                  className="color-preview"
                  style={{ backgroundColor: member.color }}
                >
                  {member.color}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="member-editor-footer">
          <button className="member-button-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="member-button-save"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MemberEditor;
