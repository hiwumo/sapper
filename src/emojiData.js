import { invoke } from "@tauri-apps/api/core";

const EMOJI_SOURCE_URL =
  "https://cdn.jsdelivr.net/npm/emoji-datasource@15.1.2/emoji.json";

const TWEMOJI_BASE =
  "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/";

// Category order matching Discord
const CATEGORY_ORDER = [
  "Smileys & Emotion",
  "People & Body",
  "Animals & Nature",
  "Food & Drink",
  "Travel & Places",
  "Activities",
  "Objects",
  "Symbols",
  "Flags",
];

const CATEGORY_ICONS = {
  "Smileys & Emotion": "\u{1F600}",
  "People & Body": "\u{1F44B}",
  "Animals & Nature": "\u{1F43E}",
  "Food & Drink": "\u{1F354}",
  "Travel & Places": "\u{2708}",
  "Activities": "\u{26BD}",
  "Objects": "\u{1F4A1}",
  "Symbols": "\u{2764}",
  "Flags": "\u{1F3F4}",
};

let cachedEmojis = null;
let cachedByName = null;
let cachedByNative = null;

export function getTwemojiUrl(unified) {
  return `${TWEMOJI_BASE}${unified}.png`;
}

export function unifiedToNative(unified) {
  return unified.split('-').map(hex => String.fromCodePoint(parseInt(hex, 16))).join('');
}

export function getCategories() {
  return CATEGORY_ORDER;
}

export function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || "";
}

/**
 * Load emoji data - tries cache first, then fetches from CDN.
 * Returns array of { name, names, unified, category, order }
 */
export async function loadEmojiData() {
  if (cachedEmojis) return cachedEmojis;

  // Try loading from disk cache
  try {
    const cached = await invoke("load_emoji_cache");
    if (cached) {
      cachedEmojis = JSON.parse(cached);
      buildNameIndex();
      return cachedEmojis;
    }
  } catch (e) {
    console.warn("Failed to load emoji cache:", e);
  }

  // Fetch from CDN
  try {
    const res = await fetch(EMOJI_SOURCE_URL);
    const raw = await res.json();

    // Transform to compact format
    cachedEmojis = raw
      .filter(
        (e) =>
          e.has_img_twitter &&
          !e.obsoleted_by &&
          CATEGORY_ORDER.includes(e.category)
      )
      .map((e) => ({
        name: e.short_name,
        names: e.short_names,
        unified: e.unified.toLowerCase().replace(/-fe0f$/g, ""),
        category: e.category,
        order: e.sort_order,
      }))
      .sort((a, b) => a.order - b.order);

    // Save to disk cache
    try {
      await invoke("save_emoji_cache", {
        data: JSON.stringify(cachedEmojis),
      });
    } catch (e) {
      console.warn("Failed to save emoji cache:", e);
    }

    buildNameIndex();
    return cachedEmojis;
  } catch (e) {
    console.error("Failed to fetch emoji data:", e);
    return [];
  }
}

function buildNameIndex() {
  cachedByName = new Map();
  cachedByNative = new Map();
  if (!cachedEmojis) return;
  for (const emoji of cachedEmojis) {
    for (const name of emoji.names) {
      cachedByName.set(name, emoji);
    }
    const native = unifiedToNative(emoji.unified);
    cachedByNative.set(native, emoji);
  }
}

/**
 * Search emojis by partial name match
 */
export function searchEmojis(query, limit = 20) {
  if (!cachedEmojis) return [];
  const q = query.toLowerCase();
  const results = [];

  // Exact prefix matches first, then substring matches
  const prefixMatches = [];
  const substringMatches = [];

  for (const emoji of cachedEmojis) {
    const matched = emoji.names.some((n) => n.startsWith(q));
    if (matched) {
      prefixMatches.push(emoji);
    } else if (emoji.names.some((n) => n.includes(q))) {
      substringMatches.push(emoji);
    }
    if (prefixMatches.length + substringMatches.length >= limit) break;
  }

  return [...prefixMatches, ...substringMatches].slice(0, limit);
}

/**
 * Get emoji by exact shortcode name
 */
export function getEmojiByName(name) {
  if (!cachedByName) return null;
  return cachedByName.get(name) || null;
}

/**
 * Replace native Unicode emoji characters with :shortcode: format.
 * Used to convert display emojis back to shortcodes before sending.
 */
export function replaceNativeWithShortcodes(text) {
  if (!cachedByNative || cachedByNative.size === 0) return text;
  let result = text;
  // Sort by native string length descending so multi-codepoint emojis match first
  const entries = [...cachedByNative.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [native, emoji] of entries) {
    if (result.includes(native)) {
      result = result.replaceAll(native, `:${emoji.name}:`);
    }
  }
  return result;
}

/**
 * Get emojis grouped by category
 */
export function getEmojisByCategory() {
  if (!cachedEmojis) return {};
  const grouped = {};
  for (const cat of CATEGORY_ORDER) {
    grouped[cat] = [];
  }
  for (const emoji of cachedEmojis) {
    if (grouped[emoji.category]) {
      grouped[emoji.category].push(emoji);
    }
  }
  return grouped;
}
