import { convertFileSrc } from "@tauri-apps/api/core";
import { useState } from "react";
import { openPath } from "@tauri-apps/plugin-opener";
import { Download, ChevronLeft, ChevronRight, X } from "lucide-react";

function MessageAttachments({ mediaRefs, onImageClick }) {
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  if (!mediaRefs || mediaRefs.length === 0) return null;

  function getAttachmentUrl(filePath) {
    if (!filePath) return "";
    return convertFileSrc(filePath);
  }

  const handleOpenFile = async (filePath) => {
    try {
      // Extract directory path
      const dirPath = filePath.substring(0, filePath.lastIndexOf('\\'));
      await openPath(dirPath);
    } catch (error) {
      console.error("Failed to open file location:", error);
    }
  };

  // Separate images from other attachments
  const images = [];
  const otherAttachments = [];

  mediaRefs.forEach((ref, idx) => {
    const fileName = ref.split("\\").pop().split("/").pop();
    const isSticker = ref.toLowerCase().includes("sticker");
    const isImage = fileName.match(/\.(jpg|jpeg|png|gif|webp|apng)$/i);

    if (!isSticker && isImage) {
      images.push({ ref, fileName, idx });
    } else {
      otherAttachments.push({ ref, fileName, idx, isSticker, isImage });
    }
  });

  const openCarousel = (index) => {
    setCarouselIndex(index);
    setCarouselOpen(true);
  };

  const closeCarousel = () => {
    setCarouselOpen(false);
  };

  const nextImage = () => {
    setCarouselIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCarouselIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <>
      <div className="message-attachments">
        {/* Image Grid */}
        {images.length > 0 && (
          <div className={`attachment-image-grid grid-${Math.min(images.length, 4)}`}>
            {images.map((img, idx) => (
              <div
                key={idx}
                className="attachment-image-grid-item"
                onClick={() => openCarousel(idx)}
              >
                <img
                  src={getAttachmentUrl(img.ref)}
                  alt={img.fileName}
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}

        {/* Other Attachments */}
        {otherAttachments.map((att) => {
          const { ref, fileName, idx, isSticker, isImage } = att;
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
              {isVideo ? (
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
                  <button
                    className="file-download-button"
                    onClick={() => handleOpenFile(ref)}
                    title="Open file location"
                  >
                    <Download size={16} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Carousel Modal */}
      {carouselOpen && images.length > 0 && (
        <div className="carousel-overlay" onClick={closeCarousel}>
          <button className="carousel-close" onClick={closeCarousel}>
            <X size={32} />
          </button>

          <div className="carousel-content" onClick={(e) => e.stopPropagation()}>
            {images.length > 1 && (
              <button className="carousel-button carousel-prev" onClick={prevImage}>
                <ChevronLeft size={40} />
              </button>
            )}

            <div className="carousel-image-container">
              <img
                src={getAttachmentUrl(images[carouselIndex].ref)}
                alt={images[carouselIndex].fileName}
              />
            </div>

            {images.length > 1 && (
              <button className="carousel-button carousel-next" onClick={nextImage}>
                <ChevronRight size={40} />
              </button>
            )}
          </div>

          {images.length > 1 && (
            <div className="carousel-counter">
              {carouselIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default MessageAttachments;
