import React, { useMemo, useRef, useState, useEffect } from "react";
import "./run.css";
import { RunControls } from "./RunControls";
import { ConsoleOutput } from "./ConsoleOutput";
import { API_ROOT, PROJECT_ID } from "../../config";
import { compileBlocks } from "../../utils/blockCompiler";
import { buildCreatePayload, buildUpdatePayload } from "../../utils/blockApiMapper";
import SockJS from "sockjs-client/dist/sockjs";
import { Client } from "@stomp/stompjs";

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`${res.status} ${res.statusText} - ${msg}`);
  }
  return data;
}

export function RunPane({ blocks = [], projectId = PROJECT_ID }) {
  const [logs, setLogs] = useState([]);
  const [debug, setDebug] = useState(false);
  const [trace, setTrace] = useState(false);
  const isRunningRef = useRef(false);
  const sessionIdRef = useRef(null);
  const stompRef = useRef(null);
  const variableIdByNameRef = useRef(new Map());

  const pushLog = (message) => {
    setLogs((prev) => [...prev, { id: Date.now() + Math.random(), message }]);
  };

  useEffect(() => {
    return () => {
      if (stompRef.current) {
        try {
          stompRef.current.deactivate();
        } catch {
          // noop
        }
      }
    };
  }, []);

  const compiled = useMemo(() => compileBlocks(blocks), [blocks]);

  const resetConsole = () => {
    setLogs([]);
  };

  const attachVariableIdToValue = (dto, varMap) => {
    if (!dto || typeof dto !== "object") return dto;
    const next = { ...dto };
    if (
      next.valueType &&
      next.valueType.toUpperCase() === "VARIABLE" &&
      next.variableId == null &&
      next.variableName
    ) {
      const mapped = varMap.get(next.variableName);
      if (mapped != null) next.variableId = mapped;
    }
    if (next.operand) next.operand = attachVariableIdToValue(next.operand, varMap);
    if (next.left) next.left = attachVariableIdToValue(next.left, varMap);
    if (next.right) next.right = attachVariableIdToValue(next.right, varMap);
    return next;
  };

  const attachVariableIdsToNode = (node, varMap) => {
    if (!node) return node;
    const mappedNode = { ...node };
    if (mappedNode.variableId == null && mappedNode.variableName) {
      const mapped = varMap.get(mappedNode.variableName);
      if (mapped != null) mappedNode.variableId = mapped;
    }
    if (mappedNode.resultVariableId == null && mappedNode.resultVariable) {
      const mapped = varMap.get(mappedNode.resultVariable);
      if (mapped != null) mappedNode.resultVariableId = mapped;
    }
    mappedNode.condition = attachVariableIdToValue(mappedNode.condition, varMap);
    mappedNode.initial = attachVariableIdToValue(mappedNode.initial, varMap);
    mappedNode.value = attachVariableIdToValue(mappedNode.value, varMap);
    mappedNode.message = attachVariableIdToValue(mappedNode.message, varMap);
    mappedNode.init = attachVariableIdToValue(mappedNode.init, varMap);
    mappedNode.increment = attachVariableIdToValue(mappedNode.increment, varMap);
    mappedNode.operand1 = attachVariableIdToValue(mappedNode.operand1, varMap);
    mappedNode.operand2 = attachVariableIdToValue(mappedNode.operand2, varMap);
    return mappedNode;
  };

  const handleRun = async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    const variableMap = variableIdByNameRef.current;

    try {
      resetConsole();
      pushLog("실행 준비 중...");
      let { nodes } = compiled;
      nodes = nodes.map((n) => attachVariableIdsToNode(n, variableMap));

      if (!nodes.length) {
        pushLog("❌ 실행할 블록이 없습니다. START/연결을 확인하세요.");
        isRunningRef.current = false;
        return;
      }

      // 0) 현재 서버에 저장된 블록 목록 조회 및 정리
      const existingBlocks = await fetchJson(
        `${API_ROOT}/api/blocks/project/${projectId}`
      );

      const existingList = Array.isArray(existingBlocks) ? existingBlocks : [];

      if (existingList.length > 0) {
        for (const block of existingList) {
          const blockId = block?.id ?? block?.blockId;
          if (blockId == null) continue;

          await fetchJson(`${API_ROOT}/api/blocks/${blockId}`, {
            method: "DELETE",
          });
        }
      }

      // 1) 생성(POST) - 링크는 일단 null로
      const localToServerId = new Map();

      for (const n of nodes) {
        const createBody = buildCreatePayload(n);

        const created = await fetchJson(
          `${API_ROOT}/api/blocks/project/${projectId}`,
          {
            method: "POST",
            body: JSON.stringify(createBody),
          }
        );

        // backend가 반환하는 id 필드명을 최대한 넓게 커버
        const serverId = created?.id ?? created?.blockId ?? created?.data?.id;
        if (serverId == null) {
          throw new Error("블록 생성 응답에서 id를 찾지 못했어요. 백엔드 응답 구조를 확인해야 합니다.");
        }

        localToServerId.set(n.localId, serverId);
        if (n.blockType === "VAR_DECLARE") {
          const varId = created?.variableId ?? created?.data?.variableId;
          if (varId != null && n.variableName) {
            variableMap.set(n.variableName, varId);
            n.variableId = varId;
          }
        }
      }

      pushLog("✅ 블록 생성 완료. 연결 정보를 업데이트합니다...");

      const resolveServerId = (localId) =>
        localId != null ? localToServerId.get(localId) ?? null : null;

      nodes = nodes.map((n) => attachVariableIdsToNode(n, variableMap));

      // 2) 연결(PUT)
      for (const n of nodes) {
        const serverId = localToServerId.get(n.localId);
        if (serverId == null) continue;

        const updateBody = buildUpdatePayload(n, resolveServerId);

        await fetchJson(`${API_ROOT}/api/blocks/${serverId}`, {
          method: "PUT",
          body: JSON.stringify(updateBody),
        });
      }

      pushLog("✅ 연결 업데이트 완료. 프로젝트 실행을 요청합니다...");

      // 3) 실행
      const qs = new URLSearchParams({
        debug: debug ? "true" : "false",
        trace: trace ? "true" : "false",
      }).toString();
      const runRes = await fetchJson(
        `${API_ROOT}/api/execution/projects/${projectId}/run?${qs}`,
        { method: "POST" }
      );

      const sessionId = runRes?.sessionId;
      if (sessionId) {
        sessionIdRef.current = sessionId;

        // 기존 연결 종료
        if (stompRef.current) {
          try {
            stompRef.current.deactivate();
          } catch {
            // noop
          }
          stompRef.current = null;
        }

        const client = new Client({
          webSocketFactory: () => new SockJS(`${API_ROOT}/ws`),
          reconnectDelay: 5000,
          onConnect: () => {
            client.subscribe(`/topic/execution/${sessionId}`, (frame) => {
              try {
                const body = JSON.parse(frame.body);
                const type = body?.type ?? "MSG";
                const data = body?.data ?? frame.body;
                if (type === "DEBUG_WAIT") {
                  pushLog(`[DEBUG] ${data}`);
                  return;
                }
                if (type === "TRACE") {
                  if (trace || debug) pushLog(`[TRACE] ${data}`);
                  return;
                }
                if (type === "ERROR") {
                  pushLog(`❌ ${data}`);
                } else {
                  pushLog(data);
                }
                if (type === "COMPLETE" || type === "ERROR") {
                  client.deactivate();
                  stompRef.current = null;
                  sessionIdRef.current = null;
                  pushLog("실행 종료");
                  isRunningRef.current = false;
                }
              } catch {
                pushLog(frame.body);
              }
            });
          },
          onStompError: (err) => {
            pushLog(`WebSocket 오류: ${err?.headers?.message ?? err.body ?? err}`);
          },
        });
        stompRef.current = client;
        client.activate();
      } else {
        pushLog("❌ 세션 생성에 실패했습니다.");
        isRunningRef.current = false;
      }
    } catch (err) {
      pushLog(`❌ 오류: ${err?.message ?? String(err)}`);
      isRunningRef.current = false;
    }
  };

  const handleStep = async () => {
    if (!sessionIdRef.current) return;
    try {
      await fetchJson(
        `${API_ROOT}/api/execution/sessions/${sessionIdRef.current}/step`,
        { method: "POST" }
      );
    } catch (err) {
      pushLog(`❌ 오류: ${err?.message ?? String(err)}`);
    }
  };

  const handleStop = async () => {
    if (!sessionIdRef.current) return;
    try {
      await fetchJson(
        `${API_ROOT}/api/execution/sessions/${sessionIdRef.current}/stop`,
        { method: "POST" }
      );
    } catch (err) {
      pushLog(`❌ 오류: ${err?.message ?? String(err)}`);
    } finally {
      if (stompRef.current) {
        try {
          stompRef.current.deactivate();
        } catch {
          // noop
        }
        stompRef.current = null;
      }
      isRunningRef.current = false;
      sessionIdRef.current = null;
      pushLog("실행 종료");
    }
  };

  const handleReset = () => {
    resetConsole();
    sessionIdRef.current = null;
  };

  return (
  <div className="run-root">
    <RunControls
      onRun={handleRun}
      onStep={handleStep}
      onStop={handleStop}
      onReset={handleReset}
      isRunning={isRunningRef.current}
      debug={debug}
      trace={trace}
      onOptionsChange={(change) => {
        if (change.debug !== undefined) setDebug(change.debug);
        if (change.trace !== undefined) setTrace(change.trace);
      }}
    />
    <ConsoleOutput logs={logs} />
  </div>
);
}
