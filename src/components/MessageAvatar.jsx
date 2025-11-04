import { convertFileSrc } from "@tauri-apps/api/core";

function MessageAvatar({ avatarUrl, name, importPath, size = "normal" }) {
  function getAvatarUrl(avatarFileName) {
    if (!importPath || !avatarFileName) return "";
    const fullPath = `${importPath}\\attachments\\${avatarFileName}`;
    return convertFileSrc(fullPath);
  }

  const sizeClass = size === "small" ? "avatar-fallback-small" : "avatar-fallback";

  return (
    <div className={`message-avatar ${size === "small" ? "message-avatar-small" : ""}`}>
      {avatarUrl ? (
        <img
          src={getAvatarUrl(avatarUrl)}
          alt={name}
          onError={(e) => {
            e.target.style.display = "none";
            e.target.nextSibling.style.display = "flex";
          }}
        />
      ) : null}
      <span className={sizeClass} style={{ display: avatarUrl ? "none" : "flex" }}>
        {name?.[0]?.toUpperCase() || "?"}
      </span>
    </div>
  );
}

export default MessageAvatar;
