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

function isMediaUrl(url) {
  const mediaExtensions = /\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|mp3|wav|ogg|m4a)(\?.*)?$/i;
  return mediaExtensions.test(url);
}

function isImageUrl(url) {
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|apng)(\?.*)?$/i;
  return imageExtensions.test(url);
}

function isGifUrl(url) {
  return /\.(gif)(\?.*)?$/i.test(url);
}

/**
 * Check if message content is ONLY a direct image/gif URL (with optional whitespace)
 */
function isOnlyImageUrl(content) {
  if (!content || typeof content !== 'string') return null;

  const trimmed = content.trim();
  const urlRegex = /^(https?:\/\/[^\s]+)$/;
  const match = trimmed.match(urlRegex);

  if (match) {
    const url = match[1];
    if (isImageUrl(url)) {
      return url;
    }
  }

  return null;
}

function parseMarkdown(text) {
  if (!text || typeof text !== 'string') return text;

  let result = text;

  // Note: Markdown links [text](url) are handled in processContent with placeholders

  // Parse subtitle (grey text)
  result = result.replace(/^-# (.+)$/gm, '<div class="message-subtitle">$1</div>');

  // Parse headings (must be at start of line)
  result = result.replace(/^#### (.+)$/gm, '<h4 class="message-h4">$1</h4>');
  result = result.replace(/^### (.+)$/gm, '<h3 class="message-h3">$1</h3>');
  result = result.replace(/^## (.+)$/gm, '<h2 class="message-h2">$1</h2>');
  result = result.replace(/^# (.+)$/gm, '<h1 class="message-h1">$1</h1>');

  // Parse unordered lists (- or *)
  result = result.replace(/^[-*] (.+)$/gm, '<li class="message-list-item">$1</li>');

  // Parse ordered lists (1. 2. etc.)
  result = result.replace(/^\d+\. (.+)$/gm, '<li class="message-list-item-ordered">$1</li>');

  // Wrap consecutive list items in ul/ol tags (with 's' flag to match across newlines)
  result = result.replace(/(<li class="message-list-item">.*?<\/li>\s*)+/gs, (match) => {
    return `<ul class="message-list">${match}</ul>`;
  });

  result = result.replace(/(<li class="message-list-item-ordered">.*?<\/li>\s*)+/gs, (match) => {
    return `<ol class="message-list-ordered">${match}</ol>`;
  });

  return result;
}

function processContent(message, importPath, convertFileSrc) {
  const { content, inlineEmojis } = message;
  if (!content) return null;

  // First, extract and replace markdown links and standalone URLs with placeholders
  const replacements = [];
  let processedContent = content;

  // Extract markdown links first (including GIF links)
  const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  processedContent = processedContent.replace(markdownLinkRegex, (match, text, url) => {
    const idx = replacements.length;
    // Check if it's a GIF link - show GIF, hide link
    if (isGifUrl(url)) {
      replacements.push({ type: 'gif', url });
      return `__GIF_${idx}__`;
    } else {
      replacements.push({ type: 'mdlink', text, url });
      return `__MDLINK_${idx}__`;
    }
  });

  // Extract standalone URLs (not in markdown links)
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  processedContent = processedContent.replace(urlRegex, (match) => {
    const idx = replacements.length;
    const url = match;
    // Check if it's a GIF - show GIF, hide URL
    if (isGifUrl(url)) {
      replacements.push({ type: 'gif', url });
      return `__GIF_${idx}__`;
    } else if (isMediaUrl(url)) {
      replacements.push({ type: 'media', url }); // Will be filtered out
      return `__MEDIA_${idx}__`;
    } else {
      replacements.push({ type: 'url', url });
      return `__URL_${idx}__`;
    }
  });

  // Now parse markdown on the text with placeholders
  const markdownParsed = parseMarkdown(processedContent);

  // Split by placeholders and reconstruct
  const placeholderRegex = /__(MDLINK|URL|GIF|MEDIA)_(\d+)__/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  placeholderRegex.lastIndex = 0;
  while ((match = placeholderRegex.exec(markdownParsed)) !== null) {
    // Add text/HTML before placeholder
    if (match.index > lastIndex) {
      parts.push({ type: 'html', content: markdownParsed.slice(lastIndex, match.index) });
    }
    // Add replacement
    const replacementIndex = parseInt(match[2]);
    parts.push(replacements[replacementIndex]);
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text/HTML
  if (lastIndex < markdownParsed.length) {
    parts.push({ type: 'html', content: markdownParsed.slice(lastIndex) });
  }

  // If no placeholders, treat entire content as HTML
  if (parts.length === 0) {
    parts.push({ type: 'html', content: markdownParsed });
  }

  // Render parts
  const processedParts = parts.map((part, partIdx) => {
    if (part.type === 'mdlink') {
      return (
        <a
          key={`mdlink-${partIdx}`}
          href={part.url}
          target="_blank"
          rel="noopener noreferrer"
          className="message-link"
        >
          {part.text}
        </a>
      );
    }

    if (part.type === 'url') {
      return (
        <a
          key={`url-${partIdx}`}
          href={part.url}
          target="_blank"
          rel="noopener noreferrer"
          className="message-link"
        >
          {part.url}
        </a>
      );
    }

    if (part.type === 'gif') {
      return (
        <div key={`gif-${partIdx}`} className="message-inline-gif">
          <img src={part.url} alt="GIF" loading="lazy" />
        </div>
      );
    }

    if (part.type === 'media') {
      // Media URLs are handled as attachments, don't render
      return null;
    }

    // HTML content (from markdown or plain text)
    const html = part.content;

    // If it contains HTML tags, render with dangerouslySetInnerHTML
    if (html.includes('<')) {
      return <span key={`html-${partIdx}`} dangerouslySetInnerHTML={{ __html: html }} />;
    }

    // Plain text - process for emojis
    if (!inlineEmojis || inlineEmojis.length === 0) return html;

    const chars = Array.from(html);
    const emojiCount = chars.filter(ch => inlineEmojis.find(e => e.name === ch)).length;
    const hasText = chars.some(ch => !inlineEmojis.find(e => e.name === ch) && ch.trim());

    const useLargeEmoji = !hasText && emojiCount <= 30;
    const emojiClass = useLargeEmoji ? "inline-emoji-large" : "inline-emoji";

    return chars.map((ch, i) => {
      const emojiObj = inlineEmojis.find(e => e.name === ch);
      if (!emojiObj) return ch;

      const emojiUrl = getEmojiUrl(importPath, emojiObj.imageUrl, convertFileSrc);
      return (
        <img
          key={`emoji-${partIdx}-${i}`}
          src={emojiUrl}
          alt={emojiObj.name}
          className={emojiClass}
          draggable={false}
        />
      );
    });
  });

  return processedParts.flat().filter(p => p !== null);
}

function Message({ message, isGrouped, importPath, onImageClick, formatTimestamp, convertFileSrc, onReplyClick }) {
  // Check if this is a system message (like pinned messages)
  const isSystemMessage = message.type === "ChannelPinnedMessage" ||
                          message.type === "RecipientAdd" ||
                          message.type === "RecipientRemove" ||
                          message.type === "Call" ||
                          message.type === "ChannelNameChange" ||
                          message.type === "ChannelIconChange";

  if (isSystemMessage) {
    // Render as system message
    let systemText = "";
    if (message.type === "ChannelPinnedMessage") {
      systemText = `${message.author.nickname} pinned a message to this channel.`;
    } else if (message.type === "RecipientAdd") {
      systemText = `${message.author.nickname} added someone to the group.`;
    } else if (message.type === "RecipientRemove") {
      systemText = `${message.author.nickname} removed someone from the group.`;
    } else if (message.type === "Call") {
      systemText = `${message.author.nickname} started a call.`;
    } else if (message.type === "ChannelNameChange") {
      systemText = `${message.author.nickname} changed the channel name.`;
    } else if (message.type === "ChannelIconChange") {
      systemText = `${message.author.nickname} changed the channel icon.`;
    }

    return (
      <div className="system-message">
        <div className="system-message-content">
          <span className="system-message-text">{systemText}</span>
          <span className="system-message-timestamp">{formatTimestamp(message.timestamp)}</span>
        </div>
      </div>
    );
  }

  // Check if message content is ONLY a direct image/gif URL
  const onlyImageUrl = isOnlyImageUrl(message.content);
  const shouldHideContent = onlyImageUrl !== null;

  return (
    <>
    <MessageReply
          referencedMessage={message.referencedMessage}
          importPath={importPath}
          onReplyClick={onReplyClick}
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
        {message.content && message.content.length > 0 && !shouldHideContent && (
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
          directImageUrl={onlyImageUrl}
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
