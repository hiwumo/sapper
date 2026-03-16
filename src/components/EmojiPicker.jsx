import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  loadEmojiData,
  getEmojisByCategory,
  getCategories,
  getCategoryIcon,
  getTwemojiUrl,
  searchEmojis,
} from "../emojiData";
import "./EmojiPicker.css";

function EmojiPicker({ onSelect, onClose }) {
  const [emojis, setEmojis] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const pickerRef = useRef(null);
  const gridRef = useRef(null);
  const categoryRefs = useRef({});
  const searchRef = useRef(null);

  useEffect(() => {
    loadEmojiData().then(() => {
      setEmojis(getEmojisByCategory());
      setActiveCategory(getCategories()[0]);
    });
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Focus search on open
  useEffect(() => {
    if (emojis && searchRef.current) {
      searchRef.current.focus();
    }
  }, [emojis]);

  const handleSearch = useCallback((e) => {
    const val = e.target.value;
    setSearch(val);
    if (val.trim()) {
      setSearchResults(searchEmojis(val.trim(), 50));
    } else {
      setSearchResults(null);
    }
  }, []);

  const scrollToCategory = useCallback((cat) => {
    setActiveCategory(cat);
    setSearch("");
    setSearchResults(null);
    const el = categoryRefs.current[cat];
    if (el && gridRef.current) {
      gridRef.current.scrollTop = el.offsetTop - gridRef.current.offsetTop;
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (searchResults || !gridRef.current) return;
    const container = gridRef.current;
    const categories = getCategories();
    let current = categories[0];

    for (const cat of categories) {
      const el = categoryRefs.current[cat];
      if (el) {
        const top = el.offsetTop - container.offsetTop - container.scrollTop;
        if (top <= 10) current = cat;
      }
    }
    setActiveCategory(current);
  }, [searchResults]);

  if (!emojis) {
    return (
      <div className="emoji-picker" ref={pickerRef}>
        <div className="emoji-picker-loading">Loading emojis...</div>
      </div>
    );
  }

  const categories = getCategories();

  return (
    <div className="emoji-picker" ref={pickerRef}>
      {/* Search bar */}
      <div className="emoji-picker-search">
        <input
          ref={searchRef}
          type="text"
          placeholder="Search emojis..."
          value={search}
          onChange={handleSearch}
          className="emoji-picker-search-input"
        />
      </div>

      {/* Category tabs */}
      <div className="emoji-picker-tabs">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`emoji-picker-tab${activeCategory === cat ? " active" : ""}`}
            onClick={() => scrollToCategory(cat)}
            title={cat}
          >
            <img
              src={getTwemojiUrl(
                cat === "Smileys & Emotion" ? "1f600" :
                cat === "People & Body" ? "1f44b" :
                cat === "Animals & Nature" ? "1f43e" :
                cat === "Food & Drink" ? "1f354" :
                cat === "Travel & Places" ? "2708" :
                cat === "Activities" ? "26bd" :
                cat === "Objects" ? "1f4a1" :
                cat === "Symbols" ? "2764" :
                "1f3f4"
              )}
              alt={cat}
              className="emoji-picker-tab-icon"
              draggable={false}
            />
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="emoji-picker-grid" ref={gridRef} onScroll={handleScroll}>
        {searchResults ? (
          <>
            <div className="emoji-picker-category-label">Search Results</div>
            <div className="emoji-picker-emojis">
              {searchResults.length === 0 && (
                <div className="emoji-picker-no-results">No emojis found</div>
              )}
              {searchResults.map((emoji) => (
                <button
                  key={emoji.name}
                  className="emoji-picker-emoji"
                  title={`:${emoji.name}:`}
                  onClick={() => onSelect(emoji)}
                >
                  <img
                    src={getTwemojiUrl(emoji.unified)}
                    alt={emoji.name}
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          </>
        ) : (
          categories.map((cat) => (
            <div
              key={cat}
              ref={(el) => (categoryRefs.current[cat] = el)}
            >
              <div className="emoji-picker-category-label">{cat}</div>
              <div className="emoji-picker-emojis">
                {(emojis[cat] || []).map((emoji) => (
                  <button
                    key={emoji.name}
                    className="emoji-picker-emoji"
                    title={`:${emoji.name}:`}
                    onClick={() => onSelect(emoji)}
                  >
                    <img
                      src={getTwemojiUrl(emoji.unified)}
                      alt={emoji.name}
                      draggable={false}
                    />
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default EmojiPicker;
