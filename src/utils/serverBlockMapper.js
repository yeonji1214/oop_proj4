import { applyTypeDefaults } from "./blockTypes";

const normalizeId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : v ?? null;
};

const pickId = (dto, keys = []) => {
  for (const k of keys) {
    if (dto?.[k] != null) return normalizeId(dto[k]);
  }
  return null;
};

const isBooleanOperator = (op = "") =>
  ["<=", ">=", "==", "!=", "&&", "||", "<", ">"].includes(op);

const displayOp = (op = "") => {
  if (op === "&&") return "그리고";
  if (op === "||") return "또는";
  return op || "==";
};

const valueDtoToText = (dto) => {
  if (!dto) return "";
  const type = (dto.valueType ?? "").toUpperCase();
  if (type === "LITERAL") {
    return dto.data != null ? String(dto.data) : "";
  }
  if (type === "VARIABLE") {
    return dto.variableName ?? "";
  }
  if (type === "UNARY") {
    return `${dto.operator ?? "!"}${valueDtoToText(dto.operand)}`;
  }
  if (type === "BINARY") {
    const left = valueDtoToText(dto.left);
    const right = valueDtoToText(dto.right);
    return [left, displayOp(dto.operator), right].filter(Boolean).join(" ");
  }
  return "";
};

const createValueMapper = (startVirtualId = -1) => {
  let virtualId = Number.isFinite(startVirtualId) ? startVirtualId : -1;

  const mapValueDto = (dto, parentId, parentSlot) => {
    if (!dto) return [];
    const type = (dto.valueType ?? "").toUpperCase();
    const id = virtualId--;
    const expressionId = normalizeId(dto.blockId ?? dto.id ?? null);
    const parent = normalizeId(parentId);
    const posX = dto.positionX ?? 0;
    const posY = dto.positionY ?? 0;

    if (type === "LITERAL") {
      const data = dto.data;
      const isBool = typeof data === "boolean";
      const isNum = typeof data === "number";
      const isNumericString =
        typeof data === "string" && data.trim() !== "" && Number.isFinite(Number(data));
      const shape = isBool ? "boolean" : isNum || isNumericString ? "value-input" : "value-string";
      const color = isBool ? "#5CB1D6" : isNum || isNumericString ? "#4CBFE6" : "#E91E63";
      return [
        {
          id,
          blockType: "VALUE",
          text: data != null ? String(data) : "",
          shape,
          color,
          x: posX,
          y: posY,
          order: 0,
          parentId: parent,
          parentSlot,
          expressionId,
        },
      ];
    }

    if (type === "VARIABLE") {
      return [
        {
          id,
          blockType: "VALUE",
          text: dto.variableName ?? "변수",
          shape: "value-pill",
          color: "#FF8C1A",
          selectedVar: dto.variableName,
          variableName: dto.variableName,
          variableId: dto.variableId ?? null,
          x: posX,
          y: posY,
          order: 0,
          parentId: parent,
          parentSlot,
          expressionId,
        },
      ];
    }

    if (type === "UNARY") {
      const node = {
        id,
        blockType: "VALUE",
        text: dto.operator ?? "!",
        shape: "boolean-not",
        color: "#5CB1D6",
        x: posX,
        y: posY,
        order: 0,
        parentId: parent,
        parentSlot,
        expressionId,
      };
      const children = mapValueDto(dto.operand, id, "condition");
      return [node, ...children];
    }

    if (type === "BINARY") {
      const op = dto.operator ?? "==";
      const booleanOp = isBooleanOperator(op);
      const node = {
        id,
        blockType: "VALUE",
        text: displayOp(op),
        shape: booleanOp ? "boolean-binary" : "value-operator-2slot",
        color: booleanOp ? "#5CB1D6" : "#4CBFE6",
        x: posX,
        y: posY,
        order: 0,
        parentId: parent,
        parentSlot,
        expressionId,
      };
      const leftBlocks = mapValueDto(dto.left, id, "left");
      const rightBlocks = mapValueDto(dto.right, id, "right");
      return [node, ...leftBlocks, ...rightBlocks];
    }

    return [];
  };

  return {
    mapValueDto,
    getNextVirtualId: () => virtualId,
  };
};

