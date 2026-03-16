import { useState, useEffect, useRef, useCallback } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import "./GifPicker.css";

const TENOR_API_KEY = "LIVDSRZULELA";

function extractTenorGifId(url) {
  if (!url || typeof url !== "string") return null;
  const match = url.match(
    /^https?:\/\/(www\.)?tenor\.com\/view\/[^/]+-(\d+)$/
  );
  return match ? match[2] : null;
}

function extractGiphyGifId(url) {
  if (!url || typeof url !== "string") return null;
  const m1 = url.match(
    /^https?:\/\/(www\.)?giphy\.com\/gifs\/(?:.*-)?([a-zA-Z0-9]+)$/
  );
  if (m1) return m1[2];
  const m2 = url.match(
    /^https?:\/\/media[0-9]?\.giphy\.com\/media\/([a-zA-Z0-9]+)\//
  );
  return m2 ? m2[1] : null;
}

function extractConversationGifs(messages, importPath) {
  const gifs = [];
  const seen = new Set();

  if (!messages) return gifs;

  for (const msg of messages) {
    if (msg.content) {
      const trimmed = msg.content.trim();

      // Tenor URLs — find a usable preview from embeds
      const tenorId = extractTenorGifId(trimmed);
      if (tenorId && !seen.has(tenorId)) {
        seen.add(tenorId);
        let previewUrl = null;
        let sendUrl = trimmed; // default: the tenor page URL
        if (msg.embeds?.length > 0) {
          for (const embed of msg.embeds) {
            const isLocal = (u) =>
              u && !/^https?:\/\//.test(u) && /[\\\/]/.test(u);
            const localThumb = isLocal(embed.thumbnail?.url)
              ? embed.thumbnail.url
              : null;
            const localVideo = isLocal(embed.video?.url)
              ? embed.video.url
              : null;
            // Use remote canonical URLs for sending (they're direct media links)
            if (embed.video?.canonicalUrl) {
              sendUrl = embed.video.canonicalUrl;
            } else if (embed.thumbnail?.canonicalUrl) {
              sendUrl = embed.thumbnail.canonicalUrl;
            }
            // Use local files for preview in the picker
            if (localThumb) {
              previewUrl = convertFileSrc(
                `${importPath}\\attachments\\${localThumb}`
              );
              break;
            }
            if (localVideo) {
              previewUrl = convertFileSrc(
                `${importPath}\\attachments\\${localVideo}`
              );
              break;
            }
            if (
              embed.thumbnail?.url &&
              /^https?:\/\//.test(embed.thumbnail.url)
            ) {
              previewUrl = embed.thumbnail.url;
              break;
            }
          }
        }
        gifs.push({ previewUrl, sendUrl });
        continue;
      }

      // Giphy URLs
      const giphyId = extractGiphyGifId(trimmed);
      if (giphyId && !seen.has(giphyId)) {
        seen.add(giphyId);
        const mediaUrl = `https://media.giphy.com/media/${giphyId}/giphy.gif`;
        let previewUrl = mediaUrl;
        if (msg.embeds?.length > 0) {
          for (const embed of msg.embeds) {
            if (
              embed.thumbnail?.url &&
              /^https?:\/\//.test(embed.thumbnail.url)
            ) {
              previewUrl = embed.thumbnail.url;
              break;
            }
          }
        }
        gifs.push({ previewUrl, sendUrl: mediaUrl });
        continue;
      }

      // Direct image/gif URLs
      if (/^https?:\/\/\S+\.gif(\?.*)?$/i.test(trimmed) && !seen.has(trimmed)) {
        seen.add(trimmed);
        gifs.push({ previewUrl: trimmed, sendUrl: trimmed });
        continue;
      }
    }

    // mediaRefs with .gif files
    if (msg.mediaRefs?.length > 0) {
      for (const ref of msg.mediaRefs) {
        if (/\.gif$/i.test(ref) && !seen.has(ref)) {
          seen.add(ref);
          const fullPath = `${importPath}\\attachments\\${ref}`;
          gifs.push({
            previewUrl: convertFileSrc(fullPath),
            sendUrl: convertFileSrc(fullPath),
          });
        }
      }
    }
  }

  return gifs;
}

