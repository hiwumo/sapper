import { useState, useEffect } from "react";
import { X } from "lucide-react";
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

  useEffect(() => {
    if (importEntry) {
      const e = importEntry.entry || importEntry;
      setAlias(e.alias || "");
      setDescription(e.description || "");
    }
  }, [importEntry]);

  if (!importEntry) return null;

  const defaultName = getDefaultName(entry);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...entry, alias: alias.trim() || defaultName, description: description.trim() });
  };

  const handleUnimport = () => {
    setConfirmDialogOpen(true);
  };

  const confirmUnimport = () => {
    onUnimport(entry.id);
    onClose();
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
              <button type="submit" className="btn-primary">
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
