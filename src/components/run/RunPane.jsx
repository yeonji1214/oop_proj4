import React, { useMemo, useRef, useState } from "react";
import "./run.css";
import { RunControls } from "./RunControls";
import { ConsoleOutput } from "./ConsoleOutput";

const API_ROOT = import.meta?.env?.VITE_API_ROOT ?? "http://localhost:8080";
const PROJECT_ID = 1;

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}


function inferBlockType(b) {
  if (b?.blockType) return b.blockType;

  const text = (b?.text ?? "").toString();
  const category = (b?.category ?? "").toString();

  if (text.includes("깃발") || text.toLowerCase().includes("start")) return "START";
  if (text.includes("만약") || text.toLowerCase().includes("if")) return "IF";
  if (text.includes("동안") || text.toLowerCase().includes("while")) return "WHILE";
  if (category.includes("출력") || text.toLowerCase().includes("print")) return "PRINT";
  if (category.includes("변수") || text.toLowerCase().includes("var")) return "VAR_DECLARE";

  return "PRINT";
}


 // parentId/parentSlot 기반으로 "다음 블록"을 추정.

function buildChildIndex(blocks) {
  const byParent = new Map(); // parentId -> children[]
  for (const b of blocks) {
    const pid = b?.parentId;
    if (pid == null) continue;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(b);
  }
  // y 오름차순으로 정렬해두면 "위->아래" 연결 추정이 안정적
  for (const [k, arr] of byParent.entries()) {
    arr.sort((a, b) => safeNum(a.y) - safeNum(b.y));
    byParent.set(k, arr);
  }
  return byParent;
}

function slotMatches(slot, candidates) {
  if (slot == null) return candidates.includes(null) || candidates.includes("null");
  const s = String(slot).toLowerCase();
  return candidates.some((c) => (c == null ? false : s.includes(String(c).toLowerCase())));
}

/**
 * blocks(프론트) -> nodes(백엔드용, localId 기반 링크 포함)
 * local 링크(nextLocalId/trueLocalId/falseLocalId)는
 *  - blocks에 이미 nextBlockId/trueBranchId/falseBranchId가 있으면 그걸 우선 사용
 *  - 없으면 parentId/parentSlot에서 추정
 */
