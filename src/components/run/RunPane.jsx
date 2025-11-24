import React, { useState } from "react";
import "./run.css";
import { RunControls } from "./RunControls";
import { ConsoleOutput } from "./ConsoleOutput";

export function RunPane() {
  const [logs, setLogs] = useState([]);

  const pushLog = (message) => {
    setLogs((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), message },
    ]);
  };

  const handleRun = () => {
    pushLog("▶ 실행되었습니다.");
  };

  const handleStep = () => {
    pushLog("▷ 한 단계 실행되었습니다.");
  };

  const handleReset = () => {
    setLogs([]);
    pushLog("⟲ 콘솔 초기화 완료.");
  };

  return (
    <div className="run-root">
      <RunControls
        onRun={handleRun}
        onStep={handleStep}
        onReset={handleReset}
      />

      <div className="run-only-console">
        <ConsoleOutput logs={logs} />
      </div>
    </div>
  );
}
