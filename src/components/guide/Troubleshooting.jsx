export function CommonIssues() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Common Issues</h2>
      <section className="guide-section">
        <div className="guide-issue">
          <div className="guide-issue-title">
            "Missing Conversations" dialog on startup
          </div>
          <p>
            This means Sapper can't find the saved data for one or more conversations.
            The folder may have been moved or deleted. You can remove the missing entries
            from Sapper, or re-import from the original files if you still have them.
          </p>
        </div>

        <div className="guide-issue">
          <div className="guide-issue-title">Import fails or shows errors</div>
          <ul className="guide-list">
            <li>
              Make sure the file is a valid JSON export from DiscordChatExporter.
            </li>
            <li>
              Check that attachment files are still in the same location they were when
              you exported.
            </li>
            <li>The import dialog will show an error message with details.</li>
          </ul>
        </div>

        <div className="guide-issue">
          <div className="guide-issue-title">
            Messages or images not displaying correctly
          </div>
          <ul className="guide-list">
            <li>Try closing and re-opening the conversation.</li>
            <li>Check your theme settings if colours look off.</li>
            <li>
              Turn on <strong>Debug Mode</strong> in Settings to see more info about
              images and messages.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

export function ReportingBugs() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Reporting Bugs</h2>
      <section className="guide-section">
        <p>If you run into a problem:</p>
        <ol className="guide-steps">
          <li>
            <strong>Turn on Debug Mode</strong> first (Settings &rarr; Advanced &rarr;
            Debug Mode). This saves more detailed logs.
          </li>
          <li>Try to reproduce the issue.</li>
          <li>
            Open your log folder (Settings &rarr; Advanced &rarr; Open Log Folder) and
            grab the latest log file.
          </li>
          <li>
            Report the bug with a description of what happened, what you expected, and
            attach the log file.
          </li>
        </ol>
        <div className="guide-callout">
          With Debug Mode on, you can also right-click any message and select "View Raw
          Data" to see its underlying details. This can be helpful when reporting display
          issues.
        </div>
      </section>
    </div>
  );
}
