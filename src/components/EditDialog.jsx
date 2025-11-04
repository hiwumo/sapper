import { confirm } from '@tauri-apps/plugin-dialog';
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import FormInput from "./FormInput";
import InfoSection from "./InfoSection";
import "./EditDialog.css";

function EditDialog({ importEntry, onClose, onSave, onUnimport }) {
  const getDefaultName = (imp) => {
    if (imp.guildName === "Direct Messages") {
      return `${imp.channelName} in DMs`;
    }
    return `${imp.channelName} in ${imp.guildName}`;
  };

  const [alias, setAlias] = useState(importEntry?.alias || "");

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

  const handleUnimport = async () => {
    const confirmation = await confirm(
      'Are you sure you want to unimport this conversation?',
      { title: 'Unimport Conversation', kind: 'warning' }
    );
    if (confirmation) {
      onUnimport(importEntry.id);
      onClose();
    }
  };

  const infoRows = [
    { label: "Channel", value: importEntry.channelName },
    { label: "Guild", value: importEntry.guildName },
    { label: "Messages", value: importEntry.messageCount.toLocaleString() },
  ];

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
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
    </div>
  );
}

export default EditDialog;
