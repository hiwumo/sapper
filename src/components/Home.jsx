import { useState } from "react";
import { Plus } from "lucide-react";
import ImportListItem from "./ImportListItem";
import EditDialog from "./EditDialog";
import "./Home.css";

function Home({ imports, onOpenConversation, onDeleteImport, onUpdateImport, onImport }) {
  const [editingImport, setEditingImport] = useState(null);

  const handleSave = async (updatedImport) => {
    await onUpdateImport(updatedImport);
    setEditingImport(null);
  };

  return (
    <div className="home">
      <div className="home-header">
        <div className="header-content">
          <div>
            <h1>Conversations</h1>
            <p className="subtitle">
              {imports.length} conversation{imports.length !== 1 ? "s" : ""} imported
            </p>
          </div>
          <button className="import-btn" onClick={onImport}>
            <Plus size={20} />
            Import
          </button>
        </div>
      </div>

      {imports.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <h2>No conversations yet</h2>
          <p className="subtitle">Click the "Import" button to add a JSON export</p>
          <p className="subtitle">Export your chats using <a href="https://github.com/Tyrrrz/DiscordChatExporter">DiscordChatExporter</a>!</p>
        </div>
      ) : (
        <div className="imports-list">
          {imports.map((imp) => (
            <ImportListItem
              key={imp.id}
              importEntry={imp}
              onOpen={onOpenConversation}
              onEdit={setEditingImport}
              onUnimport={onDeleteImport}
            />
          ))}
        </div>
      )}

      {editingImport && (
        <EditDialog
          importEntry={editingImport}
          onClose={() => setEditingImport(null)}
          onSave={handleSave}
          onUnimport={onDeleteImport}
        />
      )}
    </div>
  );
}

export default Home;
