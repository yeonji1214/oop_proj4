import { API_ROOT, PROJECT_ID } from "../config";
import { compileBlocks, buildValueDto } from "./blockCompiler";
import { buildCreatePayload, buildUpdatePayload } from "./blockApiMapper";
import { VALUE_SHAPES } from "./blockTypes";

// 동기화 중 생성된 serverId를 기억해서 PUT/링크에 활용
const localToServerId = new Map();
let lastSyncSignature = "";
let inFlightSignature = "";
let queuedSync = null;
const lastSyncedState = new Map(); // serverId -> snapshot of last PUT payload
const variableIdByName = new Map();
const variableIdByLocalId = new Map();
const localValueToServerId = new Map();
let currentProjectId = PROJECT_ID;

export function setProjectId(id) {
  const num = Number(id);
  currentProjectId = Number.isFinite(num) ? num : PROJECT_ID;
}

let partialLastSignature = "";
let partialInFlightSignature = "";
let partialQueued = null;

const normalizeValue = (dto) => {
  if (!dto || typeof dto !== "object") return null;
  const result = {};
  const exprId = dto.blockId ?? dto.expressionId;
  if (exprId != null) result.blockId = exprId;
  if (dto.localId != null) result.localId = dto.localId;
  if (dto.valueType) result.valueType = dto.valueType;
  if (dto.data !== undefined) result.data = dto.data;
  if (dto.variableName) result.variableName = dto.variableName;
  if (dto.variableId) result.variableId = dto.variableId;
  if (dto.operator) result.operator = dto.operator;
  if (dto.positionX !== undefined) result.positionX = dto.positionX;
  if (dto.positionY !== undefined) result.positionY = dto.positionY;
  if (dto.operand) {
    const op = normalizeValue(dto.operand);
    if (op) result.operand = op;
  }
  if (dto.left) {
    const left = normalizeValue(dto.left);
    if (left) result.left = left;
  }
  if (dto.right) {
    const right = normalizeValue(dto.right);
    if (right) result.right = right;
  }
  return result.valueType || result.blockId ? result : null;
};

const normalizeValueForSignature = (dto) => {
  const base = normalizeValue(dto);
  if (!base) return null;
  return {
    ...base,
    localId: dto?.localId ?? base.localId ?? null,
  };
};

export function registerServerBlocks(blockDtos = []) {
  if (!Array.isArray(blockDtos)) return;
  variableIdByName.clear();
  variableIdByLocalId.clear();
  localValueToServerId.clear();
  blockDtos.forEach((b) => {
    const id = Number(b?.id ?? b?.blockId);
    if (!Number.isFinite(id)) return;
    localToServerId.set(id, id);
    if (b.blockType === "VAR_DECLARE" && b.variableName && b.variableId != null) {
      variableIdByName.set(b.variableName, b.variableId);
      variableIdByLocalId.set(id, b.variableId);
    }
  });
  lastSyncSignature = "";
}

