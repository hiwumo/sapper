import "./ProgressDialog.css";

function ProgressDialog({ message }) {
  return (
    <div className="progress-overlay">
      <div className="progress-content">
        <div className="progress-spinner"></div>
        <p className="progress-message">{message}</p>
      </div>
    </div>
  );
}

export default ProgressDialog;
