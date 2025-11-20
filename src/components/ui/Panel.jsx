export function Panel({ title, children, style = {} }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "12px",
        background: "#fff",
        marginBottom: "12px",
        ...style,
      }}
    >
      {title && <h3 style={{ marginTop: 0, marginBottom: "10px" }}>{title}</h3>}
      {children}
    </div>
  );
}
