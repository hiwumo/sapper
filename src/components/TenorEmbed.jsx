import { useEffect, useRef } from "react";

function TenorEmbed({ gifId, url }) {
  const containerRef = useRef(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    // Load the Tenor embed script if not already loaded
    if (!scriptLoadedRef.current) {
      const existingScript = document.querySelector('script[src="https://tenor.com/embed.js"]');

      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://tenor.com/embed.js";
        script.async = true;
        document.body.appendChild(script);
      }

      scriptLoadedRef.current = true;
    }

    // Trigger Tenor embed rendering
    if (window.TenorEmbed) {
      window.TenorEmbed.init();
    }
  }, [gifId]);

  return (
    <div className="message-tenor-embed" ref={containerRef}>
      <div
        className="tenor-gif-embed"
        data-postid={gifId}
        data-share-method="host"
        data-aspect-ratio="1"
        data-width="100%"
      >
        <a href={url}>Tenor GIF</a>
      </div>
    </div>
  );
}

export default TenorEmbed;
