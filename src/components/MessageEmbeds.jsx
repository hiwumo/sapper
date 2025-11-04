import { convertFileSrc } from "@tauri-apps/api/core";

function MessageEmbeds({ embeds, importPath }) {
  if (!embeds || embeds.length === 0) return null;

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
              />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

export default MessageEmbeds;
