import { Settings as SettingsIcon } from "lucide-react";
import "./Navbar.css";

function Navbar({ activeView, openTabs, onTabClick, onCloseTab, onSettingsClick }) {
  return (
    <nav className="top-nav">
      <div className="nav-tabs">
        <button
          className={`nav-tab ${activeView === "home" ? "active" : ""}`}
          onClick={() => onTabClick("home")}
        >
          Home
        </button>
        {openTabs.map((tab) => (
          <div
            key={tab.id}
            className={`nav-tab conversation-tab ${
              activeView === tab.id ? "active" : ""
            }`}
          >
            <button
              className="tab-label"
              onClick={() => onTabClick(tab.id)}
            >
              {tab.name}
            </button>
            <button
              className="close-tab"
              onClick={() => onCloseTab(tab.id)}
              title="Close"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button className="settings-button" onClick={onSettingsClick} title="Settings">
        <SettingsIcon size={20} />
      </button>
    </nav>
  );
}

export default Navbar;
