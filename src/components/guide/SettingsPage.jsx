export function Appearance() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Appearance</h2>
      <p className="guide-page-intro">Open Settings from the gear icon in the sidebar.</p>
      <section className="guide-section">
        <ul className="guide-list">
          <li>
            <strong>Theme:</strong> Choose between Dark (default), Light, or other
            available themes. Your preference is saved automatically.
          </li>
        </ul>
      </section>
    </div>
  );
}

export function Notifications() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Notifications</h2>
      <section className="guide-section">
        <ul className="guide-list">
          <li>
            <strong>Desktop Notifications:</strong> Toggle system notifications for
            things like import completion and available updates.
          </li>
        </ul>
      </section>
    </div>
  );
}

export function DebugMode() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Debug Mode</h2>
      <section className="guide-section">
        <p>
          When Debug Mode is turned on, Sapper shows extra information that can be
          helpful for troubleshooting:
        </p>
        <div className="guide-feature-list">
          <div className="guide-feature">
            <span className="guide-feature-name">Message IDs</span>
            <span className="guide-feature-desc">Appear next to author names.</span>
          </div>
          <div className="guide-feature">
            <span className="guide-feature-name">View raw data</span>
            <span className="guide-feature-desc">
              Right-click a message to see its full underlying data.
            </span>
          </div>
          <div className="guide-feature">
            <span className="guide-feature-name">Image info</span>
            <span className="guide-feature-desc">
              Shows where each image came from (file name or original link).
            </span>
          </div>
          <div className="guide-feature">
            <span className="guide-feature-name">Extra logging</span>
            <span className="guide-feature-desc">
              Saves more detailed logs, which is useful for bug reports.
            </span>
          </div>
        </div>
        <p style={{ marginTop: "0.75rem" }}>
          <strong>Open Log Folder</strong> opens the folder where Sapper stores its log
          files. This is handy if you need to share logs when reporting a bug.
        </p>
      </section>
    </div>
  );
}
