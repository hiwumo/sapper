import { convertFileSrc } from "@tauri-apps/api/core";
import { useState, useRef, useEffect, useCallback } from "react";
import { openPath } from "@tauri-apps/plugin-opener";
import { Download, ChevronLeft, ChevronRight, X, Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { reportAssetFail } from "../assetCheck";

function VolumeSlider({ volume, muted, onVolumeChange, onToggleMute, iconSize = 16 }) {
  const trackRef = useRef(null);

  const handleClick = (e) => {
    const rect = trackRef.current.getBoundingClientRect();
    // Bottom = 0, top = 1
    const pct = Math.max(0, Math.min(1, (rect.bottom - e.clientY) / rect.height));
    const rounded = Math.round(pct * 20) / 20;
    onVolumeChange(rounded);
  };

  const displayVol = muted ? 0 : volume;

  return (
    <div className="custom-player-volume-group">
      <button className="custom-player-btn" onClick={onToggleMute}>
        {muted || volume === 0 ? <VolumeX size={iconSize} /> : <Volume2 size={iconSize} />}
      </button>
      <div className="custom-player-volume-popup">
        <div className="volume-slider-track" ref={trackRef} onClick={handleClick}>
          <div className="volume-slider-fill" style={{ height: `${displayVol * 100}%` }} />
          <div className="volume-slider-thumb" style={{ bottom: `${displayVol * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function CustomVideoPlayer({ src, type }) {
  const videoRef = useRef(null);
  const progressRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef(null);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }, []);

  const handleTimeUpdate = () => setCurrentTime(videoRef.current?.currentTime || 0);
  const handleLoadedMetadata = () => setDuration(videoRef.current?.duration || 0);
  const handleEnded = () => setPlaying(false);

  const handleSeek = (e) => {
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = pct * duration;
  };

  const toggleMute = () => {
    const v = videoRef.current;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const handleVolumeChange = (val) => {
    videoRef.current.volume = val;
    setVolume(val);
    if (val === 0) { videoRef.current.muted = true; setMuted(true); }
    else if (muted) { videoRef.current.muted = false; setMuted(false); }
  };

  const handleFullscreen = () => {
    videoRef.current?.requestFullscreen?.();
  };

  const handleMouseMove = () => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 2500);
    }
  };

  useEffect(() => {
    if (!playing) setShowControls(true);
    else {
      hideTimer.current = setTimeout(() => setShowControls(false), 2500);
    }
    return () => clearTimeout(hideTimer.current);
  }, [playing]);

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="custom-video-player" onMouseMove={handleMouseMove} onMouseLeave={() => playing && setShowControls(false)}>
      <video
        ref={videoRef}
        preload="metadata"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={(e) => reportAssetFail(`video player error (${e.target.error?.message || "unknown"})`, src)}
      >
        <source src={src} type={type} />
      </video>

      {!playing && (
        <button className="custom-player-play-overlay" onClick={togglePlay}>
          <Play size={40} fill="white" />
        </button>
      )}

      <div className={`custom-player-controls ${showControls ? "visible" : ""}`}>
        <button className="custom-player-btn" onClick={togglePlay}>
          {playing ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
        </button>

        <span className="custom-player-time">{formatTime(currentTime)}</span>

        <div className="custom-player-progress" ref={progressRef} onClick={handleSeek}>
          <div className="custom-player-progress-filled" style={{ width: `${progress}%` }} />
        </div>

        <span className="custom-player-time">{formatTime(duration)}</span>

        <VolumeSlider volume={volume} muted={muted} onVolumeChange={handleVolumeChange} onToggleMute={toggleMute} iconSize={16} />

        <button className="custom-player-btn" onClick={handleFullscreen}>
          <Maximize size={14} />
        </button>
      </div>
    </div>
  );
}

function CustomAudioPlayer({ src, type, fileName }) {
  const audioRef = useRef(null);
  const progressRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); }
    else { a.pause(); setPlaying(false); }
  }, []);

  const handleTimeUpdate = () => setCurrentTime(audioRef.current?.currentTime || 0);
  const handleLoadedMetadata = () => setDuration(audioRef.current?.duration || 0);
  const handleEnded = () => setPlaying(false);

  const handleSeek = (e) => {
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duration;
  };

  const toggleMute = () => {
    const a = audioRef.current;
    a.muted = !a.muted;
    setMuted(a.muted);
  };

  const handleVolumeChange = (val) => {
    audioRef.current.volume = val;
    setVolume(val);
    if (val === 0) { audioRef.current.muted = true; setMuted(true); }
    else if (muted) { audioRef.current.muted = false; setMuted(false); }
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="custom-audio-player">
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={(e) => reportAssetFail(`audio player error (${e.target.error?.message || "unknown"})`, src)}
      >
        <source src={src} type={type} />
      </audio>

      <button className="custom-player-btn audio-play-btn" onClick={togglePlay}>
        {playing ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" />}
      </button>

      <div className="custom-audio-info">
        <span className="custom-audio-filename">{fileName}</span>
        <div className="custom-audio-bottom">
          <span className="custom-player-time">{formatTime(currentTime)}</span>
          <div className="custom-player-progress" ref={progressRef} onClick={handleSeek}>
            <div className="custom-player-progress-filled" style={{ width: `${progress}%` }} />
          </div>
          <span className="custom-player-time">{formatTime(duration)}</span>
        </div>
      </div>

      <VolumeSlider volume={volume} muted={muted} onVolumeChange={handleVolumeChange} onToggleMute={toggleMute} iconSize={14} />
    </div>
  );
}

function MessageAttachments({ mediaRefs, onImageClick, directImageUrl, directIsVideo, debugMode }) {
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Log asset URLs and track load failures in debug mode
  useEffect(() => {
    if (!debugMode) return;
    if (directImageUrl) {
      const isDirect = /^https?:\/\//.test(directImageUrl);
      console.log(`[ASSET_DEBUG] directImage: ${isDirect ? "[remote_url]" : directImageUrl.split("/").pop()} isVideo=${!!directIsVideo}`);
    }
    if (mediaRefs && mediaRefs.length > 0) {
      mediaRefs.forEach((ref, i) => {
        const fileName = ref.split("\\").pop().split("/").pop();
        const ext = fileName.split(".").pop().toLowerCase();
        const isImage = /^(jpg|jpeg|png|gif|webp|apng)$/i.test(ext);
        const isVideo = /^(mp4|webm|mov|avi|mkv|ogv|m4v)$/i.test(ext);
        const isAudio = /^(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(ext);
        const type = isImage ? "image" : isVideo ? "video" : isAudio ? "audio" : "file";
        console.log(`[ASSET_DEBUG] mediaRef[${i}]: ${fileName} type=${type} path=${ref}`);
      });
    }
  }, [mediaRefs, directImageUrl, debugMode]);

  if ((!mediaRefs || mediaRefs.length === 0) && !directImageUrl) return null;

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

  // Add directImageUrl if provided (message was only an image/video URL)
  if (directImageUrl) {
    const fileName = directImageUrl.split("/").pop().split("?")[0]; // Extract filename from URL
    images.push({ ref: directImageUrl, fileName, idx: -1, isDirect: true, isVideoGif: !!directIsVideo });
  }

  if (mediaRefs) {
    mediaRefs.forEach((ref, idx) => {
      const fileName = ref.split("\\").pop().split("/").pop();
      const isSticker = ref.toLowerCase().includes("sticker");
      const isImage = fileName.match(/\.(jpg|jpeg|png|gif|webp|apng)$/i);

      if (!isSticker && isImage) {
        images.push({ ref, fileName, idx, isDirect: false });
      } else {
        otherAttachments.push({ ref, fileName, idx, isSticker, isImage });
      }
    });
  }

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
                {img.isVideoGif ? (
                  <video
                    src={img.ref}
                    autoPlay
                    loop
                    muted
                    playsInline
                    onError={() => reportAssetFail("video failed to load", img.ref)}
                  />
                ) : (
                  <img
                    src={img.isDirect ? img.ref : getAttachmentUrl(img.ref)}
                    alt={img.fileName}
                    loading="lazy"
                    onError={() => reportAssetFail("image failed to load", img.isDirect ? img.ref : img.ref)}
                  />
                )}
                {debugMode && (
                  <div className="debug-asset-source" title={img.ref}>
                    {img.isDirect ? "URL" : img.ref.split("\\").pop().split("/").pop()}
                  </div>
                )}
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
                <CustomVideoPlayer
                  src={getAttachmentUrl(ref)}
                  type={`video/${fileName.split('.').pop().toLowerCase()}`}
                />
              ) : isAudio ? (
                <CustomAudioPlayer
                  src={getAttachmentUrl(ref)}
                  type={`audio/${fileName.split('.').pop().toLowerCase()}`}
                  fileName={fileName}
                />
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

            <div className="carousel-image-container" onClick={closeCarousel}>
              {images[carouselIndex].isVideoGif ? (
                <video
                  src={images[carouselIndex].ref}
                  autoPlay
                  loop
                  muted
                  playsInline
                  onClick={(e) => e.stopPropagation()}
                  onError={() => reportAssetFail("carousel video failed", images[carouselIndex].ref)}
                />
              ) : (
                <img
                  src={images[carouselIndex].isDirect ? images[carouselIndex].ref : getAttachmentUrl(images[carouselIndex].ref)}
                  alt={images[carouselIndex].fileName}
                  onClick={(e) => e.stopPropagation()}
                  onError={() => reportAssetFail("carousel image failed", images[carouselIndex].ref)}
                />
              )}
            </div>

            {images.length > 1 && (
              <button className="carousel-button carousel-next" onClick={nextImage}>
                <ChevronRight size={40} />
              </button>
            )}
          </div>

          {images.length > 1 && (
            <div className="carousel-dots" onClick={(e) => e.stopPropagation()}>
              {images.map((_, idx) => (
                <span
                  key={idx}
                  className={`carousel-dot${idx === carouselIndex ? " active" : ""}`}
                  onClick={() => setCarouselIndex(idx)}
                />
              ))}
              <span className="carousel-dot-number">{carouselIndex + 1}/{images.length}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default MessageAttachments;
