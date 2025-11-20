import "./AppLayout.css";

export function AppLayout({ editor, output, palette }) {
  return (
    <div className="app-root">
      <div className="top-row">
        <div className="edit-area">
          {editor}
        </div>
        <div className="bottom-row">
          {palette}
        </div>
      </div>
      <div className="output-area">
        {output}
      </div>
    </div>
  );
}
