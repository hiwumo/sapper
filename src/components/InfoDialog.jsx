import { X } from "lucide-react";
import InfoSection from "./InfoSection";
import "./EditDialog.css";

function InfoDialog({ importEntry, onClose }) {
  if (!importEntry) return null;

  const entry = importEntry.entry || importEntry;

  const getDisplayName = () => {
    if (entry.alias) return entry.alias;
    if (entry.guildName === "Direct Messages") {
      return `${entry.channelName} in DMs`;
    }
    return `${entry.channelName} in ${entry.guildName}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Unknown";
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const rows = [
    { label: "Display Name", value: getDisplayName() },
    ...(entry.description ? [{ label: "Description", value: entry.description }] : []),
    { label: "Channel", value: entry.channelName },
    { label: "Guild", value: entry.guildName },
    { label: "Messages", value: entry.messageCount?.toLocaleString() || "0" },
    { label: "Imported", value: formatDate(entry.createdAt) },
    ...(importEntry.compatibility ? [{ label: "Version", value: importEntry.compatibility.importVersion }] : []),
  ];

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="edit-dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Conversation Info</h2>
          <button className="dialog-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="dialog-body">
          <InfoSection rows={rows} />
        </div>
      </div>
    </div>
  );
}

export default InfoDialog;
