import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { Hash, AtSign, Search, FolderOpen, Filter, X, Pin } from "lucide-react";
import { themes } from "../themes";
import { useToast } from "./ToastContainer";
import Message from "./Message";
import MessageAvatar from "./MessageAvatar";
import MessageBar from "./MessageBar";
import MemberEditor from "./MemberEditor";
import "./ConversationViewer.css";

const MESSAGES_PER_PAGE = 50;
const MAX_RENDERED_MESSAGES = 150;
const SEARCH_RESULTS_PER_PAGE = 10;

const LOADING_QUOTES = [
  "Dusting off your old memories...",
  "Packaging a chatlog...",
  "Applying sap...",
  "Imma load this someday..."
];

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function ConversationViewer({ importId, theme, debugMode, refreshKey }) {
  const toast = useToast();
  const themeColors = themes[theme]?.colors || themes.dark.colors;
  const [messages, _setMessages] = useState([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importPath, setImportPath] = useState("");
  const [conversationInfo, setConversationInfo] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchTotalCount, setSearchTotalCount] = useState(0);
  const [searchSortOrder, setSearchSortOrder] = useState("new"); // "new" or "old"
  const [isSearching, setIsSearching] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [members, setMembers] = useState([]);
  const [viewingImage, setViewingImage] = useState(null);
  const [searchPage, setSearchPage] = useState(0);
  const [memberEditorOpen, setMemberEditorOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [afterDate, setAfterDate] = useState("");
  const [beforeDate, setBeforeDate] = useState("");
  const [rawPayloadMessage, setRawPayloadMessage] = useState(null);
  const [chunkDebugInfo, setChunkDebugInfo] = useState(null);
  const [chunkDebugExpanded, setChunkDebugExpanded] = useState(false);
  const [afterTimestamp, setAfterTimestamp] = useState(null);
  const [beforeTimestamp, setBeforeTimestamp] = useState(null);
  const [memberContextMenu, setMemberContextMenu] = useState(null);
  const [showHiddenMembers, setShowHiddenMembers] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState([]); // { messageId, originalPin }
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [pinnedPage, setPinnedPage] = useState(0);
  const PINNED_PER_PAGE = 10;
  const [blurredMessages, setBlurredMessages] = useState(new Set()); // set of message IDs
  const [isMutable, setIsMutable] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null); // { id, content }
  const [editContent, setEditContent] = useState("");

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollRestorationRef = useRef(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const savePositionTimeoutRef = useRef(null);

  const setMessages = _setMessages;

  useEffect(() => {
    loadInitialData();
  }, [importId]);

  // Re-fetch mutable setting when conversation is edited
  useEffect(() => {
    if (refreshKey > 0) {
      invoke("get_mutable_setting", { importId })
        .then(val => setIsMutable(val))
        .catch(() => {});
    }
  }, [refreshKey]);

  useEffect(() => {
    if (!hasScrolledToBottom && messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView();
      setHasScrolledToBottom(true);
    }
  }, [messages, hasScrolledToBottom]);

  useLayoutEffect(() => {
    // Restore scroll position after loading older messages
    // useLayoutEffect runs synchronously before browser paint, preventing visible jump
    if (scrollRestorationRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const { anchorMessageId, anchorOffset } = scrollRestorationRef.current;

      const anchorElement = container.querySelector(`[data-message-id="${anchorMessageId}"]`);
      if (anchorElement) {
        const containerRect = container.getBoundingClientRect();
        const anchorRect = anchorElement.getBoundingClientRect();
        const currentOffset = anchorRect.top - containerRect.top;
        container.scrollTop += currentOffset - anchorOffset;
      }

      scrollRestorationRef.current = null;
      setIsLoadingMore(false);
    }
  }, [messages]);

  useEffect(() => {
    // Load members from backend
    const loadMembers = async () => {
      try {
        const result = await invoke("get_members", { importId });
        if (result && result.members) {
          // Sort members by ID and format for display
          const sortedMembers = result.members
            .sort((a, b) => a.id.localeCompare(b.id))
            .map(m => ({
              id: m.id,
              name: m.nickname,
              avatar: m.avatarUrl,
              color: m.color,
              discriminator: m.discriminator,
              isBot: m.isBot,
              hidden: m.hidden || false,
            }));
          setMembers(sortedMembers);
        }
      } catch (error) {
        console.error("Failed to load members:", error);
        // Fallback to extracting from messages if members.json doesn't exist
        const uniqueMembers = new Map();
        messages.forEach(msg => {
          if (!uniqueMembers.has(msg.author.id)) {
            uniqueMembers.set(msg.author.id, {
              id: msg.author.id,
              name: msg.author.nickname,
              avatar: msg.author.avatarUrl,
              color: msg.author.color,
              discriminator: msg.author.discriminator,
              isBot: msg.author.isBot,
              hidden: false,
            });
          }
        });
        const membersArray = Array.from(uniqueMembers.values());
        membersArray.sort((a, b) => a.id.localeCompare(b.id));
        setMembers(membersArray);
      }
    };

    if (importId) {
      loadMembers();
    }
  }, [importId]);

  // Load chunk debug info when debug mode is enabled
  useEffect(() => {
    if (!debugMode || !importId) {
      setChunkDebugInfo(null);
      return;
    }
    const loadChunkDebug = async () => {
      try {
        const info = await invoke("get_chunk_debug_info", { importId });
        setChunkDebugInfo(info);
      } catch (error) {
        console.error("Failed to load chunk debug info:", error);
      }
    };
    loadChunkDebug();
  }, [debugMode, importId]);

  // Create member lookup map by author ID
  const memberLookup = useMemo(() => {
    const lookup = new Map();
    members.forEach(member => {
      lookup.set(member.id, member);
    });
    return lookup;
  }, [members]);

  // Apply stored member info to messages
  const messagesWithStoredMembers = useMemo(() => {
    return messages.map(msg => {
      const storedMember = memberLookup.get(msg.author.id);
      if (storedMember) {
        // Replace author info with stored member info
        return {
          ...msg,
          author: {
            ...msg.author,
            nickname: storedMember.name,
            avatarUrl: storedMember.avatar,
            color: storedMember.color,
          },
        };
      }
      return msg;
    });
  }, [messages, memberLookup]);

  // Apply stored member info to search results
  const searchResultsWithStoredMembers = useMemo(() => {
    return searchResults.map(msg => {
      const storedMember = memberLookup.get(msg.author.id);
      if (storedMember) {
        return {
          ...msg,
          author: {
            ...msg.author,
            nickname: storedMember.name,
            avatarUrl: storedMember.avatar,
            color: storedMember.color,
          },
        };
      }
      return msg;
    });
  }, [searchResults, memberLookup]);

  const [pinnedMessageData, setPinnedMessageData] = useState([]);
  const [loadingPinnedData, setLoadingPinnedData] = useState(false);

  // Load full message data for pinned messages when panel opens or pins change
  useEffect(() => {
    if (!showPinnedPanel || pinnedMessages.length === 0) {
      setPinnedMessageData([]);
      return;
    }

    const loadPinnedData = async () => {
      setLoadingPinnedData(true);
      try {
        const results = await Promise.all(
          pinnedMessages.map(pin =>
            invoke("load_messages", { importId, startIndex: pin.messageId, count: 1 })
              .then(msgs => msgs.length > 0 ? { msg: msgs[0], originalPin: pin.originalPin } : null)
          )
        );
        const data = results.filter(Boolean).map(({ msg, originalPin }) => {
          const storedMember = memberLookup.get(msg.author.id);
          const enriched = storedMember ? {
            ...msg,
            author: { ...msg.author, nickname: storedMember.name, avatarUrl: storedMember.avatar, color: storedMember.color },
          } : msg;
          return { ...enriched, _originalPin: originalPin };
        });
        setPinnedMessageData(data);
      } catch (err) {
        console.error("Failed to load pinned message data:", err);
      } finally {
        setLoadingPinnedData(false);
      }
    };

    loadPinnedData();
  }, [showPinnedPanel, pinnedMessages, importId, memberLookup]);

  async function loadInitialData() {
    try {
      setLoading(true);
      setError(null);
      setHasScrolledToBottom(false);
      setPinnedMessages([]);
      setShowPinnedPanel(false);

      console.time("[perf] loadInitialData total");

      // Log frontend info
      await invoke("log_frontend_info", { message: `Loading conversation: ${importId}` });

      // Get conversation info
      console.time("[perf] get_conversation_info");
      const info = await invoke("get_conversation_info", { importId });
      console.timeEnd("[perf] get_conversation_info");
      setConversationInfo(info);

      // Get import path for constructing file URLs
      console.time("[perf] get_import_path");
      const path = await invoke("get_import_path", { importId });
      console.timeEnd("[perf] get_import_path");
      setImportPath(path);

      // Get total message count
      console.time("[perf] get_total_message_count");
      const total = await invoke("get_total_message_count", { importId });
      console.timeEnd("[perf] get_total_message_count");
      setTotalMessages(total);

      // Check for saved position
      console.time("[perf] get_conversation_position");
      const savedPosition = await invoke("get_conversation_position", { importId });
      console.timeEnd("[perf] get_conversation_position");

      let startIndex, count;
      if (savedPosition !== null && savedPosition !== undefined) {
        // Load messages around saved position
        startIndex = Math.max(0, savedPosition - 25);
        count = MESSAGES_PER_PAGE;
      } else {
        // Load last 50 messages (newest) - default behavior
        startIndex = Math.max(0, total - MESSAGES_PER_PAGE);
        count = MESSAGES_PER_PAGE;
      }

      console.time("[perf] load_messages");
      const loadedMessages = await invoke("load_messages", {
        importId,
        startIndex,
        count,
      });
      console.timeEnd("[perf] load_messages");

      console.log(loadedMessages);
      console.time("[perf] setMessages (React state)");
      setMessages(loadedMessages);
      console.timeEnd("[perf] setMessages (React state)");

      // Load pinned message IDs from backend (scans all chunks once)
      try {
        console.time("[perf] get_pinned_message_ids");
        const pinnedIds = await invoke("get_pinned_message_ids", { importId });
        console.timeEnd("[perf] get_pinned_message_ids");
        setPinnedMessages(pinnedIds.map(id => ({ messageId: id, originalPin: true })));
      } catch (pinErr) {
        console.error("Failed to load pinned messages:", pinErr);
      }

      // Load mutable conversation setting
      try {
        console.time("[perf] get_mutable_setting");
        const mutable = await invoke("get_mutable_setting", { importId });
        console.timeEnd("[perf] get_mutable_setting");
        setIsMutable(mutable);
      } catch (mutErr) {
        console.error("Failed to load mutable setting:", mutErr);
        setIsMutable(false);
      }

      console.timeEnd("[perf] loadInitialData total");

      // If we have a saved position, scroll to it after a brief delay
      if (savedPosition !== null && savedPosition !== undefined) {
        setTimeout(() => {
          const messageElement = document.querySelector(`[data-message-id="${savedPosition}"]`);
          if (messageElement) {
            messageElement.scrollIntoView({ block: "center" });
          }
        }, 100);
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
      await invoke("log_frontend_error", { message: `Failed to load conversation ${importId}: ${err.toString()}` });
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  }

  const handleOpenLogs = async () => {
    try {
      const logDir = await invoke("get_log_directory");
      await openPath(logDir);
    } catch (error) {
      console.error("Failed to open log directory:", error);
      toast.error(`Failed to open log directory: ${error}`);
    }
  };

  async function loadMoreMessages(direction = "up") {
    if (messages.length === 0 || isLoadingMore) return 0;

    try {
      setIsLoadingMore(true);

      const firstMessageId = messages[0].id;
      const lastMessageId = messages[messages.length - 1].id;

      let startIndex, count;
      if (direction === "up") {
        startIndex = Math.max(0, firstMessageId - MESSAGES_PER_PAGE);
        count = Math.min(MESSAGES_PER_PAGE, firstMessageId);
      } else {
        startIndex = lastMessageId + 1;
        count = Math.min(MESSAGES_PER_PAGE, totalMessages - lastMessageId - 1);
      }

      if (count <= 0) {
        setIsLoadingMore(false);
        return 0;
      }

      const newMessages = await invoke("load_messages", {
        importId,
        startIndex,
        count,
      });

      if (newMessages.length === 0) {
        setIsLoadingMore(false);
        return 0;
      }

      if (direction === "up") {
        // Anchor to the first currently-visible message so we can restore position after DOM update
        const container = messagesContainerRef.current;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          const messageElements = container.querySelectorAll('[data-message-id]');
          for (const el of messageElements) {
            const rect = el.getBoundingClientRect();
            if (rect.bottom > containerRect.top) {
              scrollRestorationRef.current = {
                anchorMessageId: el.getAttribute('data-message-id'),
                anchorOffset: rect.top - containerRect.top,
              };
              break;
            }
          }
        }
        // isLoadingMore is cleared in the useLayoutEffect after scroll restoration
        setMessages((prev) => {
          const existingIds = new Set(prev.map(m => m.id));
          const deduped = newMessages.filter(m => !existingIds.has(m.id));
          const combined = [...deduped, ...prev];
          // Trim from the bottom to keep DOM size bounded
          if (combined.length > MAX_RENDERED_MESSAGES) {
            return combined.slice(0, MAX_RENDERED_MESSAGES);
          }
          return combined;
        });
      } else {
        setMessages((prev) => {
          const existingIds = new Set(prev.map(m => m.id));
          const deduped = newMessages.filter(m => !existingIds.has(m.id));
          const combined = [...prev, ...deduped];
          // Trim from the top to keep DOM size bounded
          if (combined.length > MAX_RENDERED_MESSAGES) {
            return combined.slice(combined.length - MAX_RENDERED_MESSAGES);
          }
          return combined;
        });
        setIsLoadingMore(false);
      }

      return newMessages.length;
    } catch (err) {
      console.error("Failed to load more messages:", err);
      setIsLoadingMore(false);
      return 0;
    }
  }

  async function handleSearch(e) {
    e?.preventDefault();

    console.log("Search triggered with query:", searchQuery);

    if (!searchQuery.trim()) {
      console.log("Empty search query, clearing results");
      setSearchResults([]);
      setSearchPage(0);
      setIsSearching(false);
      setSearchActive(false);
      return;
    }

    try {
      console.log("Starting search...");
      setIsSearching(true);
      setSearchActive(true);
      setSearchResults([]); // Clear previous results immediately
      setSearchTotalCount(0);

      const searchResponse = await invoke("search_messages", {
        importId,
        query: searchQuery,
        limit: 100,
        afterTimestamp,
        beforeTimestamp,
      });

      const messageIds = searchResponse.ids;
      setSearchTotalCount(searchResponse.total_count);
      console.log("Search returned message IDs:", messageIds, "total:", searchResponse.total_count);

      const results = [];
      for (const id of messageIds) {
        const msgs = await invoke("load_messages", {
          importId,
          startIndex: id,
          count: 1,
        });
        if (msgs.length > 0) {
          results.push(msgs[0]);
        }
      }

      console.log("Loaded", results.length, "search results");
      setSearchResults(results);
      setSearchPage(0);
    } catch (err) {
      console.error("Search failed:", err);
      toast.error(`Search failed: ${err}`);
    } finally {
      setIsSearching(false);
    }
  }

  async function jumpToMessage(messageId) {
    try {
      // Load messages around the target message
      const startIndex = Math.max(0, messageId - 25);
      const loadedMessages = await invoke("load_messages", {
        importId,
        startIndex,
        count: MESSAGES_PER_PAGE,
      });

      setMessages(loadedMessages);
      setHasScrolledToBottom(false);

      // Wait for messages to render, then scroll to the target
      setTimeout(() => {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
          // Highlight the message briefly
          messageElement.classList.add("highlight");
          setTimeout(() => messageElement.classList.remove("highlight"), 2000);
        }
      }, 100);
    } catch (err) {
      console.error("Failed to jump to message:", err);
    }
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchResults([]);
    setSearchTotalCount(0);
    setSearchActive(false);
    setIsSearching(false);
  }

  function applyDateFilter() {
    // Convert date strings to timestamps (milliseconds)
    const after = afterDate ? new Date(afterDate).getTime() : null;
    const before = beforeDate ? new Date(beforeDate + "T23:59:59").getTime() : null;

    setAfterTimestamp(after);
    setBeforeTimestamp(before);
    setShowDateFilter(false);

    // Trigger search if there's a query
    if (searchQuery.trim()) {
      handleSearch();
    }
  }

  function clearDateFilter() {
    setAfterDate("");
    setBeforeDate("");
    setAfterTimestamp(null);
    setBeforeTimestamp(null);

    // Re-trigger search if active
    if (searchQuery.trim() && searchActive) {
      handleSearch();
    }
  }

  function getDateFilterText() {
    if (!afterTimestamp && !beforeTimestamp) return null;

    const formatDate = (timestamp) => {
      return new Date(timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    };

    if (afterTimestamp && beforeTimestamp) {
      return `between ${formatDate(afterTimestamp)} and ${formatDate(beforeTimestamp)}`;
    } else if (afterTimestamp) {
      return `after ${formatDate(afterTimestamp)}`;
    } else {
      return `before ${formatDate(beforeTimestamp)}`;
    }
  }

  function getChannelAvatarUrl() {
    if (!conversationInfo?.avatarPath) return "";
    return convertFileSrc(conversationInfo.avatarPath);
  }

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp * 1000);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Today at ${timeStr}`;
    if (isYesterday) return `Yesterday at ${timeStr}`;
    return `${date.toLocaleDateString()} ${timeStr}`;
  }

  function isPinned(messageId) {
    return pinnedMessages.some(p => p.messageId === messageId);
  }

  function isOriginalPin(messageId) {
    return pinnedMessages.some(p => p.messageId === messageId && p.originalPin);
  }

  function togglePin(messageId) {
    setPinnedMessages(prev => {
      const existing = prev.find(p => p.messageId === messageId);
      if (existing) {
        // Don't allow unpinning original pins
        if (existing.originalPin) return prev;
        return prev.filter(p => p.messageId !== messageId);
      } else {
        return [...prev, { messageId, originalPin: false }];
      }
    });
  }

  function toggleBlur(messageId) {
    setBlurredMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }

  function toggleBlurGroup(messageId) {
    // Find the message and all contiguous messages by the same author
    const msgIndex = messagesWithStoredMembers.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;
    const author = messagesWithStoredMembers[msgIndex].author.nickname;
    const groupIds = [messageId];

    // Walk backwards
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messagesWithStoredMembers[i].author.nickname === author) {
        groupIds.push(messagesWithStoredMembers[i].id);
      } else break;
    }
    // Walk forwards
    for (let i = msgIndex + 1; i < messagesWithStoredMembers.length; i++) {
      if (messagesWithStoredMembers[i].author.nickname === author) {
        groupIds.push(messagesWithStoredMembers[i].id);
      } else break;
    }

    setBlurredMessages(prev => {
      const next = new Set(prev);
      // If the clicked message is blurred, unblur the whole group; otherwise blur all
      const shouldBlur = !prev.has(messageId);
      for (const id of groupIds) {
        if (shouldBlur) next.add(id); else next.delete(id);
      }
      return next;
    });
  }

  async function handleSendMessage(content) {
    if (!content) return;

    try {
      const stored = await invoke("send_user_message", {
        importId,
        content,
      });

      setTotalMessages(prev => prev + 1);

      // Add the new message to the current view if we're at the bottom
      const latestLoaded = messages.length > 0 && messages[messages.length - 1].id >= totalMessages - 1;
      if (latestLoaded) {
        setMessages(prev => [...prev, stored]);
        // Scroll to bottom after send
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      } else {
        // Jump to present to see the new message
        jumpToPresent();
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error(`Failed to send message: ${err}`);
    }
  }

  async function handleEditMessage(messageId, newContent) {
    const content = newContent.trim();
    if (!content) return;

    try {
      const updated = await invoke("edit_user_message", {
        importId,
        messageId,
        newContent: content,
      });

      // Update message in the current view
      setMessages(prev => prev.map(m => m.id === messageId ? updated : m));
      setEditingMessage(null);
      setEditContent("");
    } catch (err) {
      console.error("Failed to edit message:", err);
      toast.error(`Failed to edit message: ${err}`);
    }
  }

  async function handleDeleteMessage(messageId) {
    try {
      await invoke("delete_user_message", { importId, messageId });

      // Remove from current view
      setMessages(prev => prev.filter(m => m.id !== messageId));
      setTotalMessages(prev => prev - 1);
    } catch (err) {
      console.error("Failed to delete message:", err);
      toast.error(`Failed to delete message: ${err}`);
    }
  }

  function startEditMessage(messageId, content) {
    setEditingMessage(messageId);
    setEditContent(content);
  }

  function cancelEdit() {
    setEditingMessage(null);
    setEditContent("");
  }

  function handleEditKeyDown(e, messageId) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEditMessage(messageId, editContent);
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  }

  function handleScroll() {
    if (!messagesContainerRef.current || isLoadingMore) return;

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const scrolledFromBottom = scrollHeight - scrollTop - clientHeight;

    // Show jump to bottom button if scrolled up significantly OR if latest messages aren't loaded
    const latestMessagesLoaded = messages.length > 0 && messages[messages.length - 1].id >= totalMessages - 1;
    setShowJumpToBottom(scrolledFromBottom > 1000 || !latestMessagesLoaded);

    // Save scroll position (debounced)
    if (messages.length > 0) {
      if (savePositionTimeoutRef.current) {
        clearTimeout(savePositionTimeoutRef.current);
      }
      savePositionTimeoutRef.current = setTimeout(() => {
        // Find the first visible message (approximate)
        const container = messagesContainerRef.current;
        if (container) {
          const messageElements = container.querySelectorAll('[data-message-id]');
          for (const el of messageElements) {
            const rect = el.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            if (rect.top >= containerRect.top && rect.top <= containerRect.bottom) {
              const messageId = parseInt(el.getAttribute('data-message-id'));
              invoke("save_conversation_position", { importId, messageId }).catch(console.error);
              break;
            }
          }
        }
      }, 1000);
    }

    if (scrollTop < 100 && messages.length > 0 && messages[0].id > 0) {
      loadMoreMessages("up");
    } else if (scrolledFromBottom < 100 && messages.length > 0 && messages[messages.length - 1].id < totalMessages - 1) {
      loadMoreMessages("down");
    }
  }

  async function jumpToPresent() {
    try {
      setIsLoadingMore(true);
      const startIndex = Math.max(0, totalMessages - MESSAGES_PER_PAGE);
      const count = totalMessages - startIndex;
      const latestMessages = await invoke("load_messages", {
        importId,
        startIndex,
        count,
      });
      if (latestMessages.length > 0) {
        setMessages(latestMessages);
        setShowJumpToBottom(false);
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView();
          }
        }, 50);
      }
      setIsLoadingMore(false);
    } catch (err) {
      console.error("Failed to jump to present:", err);
      setIsLoadingMore(false);
    }
  }

  const [loadingQuote] = useState(() =>
    LOADING_QUOTES[Math.floor(Math.random() * LOADING_QUOTES.length)]
  );

  if (loading) {
    return (
      <div className="conversation-viewer">
        <div className="loading-state">
          <div className="loading-spinner" />
          <div className="loading-quote">{loadingQuote}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="conversation-viewer">
        <div className="error-state">
          <h2>Woopsies, we couldn't load this conversation :(</h2>
          <p>It's not lost, the original is stored intact!</p>
          <p>{error}</p>
          <button className="open-logs-error-button" onClick={handleOpenLogs}>
            <FolderOpen size={20} />
            Open Log in File Explorer
          </button>
        </div>
      </div>
    );
  }

  const isDM = conversationInfo?.guildId === "0";

  // Sort search results based on selected order
  const sortedSearchResults = [...searchResultsWithStoredMembers].sort((a, b) => {
    if (searchSortOrder === "new") {
      return b.timestamp - a.timestamp; // Newest first
    } else {
      return a.timestamp - b.timestamp; // Oldest first
    }
  });

  // Pagination
  const totalPages = Math.ceil(sortedSearchResults.length / SEARCH_RESULTS_PER_PAGE);
  const startIndex = searchPage * SEARCH_RESULTS_PER_PAGE;
  const endIndex = startIndex + SEARCH_RESULTS_PER_PAGE;
  const paginatedResults = sortedSearchResults.slice(startIndex, endIndex);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 3) {
      // Show all pages if 3 or fewer
      for (let i = 0; i < totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show ellipsis, current page, ellipsis, last page
      if (searchPage < 3) {
        // First 3 pages: show them directly
        for (let i = 0; i <= Math.min(2, totalPages - 1); i++) {
          pages.push(i);
        }
        if (totalPages > 3) {
          pages.push("...");
          pages.push(totalPages - 1);
        }
      } else if (searchPage >= totalPages - 1) {
        // Last page
        pages.push("...");
        pages.push(searchPage);
      } else {
        // Middle pages: ... current ... last
        pages.push("...");
        pages.push(searchPage);
        pages.push("...");
        pages.push(totalPages - 1);
      }
    }
    return pages;
  };

  // Apply theme colors as CSS variables
  const themeStyle = Object.entries(themeColors).reduce((acc, [key, value]) => {
    acc[`--${key}`] = value;
    return acc;
  }, {});

  return (
    <div className="conversation-viewer" style={themeStyle}>
      {/* Channel Header */}
      <div className="channel-header">
        <div className="channel-name">
          {isDM ? (
            <>
              <div className="channel-avatar">
                {conversationInfo?.avatarPath ? (
                  <img
                    src={getChannelAvatarUrl()}
                    alt={conversationInfo?.channelName}
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextSibling.style.display = "flex";
                    }}
                  />
                ) : null}
                <span className="avatar-fallback" style={{ display: conversationInfo?.avatarPath ? "none" : "flex" }}>
                  {conversationInfo?.channelName?.[0]?.toUpperCase() || "?"}
                </span>
                <div className="status-indicator"></div>
              </div>
              <span className="message-author">{conversationInfo?.channelName}</span>
            </>
          ) : (
            <>
              <Hash size={20} className="channel-icon" />
              <span>{conversationInfo?.channelName}</span>
            </>
          )}
        </div>
        <div className="pin-button-wrapper">
          <button
            onClick={() => { setShowPinnedPanel(!showPinnedPanel); setPinnedPage(0); }}
            className={`pin-icon-button ${showPinnedPanel ? 'active' : ''}`}
            type="button"
            title="Pinned Messages"
          >
            <Pin size={18} fill="currentColor" />
          </button>
          {showPinnedPanel && (
            <div className="pinned-popup">
              <div className="pinned-panel-header">
                <Pin size={18} />
                <span>Pinned Messages</span>
                <button className="pinned-panel-close" onClick={() => setShowPinnedPanel(false)}>
                  <X size={16} />
                </button>
              </div>
              <div className="pinned-panel-content">
                {loadingPinnedData ? (
                  <div className="pinned-panel-loading">Loading pinned messages...</div>
                ) : pinnedMessageData.length === 0 ? (
                  <div className="pinned-panel-empty">No pinned messages</div>
                ) : (
                  <>
                    {[...pinnedMessageData]
                      .reverse()
                      .slice(pinnedPage * PINNED_PER_PAGE, (pinnedPage + 1) * PINNED_PER_PAGE)
                      .map((msg) => (
                        <div
                          key={msg.id}
                          className="pinned-message-card"
                          onClick={() => {
                            setShowPinnedPanel(false);
                            jumpToMessage(msg.id);
                          }}
                        >
                          <Message
                            message={msg}
                            isGrouped={false}
                            importPath={importPath}
                            onImageClick={setViewingImage}
                            formatTimestamp={formatTimestamp}
                            convertFileSrc={convertFileSrc}
                            onReplyClick={jumpToMessage}
                            debugMode={false}
                            isPinned={false}
                            isOriginalPin={false}
                            onTogglePin={() => {}}
                            isBlurred={blurredMessages.has(msg.id)}
                            onToggleBlur={toggleBlur}
                            onToggleBlurGroup={toggleBlurGroup}
                          />
                        </div>
                      ))}
                    {Math.ceil(pinnedMessageData.length / PINNED_PER_PAGE) > 1 && (
                      <div className="pinned-pagination">
                        <button
                          className="pagination-btn pagination-nav-btn"
                          onClick={() => setPinnedPage(Math.max(0, pinnedPage - 1))}
                          disabled={pinnedPage === 0}
                        >
                          &lt; Back
                        </button>
                        <span className="pinned-page-info">
                          {pinnedPage + 1} / {Math.ceil(pinnedMessageData.length / PINNED_PER_PAGE)}
                        </span>
                        <button
                          className="pagination-btn pagination-nav-btn"
                          onClick={() => setPinnedPage(Math.min(Math.ceil(pinnedMessageData.length / PINNED_PER_PAGE) - 1, pinnedPage + 1))}
                          disabled={pinnedPage >= Math.ceil(pinnedMessageData.length / PINNED_PER_PAGE) - 1}
                        >
                          Next &gt;
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="header-search">
          <div className="search-input-container">
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              className="search-input"
            />
            {getDateFilterText() && (
              <div className="search-filter-badge">
                <span className="filter-text">{getDateFilterText()}</span>
                <button
                  className="filter-clear-btn"
                  onClick={clearDateFilter}
                  title="Clear date filter"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowDateFilter(!showDateFilter)}
            className={`filter-icon-button ${(afterTimestamp || beforeTimestamp) ? 'active' : ''}`}
            type="button"
            title="Date filter"
          >
            <Filter size={16} />
          </button>
          <button
            onClick={searchActive ? clearSearch : handleSearch}
            className="search-icon-button"
            type="button"
          >
            {searchActive ? (
              <span className="search-clear-x">✕</span>
            ) : (
              <Search size={16} className="search-icon" />
            )}
          </button>

          {/* Date Filter Dropdown */}
          {showDateFilter && (
            <div className="date-filter-dropdown">
              <div className="date-filter-header">
                <span>Filter by Date</span>
                <button
                  className="date-filter-close"
                  onClick={() => setShowDateFilter(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="date-filter-body">
                <div className="date-filter-field">
                  <label>After</label>
                  <input
                    type="date"
                    value={afterDate}
                    onChange={(e) => setAfterDate(e.target.value)}
                    max={beforeDate || undefined}
                  />
                </div>
                <div className="date-filter-field">
                  <label>Before</label>
                  <input
                    type="date"
                    value={beforeDate}
                    onChange={(e) => setBeforeDate(e.target.value)}
                    min={afterDate || undefined}
                  />
                </div>
              </div>
              <div className="date-filter-actions">
                <button
                  className="date-filter-clear-btn"
                  onClick={() => {
                    clearDateFilter();
                    setShowDateFilter(false);
                  }}
                >
                  Clear
                </button>
                <button
                  className="date-filter-apply-btn"
                  onClick={applyDateFilter}
                  disabled={!afterDate && !beforeDate}
                >
                  Apply Filter
                </button>
              </div>
            </div>
          )}
        </div>
      </div>


      <div className="conversation-content">
        {/* Messages Column (messages + optional message bar) */}
        <div className="messages-column">
        {/* Messages Area (80%) */}
        <div
          className="messages-area"
          ref={messagesContainerRef}
          onScroll={handleScroll}
        >
          {messagesWithStoredMembers.map((message, idx) => {
            const prevMessage = idx > 0 ? messagesWithStoredMembers[idx - 1] : null;
            const timeDiff = prevMessage ? message.timestamp - prevMessage.timestamp : Infinity;
            // Break grouping if message has a reply
            const isGrouped = prevMessage &&
              prevMessage.author.nickname === message.author.nickname &&
              timeDiff >= 0 &&
              timeDiff <= 300 && // Within 5 minutes and chronological
              !message.referencedMessage; // Break grouping if this message is a reply

            return (
              <div key={message.id} data-message-id={message.id}>
                {editingMessage === message.id ? (
                  <div className="message-edit-container">
                    <textarea
                      className="message-edit-input"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => handleEditKeyDown(e, message.id)}
                      autoFocus
                    />
                    <div className="message-edit-actions">
                      <span className="message-edit-hint">Escape to cancel, Enter to save</span>
                      <button className="message-edit-cancel" onClick={cancelEdit}>Cancel</button>
                      <button className="message-edit-save" onClick={() => handleEditMessage(message.id, editContent)}>Save</button>
                    </div>
                  </div>
                ) : (
                <Message
                  message={message}
                  isGrouped={isGrouped}
                  importPath={importPath}
                  onImageClick={setViewingImage}
                  formatTimestamp={formatTimestamp}
                  convertFileSrc={convertFileSrc}
                  onReplyClick={jumpToMessage}
                  debugMode={debugMode}
                  onShowRawPayload={setRawPayloadMessage}
                  isPinned={isPinned(message.id)}
                  isOriginalPin={isOriginalPin(message.id)}
                  onTogglePin={togglePin}
                  isBlurred={blurredMessages.has(message.id)}
                  onToggleBlur={toggleBlur}
                  onToggleBlurGroup={toggleBlurGroup}
                  isMutable={isMutable}
                  onEditMessage={startEditMessage}
                  onDeleteMessage={handleDeleteMessage}
                />
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Jump to Present Bar */}
        {showJumpToBottom && (
          <div className="jump-to-present-bar">
            <span className="jump-to-present-label">You're Viewing Older Messages</span>
            <button className="jump-to-present-button" onClick={jumpToPresent}>
              Jump to Present
            </button>
          </div>
        )}

        {/* Mutable Conversation Message Bar */}
        {isMutable && <MessageBar onSend={handleSendMessage} channelName={conversationInfo?.channelName} />}
        </div>{/* end messages-column */}

        {/* Member List / Search Results (20%) */}
        <div className="member-list">
          {searchActive ? (
            <>
              {!isSearching && searchResults.length > 0 && (
                <div className="search-results-header-new">
                  <span className="search-results-count">
                    {searchTotalCount} results
                  </span>
                  <div className="search-sort-buttons">
                    <button
                      className={`search-sort-btn ${searchSortOrder === "new" ? "active" : ""}`}
                      onClick={() => {
                        setSearchSortOrder("new");
                        setSearchPage(0);
                      }}
                    >
                      New
                    </button>
                    <button
                      className={`search-sort-btn ${searchSortOrder === "old" ? "active" : ""}`}
                      onClick={() => {
                        setSearchSortOrder("old");
                        setSearchPage(0);
                      }}
                    >
                      Old
                    </button>
                  </div>
                </div>
              )}
              <div className="search-results-content">
                {isSearching ? (
                  <div className="search-loading">Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div className="search-empty">No results found</div>
                ) : (
                  <>
                    {paginatedResults.map((result) => (
                      <div
                        key={result.id}
                        className="search-result-card"
                        onClick={() => jumpToMessage(result.id)}
                      >
                        <div className="search-result-message">
                          <Message
                            message={result}
                            isGrouped={false}
                            importPath={importPath}
                            onImageClick={setViewingImage}
                            formatTimestamp={formatTimestamp}
                            convertFileSrc={convertFileSrc}
                            onReplyClick={jumpToMessage}
                            debugMode={debugMode}
                            onShowRawPayload={setRawPayloadMessage}
                            isPinned={isPinned(result.id)}
                            isOriginalPin={isOriginalPin(result.id)}
                            onTogglePin={togglePin}
                            isBlurred={blurredMessages.has(result.id)}
                            onToggleBlur={toggleBlur}
                            onToggleBlurGroup={toggleBlurGroup}
                          />
                        </div>
                        <button
                          className="search-jump-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            jumpToMessage(result.id);
                          }}
                        >
                          Jump
                        </button>
                      </div>
                    ))}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="search-pagination">
                        <button
                          className="pagination-btn pagination-nav-btn"
                          onClick={() => setSearchPage(Math.max(0, searchPage - 1))}
                          disabled={searchPage === 0}
                        >
                          &lt; Back
                        </button>

                        {getPageNumbers().map((page, idx) => (
                          page === "..." ? (
                            <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
                              ...
                            </span>
                          ) : (
                            <button
                              key={page}
                              className={`pagination-btn pagination-page-btn ${searchPage === page ? "active" : ""}`}
                              onClick={() => setSearchPage(page)}
                            >
                              {page + 1}
                            </button>
                          )
                        ))}

                        <button
                          className="pagination-btn pagination-nav-btn"
                          onClick={() => setSearchPage(Math.min(totalPages - 1, searchPage + 1))}
                          disabled={searchPage === totalPages - 1}
                        >
                          Next &gt;
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="member-list-header">
                Members—{members.filter(m => !m.hidden).length}
              </div>
              <div className={`member-list-content ${debugMode && chunkDebugInfo ? "member-list-split" : ""}`}>
                {members.filter(m => !m.hidden).map((member, idx) => (
                  <div
                    key={idx}
                    className="member-item clickable"
                    onClick={() => {
                      setSelectedMember(member);
                      setMemberEditorOpen(true);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMemberContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        member,
                      });
                    }}
                    title="Click to edit member"
                  >
                    <MessageAvatar
                      avatarUrl={member.avatar}
                      name={member.name}
                      importPath={importPath}
                    />
                    <span className="member-name">
                      {member.name}
                    </span>
                  </div>
                ))}

                {/* Hidden members section */}
                {showHiddenMembers && members.filter(m => m.hidden).map((member, idx) => (
                  <div
                    key={`hidden-${idx}`}
                    className="member-item clickable member-item-hidden"
                    onClick={() => {
                      setSelectedMember(member);
                      setMemberEditorOpen(true);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMemberContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        member,
                      });
                    }}
                    title="Click to edit member"
                  >
                    <MessageAvatar
                      avatarUrl={member.avatar}
                      name={member.name}
                      importPath={importPath}
                    />
                    <span className="member-name">
                      {member.name}
                    </span>
                  </div>
                ))}

                {/* Hidden count indicator */}
                {members.filter(m => m.hidden).length > 0 && (
                  <div
                    className="member-hidden-indicator"
                    onClick={() => setShowHiddenMembers(!showHiddenMembers)}
                  >
                    {showHiddenMembers
                      ? "Hide hidden members"
                      : `${members.filter(m => m.hidden).length} hidden`}
                  </div>
                )}
              </div>

              {/* Chunk Debug Panel - only visible in debug mode */}
              {debugMode && chunkDebugInfo && (
                <div className="chunk-debug-panel">
                  <div
                    className="chunk-debug-header"
                    onClick={() => setChunkDebugExpanded(!chunkDebugExpanded)}
                  >
                    <span className="chunk-debug-title">
                      {chunkDebugExpanded ? "▾" : "▸"} Tantivy / Chunk Debug
                    </span>
                    <span className="chunk-debug-summary">
                      {chunkDebugInfo.totalChunks} chunks
                    </span>
                  </div>
                  {chunkDebugExpanded && (
                    <div className="chunk-debug-content">
                      <div className="chunk-debug-overview">
                        <div className="chunk-debug-row">
                          <span className="chunk-debug-label">Total Messages</span>
                          <span className="chunk-debug-value">{chunkDebugInfo.totalMessages.toLocaleString()}</span>
                        </div>
                        <div className="chunk-debug-row">
                          <span className="chunk-debug-label">Chunk Size</span>
                          <span className="chunk-debug-value">{chunkDebugInfo.chunkSize}</span>
                        </div>
                        <div className="chunk-debug-row">
                          <span className="chunk-debug-label">Total Chunks</span>
                          <span className="chunk-debug-value">{chunkDebugInfo.totalChunks}</span>
                        </div>
                        <div className="chunk-debug-row">
                          <span className="chunk-debug-label">Search Index</span>
                          <span className="chunk-debug-value">
                            {chunkDebugInfo.searchIndexExists
                              ? formatBytes(chunkDebugInfo.searchIndexSizeBytes)
                              : "Missing"}
                          </span>
                        </div>
                        <div className="chunk-debug-row">
                          <span className="chunk-debug-label">Import Path</span>
                          <span className="chunk-debug-value chunk-debug-path" title={chunkDebugInfo.importPath}>
                            {chunkDebugInfo.importPath}
                          </span>
                        </div>
                      </div>
                      <div className="chunk-debug-list-header">Chunks</div>
                      <div className="chunk-debug-list">
                        {chunkDebugInfo.chunks.map((chunk) => (
                          <div key={chunk.chunkId} className="chunk-debug-item">
                            <div className="chunk-debug-item-header">
                              <span className="chunk-debug-chunk-id">#{chunk.chunkId}</span>
                              <span className="chunk-debug-chunk-size">{formatBytes(chunk.fileSizeBytes)}</span>
                            </div>
                            <div className="chunk-debug-item-detail">
                              IDs {chunk.startId}–{chunk.endId} ({chunk.messageCount} msgs)
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Image Viewer Modal */}
      {viewingImage && (
        <div className="image-viewer-modal" onClick={() => setViewingImage(null)}>
          <div className="image-viewer-content">
            <button className="image-viewer-close" onClick={(e) => { e.stopPropagation(); setViewingImage(null); }}>
              ✕
            </button>
            <img src={viewingImage} alt="Viewing" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}

      {/* Member Context Menu */}
      {memberContextMenu && (
        <div className="member-context-overlay" onClick={() => setMemberContextMenu(null)}>
          <div
            className="member-context-menu"
            style={{ top: memberContextMenu.y, left: memberContextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="member-context-item"
              onClick={() => {
                setSelectedMember(memberContextMenu.member);
                setMemberEditorOpen(true);
                setMemberContextMenu(null);
              }}
            >
              Edit
            </button>
            <button
              className="member-context-item"
              onClick={async () => {
                const member = memberContextMenu.member;
                try {
                  await invoke("update_member", {
                    importId,
                    memberId: member.id,
                    nickname: null,
                    avatarUrl: null,
                    hidden: !member.hidden,
                  });
                  // Reload members
                  const result = await invoke("get_members", { importId });
                  if (result && result.members) {
                    const sortedMembers = result.members
                      .sort((a, b) => a.id.localeCompare(b.id))
                      .map(m => ({
                        id: m.id,
                        name: m.nickname,
                        avatar: m.avatarUrl,
                        color: m.color,
                        discriminator: m.discriminator,
                        isBot: m.isBot,
                        hidden: m.hidden || false,
                      }));
                    setMembers(sortedMembers);
                  }
                } catch (error) {
                  console.error("Failed to toggle member visibility:", error);
                  toast.error(`Failed to update member: ${error}`);
                }
                setMemberContextMenu(null);
              }}
            >
              {memberContextMenu.member.hidden ? "Show" : "Hide"}
            </button>
          </div>
        </div>
      )}

      <MemberEditor
        isOpen={memberEditorOpen}
        onClose={() => {
          setMemberEditorOpen(false);
          setSelectedMember(null);
        }}
        member={selectedMember}
        importId={importId}
        importPath={importPath}
        onUpdate={async () => {
          // Reload members after update
          try {
            const result = await invoke("get_members", { importId });
            if (result && result.members) {
              const sortedMembers = result.members
                .sort((a, b) => a.id.localeCompare(b.id))
                .map(m => ({
                  id: m.id,
                  name: m.nickname,
                  avatar: m.avatarUrl,
                  color: m.color,
                  discriminator: m.discriminator,
                  isBot: m.isBot,
                  hidden: m.hidden || false,
                }));
              setMembers(sortedMembers);
            }
          } catch (error) {
            console.error("Failed to reload members:", error);
          }
        }}
      />

      {/* Raw Payload Modal (Debug Mode) */}
      {rawPayloadMessage && (
        <div className="raw-payload-overlay" onClick={() => setRawPayloadMessage(null)}>
          <div className="raw-payload-modal" onClick={(e) => e.stopPropagation()}>
            <div className="raw-payload-header">
              <h3>Raw Message Payload</h3>
              <span className="raw-payload-id">ID: {rawPayloadMessage.id} | Original: {rawPayloadMessage.originalId}</span>
              <button className="raw-payload-close" onClick={() => setRawPayloadMessage(null)}>
                <X size={20} />
              </button>
            </div>
            <pre className="raw-payload-content">
              {JSON.stringify(rawPayloadMessage, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConversationViewer;
