export function BlockPalettePane() {
  const btn = {
    padding: "6px 14px",
    borderRadius: "999px",
    border: "none",
    background: "#ccc",
    marginRight: "8px",
    cursor: "pointer",
    fontSize: "13px",
  };

  const block = {
    height: "16px",
    background: "#bfbfbf",
    borderRadius: "4px",
    marginBottom: "8px",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ marginBottom: "12px" }}>
        <button style={btn}>블록 종류1</button>
        <button style={btn}>블록 종류2</button>
        <button style={btn}>블록 종류3</button>
        <button style={btn}>블록 종류4</button>
        <button style={btn}>블록 종류5</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingRight: "8px" }}>
        <div style={block}></div>
        <div style={block}></div>
        <div style={block}></div>
        <div style={block}></div>
      </div>
    </div>
  );
}
