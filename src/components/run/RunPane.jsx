import React, { useState } from "react";
import "./run.css";
import { RunControls } from "./RunControls";
import { ConsoleOutput } from "./ConsoleOutput";

const API_ROOT = "http://localhost:8080";

export function RunPane({ blocks = [] }) {
  const [logs, setLogs] = useState([]);

  const pushLog = (message) => {
    setLogs((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), message },
    ]);
  };

  // 실행 버튼
  const handleRun = async () => {
    const payload = {
      blocks: blocks.map((b) => ({
        id: b.id,
        text: b.text,
        color: b.color,
        shape: b.shape,
        x: b.x,
        y: b.y,
        parentId: b.parentId ?? null,
        parentSlot: b.parentSlot ?? null, 
        category: b.category ?? null,    
      })),
    };

    pushLog("▶ 실행 요청을 서버로 전송합니다...");

    try {
      const response = await fetch(`${API_ROOT}/api/blocks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        pushLog(`서버 응답 에러: ${response.status}`);
        return;
      }

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      pushLog("서버에 블록 리스트 전송 완료");
      if (data !== null) {
        pushLog(`서버 응답: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      pushLog(`실행 요청 중 오류 발생: ${error.message}`);
    }
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
