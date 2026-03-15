import React from "react";
import { X } from "lucide-react";
import "./Changelog.css";

const CHANGELOG = {
  "0.4.1": {
    date: "2025-03-15",
    changes: [
      {
        type: "improvement",
        title: "Better Searching",
        description: "Should be perfect now!",
      },
      {
        type: "fix",
        title: "GIFs, videos, and audios now load",
        description: "yippee",
      },
    ],
  },
  "0.4.0": {
    date: "2026-03-14",
    changes: [
      {
        type: "feature",
        title: "Brand new UI !!",
        description: "Merged conversations page, and a lovely new settings modal",
      },
      {
        type: "feature",
        title: "In-app Guide",
        description: "Click the question mark on the top-left for a quick explanation to anything",
      },
      {
        type: "improvement",
        title: "Better Video and Audio player",
        description: "It should look way better to play now ^-^",
      },
      {
        type: "improvement",
        title: "Improved Search and Message Loading",
        description: "You'll actually see what you searched for now",
      },
      {
        type: "fix",
        title: "Media fix!",
        description: "Gifs, videos, and audio now load properly; and images are no longer clipped!",
      }
    ]
  },
  "0.3.1": {
    date: "2025-01-08",
    changes: [
      {
        type: "feature",
        title: "Version Compatibility System",
        description: "Keep your conversations stable and up to date",
      },
      {
        type: "feature",
        title: "Discord Rich Presence",
        description: "No extra details are shown for privacy :)",
      },
      {
        type: "improvement",
        title: "UI Enhancements",
        description: "A much smoother and nicer UI!",
      },
    ],
  },
};

function Changelog({ isOpen, onClose, version }) {
  if (!isOpen) return null;

  const displayVersion = version || "0.3.0";
  const changelog = CHANGELOG[displayVersion];

  if (!changelog) {
    return null;
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case "feature":
        return "✨";
      case "improvement":
        return "⚡";
      case "fix":
        return "🐛";
      default:
        return "•";
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case "feature":
        return "New";
      case "improvement":
        return "Improved";
      case "fix":
        return "Fixed";
      default:
        return "";
    }
  };

  return (
    <div className="changelog-overlay" onClick={onClose}>
      <div className="changelog-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="changelog-header">
          <div>
            <h2>What's New in v{displayVersion}</h2>
            <p className="changelog-date">{changelog.date}</p>
          </div>
          <button className="changelog-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="changelog-content">
          {changelog.changes.map((change, index) => (
            <div key={index} className={`changelog-item ${change.type}`}>
              <div className="changelog-item-header">
                <span className="changelog-icon">{getTypeIcon(change.type)}</span>
                <span className="changelog-type">{getTypeLabel(change.type)}</span>
                <span className="changelog-title">{change.title}</span>
              </div>
              <p className="changelog-description">{change.description}</p>
            </div>
          ))}
        </div>

        <div className="changelog-footer">
          <button className="changelog-button" onClick={onClose}>
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}

export default Changelog;
