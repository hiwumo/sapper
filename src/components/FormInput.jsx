import "./FormInput.css";

function FormInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  autoFocus = false,
  type = "text"
}) {
  return (
    <div className="form-group">
      {label && <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      {hint && <div className="form-hint">{hint}</div>}
    </div>
  );
}

export default FormInput;
