import { X } from "lucide-react";
import "./Dialog.css";

function Dialog({
  isOpen,
  onClose,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  type = "default", // default, danger, success
}) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  const handleCancel = () => {
    onCancel?.();
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={handleCancel}>
      <div className="dialog-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2 className="dialog-title">{title}</h2>
          <button className="dialog-close" onClick={handleCancel}>
            <X size={20} />
          </button>
        </div>

        <div className="dialog-content">
          <p className="dialog-message">{message}</p>
        </div>

        <div className="dialog-footer">
          <button className="dialog-button dialog-button-cancel" onClick={handleCancel}>
            {cancelText}
          </button>
          <button
            className={`dialog-button dialog-button-confirm ${
              type === "danger" ? "danger" : type === "success" ? "success" : ""
            }`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Dialog;
