export function DataStorage() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Where Your Data Lives</h2>
      <section className="guide-section">
        <p>
          All of Sapper's data is stored in a folder on your computer. You can find it by
          opening Settings and clicking <strong>Open Data Folder</strong>. Inside you'll
          find:
        </p>
        <ul className="guide-list">
          <li>
            <strong>Imported conversations</strong> (messages, attachments, and search
            data)
          </li>
          <li>
            <strong>Cache files</strong> (temporary files that Sapper uses)
          </li>
          <li>
            <strong>Log files</strong> (records of what happened, useful for
            troubleshooting)
          </li>
          <li>
            <strong>Your settings and preferences</strong>
          </li>
        </ul>
      </section>
    </div>
  );
}

export function InternetConnection() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Internet Connection</h2>
      <section className="guide-section">
        <p>
          Sapper is an <strong>offline-first</strong> app. The only times it connects to
          the internet are:
        </p>
        <ul className="guide-list">
          <li>
            <strong>Update checks:</strong> Sapper may check for new versions (this is
            optional).
          </li>
          <li>
            <strong>Discord Rich Presence:</strong> If you turn this on, it shows that
            you're using Sapper on your Discord status. No private data is shared.
          </li>
        </ul>
        <div className="guide-callout guide-callout-success">
          There is <strong>no analytics, no telemetry, and no data collection.</strong>{" "}
          Your conversations are never uploaded anywhere.
        </div>
      </section>
    </div>
  );
}

export function MessageSafety() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Keeping Messages Safe</h2>
      <section className="guide-section">
        <ul className="guide-list">
          <li>
            All data is stored locally. Sapper does not modify your original export files.
          </li>
          <li>Importing and exporting are safe operations that won't damage your files.</li>
          <li>
            Unimporting only deletes Sapper's own copy, not your original files.
          </li>
          <li>
            Use the <strong>Export</strong> feature to create regular backups.
          </li>
        </ul>
      </section>
    </div>
  );
}

export function DataCorruption() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Data Corruption</h2>
      <section className="guide-section">
        <p>
          Sapper is careful about how it saves your data, so corruption is very unlikely.
          That said, unexpected crashes or disk problems could theoretically cause issues.{" "}
          <strong>Regular backups are always a good idea.</strong> If you do notice
          anything wrong, you can unimport and re-import from your original export file.
        </p>
      </section>
    </div>
  );
}
