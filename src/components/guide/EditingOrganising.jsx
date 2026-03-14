export function EditingDetails() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Editing Conversation Details</h2>
      <section className="guide-section">
        <p>
          Right-click a conversation in the sidebar and select <strong>Edit</strong> (or
          click the three-dot menu):
        </p>
        <ul className="guide-list">
          <li>
            <strong>Display Name:</strong> Change the name shown in the sidebar. This
            doesn't affect the original data.
          </li>
          <li>
            <strong>Description:</strong> Add optional notes about the conversation (e.g.
            "Server drama, June 2024").
          </li>
        </ul>
        <p>
          To just view details without editing, select <strong>Info</strong> instead.
        </p>
      </section>
    </div>
  );
}

export function EditingMembers() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Editing Members</h2>
      <section className="guide-section">
        <p>
          Open the <strong>Members</strong> panel from the conversation view to see
          everyone who posted. From there you can:
        </p>
        <ol className="guide-steps">
          <li>
            <strong>Click a member's name</strong> (or right-click and select "Edit") to
            open the member editor.
          </li>
          <li>
            In the editor you can:
            <ul className="guide-list" style={{ marginTop: "0.5rem" }}>
              <li>
                <strong>Change their avatar:</strong> Click the avatar to upload a new
                image (PNG, JPG, GIF, or WebP).
              </li>
              <li>
                <strong>Change their display name:</strong> Override the name shown on
                their messages.
              </li>
              <li>
                <strong>Hide the member:</strong> Toggle visibility to hide them from the
                member list. Hidden members' messages still appear.
              </li>
            </ul>
          </li>
          <li>
            Click <strong>Save</strong> to apply changes.
          </li>
        </ol>
        <div className="guide-callout">
          All member edits are per-conversation. Changing a member's name in one
          conversation doesn't affect them in another.
        </div>
      </section>
    </div>
  );
}

export function ReorderingConversations() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Reordering Conversations</h2>
      <section className="guide-section">
        <p>
          Drag and drop conversations in the sidebar to reorder them. Your custom order
          is saved automatically.
        </p>
      </section>
    </div>
  );
}
