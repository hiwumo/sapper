import { convertFileSrc } from "@tauri-apps/api/core";

function MessageAttachments({ mediaRefs, onImageClick }) {
  if (!mediaRefs || mediaRefs.length === 0) return null;

  function getAttachmentUrl(filePath) {
    if (!filePath) return "";
    return convertFileSrc(filePath);
  }

  return (
    <div className="message-attachments">
      {mediaRefs.map((ref, idx) => {
        const fileName = ref.split("\\").pop().split("/").pop();
        const isSticker = ref.toLowerCase().includes("sticker");
        const isImage = fileName.match(/\.(jpg|jpeg|png|gif|webp|apng)$/i);
        const isVideo = fileName.match(/\.(mp4|webm|mov|avi|mkv|ogv|m4v)$/i);
        const isAudio = fileName.match(/\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i);

        if (isSticker && isImage) {
          return (
            <div key={idx} className="sticker" onClick={() => onImageClick?.(getAttachmentUrl(ref))}>
              <img
                src={getAttachmentUrl(ref)}
                alt="Sticker"
                loading="lazy"
              />
            </div>
          );
        }

        return (
          <div key={idx} className="attachment">
            {isImage ? (
              <div className="attachment-image" onClick={() => onImageClick?.(getAttachmentUrl(ref))}>
                <img
                  src={getAttachmentUrl(ref)}
                  alt={fileName}
                  loading="lazy"
                />
              </div>
            ) : isVideo ? (
              <div className="attachment-video">
                <video
                  controls
                  preload="metadata"
                  className="video-player"
                >
                  <source src={getAttachmentUrl(ref)} type={`video/${fileName.split('.').pop().toLowerCase()}`} />
                  Your browser does not support the video tag.
                </video>
              </div>
            ) : isAudio ? (
              <div className="attachment-audio">
                <audio
                  controls
                  preload="metadata"
                  className="audio-player"
                >
                  <source src={getAttachmentUrl(ref)} type={`audio/${fileName.split('.').pop().toLowerCase()}`} />
                  Your browser does not support the audio tag.
                </audio>
              </div>
            ) : (
              <div className="attachment-file">
                <span className="file-icon">📎</span>
                <span className="file-name">{fileName}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default MessageAttachments;
