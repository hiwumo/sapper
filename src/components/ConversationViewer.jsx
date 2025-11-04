import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { Hash, AtSign, Search, FolderOpen } from "lucide-react";
import { themes } from "../themes";
import Message from "./Message";
import MessageAvatar from "./MessageAvatar";
import "./ConversationViewer.css";

const MESSAGES_PER_PAGE = 50;
const SEARCH_RESULTS_PER_PAGE = 10;

function ConversationViewer({ importId, theme }) {
  const themeColors = themes[theme]?.colors || themes.dark.colors;
  const [messages, _setMessages] = useState([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importPath, setImportPath] = useState("");
  const [conversationInfo, setConversationInfo] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchSortOrder, setSearchSortOrder] = useState("new"); // "new" or "old"
  const [isSearching, setIsSearching] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [members, setMembers] = useState([]);
  const [viewingImage, setViewingImage] = useState(null);
  const [searchPage, setSearchPage] = useState(0);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollRestorationRef = useRef(null);

  const setMessages = _setMessages;

  useEffect(() => {
    loadInitialData();
  }, [importId]);

  useEffect(() => {
    if (!hasScrolledToBottom && messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView();
      setHasScrolledToBottom(true);
    }
  }, [messages, hasScrolledToBottom]);

  useEffect(() => {
    // Restore scroll position after loading older messages
    if (scrollRestorationRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const { previousScrollHeight, previousScrollTop } = scrollRestorationRef.current;
      const newScrollHeight = container.scrollHeight;
      const scrollDiff = newScrollHeight - previousScrollHeight;

      container.scrollTop = previousScrollTop + scrollDiff;
      scrollRestorationRef.current = null;
    }
  }, [messages]);

  useEffect(() => {
    // Extract unique members from messages
    const uniqueMembers = new Map();
    messages.forEach(msg => {
      if (!uniqueMembers.has(msg.author.nickname)) {
        uniqueMembers.set(msg.author.nickname, {
          name: msg.author.nickname,
          avatar: msg.author.avatarUrl,
          color: msg.author.color,
        });
      }
    });
    setMembers(Array.from(uniqueMembers.values()));
  }, [messages]);

  async function loadInitialData() {
    try {
      setLoading(true);
      setError(null);
      setHasScrolledToBottom(false);

      // Log frontend info
      await invoke("log_frontend_info", { message: `Loading conversation: ${importId}` });

      // Get conversation info
      const info = await invoke("get_conversation_info", { importId });
      setConversationInfo(info);

      // Get import path for constructing file URLs
      const path = await invoke("get_import_path", { importId });
      setImportPath(path);

      // Get total message count
      const total = await invoke("get_total_message_count", { importId });
      setTotalMessages(total);

      // Load last 50 messages (newest)
      const startIndex = Math.max(0, total - MESSAGES_PER_PAGE);
      const loadedMessages = await invoke("load_messages", {
        importId,
        startIndex,
        count: MESSAGES_PER_PAGE,
      });

      console.log(loadedMessages);
      setMessages(loadedMessages);
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
      alert(`Failed to open log directory: ${error}`);
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
        // Save scroll position before adding messages
        const container = messagesContainerRef.current;
        if (container) {
          scrollRestorationRef.current = {
            previousScrollHeight: container.scrollHeight,
            previousScrollTop: container.scrollTop,
          };
        }
        console.log([...newMessages, ...messages]);
        setMessages((prev) => [...newMessages, ...prev]);
      } else {
        console.log([...newMessages, ...messages]);
        setMessages((prev) => [...prev, ...newMessages]);
      }

      setIsLoadingMore(false);
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

      const messageIds = await invoke("search_messages", {
        importId,
        query: searchQuery,
        limit: 100,
      });

      console.log("Search returned message IDs:", messageIds);

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
      alert(`Search failed: ${err}`);
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
    setSearchActive(false);
    setIsSearching(false);
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

  function handleScroll() {
    if (!messagesContainerRef.current || isLoadingMore) return;

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;

    if (scrollTop < 100 && messages.length > 0 && messages[0].id > 0) {
      loadMoreMessages("up");
    } else if (scrollHeight - scrollTop - clientHeight < 100 && messages.length < totalMessages) {
      loadMoreMessages("down");
    }
  }

  if (loading) {
    return (
      <div className="conversation-viewer">
        <div className="loading-state">Loading conversation...</div>
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
  const sortedSearchResults = [...searchResults].sort((a, b) => {
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
        <div className="header-search">
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
        </div>
      </div>

      <div className="conversation-content">
        {/* Messages Area (80%) */}
        <div
          className="messages-area"
          ref={messagesContainerRef}
          onScroll={handleScroll}
        >
          {messages.map((message, idx) => {
            const prevMessage = idx > 0 ? messages[idx - 1] : null;
            const timeDiff = prevMessage ? message.timestamp - prevMessage.timestamp : Infinity;
            // Break grouping if message has a reply
            const isGrouped = prevMessage &&
              prevMessage.author.nickname === message.author.nickname &&
              timeDiff > 0 &&
              timeDiff <= 300 && // Within 5 minutes and chronological
              !message.referencedMessage; // Break grouping if this message is a reply

            return (
              <div key={message.id} data-message-id={message.id}>
                <Message
                  message={message}
                  isGrouped={isGrouped}
                  importPath={importPath}
                  onImageClick={setViewingImage}
                  formatTimestamp={formatTimestamp}
                  convertFileSrc={convertFileSrc}
                />
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Member List / Search Results (20%) */}
        <div className="member-list">
          {searchActive ? (
            <>
              {!isSearching && searchResults.length > 0 && (
                <div className="search-results-header-new">
                  <span className="search-results-count">
                    {searchResults.length} results
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
                Members—{members.length}
              </div>
              <div className="member-list-content">
                {members.map((member, idx) => (
                  <div key={idx} className="member-item">
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
              </div>
            </>
          )}
        </div>
      </div>

      {/* Image Viewer Modal */}
      {viewingImage && (
        <div className="image-viewer-modal" onClick={() => setViewingImage(null)}>
          <div className="image-viewer-content" onClick={(e) => e.stopPropagation()}>
            <button className="image-viewer-close" onClick={() => setViewingImage(null)}>
              ✕
            </button>
            <img src={viewingImage} alt="Viewing" />
          </div>
        </div>
      )}
    </div>
  );
}

export default ConversationViewer;
