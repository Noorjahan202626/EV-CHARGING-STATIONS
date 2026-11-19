export default function Field({ id, label, error, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="ev-label">{label}</label>
      <input id={id} className={`ev-input ${error ? "invalid" : ""}`}
        aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...props} />
      {error && <div id={`${id}-err`} className="ev-error">{error}</div>}
    </div>
  );
}
