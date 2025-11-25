import React from "react";
import "./run.css";

export function RunControls({ onRun, onStep, onReset, isRunning = false }) {
  const handleClick = (handler) => () => {
    if (typeof handler === "function") {
      handler();
    }
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
        disabled={isRunning}
      >
        ▷ 한 단계
      </button>
      <button
        className="run-button"
        type="button"
        onClick={handleClick(onReset)}
      >
        ⟲ 초기화
      </button>
    </div>
  );
}
