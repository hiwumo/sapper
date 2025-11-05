import MessageAvatar from "./MessageAvatar";

function MessageReply({ referencedMessage, importPath, onReplyClick }) {
  if (!referencedMessage) return null;

  const replyContent = referencedMessage.content
    ? (referencedMessage.content.length > 50
        ? referencedMessage.content.substring(0, 50) + "..."
        : referencedMessage.content)
    : referencedMessage.attachments?.length > 0
      ? "Click to see attachment"
      : "Click to see original message";

  const handleClick = () => {
    if (onReplyClick && referencedMessage.id !== undefined) {
      onReplyClick(referencedMessage.id);
    }
  };

  return (
    <div className="message-reply-reference" onClick={handleClick} style={{ cursor: onReplyClick ? 'pointer' : 'default' }}>
      <div className="reply-line"></div>
      <div className="reply-avatar">
        <MessageAvatar
          avatarUrl={referencedMessage.author.avatarUrl}
          name={referencedMessage.author.nickname}
          importPath={importPath}
          size="small"
        />
      </div>
      <span className="reply-author">{referencedMessage.author.nickname}</span>
      <span className="reply-content">{replyContent}</span>
    </div>
  );
}

export default MessageReply;
