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

  const [alias, setAlias] = useState(importEntry?.alias || "");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  useEffect(() => {
    if (importEntry) {
      setAlias(importEntry.alias || "");
    }
  }, [importEntry]);

  if (!importEntry) return null;

  const defaultName = getDefaultName(importEntry);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...importEntry, alias: alias.trim() || defaultName });
  };

  const handleUnimport = () => {
    setConfirmDialogOpen(true);
  };

  const confirmUnimport = () => {
    onUnimport(importEntry.id);
    onClose();
  };

  const infoRows = [
    { label: "Channel", value: importEntry.channelName },
    { label: "Guild", value: importEntry.guildName },
    { label: "Messages", value: importEntry.messageCount.toLocaleString() },
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
