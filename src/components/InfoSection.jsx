import "./InfoSection.css";

function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}:</span>
      <span className="info-value">{value}</span>
    </div>
  );
}

function InfoSection({ rows }) {
  return (
    <div className="info-section">
      {rows.map((row, index) => (
        <InfoRow key={index} label={row.label} value={row.value} />
      ))}
    </div>
  );
}

export default InfoSection;
