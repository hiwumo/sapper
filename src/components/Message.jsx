import MessageAvatar from "./MessageAvatar";
import MessageReply from "./MessageReply";
import MessageStickers from "./MessageStickers";
import MessageAttachments from "./MessageAttachments";
import MessageEmbeds from "./MessageEmbeds";

/**
 * Build a usable URL for an emoji image reported in message.inlineEmojis.
 */
function getEmojiUrl(importPath, emojiImageUrl, convertFileSrc) {
  if (!importPath || !emojiImageUrl) return "";
  if (/^https?:\/\//.test(emojiImageUrl)) return emojiImageUrl;
  const fullPath = `${importPath}\\attachments\\${emojiImageUrl}`;
  return convertFileSrc(fullPath);
}

function processContent(message, importPath, convertFileSrc) {
  const { content, inlineEmojis } = message;
  if (!content) return null;
  if (!inlineEmojis || inlineEmojis.length === 0) return content;

  const chars = Array.from(content);

  const emojiCount = chars.filter(ch => inlineEmojis.find(e => e.name === ch)).length;
  const hasText = chars.some(ch => !inlineEmojis.find(e => e.name === ch) && ch.trim());

  const useLargeEmoji = !hasText && emojiCount <= 30;
  const emojiClass = useLargeEmoji ? "inline-emoji-large" : "inline-emoji";

  const nodes = chars.map((ch, i) => {
    const emojiObj = inlineEmojis.find(e => e.name === ch);
    if (!emojiObj) return ch;

    const emojiUrl = getEmojiUrl(importPath, emojiObj.imageUrl, convertFileSrc);
    return (
      <img
        key={`emoji-${i}`}
        src={emojiUrl}
        alt={emojiObj.name}
        className={emojiClass}
        draggable={false}
      />
    );
  });

  return nodes;
}

function Message({ message, isGrouped, importPath, onImageClick, formatTimestamp, convertFileSrc }) {
  return (
    <>
    <MessageReply
          referencedMessage={message.referencedMessage}
          importPath={importPath}
        />
    <div className={`message ${isGrouped ? "grouped" : ""}`}>
      
      {!isGrouped && (
        <MessageAvatar
          avatarUrl={message.author.avatarUrl}
          name={message.author.nickname}
          importPath={importPath}
        />
      )}
      <div className="message-content">
        {!isGrouped && (
          <div className="message-header">
            <span className="message-author">
              {message.author.nickname}
            </span>
            <span className="message-timestamp">
              {formatTimestamp(message.timestamp)}
            </span>
          </div>
        )}
        {message.content && message.content.length > 0 && (
          <div className="message-text">{processContent(message, importPath, convertFileSrc)}</div>
        )}
        <MessageStickers
          stickers={message.stickers}
          importPath={importPath}
          onImageClick={onImageClick}
        />
        <MessageAttachments
          mediaRefs={message.mediaRefs}
          onImageClick={onImageClick}
        />
        <MessageEmbeds
          embeds={message.embeds}
          importPath={importPath}
        />
      </div>
    </div>
    </>
  );
}

export default Message;
