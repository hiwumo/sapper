import { useState, useRef, useCallback, useEffect } from "react";
import {
  loadEmojiData,
  searchEmojis,
  getTwemojiUrl,
  getEmojiByName,
  unifiedToNative,
  replaceNativeWithShortcodes,
} from "../emojiData";
import EmojiPicker from "./EmojiPicker";
import "./EmojiPicker.css";

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
  const [showPicker, setShowPicker] = useState(false);
  const [autocomplete, setAutocomplete] = useState(null); // { results, activeIndex, colonStart }
  const inputRef = useRef(null);
  const barRef = useRef(null);

  // Preload emoji data
  useEffect(() => {
    loadEmojiData();
  }, []);

  const insertEmoji = useCallback((emoji) => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const native = unifiedToNative(emoji.unified);

    if (autocomplete) {
      // Replace the partial :query with the native emoji
      const before = input.slice(0, autocomplete.colonStart);
      const after = input.slice(textarea.selectionStart);
      const newValue = before + native + after;
      setInput(newValue);
      setAutocomplete(null);

      requestAnimationFrame(() => {
        const pos = before.length + native.length;
        textarea.setSelectionRange(pos, pos);
        textarea.focus();
      });
    } else {
      // Insert at cursor from picker
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = input.slice(0, start);
      const after = input.slice(end);
      const newValue = before + native + after;
      setInput(newValue);

      requestAnimationFrame(() => {
        const pos = before.length + native.length;
        textarea.setSelectionRange(pos, pos);
        textarea.focus();
      });
    }
  }, [input, autocomplete]);

  const handlePickerSelect = useCallback((emoji) => {
    insertEmoji(emoji);
    setShowPicker(false);
  }, [insertEmoji]);

  const handleSend = useCallback(() => {
    const content = input.trim();
    if (!content) return;
    // Convert native emoji characters back to :shortcodes: for storage/rendering
    onSend(replaceNativeWithShortcodes(content));
    setInput("");
    setAutocomplete(null);
  }, [input, onSend]);

  const handleChange = useCallback((e) => {
    let value = e.target.value;
    let cursorPos = e.target.selectionStart;

    // Check for just-completed shortcode (user typed closing colon)
    const textBeforeCursor = value.slice(0, cursorPos);
    const completedMatch = textBeforeCursor.match(/:([a-z0-9_+\-]+):$/i);
    if (completedMatch) {
      const emoji = getEmojiByName(completedMatch[1].toLowerCase());
      if (emoji) {
        const native = unifiedToNative(emoji.unified);
        const before = value.slice(0, cursorPos - completedMatch[0].length);
        const after = value.slice(cursorPos);
        value = before + native + after;
        cursorPos = before.length + native.length;
        setInput(value);
        setAutocomplete(null);
        requestAnimationFrame(() => {
          const textarea = inputRef.current;
          if (textarea) {
            textarea.setSelectionRange(cursorPos, cursorPos);
          }
        });
        return;
      }
    }

    setInput(value);

    // Check for emoji autocomplete trigger
    const textBeforeCursor2 = value.slice(0, cursorPos);
    const colonMatch = textBeforeCursor2.match(/:([a-z0-9_+\-]*)$/i);

    if (colonMatch && colonMatch[1].length >= 1) {
      const query = colonMatch[1];
      const results = searchEmojis(query, 10);
      if (results.length > 0) {
        setAutocomplete({
          results,
          activeIndex: 0,
          colonStart: cursorPos - colonMatch[0].length,
        });
        return;
      }
    }

    setAutocomplete(null);
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (autocomplete) {
      const { results, activeIndex } = autocomplete;

      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        insertEmoji(results[activeIndex]);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAutocomplete((prev) => ({
          ...prev,
          activeIndex: (prev.activeIndex + 1) % prev.results.length,
        }));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAutocomplete((prev) => ({
          ...prev,
          activeIndex:
            (prev.activeIndex - 1 + prev.results.length) % prev.results.length,
        }));
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setAutocomplete(null);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [autocomplete, handleSend, insertEmoji]);

  const placeholder = channelName ? `Message @${channelName}` : "Message...";

  return (
    <div className="message-bar" ref={barRef}>
      <div className="message-bar-container" style={{ position: "relative" }}>
        {/* Autocomplete popup */}
        {autocomplete && (
          <div className="emoji-autocomplete">
            {autocomplete.results.map((emoji, i) => (
              <button
                key={emoji.name}
                className={`emoji-autocomplete-item${i === autocomplete.activeIndex ? " active" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertEmoji(emoji);
                }}
                onMouseEnter={() =>
                  setAutocomplete((prev) => ({ ...prev, activeIndex: i }))
                }
              >
                <img
                  src={getTwemojiUrl(emoji.unified)}
                  alt={emoji.name}
                  draggable={false}
                />
                :{emoji.name}:
              </button>
            ))}
          </div>
        )}

        {/* Emoji picker */}
        {showPicker && (
          <EmojiPicker
            onSelect={handlePickerSelect}
            onClose={() => setShowPicker(false)}
          />
        )}

        <textarea
          ref={inputRef}
          className="message-bar-input"
          placeholder={placeholder}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <div className="message-bar-buttons">
          <button className="message-bar-icon-btn" title="GIF" type="button">
            <GifIcon size={20} />
          </button>
          <button
            className="message-bar-icon-btn"
            title="Emoji"
            type="button"
            onClick={() => setShowPicker((v) => !v)}
          >
            <EmojiIcon size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default MessageBar;
