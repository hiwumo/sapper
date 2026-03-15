import { useState, useRef, useCallback } from "react";

function GifIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
      <text x="12" y="15.5" textAnchor="middle" fill="currentColor" fontSize="8" fontWeight="700" fontFamily="Arial, sans-serif">GIF</text>
    </svg>
  );
}

function EmojiIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <circle cx="8.5" cy="10" r="1.2" fill="currentColor" />
      <circle cx="15.5" cy="10" r="1.2" fill="currentColor" />
      <path d="M8 14.5c1 1.5 3 2.5 4 2.5s3-1 4-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MessageBar({ onSend, channelName }) {
  const [input, setInput] = useState("");
  const inputRef = useRef(null);

  const handleSend = useCallback(() => {
    const content = input.trim();
    if (!content) return;
    onSend(content);
    setInput("");
  }, [input, onSend]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const placeholder = channelName ? `Message @${channelName}` : "Message...";

  return (
    <div className="message-bar">
      <div className="message-bar-container">
        <textarea
          ref={inputRef}
          className="message-bar-input"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <div className="message-bar-buttons">
          <button className="message-bar-icon-btn" title="GIF" type="button">
            <GifIcon size={20} />
          </button>
          <button className="message-bar-icon-btn" title="Emoji" type="button">
            <EmojiIcon size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default MessageBar;
