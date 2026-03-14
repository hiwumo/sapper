function GiphyEmbed({ gifId, url }) {
  return (
    <div className="message-giphy-embed">
      <iframe
        src={`https://giphy.com/embed/${gifId}`}
        width="100%"
        height="100%"
        frameBorder="0"
        allowFullScreen
        title="Giphy GIF"
      />
    </div>
  );
}

export default GiphyEmbed;