function compileToBackendNodes(blocks) {
  const list = Array.isArray(blocks) ? blocks : [];
  const byId = new Map(list.map((b) => [b.id, b]));
  const childrenByParent = buildChildIndex(list);

  const findStart = () => {
    // 1) blockType=START 우선
    const explicit = list.find((b) => inferBlockType(b) === "START");
    if (explicit) return explicit;
    // 2) 텍스트 기반
    return list.find((b) => (b?.text ?? "").toString().includes("깃발")) ?? null;
  };

  const start = findStart();
  if (!start) {
    return { nodes: [], startLocalId: null, warnings: ["START 블록을 찾지 못했어요."] };
  }

  const getChild = (parentId, kind) => {
    const kids = childrenByParent.get(parentId) ?? [];
    if (kids.length === 0) return null;

    // kind: "next" | "true" | "false" | "condition"
    const slot = (b) => b?.parentSlot ?? null;

    if (kind === "true") {
      const cand = kids.find((c) => slotMatches(slot(c), ["true", "then", "t", "1"]));
      return cand ?? null;
    }
    if (kind === "false") {
      const cand = kids.find((c) => slotMatches(slot(c), ["false", "else", "f", "0"]));
      return cand ?? null;
    }
    if (kind === "condition") {
      const cand = kids.find((c) => slotMatches(slot(c), ["cond", "condition"]));
      return cand ?? null;
    }

    // next
    const cand =
      kids.find((c) => slotMatches(slot(c), ["next", "body", "statement", "do"])) ??
      kids.find((c) => c?.parentSlot == null) ??
      kids[0];
    return cand ?? null;
  };

  // local graph links
  const localNextOf = (b) => {
    // blocks에 nextBlockId가 이미 localId로 들어있는 경우 우선
    if (b?.nextBlockId != null) return b.nextBlockId;
    const child = getChild(b.id, "next");
    return child?.id ?? null;
  };

  const localTrueOf = (b) => {
    if (b?.trueBranchId != null) return b.trueBranchId;
    const child = getChild(b.id, "true");
    return child?.id ?? null;
  };

  const localFalseOf = (b) => {
    if (b?.falseBranchId != null) return b.falseBranchId;
    const child = getChild(b.id, "false");
    return child?.id ?? null;
  };

  const localConditionExprOf = (b) => {
    // blocks에 conditionExpression이 있으면 최우선
    if (b?.conditionExpression) return b.conditionExpression;
    // condition 슬롯에 들어간 블록 텍스트를 조건식으로 쓰는 fallback
    const condChild = getChild(b.id, "condition");
    const t = (condChild?.text ?? "").toString().trim();
    if (t) return t;
    // 최후 fallback
    return "true";
  };

  // reachable 노드 모으기(START에서 출발)
  const visited = new Set();
  const stack = [start.id];
  while (stack.length) {
    const id = stack.pop();
    if (id == null || visited.has(id) || !byId.has(id)) continue;
    visited.add(id);

    const b = byId.get(id);
    const type = inferBlockType(b);

    if (type === "IF") {
      const t = localTrueOf(b);
      const f = localFalseOf(b);
      if (t != null) stack.push(t);
      if (f != null) stack.push(f);
      // IF도 다음 블록이 있을 수 있으면(프로젝트 구현에 따라) 이어지도록
      const n = localNextOf(b);
      if (n != null) stack.push(n);
    } else if (type === "WHILE") {
      const t = localTrueOf(b);
      const n = localNextOf(b);
      if (t != null) stack.push(t);
      if (n != null) stack.push(n);
    } else {
      const n = localNextOf(b);
      if (n != null) stack.push(n);
    }
  }

  // order는 화면 y 기준으로 안정적으로 부여
  const reachableBlocks = [...visited]
    .map((id) => byId.get(id))
    .filter(Boolean)
    .sort((a, b) => safeNum(a.y) - safeNum(b.y) || safeNum(a.x) - safeNum(b.x));

  const orderMap = new Map();
  reachableBlocks.forEach((b, idx) => orderMap.set(b.id, idx + 1));

  const nodes = reachableBlocks.map((b) => {
    const type = inferBlockType(b);

    const base = {
      localId: b.id,
      blockType: type,
      positionX: safeNum(b.x),
      positionY: safeNum(b.y),
      order: orderMap.get(b.id) ?? 1,

      // local link (서버 id로 바꾸기 전)
      nextLocalId: null,
      trueLocalId: null,
      falseLocalId: null,
    };

    if (type === "START") {
      base.nextLocalId = localNextOf(b);
      return base;
    }

    if (type === "IF") {
      base.conditionExpression = localConditionExprOf(b);
      base.trueLocalId = localTrueOf(b);
      base.falseLocalId = localFalseOf(b);
      return base;
    }

    if (type === "WHILE") {
      base.conditionExpression = localConditionExprOf(b);
      base.trueLocalId = localTrueOf(b);
      base.nextLocalId = localNextOf(b);
      return base;
    }

    if (type === "VAR_DECLARE") {
      // 가능하면 editor/store에서 variableName, initialValue를 넣어주는 게 정답
      base.variableName = b.variableName ?? "x";
      base.initialValue = b.initialValue ?? "0";
      base.nextLocalId = localNextOf(b);
      return base;
    }

    if (type === "VAR_ASSIGN") {
      base.variableName = b.variableName ?? "x";
      base.valueExpression = b.valueExpression ?? "0";
      base.nextLocalId = localNextOf(b);
      return base;
    }

    if (type === "PRINT") {
      base.message = b.message ?? b.text ?? "";
      base.nextLocalId = localNextOf(b);
      return base;
    }

    // 산술 등 기타: 프로젝트 스펙에 맞는 필드를 store에서 제공하면 여기에 그대로 태우면 됨
    base.message = b.message ?? b.text ?? `[${type}]`;
    base.nextLocalId = localNextOf(b);
    return base;
  });

  const warnings = [];
  // IF인데 true/false가 다 비어있으면 경고
  for (const n of nodes) {
    if (n.blockType === "IF" && n.trueLocalId == null && n.falseLocalId == null) {
      warnings.push(`IF 블록(localId=${n.localId})에 true/false branch 연결이 안 잡혔어요.`);
    }
    if (n.blockType === "START" && n.nextLocalId == null) {
      warnings.push(`START 블록 다음(next)이 null이라 실행 흐름이 끊길 수 있어요.`);
    }
  }

  return { nodes, startLocalId: start.id, warnings };
}

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

