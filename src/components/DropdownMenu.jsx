import { useEffect, useRef } from "react";
import "./DropdownMenu.css";

function DropdownMenu({ items, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  return (
    <div className="dropdown-menu" ref={menuRef}>
      {items.map((item, index) => (
        <button
          key={index}
          className={`menu-item ${item.danger ? "danger" : ""}`}
          onClick={item.onClick}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default DropdownMenu;
