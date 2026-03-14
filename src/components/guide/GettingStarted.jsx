import { useMemo } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

function getRecommendedRelease() {
  const ua = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || "";

  let os;
  if (ua.includes("win")) os = "win";
  else if (ua.includes("mac") || ua.includes("darwin")) os = "osx";
  else os = "linux";

  let arch;
  if (ua.includes("arm64") || ua.includes("aarch64") || platform.includes("arm")) {
    arch = os === "osx" ? "arm64" : "arm";
  } else {
    arch = "x64";
  }

  return `DiscordChatExporter.${os.charAt(0).toLocaleLowerCase() + os.slice(1)}-${arch}.zip`;
}

export function WhatIsSapper() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">What is Sapper?</h2>
      <section className="guide-section">
        <p>
          Sapper is a desktop app for viewing, organising, and managing exported Discord
          conversations. You can browse your messages offline with full support for
          attachments, embeds, custom emojis, reactions, and more. Everything is stored
          locally on your computer.
        </p>
        <br/>
        <p>
          I primarily made this for my best friend! Love you ^-^
        </p>
      </section>
    </div>
  );
}

export function ExportingFromDiscord() {
  const recommendedRelease = useMemo(() => getRecommendedRelease(), []);

  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Exporting from Discord</h2>
      <section className="guide-section">
        <p>
          Before you can use Sapper, you'll need to export your Discord conversations
          using <strong>DiscordChatExporter</strong>:
        </p>
        <ol className="guide-steps">
          <li>
            Download and install{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                openUrl("https://github.com/Tyrrrz/DiscordChatExporter/releases");
              }}
            >
              DiscordChatExporter
            </a>
            . Based on your system, you should download <code>{recommendedRelease}</code>.
          </li>
          <li>Select the channel or DM you want to export.</li>
          <li>
            <strong>Set the export format to JSON.</strong> This is important; Sapper only
            reads JSON exports.
          </li>
          <li>
            <strong>Turn on "Download assets"</strong> so that images, videos, and other
            attachments are saved alongside the export. You don't need to change the
            default asset path; just make sure the option is ticked.
          </li>
          <li>
            Run the export. You'll get a <code>.json</code> file and (if you enabled
            assets) a folder of downloaded files.
          </li>
        </ol>
        <div className="guide-callout">
          <strong>Does HTML / CSV / plaintext work?</strong>
          <p>
            Not yet. Sapper currently only supports JSON exports. Support for other formats
            may come in the future.
          </p>
        </div>
      </section>
    </div>
  );
}

export function ImportingConversations() {
  return (
    <div className="guide-page">
      <h2 className="guide-page-title">Importing Conversations</h2>
      <section className="guide-section">
        <ol className="guide-steps">
          <li>
            Click the <strong>+</strong> button at the top of the sidebar.
          </li>
          <li>Select one or more <code>.json</code> files from your computer.</li>
          <li>
            A preview dialog will show you the conversation details. You can set a
            custom <strong>display name</strong> for each conversation before importing.
          </li>
          <li>
            Click <strong>Import</strong>. Sapper will save the data to your computer
            and get everything ready for browsing.
          </li>
        </ol>
        <div className="guide-info-grid">
          <div className="guide-info-card">
            <span className="guide-info-label">Bulk import</span>
            <p>
              You can select multiple files at once to import several conversations in
              one go.
            </p>
          </div>
          <div className="guide-info-card">
            <span className="guide-info-label">Large imports</span>
            <p>
              If the total attachment size is over 3 GB, Sapper will warn you about disk
              usage.
            </p>
          </div>
          <div className="guide-info-card">
            <span className="guide-info-label">Cancelling</span>
            <p>
              You can cancel an import while it's in progress using the progress dialog.
            </p>
          </div>
          <div className="guide-info-card">
            <span className="guide-info-label">Missing assets</span>
            <p>
              If attachments can't be found during a single-file import, Sapper will let
              you know.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