// 서버 DTO 목록 -> 에디터에서 쓰는 로컬 블록 리스트로 변환
// UI는 건드리지 않고 데이터 필드/명칭을 백엔드 스펙과 맞춘다.
export function mapServerBlocksToClient(serverBlocks = [], options = {}) {
  if (!Array.isArray(serverBlocks)) return { blocks: [], nextVirtualId: -1 };

  const startVirtualId =
    typeof options === "number"
      ? options
      : typeof options?.startVirtualId === "number"
        ? options.startVirtualId
        : -1;
  const { mapValueDto, getNextVirtualId } = createValueMapper(startVirtualId);

  const locals = serverBlocks.map((dto) => {
    const serverId = pickId(dto, ["id", "blockId"]);
    const base = applyTypeDefaults({
      id: serverId,
      blockType: dto.blockType,
      text: undefined,
      x: dto.positionX ?? 0,
      y: dto.positionY ?? 0,
      order: dto.order ?? 0,
      message: valueDtoToText(dto.message),
      messageValue: dto.message,
      conditionExpression: valueDtoToText(dto.condition),
      condition: dto.condition,
      variableName: dto.variableName,
      initialValue: valueDtoToText(dto.initial),
      initial: dto.initial,
      variableType: dto.variableType,
      variableId: dto.variableId ?? null,
      valueExpression: valueDtoToText(dto.value),
      value: dto.value,
      operand1: valueDtoToText(dto.operand1),
      operand1Value: dto.operand1,
      operand2: valueDtoToText(dto.operand2),
      operand2Value: dto.operand2,
      resultVariable: dto.resultVariable,
      resultVariableId: dto.resultVariableId ?? null,
      initExpression: valueDtoToText(dto.init),
      init: dto.init,
      incrementExpression: valueDtoToText(dto.increment),
      increment: dto.increment,
      shapeType: dto.shape ?? dto.shapeType,
      drawColor: dto.color,
      size: dto.size,
      parentId: null,
      parentSlot: null,
    });

    // 팔레트 양식 강제
    if (dto.blockType === "VAR_DECLARE") {
      base.shape = "variable-set";
      base.text = "변수 선언";
      base.subText = "=";
      base.selectedVar = dto.variableName ?? "변수";
    } else if (dto.blockType === "VAR_ASSIGN") {
      base.shape = "variable-set";
      base.text = "값 넣기";
      base.subText = "=";
      base.selectedVar = dto.variableName ?? "변수";
    }

    return base;
  });

  const localMap = new Map(locals.map((b) => [b.id, b]));

  const setParent = (childId, parentId, slot) => {
    const childKey = normalizeId(childId);
    if (childKey == null) return;
    const child = localMap.get(childKey);
    if (!child) return;
    child.parentId = normalizeId(parentId);
    child.parentSlot = slot;
  };

  const valueBlocks = [];
  const attachValue = (dto, parentId, parentSlot) => {
    mapValueDto(dto, parentId, parentSlot)
      .map(applyTypeDefaults)
      .forEach((b) => valueBlocks.push(b));
  };

  serverBlocks.forEach((dto) => {
    const serverId = pickId(dto, ["id", "blockId"]);
    const nextId = pickId(dto, ["nextBlockId", "nextId", "next"]);
    const trueId = pickId(dto, ["trueBranchId", "trueBranch", "trueBlockId"]);
    const falseId = pickId(dto, ["falseBranchId", "falseBranch", "falseBlockId"]);

    setParent(nextId, serverId, "next");

    if (dto.blockType === "IF") {
      // falseBranchId 존재 여부로 shape 자동 결정
      const hasElse = pickId(dto, ["falseBranchId", "falseBranch", "falseBlockId"]) != null;
      const local = localMap.get(serverId);
      if (local) {
        local.shape = hasElse ? "command-if-else" : "command-if";
      }
      setParent(trueId, serverId, "subStack1");
      if (hasElse) {
        setParent(falseId, serverId, "subStack2");
      }
      attachValue(dto.condition, serverId, "condition");
    } else if (dto.blockType === "WHILE") {
      setParent(trueId, serverId, "subStack1");
      attachValue(dto.condition, serverId, "condition");
    } else if (dto.blockType === "FOR") {
      setParent(trueId, serverId, "subStack1");
      attachValue(dto.condition, serverId, "times");
      attachValue(dto.init, serverId, "init");
      attachValue(dto.increment, serverId, "increment");
    }

    if (dto.blockType === "PRINT") {
      attachValue(dto.message, serverId, "value");
    }

    if (dto.blockType === "VAR_ASSIGN") {
      attachValue(dto.value, serverId, "value");
      const local = localMap.get(serverId);
      if (local) {
        local.selectedVar = dto.variableName ?? local.variableName;
        local.text = "값 넣기";
        local.subText = "=";
      }
    }

    if (dto.blockType === "VAR_DECLARE") {
      attachValue(dto.initial, serverId, "value");
      const local = localMap.get(serverId);
      if (local) {
        local.selectedVar = dto.variableName ?? local.variableName;
        local.text = "변수 선언";
        local.subText = "=";
      }
    }


  });

  // order 기반 next 연결 보정: parent가 비어 있고 statement인 루트들을 순서대로 체인
  const roots = locals.filter((b) => b.parentId == null && b.blockType !== "START");
  const sortedRoots = [...roots].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (let i = 0; i < sortedRoots.length - 1; i += 1) {
    const cur = sortedRoots[i];
    const nxt = sortedRoots[i + 1];
    if (cur && nxt && nxt.parentId == null) {
      nxt.parentId = cur.id;
      nxt.parentSlot = "next";
    }
  }

  const blocks = [...locals.map(applyTypeDefaults), ...valueBlocks.map(applyTypeDefaults)];
  return { blocks, nextVirtualId: getNextVirtualId() };
}

export function mapServerExpressionsToBlocks(expressions = [], options = {}) {
  if (!Array.isArray(expressions)) return { blocks: [], nextVirtualId: -1 };

  const startVirtualId =
    typeof options === "number"
      ? options
      : typeof options?.startVirtualId === "number"
        ? options.startVirtualId
        : -1;

  const { mapValueDto, getNextVirtualId } = createValueMapper(startVirtualId);
  const valueBlocks = [];

  expressions.forEach((expr) => {
    mapValueDto(expr, null, null)
      .map(applyTypeDefaults)
      .forEach((b) => valueBlocks.push(b));
  });

  return { blocks: valueBlocks, nextVirtualId: getNextVirtualId() };
}