export function RunPane({ blocks = [] }) {
  const [logs, setLogs] = useState([]);
  const isRunningRef = useRef(false);

  const pushLog = (message) => {
    setLogs((prev) => [...prev, { id: Date.now() + Math.random(), message }]);
  };

  const compiled = useMemo(() => compileToBackendNodes(blocks), [blocks]);

  const resetConsole = () => {
    setLogs([]);
  };

  const handleRun = async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    try {
      resetConsole();

      pushLog("블록을 백엔드 형식으로 변환합니다...");
      const { nodes, warnings } = compiled;

      if (!nodes.length) {
        pushLog("❌ 변환된 statement가 0개입니다. START 블록/연결을 확인하세요.");
        return;
      }

      pushLog(`✅ 컴파일 완료: statement ${nodes.length}개`);
      warnings.forEach((w) => pushLog(`⚠️ ${w}`));

      // 1) 생성(POST) - 링크는 일단 null로
      pushLog(`서버에 블록을 생성합니다... (project=${PROJECT_ID})`);
      const localToServerId = new Map();

      for (const n of nodes) {
        const createBody = {
          blockType: n.blockType,
          positionX: n.positionX,
          positionY: n.positionY,
          order: n.order,
        };

        // 타입별 필드
        if (n.blockType === "START") {
          createBody.nextBlockId = null;
        } else if (n.blockType === "IF") {
          createBody.conditionExpression = n.conditionExpression ?? "true";
          createBody.trueBranchId = null;
          createBody.falseBranchId = null;
        } else if (n.blockType === "WHILE") {
          createBody.conditionExpression = n.conditionExpression ?? "true";
          createBody.trueBranchId = null;
          createBody.nextBlockId = null;
        } else if (n.blockType === "VAR_DECLARE") {
          createBody.variableName = n.variableName ?? "x";
          createBody.initialValue = String(n.initialValue ?? "0");
          createBody.nextBlockId = null;
        } else if (n.blockType === "VAR_ASSIGN") {
          createBody.variableName = n.variableName ?? "x";
          createBody.valueExpression = String(n.valueExpression ?? "0");
          createBody.nextBlockId = null;
        } else if (n.blockType === "PRINT") {
          createBody.message = String(n.message ?? "");
          createBody.nextBlockId = null;
        } else {
          // 기타 타입 fallback
          createBody.message = String(n.message ?? "");
          createBody.nextBlockId = null;
        }

        const created = await fetchJson(
          `${API_ROOT}/api/blocks/project/${PROJECT_ID}`,
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
      }

      pushLog("✅ 블록 생성 완료. 연결 정보를 업데이트합니다...");

      // 2) 연결(PUT)
      for (const n of nodes) {
        const serverId = localToServerId.get(n.localId);
        if (serverId == null) continue;

        const updateBody = { blockType: n.blockType };

        if (n.blockType === "START") {
          updateBody.nextBlockId =
            n.nextLocalId != null ? localToServerId.get(n.nextLocalId) ?? null : null;
        } else if (n.blockType === "IF") {
          updateBody.conditionExpression = n.conditionExpression ?? "true";
          updateBody.trueBranchId =
            n.trueLocalId != null ? localToServerId.get(n.trueLocalId) ?? null : null;
          updateBody.falseBranchId =
            n.falseLocalId != null ? localToServerId.get(n.falseLocalId) ?? null : null;
        } else if (n.blockType === "WHILE") {
          updateBody.conditionExpression = n.conditionExpression ?? "true";
          updateBody.trueBranchId =
            n.trueLocalId != null ? localToServerId.get(n.trueLocalId) ?? null : null;
          updateBody.nextBlockId =
            n.nextLocalId != null ? localToServerId.get(n.nextLocalId) ?? null : null;
        } else if (n.blockType === "VAR_DECLARE") {
          updateBody.variableName = n.variableName ?? "x";
          updateBody.initialValue = String(n.initialValue ?? "0");
          updateBody.nextBlockId =
            n.nextLocalId != null ? localToServerId.get(n.nextLocalId) ?? null : null;
        } else if (n.blockType === "VAR_ASSIGN") {
          updateBody.variableName = n.variableName ?? "x";
          updateBody.valueExpression = String(n.valueExpression ?? "0");
          updateBody.nextBlockId =
            n.nextLocalId != null ? localToServerId.get(n.nextLocalId) ?? null : null;
        } else if (n.blockType === "PRINT") {
          updateBody.message = String(n.message ?? "");
          updateBody.nextBlockId =
            n.nextLocalId != null ? localToServerId.get(n.nextLocalId) ?? null : null;
        } else {
          updateBody.nextBlockId =
            n.nextLocalId != null ? localToServerId.get(n.nextLocalId) ?? null : null;
        }

        await fetchJson(`${API_ROOT}/api/blocks/${serverId}`, {
          method: "PUT",
          body: JSON.stringify(updateBody),
        });
      }

      pushLog("✅ 연결 업데이트 완료. 프로젝트 실행을 요청합니다...");

      // 3) 실행
      const runRes = await fetchJson(
        `${API_ROOT}/api/execution/projects/${PROJECT_ID}/run`,
        { method: "POST" }
      );

      const sessionId = runRes?.sessionId;
      const message = runRes?.message;

      if (message) pushLog(`▶ ${message}`);
      if (sessionId) pushLog(`sessionId = ${sessionId}`);

      pushLog("ℹ️ 실시간 출력(WebSocket)은 별도 구독이 필요합니다. (SockJS/STOMP)");
    } catch (err) {
      // 네 캡처처럼 net::ERR_CONNECTION_REFUSED면 여기로 떨어짐
      pushLog(`❌ 오류: ${err?.message ?? String(err)}`);
      pushLog("서버가 켜져있는지(기본: http://localhost:8080) / 포트가 맞는지 확인해봐.");
    } finally {
      isRunningRef.current = false;
    }
  };

  const handleStep = async () => {
    // README에는 "step 실행" API가 따로 명시되어 있지 않아서,
    // 일단 버튼이 있어도 동작을 막지 않게 로그만 남김.
    pushLog("한 단계 실행은 백엔드에 별도 step API가 있어야 구현 가능해요.");
  };

  const handleReset = () => {
    resetConsole();
    pushLog("초기화 완료");
  };

  return (
  <div className="run-root">
    <RunControls onRun={handleRun} onStep={handleStep} onReset={handleReset} />
    <ConsoleOutput logs={logs} />
  </div>
);
}
