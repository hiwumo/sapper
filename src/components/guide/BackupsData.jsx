export function ExportingBackup() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Exporting a Backup</h2>
      <section className="guide-section">
        <p>You have a few ways to create backups:</p>

        <h4>Export everything</h4>
        <ol className="guide-steps">
          <li>
            Open <strong>Settings</strong> &rarr; <strong>Data</strong> tab &rarr;{" "}
            <strong>Imports & Exports</strong>.
          </li>
          <li>Click <strong>Export everything</strong>.</li>
          <li>
            Choose a destination folder. Sapper saves all conversations and app settings
            into a backup folder.
          </li>
        </ol>

        <h4>Export a single conversation</h4>
        <ul className="guide-list">
          <li>
            Right-click the conversation in the sidebar &rarr; <strong>Export</strong>.
          </li>
          <li>Choose a destination folder.</li>
        </ul>

        <h4>Export selected conversations</h4>
        <ol className="guide-steps">
          <li>
            Open <strong>Settings</strong> &rarr; <strong>Data</strong> tab.
          </li>
          <li>Click <strong>Export selected</strong>.</li>
          <li>Tick the conversations you want, then export.</li>
        </ol>
      </section>
    </div>
  );
}

export function RestoringBackup() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Restoring from a Backup</h2>
      <section className="guide-section">
        <ol className="guide-steps">
          <li>
            Open <strong>Settings</strong> &rarr; <strong>Data</strong> tab &rarr;{" "}
            <strong>Imports & Exports</strong>.
          </li>
          <li>Click <strong>Import backup</strong>.</li>
          <li>
            Select the folder that was previously created by Sapper's export.
          </li>
          <li>Sapper detects the conversations inside and restores them.</li>
        </ol>
      </section>
    </div>
  );
}

export function Unimporting() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Unimporting a Conversation</h2>
      <section className="guide-section">
        <p>
          Right-click a conversation in the sidebar &rarr; <strong>Unimport</strong>.
        </p>
        <ul className="guide-list">
          <li>
            This removes the conversation from Sapper and deletes the copy that Sapper
            made.
          </li>
          <li>
            <strong>Your original export files are not touched.</strong> Only Sapper's
            own copy is deleted.
          </li>
          <li>You'll be asked to confirm before anything is removed.</li>
        </ul>
      </section>
    </div>
  );
}

export function DiskUsage() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Managing Disk Usage</h2>
      <section className="guide-section">
        <p>
          Open <strong>Settings</strong> &rarr; <strong>Data</strong> tab &rarr;{" "}
          <strong>Storage</strong> to see how much space Sapper is using:
        </p>
        <div className="guide-info-grid">
          <div className="guide-info-card">
            <span className="guide-info-label">Total disk usage</span>
            <p>Broken down by conversations, cache, and logs.</p>
          </div>
          <div className="guide-info-card">
            <span className="guide-info-label">Per-conversation</span>
            <p>Each conversation's size and message count.</p>
          </div>
          <div className="guide-info-card">
            <span className="guide-info-label">Clear Logs</span>
            <p>Free up space used by log files. You'll be asked to confirm first.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
