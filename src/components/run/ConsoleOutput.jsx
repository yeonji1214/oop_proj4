import React from "react";
import "./run.css";

export function ConsoleOutput({ logs = [] }) {
  const normalizedLogs = logs.map((log, index) =>
    typeof log === "string"
      ? { id: index, message: log }
      : { id: log.id ?? index, message: log.message ?? String(log) }
  );

  return (
    <div className="run-console">
      <div className="run-console-header">콘솔 출력</div>
      <div className="run-console-body">
        {normalizedLogs.length === 0 ? (
          <div className="run-console-empty">
            아직 출력된 내용이 없습니다.
          </div>
        ) : (
          normalizedLogs.map((log) => (
            <div key={log.id} className="run-console-line">
              {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
