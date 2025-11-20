export function Button({ children, onClick, color = "#4A60FF", style = {} }) {
  const baseStyle = {
    padding: "8px 14px",
    background: color,
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 500,
    transition: "0.15s",
  };

  return (
    <button
      onClick={onClick}
      style={{ ...baseStyle, ...style }}
      onMouseEnter={(e) => (e.target.style.opacity = 0.85)}
      onMouseLeave={(e) => (e.target.style.opacity = 1)}
    >
      {children}
    </button>
  );
}