function GifPicker({ onSelect, onClose, messages, importPath }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [featured, setFeatured] = useState(null);
  const pickerRef = useRef(null);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  const conversationGifs = useRef([]);

  useEffect(() => {
    conversationGifs.current = extractConversationGifs(messages, importPath);
  }, [messages, importPath]);

  // Load trending GIFs on open
  useEffect(() => {
    fetchTrending();
  }, []);

  // Focus search on open
  useEffect(() => {
    if (searchRef.current) searchRef.current.focus();
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

  function parseTenorV1Results(data) {
    return (data.results || []).map((r) => {
      const gif = r.media?.[0]?.gif;
      const tinygif = r.media?.[0]?.tinygif;
      const mediumgif = r.media?.[0]?.mediumgif;
      return {
        id: r.id,
        previewUrl: tinygif?.url || mediumgif?.url || gif?.url,
        sendUrl: gif?.url || mediumgif?.url || tinygif?.url,
        title: r.title || r.content_description || "",
      };
    });
  }

  async function fetchTrending() {
    try {
      const resp = await fetch(
        `https://g.tenor.com/v1/trending?key=${TENOR_API_KEY}&limit=30&media_filter=minimal`
      );
      if (!resp.ok) return;
      const data = await resp.json();
      setFeatured(parseTenorV1Results(data));
    } catch {
      setFeatured([]);
    }
  }

  async function searchTenor(query) {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(
        `https://g.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&limit=30&media_filter=minimal`
      );
      if (!resp.ok) {
        setResults([]);
        return;
      }
      const data = await resp.json();
      setResults(parseTenorV1Results(data));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = useCallback((e) => {
    const val = e.target.value;
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchTenor(val);
    }, 400);
  }, []);

  function handleGifClick(gif) {
    if (gif.sendUrl) {
      onSelect(gif.sendUrl);
    }
    onClose();
  }

  const showingSearch = results !== null || loading;
  const convGifs = conversationGifs.current;

  return (
    <div className="gif-picker" ref={pickerRef}>
      <div className="gif-picker-search">
        <input
          ref={searchRef}
          type="text"
          placeholder="Search Tenor..."
          value={search}
          onChange={handleSearch}
          className="gif-picker-search-input"
        />
      </div>

      <div className="gif-picker-content">
        {showingSearch && (
          <>
            {loading && (
              <div className="gif-picker-loading">Searching...</div>
            )}
            {results && results.length === 0 && !loading && (
              <div className="gif-picker-no-results">No GIFs found</div>
            )}
            {results && results.length > 0 && (
              <div className="gif-picker-grid">
                {results.map((gif) => (
                  <button
                    key={gif.id}
                    className="gif-picker-item"
                    onClick={() => handleGifClick(gif)}
                    title={gif.title}
                  >
                    <img
                      src={gif.previewUrl}
                      alt={gif.title}
                      loading="lazy"
                      draggable={false}
                    />
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {!showingSearch && (
          <>
            {convGifs.length > 0 && (
              <>
                <div className="gif-picker-section-label">
                  From this conversation
                </div>
                <div className="gif-picker-grid">
                  {convGifs.map((gif, i) => (
                    <button
                      key={`conv-${i}`}
                      className="gif-picker-item"
                      onClick={() => handleGifClick(gif)}
                      title="Reuse GIF"
                    >
                      {gif.previewUrl ? (
                        <img
                          src={gif.previewUrl}
                          alt="GIF"
                          loading="lazy"
                          draggable={false}
                        />
                      ) : (
                        <div className="gif-picker-placeholder">GIF</div>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            {featured && featured.length > 0 && (
              <>
                <div className="gif-picker-section-label">Trending</div>
                <div className="gif-picker-grid">
                  {featured.map((gif) => (
                    <button
                      key={gif.id}
                      className="gif-picker-item"
                      onClick={() => handleGifClick(gif)}
                      title={gif.title}
                    >
                      <img
                        src={gif.previewUrl}
                        alt={gif.title}
                        loading="lazy"
                        draggable={false}
                      />
                    </button>
                  ))}
                </div>
              </>
            )}

            {!featured && (
              <div className="gif-picker-loading">Loading GIFs...</div>
            )}
          </>
        )}
      </div>

      <div className="gif-picker-footer">
        <img
          src="https://www.gstatic.com/tenor/web/attribution/PB_tenor_logo_blue_horizontal.svg"
          alt="Powered by Tenor"
          className="gif-picker-tenor-logo"
          draggable={false}
        />
      </div>
    </div>
  );
}

export default GifPicker;
