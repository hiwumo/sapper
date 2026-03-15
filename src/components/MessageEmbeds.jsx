import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect } from "react";

function MessageEmbeds({ embeds, importPath, debugMode }) {
  if (!embeds || embeds.length === 0) return null;

  useEffect(() => {
    if (!debugMode) return;
    embeds.forEach((embed, i) => {
      const parts = [`[EMBED_DEBUG] embed[${i}]`];
      if (embed.type) parts.push(`type=${embed.type}`);
      if (embed.title) parts.push(`title=[REDACTED]`);
      if (embed.description) parts.push(`hasDesc=true`);
      if (embed.url) parts.push(`url=[has_url]`);
      if (embed.thumbnail?.url) {
        const isLocal = !/^https?:\/\//.test(embed.thumbnail.url);
        parts.push(`thumbnail=${isLocal ? embed.thumbnail.url : "[remote]"}(${isLocal ? "local" : "remote"})`);
      }
      if (embed.video?.url) {
        const isLocal = !/^https?:\/\//.test(embed.video.url);
        parts.push(`video=${isLocal ? embed.video.url : "[remote]"}(${isLocal ? "local" : "remote"})`);
      }
      if (embed.image?.url) {
        const isLocal = !/^https?:\/\//.test(embed.image.url);
        parts.push(`image=${isLocal ? embed.image.url : "[remote]"}(${isLocal ? "local" : "remote"})`);
      }
      if (embed.fields?.length) parts.push(`fields=${embed.fields.length}`);
      console.log(parts.join(" | "));
    });
  }, [embeds, debugMode]);

  function getEmbedThumbnailUrl(thumbnailPath) {
    if (!thumbnailPath) return "";
    if (/^https?:\/\//.test(thumbnailPath)) return thumbnailPath;
    const fullPath = `${importPath}\\attachments\\${thumbnailPath}`;
    return convertFileSrc(fullPath);
  }

  return (
    <div className="message-embeds">
      {embeds.map((embed, idx) => (
        <div key={idx} className="embed">
          <div className="embed-content">
            {embed.title && (
              <a
                href={embed.url}
                target="_blank"
                rel="noopener noreferrer"
                className="embed-title"
              >
                {embed.title}
              </a>
            )}
            {embed.description && (
              <div className="embed-description">{embed.description}</div>
            )}
            {embed.fields && embed.fields.length > 0 && (
              <div className="embed-fields">
                {embed.fields.map((field, fieldIdx) => (
                  <div key={fieldIdx} className="embed-field">
                    <div className="embed-field-name">{field.name}</div>
                    <div className="embed-field-value">{field.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {embed.thumbnail && embed.thumbnail.url && (
            <a
              href={embed.url}
              target="_blank"
              rel="noopener noreferrer"
              className="embed-thumbnail"
            >
              <img
                src={getEmbedThumbnailUrl(embed.thumbnail.url)}
                alt={embed.title || "Embed thumbnail"}
                loading="lazy"
                onError={() => debugMode && console.warn(`[ASSET_FAIL] embed thumbnail failed: ${embed.thumbnail.url}`)}
              />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

export default MessageEmbeds;
