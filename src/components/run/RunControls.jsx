import React from "react";
import "./run.css";

export function RunControls({
  onRun,
  onStep,
  onStop,
  onReset,
  isRunning = false,
  debug = false,
  trace = false,
  onOptionsChange,
}) {
  const handleClick = (handler) => () => {
    if (typeof handler === "function") handler();
  };

  const toggle = (key) => (e) => {
    if (!onOptionsChange) return;
    onOptionsChange({ [key]: e.target.checked });
  };

  return (
    <div className="run-controls">
      <button
        className="run-button primary"
        type="button"
        onClick={handleClick(onRun)}
      >
        ▶ 실행
      </button>
      <button
        className="run-button"
        type="button"
        onClick={handleClick(onStep)}
        disabled={!isRunning}
      >
        ▷ 한 단계
      </button>
      <button
        className="run-button"
        type="button"
        onClick={handleClick(onStop)}
        disabled={!isRunning}
      >
        ■ 중지
      </button>
      <button
        className="run-button"
        type="button"
        onClick={handleClick(onReset)}
      >
        ⟲ 초기화
      </button>

      <div className="run-toggle-group">
        <label className="run-toggle">
          <input type="checkbox" checked={debug} onChange={toggle("debug")} />
          Debug
        </label>
        <label className="run-toggle">
          <input type="checkbox" checked={trace} onChange={toggle("trace")} />
          Trace
        </label>
      </div>
    </div>
  );
}
