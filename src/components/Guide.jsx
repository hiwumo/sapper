import { useState, useRef, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { WhatIsSapper, ExportingFromDiscord, ImportingConversations } from "./guide/GettingStarted";
import { TheSidebar, ReadingMessages, AttachmentsMedia, Searching } from "./guide/ViewingConversations";
import { EditingDetails, EditingMembers, ReorderingConversations } from "./guide/EditingOrganising";
import { ExportingBackup, RestoringBackup, Unimporting, DiskUsage } from "./guide/BackupsData";
import { Appearance, Notifications, DebugMode } from "./guide/SettingsPage";
import { AppUpdates, ConversationUpdates } from "./guide/UpdatingSapper";
import { DataStorage, InternetConnection, MessageSafety, DataCorruption } from "./guide/PrivacyDataSafety";
import FAQ from "./guide/FAQ";
import { CommonIssues, ReportingBugs } from "./guide/Troubleshooting";
import "./Guide.css";

const CHAPTERS = [
  {
    numeral: "I", label: "Getting Started", color: "#f87171",
    subchapters: [
      { label: "What is Sapper?", component: WhatIsSapper },
      { label: "Exporting from Discord", component: ExportingFromDiscord },
      { label: "Importing Conversations", component: ImportingConversations },
    ],
  },
  {
    numeral: "II", label: "Viewing Conversations", color: "#fb923c",
    subchapters: [
      { label: "The Sidebar", component: TheSidebar },
      { label: "Reading Messages", component: ReadingMessages },
      { label: "Attachments & Media", component: AttachmentsMedia },
      { label: "Searching", component: Searching },
    ],
  },
  {
    numeral: "III", label: "Editing & Organising", color: "#fbbf24",
    subchapters: [
      { label: "Editing Conversation Details", component: EditingDetails },
      { label: "Editing Members", component: EditingMembers },
      { label: "Reordering Conversations", component: ReorderingConversations },
    ],
  },
  {
    numeral: "IV", label: "Backups & Data", color: "#4ade80",
    subchapters: [
      { label: "Exporting a Backup", component: ExportingBackup },
      { label: "Restoring from a Backup", component: RestoringBackup },
      { label: "Unimporting a Conversation", component: Unimporting },
      { label: "Managing Disk Usage", component: DiskUsage },
    ],
  },
  {
    numeral: "V", label: "Settings", color: "#2dd4bf",
    subchapters: [
      { label: "Appearance", component: Appearance },
      { label: "Notifications", component: Notifications },
      { label: "Debug Mode", component: DebugMode },
    ],
  },
  {
    numeral: "VI", label: "Updating Sapper", color: "#60a5fa",
    subchapters: [
      { label: "App Updates", component: AppUpdates },
      { label: "Conversation Updates", component: ConversationUpdates },
    ],
  },
  {
    numeral: "VII", label: "Privacy & Data Safety", color: "#818cf8",
    subchapters: [
      { label: "Where Your Data Lives", component: DataStorage },
      { label: "Internet Connection", component: InternetConnection },
      { label: "Keeping Messages Safe", component: MessageSafety },
      { label: "Data Corruption", component: DataCorruption },
    ],
  },
  {
    numeral: "VIII", label: "FAQ", color: "#a78bfa",
    component: FAQ,
  },
  {
    numeral: "IX", label: "Troubleshooting", color: "#f472b6",
    subchapters: [
      { label: "Common Issues", component: CommonIssues },
      { label: "Reporting Bugs", component: ReportingBugs },
    ],
  },
];

// Build flat page list and chapter-to-page index
const PAGES = [];
const CHAPTER_START = [];

CHAPTERS.forEach((chapter, ci) => {
  CHAPTER_START.push(PAGES.length);
  if (chapter.subchapters) {
    chapter.subchapters.forEach((sub, si) => {
      PAGES.push({
        chapterIndex: ci,
        letter: String.fromCharCode(65 + si),
        label: sub.label,
        component: sub.component,
      });
    });
  } else {
    PAGES.push({
      chapterIndex: ci,
      letter: null,
      label: chapter.label,
      component: chapter.component,
    });
  }
});

function Guide({ isOpen, onClose }) {
  const [activePage, setActivePage] = useState(0);
  const contentRef = useRef(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activePage]);

  if (!isOpen) return null;

  const current = PAGES[activePage];
  const chapter = CHAPTERS[current.chapterIndex];
  const PageComponent = current.component;

  return (
    <div className="guide-overlay" onClick={onClose}>
      <div className="guide-modal" onClick={(e) => e.stopPropagation()}>
        <div className="guide-header">
          <div className="guide-header-title">
            <BookOpen size={22} />
            <h2>Guide</h2>
          </div>
          <button className="guide-close" onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        <div className="guide-body">
          <nav className="guide-nav">
            <div className="guide-nav-label">Contents</div>
            {CHAPTERS.map((ch, ci) => {
              const isActiveChapter = current.chapterIndex === ci;
              return (
                <div key={ci}>
                  <button
                    className={`guide-nav-item ${isActiveChapter ? "active" : ""}`}
                    onClick={() => setActivePage(CHAPTER_START[ci])}
                  >
                    <span
                      className="guide-numeral"
                      style={{
                        color: ch.color,
                        textShadow: isActiveChapter ? `0 0 12px ${ch.color}50` : "none",
                      }}
                    >
                      {ch.numeral}
                    </span>
                    <span className="guide-nav-label-text">{ch.label}</span>
                  </button>
                  {isActiveChapter && ch.subchapters && (
                    <div className="guide-subchapters">
                      {ch.subchapters.map((sub, si) => {
                        const pageIndex = CHAPTER_START[ci] + si;
                        return (
                          <button
                            key={si}
                            className={`guide-subchapter-item ${activePage === pageIndex ? "active" : ""}`}
                            onClick={() => setActivePage(pageIndex)}
                          >
                            <span className="guide-subchapter-letter">
                              {String.fromCharCode(65 + si)}
                            </span>
                            <span>{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="guide-content" ref={contentRef}>
            <div className="guide-content-inner">
              <div className="guide-page-indicator">
                <span
                  className="guide-page-numeral"
                  style={{ color: chapter.color }}
                >
                  {chapter.numeral}{current.letter && current.letter}
                </span>
                <span className="guide-page-count">
                  {activePage + 1} of {PAGES.length}
                </span>
              </div>

              <PageComponent />

              <div className="guide-pagination">
                <button
                  className="guide-pagination-btn"
                  onClick={() => setActivePage((p) => p - 1)}
                  disabled={activePage === 0}
                >
                  <ChevronLeft size={16} />
                  <span>
                    {activePage > 0 && PAGES[activePage - 1].label}
                  </span>
                </button>
                <button
                  className="guide-pagination-btn"
                  onClick={() => setActivePage((p) => p + 1)}
                  disabled={activePage === PAGES.length - 1}
                >
                  <span>
                    {activePage < PAGES.length - 1 && PAGES[activePage + 1].label}
                  </span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Guide;
