# Performance Profiling Guide

Sapper has built-in profiling instrumentation for both the Rust backend and the React frontend. This guide covers how to use each tool to identify bottlenecks.

---

## Backend: Rust Flame Graph (Chrome Trace)

In **dev builds only** (`cargo tauri dev`), Sapper automatically writes a [Chrome Trace Format](https://docs.google.com/document/d/1CvAClvFfyA5R-PhYUmn5OOQtYMH4h6I0nSsKchNAySU/preview) JSON file to `~/.sapper/logs/`. This captures timing spans for all instrumented Rust functions.

### What's instrumented

**Tauri commands** (the IPC boundary — what the frontend calls):
- `load_messages`
- `get_conversation_info`
- `get_import_path`
- `get_total_message_count`
- `get_pinned_message_ids`
- `get_members`
- `search_messages`

**Internal functions** (nested inside the command spans):
- `MessageStorage::load_chunk` — individual chunk file reads + JSON deserialization
- `MessageStorage::load_chunk_index` — chunk index reads
- `MessageStorage::load_messages_range` — the full message loading pipeline
- `MessageStorage::get_pinned_message_ids` — scans all chunks for pinned messages
- `MessageStorage::create_chunks` — chunk creation during import
- `SapperCore::parse_export` — JSON parsing of the Discord export file
- `SapperCore::convert_messages_to_stored` — message conversion (two-pass)
- `SapperCore::import_conversation_with_callbacks` — full import pipeline

### How to use

1. Start the app in dev mode:
   ```
   cargo tauri dev
   ```

2. Perform the actions you want to profile (load a conversation, import, search, etc.)

3. **Close the app.** The trace file is flushed on shutdown.

4. Find the trace file:
   ```
   ~/.sapper/logs/trace-YYYYMMDD-HHMMSS.json
   ```

5. Open the trace in a viewer:
   - **Perfetto** (recommended): Go to https://ui.perfetto.dev, click "Open trace file", and select the JSON file. Perfetto has better navigation, filtering, and search.
   - **Chrome DevTools**: Navigate to `chrome://tracing` in Chrome, click "Load", and select the JSON file.

### Reading the flame graph

- Each horizontal bar is a **span** (function call). Width = duration.
- Bars are **nested** — a `load_messages` command span will contain child spans like `load_chunk_index` and `load_chunk`.
- Look for:
  - **Wide bars** — these are the slow functions.
  - **Many repeated bars** — e.g., `load_chunk` being called 20+ times inside `get_pinned_message_ids` means it's scanning every chunk.
  - **Gaps between bars** — time spent in uninstrumented code or I/O waits.

### Comparing large vs. small conversations

Run both conversations in the same session. In Perfetto, you can zoom into each region of the timeline to compare how the same function behaves with different data sizes. Look for functions where duration scales non-linearly with message count.

### Adding more instrumentation

To instrument a new function, add `#[tracing::instrument]` above it:

```rust
use tracing::instrument;

// Skip large arguments to avoid bloating the trace file
#[instrument(skip_all, fields(some_useful_field = value))]
fn my_function(...) { ... }
```

The `fields(...)` parameter lets you attach metadata (like message counts) that shows up when you click a span in the viewer.

### Notes

- The chrome trace layer is gated behind `#[cfg(debug_assertions)]` — release builds have zero overhead.
- Each app session creates a new trace file. Old ones are not cleaned up automatically.
- Very long sessions may produce large trace files (10MB+). Delete old ones from `~/.sapper/logs/` periodically.

---

## Frontend: Console Timers

`loadInitialData()` in `ConversationViewer.jsx` has `console.time` / `console.timeEnd` calls around every backend invoke. These show up in the browser console.

### How to use

1. Start the app:
   ```
   cargo tauri dev
   ```

2. Open DevTools in the Tauri window:
   - Right-click anywhere in the app -> **Inspect**
   - Or use the keyboard shortcut if one is configured

3. Go to the **Console** tab.

4. Click on a conversation to load it. You'll see output like:

   ```
   [perf] get_conversation_info: 1.2ms
   [perf] get_import_path: 0.8ms
   [perf] get_total_message_count: 3.1ms
   [perf] get_conversation_position: 0.5ms
   [perf] load_messages: 42.7ms
   [perf] setMessages (React state): 0.1ms
   [perf] get_pinned_message_ids: 287.4ms
   [perf] get_mutable_setting: 1.0ms
   [perf] loadInitialData total: 338.2ms
   ```

5. Click the large conversation, note the timings. Click the small conversation, compare.

### What each timer measures

| Timer | What it covers |
|---|---|
| `get_conversation_info` | IPC + metadata.json read + find import entry |
| `get_import_path` | IPC + metadata.json read (same file, no caching) |
| `get_total_message_count` | IPC + chunk_index.json read |
| `get_conversation_position` | IPC + config.json read |
| `load_messages` | IPC + chunk_index read + chunk file read + JSON deser + clone |
| `setMessages (React state)` | React setState call (just scheduling, not rendering) |
| `get_pinned_message_ids` | IPC + reads **every chunk file** to scan for pinned messages |
| `get_mutable_setting` | IPC + import_data.json read |
| `loadInitialData total` | Wall clock for the entire loading sequence |

The timings include IPC overhead (Tauri serialization/deserialization between Rust and JS), so they represent the true end-to-end cost from the frontend's perspective.

---

## Frontend: Chrome DevTools Performance Tab

For a full flame chart of the frontend (React rendering, layout, paint, JS execution), use the DevTools Performance recorder.

### How to use

1. Open DevTools -> **Performance** tab.

2. Click the **Record** button (circle icon).

3. Click on a conversation to trigger a load.

4. Wait for it to finish loading, then click **Stop**.

5. You get a flame chart with:
   - **Main thread** activity: JS execution, React reconciliation, style/layout/paint
   - **Frames**: whether any frames were dropped
   - **Network** (if applicable): any fetch calls

### What to look for

- **Long tasks** (red corners on bars): anything blocking the main thread for >50ms
- **React reconciliation**: look for `commitRoot`, `performSyncWorkOnRoot`, `renderRootSync` — these show how long React spends rendering
- **Layout thrashing**: repeated `Layout` bars after DOM mutations
- **`invoke` calls**: appear as microtask gaps (JS pauses while waiting for Rust IPC response)

### React DevTools Profiler

If you have the React DevTools extension:

1. Open DevTools -> **Profiler** tab (from React DevTools).
2. Click **Record**.
3. Load a conversation.
4. Click **Stop**.
5. You'll see which components re-rendered, how many times, and how long each render took.

This is useful for finding unnecessary re-renders (e.g., all messages re-rendering when only pinned state changes).

---

## Profiling the Import Pipeline

Importing a large conversation is the heaviest operation. The backend trace captures the full pipeline:

```
import_conversation_with_callbacks
  ├── parse_export              (JSON parsing)
  ├── copy_attachments          (file I/O)
  ├── convert_messages_to_stored (two-pass message processing)
  │   └── pass 2: O(n^2) referenced message lookup
  ├── create_chunks             (chunking + JSON serialization)
  │   └── (one write per chunk)
  └── index_messages            (Tantivy full-text index)
```

To profile an import:

1. Start the app in dev mode
2. Import a conversation (use your large test export)
3. Close the app
4. Open the trace file in Perfetto

Look at the relative widths of each sub-span to see where time is spent.

---

## Quick Reference

| What you want to profile | Tool | Where to look |
|---|---|---|
| Which backend function is slow | Perfetto flame graph | `~/.sapper/logs/trace-*.json` |
| Which IPC call is slow from frontend | Console timers | DevTools Console, `[perf]` prefix |
| React rendering performance | DevTools Performance tab | Main thread flame chart |
| Component re-render counts | React DevTools Profiler | Profiler tab |
| Import pipeline breakdown | Perfetto flame graph | `import_conversation_with_callbacks` span |
| Search performance | Perfetto flame graph | `search_messages` span |
