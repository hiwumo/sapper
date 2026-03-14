export function TheSidebar() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">The Sidebar</h2>
      <section className="guide-section">
        <p>
          The sidebar on the left lists all your imported conversations. Each entry shows:
        </p>
        <ul className="guide-list">
          <li>
            An <strong>avatar</strong> (guild icon or first letter of the conversation
            name)
          </li>
          <li>
            The <strong>display name</strong> (your custom name, or the default
            channel/DM name)
          </li>
          <li>
            An optional <strong>description</strong> if you've added one
          </li>
          <li>
            A <strong>warning icon</strong> if the conversation needs updating
          </li>
        </ul>
        <p>
          Click a conversation to open it. Right-click (or click the three-dot menu) for
          options like Edit, Info, Export, and Unimport.
        </p>
      </section>
    </div>
  );
}

export function ReadingMessages() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Reading Messages</h2>
      <section className="guide-section">
        <p>Messages are displayed in a familiar chat layout:</p>
        <div className="guide-feature-list">
          <div className="guide-feature">
            <span className="guide-feature-name">Grouped messages</span>
            <span className="guide-feature-desc">
              Consecutive messages from the same person are grouped together.
            </span>
          </div>
          <div className="guide-feature">
            <span className="guide-feature-name">Timestamps</span>
            <span className="guide-feature-desc">
              Shown for each message or message group.
            </span>
          </div>
          <div className="guide-feature">
            <span className="guide-feature-name">Replies</span>
            <span className="guide-feature-desc">
              The original message is shown above for context.
            </span>
          </div>
          <div className="guide-feature">
            <span className="guide-feature-name">Edited messages</span>
            <span className="guide-feature-desc">
              Marked with an "(edited)" label and timestamp.
            </span>
          </div>
          <div className="guide-feature">
            <span className="guide-feature-name">Reactions</span>
            <span className="guide-feature-desc">
              Displayed below the message with emoji and count.
            </span>
          </div>
          <div className="guide-feature">
            <span className="guide-feature-name">Bot badges</span>
            <span className="guide-feature-desc">Bot accounts are labelled.</span>
          </div>
        </div>
      </section>

      <section className="guide-section">
        <h3>Supported formatting</h3>
        <div className="guide-tag-list">
          {[
            "Bold", "Italic", "Underline", "Strikethrough", "Headings", "Lists",
            "Code blocks", "Inline code", "Links", "Mentions", "Custom emojis",
            "Spoiler tags",
          ].map((tag) => (
            <span key={tag} className="guide-tag">{tag}</span>
          ))}
        </div>
      </section>

      <section className="guide-section">
        <h3>Scrolling and navigation</h3>
        <ul className="guide-list">
          <li>
            Sapper loads messages in batches for smooth performance. Scroll up for older
            messages, and down for newer ones.
          </li>
          <li>
            A <strong>Jump to Present</strong> button appears when you scroll up. Click
            it to jump back to the newest messages.
          </li>
          <li>Your scroll position is saved for each conversation.</li>
        </ul>
      </section>
    </div>
  );
}

export function AttachmentsMedia() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Attachments & Media</h2>
      <section className="guide-section">
        <div className="guide-feature-list">
          <div className="guide-feature">
            <span className="guide-feature-name">Images</span>
            <span className="guide-feature-desc">
              Displayed inline in a grid. Click to open a full-size carousel.
            </span>
          </div>
          <div className="guide-feature">
            <span className="guide-feature-name">Videos</span>
            <span className="guide-feature-desc">
              Built-in player with play/pause, seeking, volume, and fullscreen.
            </span>
          </div>
          <div className="guide-feature">
            <span className="guide-feature-name">Audio</span>
            <span className="guide-feature-desc">
              Built-in player with play/pause, progress bar, and volume.
            </span>
          </div>
          <div className="guide-feature">
            <span className="guide-feature-name">Other files</span>
            <span className="guide-feature-desc">
              Shown with a file icon and an "Open file location" button.
            </span>
          </div>
          <div className="guide-feature">
            <span className="guide-feature-name">GIFs</span>
            <span className="guide-feature-desc">
              Tenor and Giphy GIFs are automatically detected and displayed.
            </span>
          </div>
          <div className="guide-feature">
            <span className="guide-feature-name">Stickers</span>
            <span className="guide-feature-desc">
              Displayed alongside message content.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

export function Searching() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Searching</h2>
      <section className="guide-section">
        <ol className="guide-steps">
          <li>
            Click the <strong>magnifying glass icon</strong> in the conversation header.
          </li>
          <li>Type your search query.</li>
          <li>Results appear with matching messages highlighted.</li>
        </ol>
        <div className="guide-info-grid">
          <div className="guide-info-card">
            <span className="guide-info-label">Sort order</span>
            <p>Toggle between "Newest First" and "Oldest First."</p>
          </div>
          <div className="guide-info-card">
            <span className="guide-info-label">Date filtering</span>
            <p>
              You can filter results to messages before or after a specific date.
            </p>
          </div>
          <div className="guide-info-card">
            <span className="guide-info-label">Fast</span>
            <p>Search is built to be quick, even for very large conversations.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
