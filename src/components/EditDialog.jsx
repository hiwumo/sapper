import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import FormInput from "./FormInput";
import InfoSection from "./InfoSection";
import Dialog from "./Dialog";
import "./EditDialog.css";

function EditDialog({ importEntry, onClose, onSave, onUnimport }) {
  const getDefaultName = (imp) => {
    if (imp.guildName === "Direct Messages") {
      return `${imp.channelName} in DMs`;
    }
    return `${imp.channelName} in ${imp.guildName}`;
  };

  const entry = importEntry?.entry || importEntry;
  const [alias, setAlias] = useState(entry?.alias || "");
  const [description, setDescription] = useState(entry?.description || "");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [mutableConversation, setMutableConversation] = useState(false);
  const [mutableMemberId, setMutableMemberId] = useState(null);
  const [members, setMembers] = useState([]);
  const [importPath, setImportPath] = useState("");

  useEffect(() => {
    if (importEntry) {
      const e = importEntry.entry || importEntry;
      setAlias(e.alias || "");
      setDescription(e.description || "");

      // Load mutable setting + member ID
      invoke("get_mutable_setting", { importId: e.id })
        .then(val => setMutableConversation(val))
        .catch(() => setMutableConversation(false));

      invoke("get_mutable_member", { importId: e.id })
        .then(val => {
          if (val) setMutableMemberId(val.id);
        })
        .catch(() => {});

      // Load members for the picker
      invoke("get_members", { importId: e.id })
        .then(result => {
          if (result && result.members) {
            setMembers(result.members.sort((a, b) => a.id.localeCompare(b.id)));
          }
        })
        .catch(() => {});

      // Load import path for avatars
      invoke("get_import_path", { importId: e.id })
        .then(path => setImportPath(path))
        .catch(() => {});
    }
  }, [importEntry]);

  if (!importEntry) return null;

  const defaultName = getDefaultName(entry);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Save mutable setting with member ID
    try {
      await invoke("set_mutable_setting", {
        importId: entry.id,
        enabled: mutableConversation,
        memberId: mutableConversation ? mutableMemberId : null,
      });
    } catch (err) {
      console.error("Failed to save mutable setting:", err);
    }
    onSave({ ...entry, alias: alias.trim() || defaultName, description: description.trim() });
  };

  const canSave = !mutableConversation || mutableMemberId;

  const handleUnimport = () => {
    setConfirmDialogOpen(true);
  };

  const confirmUnimport = () => {
    onUnimport(entry.id);
    onClose();
  };

  const getAvatarSrc = (member) => {
    if (!member.avatarUrl || !importPath) return null;
    if (/^https?:\/\//.test(member.avatarUrl)) return member.avatarUrl;
    const fullPath = `${importPath}\\attachments\\${member.avatarUrl}`;
    try {
      return convertFileSrc(fullPath);
    } catch {
      return null;
    }
  };

  const infoRows = [
    { label: "Channel", value: entry.channelName },
    { label: "Guild", value: entry.guildName },
    { label: "Messages", value: entry.messageCount.toLocaleString() },
  ];

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="edit-dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Edit Conversation</h2>
          <button className="dialog-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dialog-body">
            <FormInput
              id="alias"
              label="Display Name"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder={defaultName}
              hint={`Default: ${defaultName}`}
              autoFocus={true}
            />
            <div className="form-group" style={{ marginTop: "1rem" }}>
              <label htmlFor="description" className="form-label" style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.85rem", color: "#aaa", fontWeight: 500 }}>
                Description
              </label>
              <textarea
                id="description"
                className="form-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                rows={2}
                style={{
                  width: "100%",
                  background: "#2a2a2a",
                  border: "1px solid #3a3a3a",
                  borderRadius: "6px",
                  color: "#fff",
                  padding: "0.6rem",
                  fontSize: "0.9rem",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </div>
            <div className="form-group" style={{ marginTop: "1rem" }}>
              <label className="mutable-toggle" style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                cursor: "pointer",
                fontSize: "0.9rem",
                color: "#ddd",
              }}>
                <input
                  type="checkbox"
                  checked={mutableConversation}
                  onChange={(e) => {
                    setMutableConversation(e.target.checked);
                    if (!e.target.checked) setMutableMemberId(null);
                  }}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                <div>
                  <div style={{ fontWeight: 500 }}>Mutable Conversation</div>
                  <div style={{ fontSize: "0.78rem", color: "#888", marginTop: "2px" }}>
                    Send, edit, and delete your own messages in this conversation
                  </div>
                </div>
              </label>

              {mutableConversation && (
                <div className="mutable-member-picker">
                  <div className="mutable-member-picker-label">
                    Select which member is you:
                  </div>
                  <div className="mutable-member-list">
                    {members.filter(m => !m.hidden).map((member) => {
                      const avatarSrc = getAvatarSrc(member);
                      const isSelected = mutableMemberId === member.id;
                      return (
                        <div
                          key={member.id}
                          className={`mutable-member-option ${isSelected ? "selected" : ""}`}
                          onClick={() => setMutableMemberId(member.id)}
                        >
                          <div className="mutable-member-avatar">
                            {avatarSrc ? (
                              <img src={avatarSrc} alt="" />
                            ) : (
                              <div className="mutable-member-avatar-fallback">
                                {(member.nickname || member.name || "?")[0].toUpperCase()}
                              </div>
                            )}
                          </div>
                          <span className="mutable-member-name">
                            {member.nickname || member.name}
                          </span>
                          {isSelected && <span className="mutable-member-check">&#10003;</span>}
                        </div>
                      );
                    })}
                  </div>
                  {!mutableMemberId && (
                    <div className="mutable-member-hint">
                      You must select a member to enable mutable conversation
                    </div>
                  )}
                </div>
              )}
            </div>
            <InfoSection rows={infoRows} />
          </div>

          <div className="dialog-footer">
            <button
              type="button"
              className="btn-danger-dialog"
              onClick={handleUnimport}
            >
              Unimport
            </button>
            <div className="dialog-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={!canSave}>
                Save
              </button>
            </div>
          </div>
        </form>
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

export default EditDialog;
