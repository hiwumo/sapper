import { convertFileSrc } from "@tauri-apps/api/core";

function MessageStickers({ stickers, importPath, onImageClick }) {
  if (!stickers || stickers.length === 0) return null;

  function getStickerUrl(stickerSourceUrl) {
    if (!importPath || !stickerSourceUrl) return "";
    const stickerPath = `${importPath}\\attachments\\${stickerSourceUrl}`;
    return convertFileSrc(stickerPath);
  }

  return (
    <div className="message-stickers">
      {stickers.map((sticker, idx) => {
        const stickerUrl = getStickerUrl(sticker.sourceUrl);
        return (
          <div key={idx} className="sticker" onClick={() => onImageClick?.(stickerUrl)}>
            <img
              src={stickerUrl}
              alt={sticker.name || "Sticker"}
              loading="lazy"
            />
          </div>
        );
      })}
    </div>
  );
}

export default MessageStickers;
