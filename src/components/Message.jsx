import { useState, useRef, useEffect } from "react";
import hljs from "highlight.js/lib/core";
import "highlight.js/styles/github-dark-dimmed.css";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import cpp from "highlight.js/lib/languages/cpp";
import c from "highlight.js/lib/languages/c";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import sql from "highlight.js/lib/languages/sql";
import rust from "highlight.js/lib/languages/rust";
import go from "highlight.js/lib/languages/go";
import ruby from "highlight.js/lib/languages/ruby";
import php from "highlight.js/lib/languages/php";
import lua from "highlight.js/lib/languages/lua";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("java", java);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("c", c);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("cs", csharp);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("go", go);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("rb", ruby);
hljs.registerLanguage("php", php);
hljs.registerLanguage("lua", lua);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
import MessageAvatar from "./MessageAvatar";
import MessageReply from "./MessageReply";
import MessageStickers from "./MessageStickers";
import MessageAttachments from "./MessageAttachments";
import MessageEmbeds from "./MessageEmbeds";
import TenorEmbed from "./TenorEmbed";
import GiphyEmbed from "./GiphyEmbed";

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
 * Check if URL is a Tenor GIF link and extract the GIF ID
 */
function extractTenorGifId(url) {
  if (!url || typeof url !== 'string') return null;

  const tenorRegex = /^https?:\/\/(www\.)?tenor\.com\/view\/[^\/]+-(\d+)$/;
  const match = url.match(tenorRegex);

  if (match) {
    return match[2]; // The GIF ID
  }

  return null;
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

/**
 * Check if message content is ONLY a Tenor GIF URL
 */
function isOnlyTenorUrl(content) {
  if (!content || typeof content !== 'string') return null;

  const trimmed = content.trim();
  const urlRegex = /^(https?:\/\/[^\s]+)$/;
  const match = trimmed.match(urlRegex);

  if (match) {
    const url = match[1];
    const gifId = extractTenorGifId(url);
    if (gifId) {
      return { url, gifId };
    }
  }

  return null;
}

/**
 * Check if URL is a Giphy GIF link and extract the GIF ID
 */
function extractGiphyGifId(url) {
  if (!url || typeof url !== 'string') return null;

  // https://giphy.com/gifs/optional-slug-GIFID
  const giphyRegex = /^https?:\/\/(www\.)?giphy\.com\/gifs\/(?:.*-)?([a-zA-Z0-9]+)$/;
  // https://media.giphy.com/media/GIFID/giphy.gif (and variants)
  const mediaRegex = /^https?:\/\/media[0-9]?\.giphy\.com\/media\/([a-zA-Z0-9]+)\//;

  let match = url.match(giphyRegex);
  if (match) return match[2];

  match = url.match(mediaRegex);
  if (match) return match[1];

  return null;
}

/**
 * Check if message content is ONLY a Giphy GIF URL
 */
function isOnlyGiphyUrl(content) {
  if (!content || typeof content !== 'string') return null;

  const trimmed = content.trim();
  const urlRegex = /^(https?:\/\/[^\s]+)$/;
  const match = trimmed.match(urlRegex);

  if (match) {
    const url = match[1];
    const gifId = extractGiphyGifId(url);
    if (gifId) {
      return { url, gifId };
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

  // Parse inline formatting (order matters for nested combinations)
  // Strikethrough
  result = result.replace(/~~(.+?)~~/g, '<s>$1</s>');
  // __***bold italic underline***__ or __***bold italic underline***__
  result = result.replace(/__\*\*\*(.+?)\*\*\*__/g, '<u><strong><em>$1</em></strong></u>');
  // __**bold underline**__
  result = result.replace(/__\*\*(.+?)\*\*__/g, '<u><strong>$1</strong></u>');
  // __*italic underline*__
  result = result.replace(/__\*(.+?)\*__/g, '<u><em>$1</em></u>');
  // ***bold and italic***
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // **bold**
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // *italic*
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // __underline__
  result = result.replace(/__(.+?)__/g, '<u>$1</u>');

  return result;
}

/**
 * Highlight a code string with highlight.js.
 * Returns an HTML string with syntax spans.
 */
function highlightCode(code, lang) {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(code, { language: lang }).value;
    } catch (_) { /* fall through */ }
  }
  // No language specified — render as plain text (no auto-detect with limited language set)
  return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Replace Discord-style mention placeholders (<@id>) with display names
 * using the message.mentions array.
 */
function replaceMentions(text, mentions) {
  if (!mentions || mentions.length === 0) return text;
  // Discord raw content uses <@ID> or <@!ID> for mentions
  return text.replace(/<@!?(\d+)>/g, (match, id) => {
    const user = mentions.find(m => m.id === id);
    if (user) {
      const displayName = user.nickname || user.name;
      return `\x01MENTION_${id}\x01${displayName}\x01MENTIONEND\x01`;
    }
    return match;
  });
}

function processContent(message, importPath, convertFileSrc) {
  const { content, inlineEmojis, mentions } = message;
  if (!content) return null;

  const replacements = [];
  let processedContent = content;

  // 1. Extract fenced code blocks FIRST (before anything else)
  const fencedCodeRegex = /```(\w*)\n?([\s\S]*?)```/g;
  processedContent = processedContent.replace(fencedCodeRegex, (match, lang, code) => {
    const idx = replacements.length;
    replacements.push({ type: 'codeblock', lang: lang || '', code: code.replace(/\n$/, '') });
    return `\x01CODEBLOCK_${idx}\x01`;
  });

  // 2. Extract inline code
  const inlineCodeRegex = /`([^`\n]+)`/g;
  processedContent = processedContent.replace(inlineCodeRegex, (match, code) => {
    const idx = replacements.length;
    replacements.push({ type: 'inlinecode', code });
    return `\x01INLINECODE_${idx}\x01`;
  });

  // 3. Replace mentions
  processedContent = replaceMentions(processedContent, mentions);

  // Also handle content where mentions are already resolved as @displayName
  // (some exports store "@nickname" directly in content)
  if (mentions && mentions.length > 0) {
    for (const m of mentions) {
      const displayName = m.nickname || m.name;
      // Only replace if not already wrapped by the <@id> replacement above
      if (!processedContent.includes(`\x01MENTION_${m.id}\x01`)) {
        const escaped = displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const atMentionRegex = new RegExp(`@${escaped}`, 'g');
        processedContent = processedContent.replace(atMentionRegex, (match) => {
          const idx = replacements.length;
          replacements.push({ type: 'mention', name: displayName });
          return `\x01MENTIONOBJ_${idx}\x01`;
        });
      }
    }
  }

  // Convert \x01MENTION_id\x01name\x01MENTIONEND\x01 to placeholder objects
  processedContent = processedContent.replace(/\x01MENTION_(\d+)\x01(.+?)\x01MENTIONEND\x01/g, (match, id, name) => {
    const idx = replacements.length;
    replacements.push({ type: 'mention', name });
    return `\x01MENTIONOBJ_${idx}\x01`;
  });

  // 4. Extract markdown links (including GIF links)
  const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  processedContent = processedContent.replace(markdownLinkRegex, (match, text, url) => {
    const idx = replacements.length;
    if (isGifUrl(url)) {
      replacements.push({ type: 'gif', url });
      return `\x01GIF_${idx}\x01`;
    } else {
      replacements.push({ type: 'mdlink', text, url });
      return `\x01MDLINK_${idx}\x01`;
    }
  });

  // 5. Extract standalone URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  processedContent = processedContent.replace(urlRegex, (match) => {
    const idx = replacements.length;
    const url = match;
    if (isGifUrl(url)) {
      replacements.push({ type: 'gif', url });
      return `\x01GIF_${idx}\x01`;
    } else if (isMediaUrl(url)) {
      replacements.push({ type: 'media', url });
      return `\x01MEDIA_${idx}\x01`;
    } else {
      replacements.push({ type: 'url', url });
      return `\x01URL_${idx}\x01`;
    }
  });

  // Now parse markdown on the text with placeholders
  const markdownParsed = parseMarkdown(processedContent);

  // Split by ALL placeholders and reconstruct
  const placeholderRegex = /\x01(CODEBLOCK|INLINECODE|MENTIONOBJ|MDLINK|URL|GIF|MEDIA)_(\d+)\x01/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  placeholderRegex.lastIndex = 0;
  while ((match = placeholderRegex.exec(markdownParsed)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'html', content: markdownParsed.slice(lastIndex, match.index) });
    }
    const replacementIndex = parseInt(match[2]);
    parts.push(replacements[replacementIndex]);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < markdownParsed.length) {
    parts.push({ type: 'html', content: markdownParsed.slice(lastIndex) });
  }

  if (parts.length === 0) {
    parts.push({ type: 'html', content: markdownParsed });
  }

  // Render parts
  const processedParts = parts.map((part, partIdx) => {
    if (part.type === 'codeblock') {
      const highlighted = highlightCode(part.code, part.lang);
      return (
        <pre key={`codeblock-${partIdx}`} className="message-codeblock">
          {part.lang && <span className="codeblock-lang">{part.lang}</span>}
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
      );
    }

    if (part.type === 'inlinecode') {
      return <code key={`inlinecode-${partIdx}`} className="message-inline-code">{part.code}</code>;
    }

    if (part.type === 'mention') {
      return <span key={`mention-${partIdx}`} className="mention">@{part.name}</span>;
    }

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
      return null;
    }

    // HTML content (from markdown or plain text)
    const html = part.content;

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
          onError={() => console.warn(`[ASSET_FAIL] emoji failed to load: ${emojiObj.imageUrl || "unknown"}`)}
        />
      );
    });
  });

  return processedParts.flat().filter(p => p !== null);
}

function logMessageDebug(message, debugMode) {
  if (!debugMode) return;

  const attachmentCount = message.mediaRefs?.length || 0;
  const embedCount = message.embeds?.length || 0;
  const stickerCount = message.stickers?.length || 0;
  const hasContent = !!(message.content && message.content.length > 0);
  const contentLength = message.content?.length || 0;
  const hasReply = !!message.referencedMessage;
  const mentionCount = message.mentions?.length || 0;
  const emojiCount = message.inlineEmojis?.length || 0;

  const assetUrls = [];

  // Collect attachment paths
  if (message.mediaRefs) {
    message.mediaRefs.forEach((ref, i) => {
      const fileName = ref.split("\\").pop().split("/").pop();
      assetUrls.push(`attachment[${i}]: ${fileName}`);
    });
  }

  // Collect embed asset URLs
  if (message.embeds) {
    message.embeds.forEach((embed, i) => {
      if (embed.thumbnail?.url) {
        const isLocal = !/^https?:\/\//.test(embed.thumbnail.url);
        assetUrls.push(`embed[${i}].thumbnail: ${isLocal ? embed.thumbnail.url : "[remote_url]"} (${isLocal ? "local" : "remote"})`);
      }
      if (embed.video?.url) {
        const isLocal = !/^https?:\/\//.test(embed.video.url);
        assetUrls.push(`embed[${i}].video: ${isLocal ? embed.video.url : "[remote_url]"} (${isLocal ? "local" : "remote"})`);
      }
      if (embed.image?.url) {
        const isLocal = !/^https?:\/\//.test(embed.image.url);
        assetUrls.push(`embed[${i}].image: ${isLocal ? embed.image.url : "[remote_url]"} (${isLocal ? "local" : "remote"})`);
      }
    });
  }

  // Collect sticker URLs
  if (message.stickers) {
    message.stickers.forEach((sticker, i) => {
      if (sticker.sourceUrl) {
        assetUrls.push(`sticker[${i}]: ${sticker.sourceUrl}`);
      }
    });
  }

  const summary = [
    `[MSG_DEBUG] id=${message.id}`,
    `type=${message.type || "Default"}`,
    `hasContent=${hasContent}(${contentLength}chars)`,
    `attachments=${attachmentCount}`,
    `embeds=${embedCount}`,
    `stickers=${stickerCount}`,
    `mentions=${mentionCount}`,
    `emojis=${emojiCount}`,
    `hasReply=${hasReply}`,
  ].join(" | ");

  console.log(summary);

  if (assetUrls.length > 0) {
    console.log(`[MSG_DEBUG] id=${message.id} assets: ${assetUrls.join(", ")}`);
  }
}

function Message({ message, isGrouped, importPath, onImageClick, formatTimestamp, convertFileSrc, onReplyClick, debugMode, onShowRawPayload }) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const contextMenuRef = useRef(null);

  // Log message debug info on mount/update when debug mode is on
  useEffect(() => {
    logMessageDebug(message, debugMode);
  }, [message.id, debugMode]);

  const handleContextMenu = (e) => {
    if (!debugMode) return;
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  useEffect(() => {
    if (!showContextMenu) return;
    const handleClick = () => setShowContextMenu(false);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [showContextMenu]);

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
      <div className="system-message" onContextMenu={handleContextMenu}>
        <div className="system-message-content">
          <span className="system-message-text">{systemText}</span>
          <span className="system-message-timestamp">{formatTimestamp(message.timestamp)}</span>
        </div>
        {showContextMenu && (
          <div
            className="debug-context-menu"
            ref={contextMenuRef}
            style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
          >
            <button onClick={() => { onShowRawPayload?.(message); setShowContextMenu(false); }}>
              View Raw Payload
            </button>
          </div>
        )}
      </div>
    );
  }

  // Check if message content is ONLY a direct image/gif URL, Tenor URL, or Giphy URL
  const onlyImageUrl = isOnlyImageUrl(message.content);
  const onlyTenorUrl = isOnlyTenorUrl(message.content);
  const onlyGiphyUrl = isOnlyGiphyUrl(message.content);
  const shouldHideContent = onlyImageUrl !== null || onlyTenorUrl !== null || onlyGiphyUrl !== null;

  // When content is just a URL (image/tenor), check if embeds have a local thumbnail
  // that we should use instead of the remote URL (which may be expired or blocked)
  let resolvedDirectUrl = onlyImageUrl;
  let resolvedIsVideo = false;
  let hasLocalGif = false;

  if ((onlyImageUrl || onlyTenorUrl || onlyGiphyUrl) && message.embeds?.length > 0) {
    for (const embed of message.embeds) {
      // Check for local thumbnail (GIF) or video (Tenor stores as MP4)
      const localThumb = embed.thumbnail?.url && !/^https?:\/\//.test(embed.thumbnail.url)
        ? embed.thumbnail.url : null;
      const localVideo = embed.video?.url && !/^https?:\/\//.test(embed.video.url)
        ? embed.video.url : null;

      if (localThumb || localVideo) {
        // Prefer thumbnail if it's a GIF; otherwise use video for Tenor-style MP4 GIFs
        const isThumbGif = localThumb && /\.gif$/i.test(localThumb);
        const chosen = isThumbGif ? localThumb : (localVideo || localThumb);
        const fullPath = `${importPath}\\attachments\\${chosen}`;
        resolvedDirectUrl = convertFileSrc(fullPath);
        resolvedIsVideo = !isThumbGif && !!localVideo;
        hasLocalGif = true;
        break;
      }
    }
  }

  return (
    <>
    <MessageReply
          referencedMessage={message.referencedMessage}
          importPath={importPath}
          onReplyClick={onReplyClick}
        />
    <div className={`message ${isGrouped ? "grouped" : ""}`} onContextMenu={handleContextMenu}>

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
            {debugMode && (
              <span className="debug-message-id" title="Internal message ID">
                #{message.id}
              </span>
            )}
          </div>
        )}
        {message.content && message.content.length > 0 && !shouldHideContent && (
          <div className="message-text">{processContent(message, importPath, convertFileSrc)}</div>
        )}
        {onlyTenorUrl && !hasLocalGif && (
          <TenorEmbed gifId={onlyTenorUrl.gifId} url={onlyTenorUrl.url} />
        )}
        {onlyGiphyUrl && !hasLocalGif && (
          <GiphyEmbed gifId={onlyGiphyUrl.gifId} url={onlyGiphyUrl.url} />
        )}
        <MessageStickers
          stickers={message.stickers}
          importPath={importPath}
          onImageClick={onImageClick}
        />
        <MessageAttachments
          mediaRefs={message.mediaRefs}
          onImageClick={onImageClick}
          directImageUrl={resolvedDirectUrl}
          directIsVideo={resolvedIsVideo}
          debugMode={debugMode}
        />
        {!onlyTenorUrl && !onlyGiphyUrl && !hasLocalGif && (
          <MessageEmbeds
            embeds={message.embeds}
            importPath={importPath}
            debugMode={debugMode}
          />
        )}
      </div>

      {showContextMenu && (
        <div
          className="debug-context-menu"
          ref={contextMenuRef}
          style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
        >
          <button onClick={() => { onShowRawPayload?.(message); setShowContextMenu(false); }}>
            View Raw Payload
          </button>
        </div>
      )}
    </div>
    </>
  );
}

export default Message;