export async function deleteServerBlocks(localIds = [], logger = () => { }) {
  const log = (msg) => {
    try {
      logger(msg);
    } catch {
      // noop
    }
  };
  const ids = (localIds ?? []).filter((v) => v != null);
  console.log("[deleteServerBlocks] 삭제 요청 localIds:", ids);
  console.log("[deleteServerBlocks] localToServerId 맵:", Object.fromEntries(localToServerId));

  if (!ids.length) {
    console.log("[deleteServerBlocks] 삭제할 ID가 없습니다");
    return;
  }

  for (const localId of ids) {
    const serverId =
      localToServerId.get(Number(localId)) ?? localToServerId.get(localId);
    console.log(`[deleteServerBlocks] localId=${localId} -> serverId=${serverId}`);
    if (serverId == null) {
      console.log(`[deleteServerBlocks] serverId가 없어 삭제 건너뜀: localId=${localId}`);
      continue;
    }
    try {
      await fetchJson(`${API_ROOT}/api/blocks/${serverId}`, { method: "DELETE" });
      localToServerId.delete(Number(localId));
      localToServerId.delete(localId);
      lastSyncedState.delete(serverId);
      log(`DELETE 완료: localId=${localId} (serverId=${serverId})`);
      console.log(`[deleteServerBlocks] DELETE 성공: localId=${localId}, serverId=${serverId}`);
    } catch (err) {
      console.error(`[deleteServerBlocks] DELETE 실패: localId=${localId}, serverId=${serverId}`, err);
    }
  }
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

const attachVariableIdToValue = (dto) => {
  if (!dto || typeof dto !== "object") return dto;
  const next = { ...dto };
  if (
    next.valueType &&
    next.valueType.toUpperCase() === "VARIABLE" &&
    next.variableId == null &&
    next.variableName
  ) {
    const mapped = variableIdByName.get(next.variableName);
    if (mapped != null) next.variableId = mapped;
  }
  if (next.operand) next.operand = attachVariableIdToValue(next.operand);
  if (next.left) next.left = attachVariableIdToValue(next.left);
  if (next.right) next.right = attachVariableIdToValue(next.right);
  return next;
};

const attachVariableIdsToNode = (node) => {
  if (!node) return node;
  const mappedNode = { ...node };
  if (mappedNode.variableId == null && mappedNode.variableName) {
    const mapped = variableIdByName.get(mappedNode.variableName);
    if (mapped != null) mappedNode.variableId = mapped;
  }
  if (mappedNode.resultVariableId == null && mappedNode.resultVariable) {
    const mapped = variableIdByName.get(mappedNode.resultVariable);
    if (mapped != null) mappedNode.resultVariableId = mapped;
  }
  mappedNode.condition = attachVariableIdToValue(mappedNode.condition);
  mappedNode.initial = attachVariableIdToValue(mappedNode.initial);
  mappedNode.value = attachVariableIdToValue(mappedNode.value);
  mappedNode.message = attachVariableIdToValue(mappedNode.message);
  mappedNode.init = attachVariableIdToValue(mappedNode.init);
  mappedNode.increment = attachVariableIdToValue(mappedNode.increment);
  mappedNode.operand1 = attachVariableIdToValue(mappedNode.operand1);
  mappedNode.operand2 = attachVariableIdToValue(mappedNode.operand2);
  return mappedNode;
};

const isValueShape = (shape) =>
  ["value-pill", "value-operator-2slot", "value-input", "value-string", "boolean", "boolean-binary", "boolean-not"].includes(
    (shape ?? "").toString()
  );

export function registerServerExpressions(valueBlocks = []) {
  if (!Array.isArray(valueBlocks)) return;
  valueBlocks
    .filter((b) => isValueShape(b.shape) && (b.parentId == null || b.parentSlot == null))
    .forEach((b) => {
      const exprId = b.expressionId ?? b.expressionBlockId ?? b.id;
      if (exprId != null && b.id != null) {
        localValueToServerId.set(b.id, exprId);
      }
    });
}

/**
 * Expression(value) 블록 삭제
 */
export async function deleteServerExpressions(localIds = [], logger = () => { }) {
  const log = (msg) => {
    try {
      logger(msg);
    } catch {
      // noop
    }
  };
  const ids = (localIds ?? []).filter((v) => v != null);
  console.log("[deleteServerExpressions] 삭제 요청 localIds:", ids);
  console.log("[deleteServerExpressions] localValueToServerId 맵:", Object.fromEntries(localValueToServerId));

  if (!ids.length) {
    console.log("[deleteServerExpressions] 삭제할 ID가 없습니다");
    return;
  }

  for (const localId of ids) {
    const expressionId =
      localValueToServerId.get(Number(localId)) ?? localValueToServerId.get(localId);
    console.log(`[deleteServerExpressions] localId=${localId} -> expressionId=${expressionId}`);
    if (expressionId == null) {
      console.log(`[deleteServerExpressions] expressionId가 없어 삭제 건너뜀: localId=${localId}`);
      continue;
    }
    try {
      await fetchJson(`${API_ROOT}/api/expressions/${expressionId}`, { method: "DELETE" });
      localValueToServerId.delete(Number(localId));
      localValueToServerId.delete(localId);
      log(`Expression DELETE 완료: localId=${localId} (expressionId=${expressionId})`);
      console.log(`[deleteServerExpressions] DELETE 성공: localId=${localId}, expressionId=${expressionId}`);
    } catch (err) {
      console.error(`[deleteServerExpressions] DELETE 실패: localId=${localId}, expressionId=${expressionId}`, err);
    }
  }
}

async function syncValueExpressions(blocks = [], logger = () => { }) {
  const log = (msg) => {
    try {
      logger(msg);
    } catch {
      // noop
    }
  };
  const roots = (blocks ?? []).filter(
    (b) => isValueShape(b.shape) && (b.parentId == null || b.parentSlot == null)
  );
  for (const root of roots) {
    if (localValueToServerId.has(root.id)) continue;
    const dto = buildValueDto(root, blocks);
    if (!dto) continue;
    try {
      const created = await fetchJson(
        `${API_ROOT}/api/expressions/project/${currentProjectId}`,
        {
          method: "POST",
          body: JSON.stringify(dto),
        }
      );
      const exprId = created?.blockId ?? created?.id ?? created?.data?.blockId ?? created?.data?.id;
      if (exprId != null) {
        localValueToServerId.set(root.id, exprId);
        log(`값 표현식 생성: localId=${root.id} -> expressionId=${exprId}`);
      }
    } catch (err) {
      log(`값 표현식 생성 실패(localId=${root.id}): ${err?.message ?? err}`);
    }
  }
}

/**
 * 블록 리스트 전체를 백엔드 상태로 동기화
 * - 기존 블록 삭제 후 새로 생성/연결 (실행은 하지 않음)
 * - logger(optional): (msg) => void
 */
export async function syncProjectBlocks(blocks, logger = () => { }) {
  const log = (msg) => {
    try {
      logger(msg);
    } catch {
      // noop
    }
  };

  const normalizeId = (v) => {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
    return v ?? null;
  };

  await syncValueExpressions(blocks, log);

  const { nodes: rawNodes, warnings } = compileBlocks(blocks);
  const forceRefresh = (blocks ?? []).some((b) =>
    ["value-pill", "value-operator-2slot", "value-input", "value-string", "boolean", "boolean-binary", "boolean-not"].includes(
      (b?.shape ?? "").toString()
    )
  );
  let nodes = rawNodes.map((n) => ({
    ...n,
    localId: normalizeId(n.localId) ?? n.localId,
    nextLocalId: normalizeId(n.nextLocalId) ?? n.nextLocalId,
    trueLocalId: normalizeId(n.trueLocalId) ?? n.trueLocalId,
    falseLocalId: normalizeId(n.falseLocalId) ?? n.falseLocalId,
  })).map(attachVariableIdsToNode);
  const signature = JSON.stringify(
    [...nodes]
      .map((n) => ({
        localId: n.localId,
        blockType: n.blockType,
        positionX: n.positionX,
        positionY: n.positionY,
        order: n.order,
        next: n.nextLocalId ?? null,
        trueBranch: n.trueLocalId ?? null,
        falseBranch: n.falseLocalId ?? null,
        condition: normalizeValueForSignature(n.condition) ?? null,
        init: normalizeValueForSignature(n.init) ?? null,
        increment: normalizeValueForSignature(n.increment) ?? null,
        variableName: n.variableName ?? null,
        variableType: n.variableType ?? null,
        variableId: n.variableId ?? null,
        initial: normalizeValueForSignature(n.initial) ?? null,
        value: normalizeValueForSignature(n.value) ?? null,
        message: normalizeValueForSignature(n.message) ?? null,
        operand1: normalizeValueForSignature(n.operand1) ?? null,
        operand2: normalizeValueForSignature(n.operand2) ?? null,
        resultVariable: n.resultVariable ?? null,
        resultVariableId: n.resultVariableId ?? null,
      }))
      .sort((a, b) => {
        const aId = a.localId ?? 0;
        const bId = b.localId ?? 0;
        if (aId === bId) return 0;
        return aId > bId ? 1 : -1;
      })
  );

  // 같은 상태에 대한 중복 호출 방지 (단, 값 블록만 변경된 경우 강제 리프레시 가능)
  if (!forceRefresh && (signature === lastSyncSignature || signature === inFlightSignature)) {
    return;
  }

  // 다른 상태가 이미 동기화 중이면 최신 상태만 큐에 저장
  if (inFlightSignature && signature !== inFlightSignature) {
    queuedSync = { blocks, logger };
    return;
  }

  inFlightSignature = signature;

  const currentLocalIds = new Set(nodes.map((n) => Number(n.localId)));
  const staleEntries = [];
  for (const [localId, serverId] of localToServerId.entries()) {
    if (!currentLocalIds.has(localId)) {
      staleEntries.push({ localId, serverId });
    }
  }

  let nextSync = null;
  try {
    if (staleEntries.length) {
      log(`서버 블록 ${staleEntries.length}개 삭제...`);
      for (const { localId, serverId } of staleEntries) {
        if (serverId == null) continue;
        await fetchJson(`${API_ROOT}/api/blocks/${serverId}`, { method: "DELETE" });
        localToServerId.delete(Number(localId));
        lastSyncedState.delete(serverId);
      }
    }

    if (!nodes.length) {
      log("동기화 중단: 동기화할 statement가 없습니다.");
      lastSyncSignature = signature;
      return;
    }
    warnings.forEach((w) => log(`⚠️ ${w}`));

    log(`블록 생성(신규)/수정(기존) 시작... project=${currentProjectId}`);

    // 1) serverId 없는 노드만 POST
    const newNodes = nodes.filter((n) => !localToServerId.has(Number(n.localId)));
    for (const n of newNodes) {
      const body = buildCreatePayload(n);

      const created = await fetchJson(
        `${API_ROOT}/api/blocks/project/${currentProjectId}`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );

      const serverId = Number(created?.id ?? created?.blockId ?? created?.data?.id);
      if (!Number.isFinite(serverId)) {
        throw new Error("블록 생성 응답에서 id를 찾지 못했습니다.");
      }
      localToServerId.set(Number(n.localId), serverId);
      if (n.blockType === "VAR_DECLARE") {
        const varId = created?.variableId ?? created?.data?.variableId;
        if (varId != null) {
          variableIdByName.set(n.variableName, varId);
          variableIdByLocalId.set(n.localId, varId);
          n.variableId = varId;
        }
      }
      log(`POST 완료: localId=${n.localId} -> serverId=${serverId} (${n.blockType})`);
    }

    nodes = nodes.map(attachVariableIdsToNode);

    log("연결/위치 정보 갱신(PUT)...");
    const resolveServerId = (localId) => {
      if (localId == null) return null;
      const mapped =
        localToServerId.get(Number(localId)) ?? localToServerId.get(localId);
      if (mapped != null) return mapped;
      log(`경고: serverId 매핑을 찾지 못해 null로 대체 (localId=${localId})`);
      return null;
    };

    for (const n of nodes) {
      const serverId =
        localToServerId.get(Number(n.localId)) ?? localToServerId.get(n.localId);
      if (serverId == null) continue;

      const updateBody = buildUpdatePayload(n, resolveServerId);

      await fetchJson(`${API_ROOT}/api/blocks/${serverId}`, {
        method: "PUT",
        body: JSON.stringify(updateBody),
      });

      lastSyncedState.set(serverId, updateBody);
      log(`PUT 완료: serverId=${serverId} (${n.blockType})`);
    }

    lastSyncSignature = signature;
    log("동기화 완료");
  } finally {
    // 실패/성공 모두 플래그 해제하여 다음 요청이 막히지 않게 한다.
    inFlightSignature = "";

    // 동기화 도중 새롭게 큐에 쌓인 요청이 있으면 마지막 것만 수행
    if (queuedSync) {
      nextSync = queuedSync;
      queuedSync = null;
    }
  }

  if (nextSync) {
    return syncProjectBlocks(nextSync.blocks, nextSync.logger);
  }
}

/**
 * 부분 동기화: 특정 블록만 생성/수정
 * - targetLocalIds: 변경되거나 연결 변화가 생긴 블록 localId 배열
 */
export async function syncPartialBlocks(
  blocks,
  targetLocalIds = [],
  logger = () => { },
  options = {}
) {
  const log = (msg) => {
    try {
      logger(msg);
    } catch {
      // noop
    }
  };

  const ids = (targetLocalIds ?? []).filter((v) => v != null);
  if (!Array.isArray(blocks) || !ids.length) return;

  // 값/표현식 블록이 변경 대상에 포함되면 시그니처 캐시를 비워 강제 동기화
  const isValueShape = (shape) =>
    ["value-pill", "value-operator-2slot", "value-input", "value-string", "boolean", "boolean-binary", "boolean-not"].includes(
      (shape ?? "").toString()
    );
  const hasValueTarget = ids.some((id) => {
    const found = blocks.find((b) => b.id === id);
    return found && isValueShape(found.shape);
  });
  if (hasValueTarget) {
    partialLastSignature = "";
    partialInFlightSignature = "";
  }

  await syncValueExpressions(blocks, log);

  const { nodes } = compileBlocks(blocks);
  if (!nodes.length) return;

  const nodeMap = new Map(nodes.map((n) => [n.localId, n]));

  const required = new Set(ids);
  // 연결 대상도 함께 포함 (next/true/false) → serverId 해석을 위해 필요
  ids.forEach((id) => {
    const node = nodeMap.get(id);
    if (!node) return;
    [node.nextLocalId, node.trueLocalId, node.falseLocalId].forEach((ref) => {
      if (ref != null) required.add(ref);
    });
  });

  const requiredNodes = [...required]
    .map((id) => nodeMap.get(id))
    .filter(Boolean);

  const includePosition = options.includePosition !== false;

  const signature = JSON.stringify(
    requiredNodes
      .map((n) => ({
        id: n.localId,
        blockType: n.blockType,
        x: includePosition ? n.positionX : null,
        y: includePosition ? n.positionY : null,
        order: n.order,
        next: n.nextLocalId ?? null,
        trueBranch: n.trueLocalId ?? null,
        falseBranch: n.falseLocalId ?? null,
        condition: normalizeValueForSignature(n.condition) ?? null,
        variableName: n.variableName ?? null,
        variableType: n.variableType ?? null,
        variableId: n.variableId ?? null,
        initial: normalizeValueForSignature(n.initial) ?? null,
        value: normalizeValueForSignature(n.value) ?? null,
        message: normalizeValueForSignature(n.message) ?? null,
        init: normalizeValueForSignature(n.init) ?? null,
        increment: normalizeValueForSignature(n.increment) ?? null,
        operand1: normalizeValueForSignature(n.operand1) ?? null,
        operand2: normalizeValueForSignature(n.operand2) ?? null,
        resultVariable: n.resultVariable ?? null,
        resultVariableId: n.resultVariableId ?? null,
      }))
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
  );

  // 중복/동시 호출 방어
  if (signature === partialLastSignature || signature === partialInFlightSignature) {
    return;
  }
  if (partialInFlightSignature && signature !== partialInFlightSignature) {
    partialQueued = { blocks, targetLocalIds, logger };
    return;
  }
  partialInFlightSignature = signature;

  let nextSync = null;
  try {
    // 1) 아직 서버에 없는 required 노드만 생성
    const newNodes = requiredNodes.filter(
      (n) => !localToServerId.has(Number(n.localId))
    );
    for (const n of newNodes) {
      const body = buildCreatePayload(n);
      const created = await fetchJson(
        `${API_ROOT}/api/blocks/project/${currentProjectId}`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );
      const serverId = Number(created?.id ?? created?.blockId ?? created?.data?.id);
      if (!Number.isFinite(serverId)) {
        throw new Error("블록 생성 응답에서 id를 찾지 못했습니다.");
      }
      localToServerId.set(Number(n.localId), serverId);
      if (n.blockType === "VAR_DECLARE") {
        const varId = created?.variableId ?? created?.data?.variableId;
        if (varId != null) {
          variableIdByName.set(n.variableName, varId);
          variableIdByLocalId.set(n.localId, varId);
          n.variableId = varId;
        }
      }
      log(`(부분) POST 완료: localId=${n.localId} -> serverId=${serverId}`);
    }

    const resolveServerId = (localId) => {
      if (localId == null) return null;
      return (
        localToServerId.get(Number(localId)) ?? localToServerId.get(localId) ?? null
      );
    };

    const nodesWithVars = requiredNodes.map(attachVariableIdsToNode);
    nodesWithVars.forEach((n) => nodeMap.set(n.localId, n));

    // 2) 대상 노드만 PUT
    for (const id of ids) {
      const node = nodeMap.get(id);
      if (!node) continue;
      const serverId = resolveServerId(node.localId);
      if (serverId == null) {
        log(`경고: serverId 매핑이 없어 PUT을 건너뜁니다. localId=${node.localId}`);
        continue;
      }
      const updateBody = buildUpdatePayload(node, resolveServerId, {
        includePosition,
      });
      await fetchJson(`${API_ROOT}/api/blocks/${serverId}`, {
        method: "PUT",
        body: JSON.stringify(updateBody),
      });
      lastSyncedState.set(serverId, updateBody);
      log(`(부분) PUT 완료: serverId=${serverId} (${node.blockType})`);
    }

    partialLastSignature = signature;
  } finally {
    // 실패/성공 모두 플래그 해제하여 다음 요청이 막히지 않게 한다.
    partialInFlightSignature = "";

    if (partialQueued) {
      nextSync = partialQueued;
      partialQueued = null;
    }
  }

  if (nextSync) {
    return syncPartialBlocks(nextSync.blocks, nextSync.targetLocalIds, nextSync.logger);
  }
}
