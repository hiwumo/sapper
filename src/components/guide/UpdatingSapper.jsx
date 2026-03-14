export function AppUpdates() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">App Updates</h2>
      <section className="guide-section">
        <p>
          Sapper can check for new versions automatically. When an update is available,
          you'll be notified and can download and install it directly from the app.
        </p>
      </section>
    </div>
  );
}

export function ConversationUpdates() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Conversation Updates</h2>
      <section className="guide-section">
        <p>
          Sometimes after a Sapper update, older imports may need to be refreshed to work
          with the new version. You'll know because:
        </p>
        <ul className="guide-list">
          <li>
            A warning triangle appears on affected conversations in the sidebar.
          </li>
          <li>
            An <strong>Incompatible Imports</strong> dialog may appear on startup.
          </li>
        </ul>
        <p>To update them:</p>
        <div className="guide-info-grid">
          <div className="guide-info-card">
            <span className="guide-info-label">Single</span>
            <p>
              Click "Update Now" on the dialog for an individual conversation.
            </p>
          </div>
          <div className="guide-info-card">
            <span className="guide-info-label">Batch</span>
            <p>
              Use the batch update option in Settings to update all outdated
              conversations at once.
            </p>
          </div>
        </div>
        <div className="guide-callout" style={{ marginTop: "0.75rem" }}>
          Updating just refreshes the conversation so it works with the latest version of
          Sapper. Your data is preserved.
        </div>
      </section>
    </div>
  );
}
