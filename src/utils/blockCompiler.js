// 공용: 프론트 블록을 백엔드 BlockCreateRequest 형태로 컴파일
import { VALUE_SHAPES, inferTypeFromShape } from "./blockTypes";

const safeNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const valueShapes = VALUE_SHAPES;

const normalizeValueDto = (dto) => {
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
  if (dto.positionX !== undefined) result.positionX = safeNum(dto.positionX);
  if (dto.positionY !== undefined) result.positionY = safeNum(dto.positionY);
  if (dto.operand) {
    const op = normalizeValueDto(dto.operand);
    if (op) result.operand = op;
  }
  if (dto.left) {
    const left = normalizeValueDto(dto.left);
    if (left) result.left = left;
  }
  if (dto.right) {
    const right = normalizeValueDto(dto.right);
    if (right) result.right = right;
  }

  return result.valueType || result.blockId ? result : null;
};

const pickValueDto = (...candidates) => {
  for (const c of candidates) {
    const normalized = normalizeValueDto(c);
    if (normalized) return normalized;
  }
  return null;
};

const stripQuotes = (text = "") => {
  const t = text.toString().trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
};

const asLiteral = (data) => normalizeValueDto({ valueType: "LITERAL", data });
const asVariable = (name, id) =>
  normalizeValueDto({
    valueType: "VARIABLE",
    variableName: name || "var",
    ...(id != null ? { variableId: id } : {}),
  });

const normalizeOperator = (op = "", defaultOp = "+") => {
  const t = op.toString().trim();
  if (!t) return defaultOp;
  if (t === "그리고") return "&&";
  if (t === "또는") return "||";
  if (t === "=") return "==";
  return t;
};

const parseFallbackExpression = (text) => {
  if (text == null) return null;
  const src = text.toString().trim();
  if (!src) return null;

  const lower = src.toLowerCase();
  if (lower === "true") return asLiteral(true);
  if (lower === "false") return asLiteral(false);

  const num = Number(src);
  if (Number.isFinite(num)) return asLiteral(num);

  const operators = ["<=", ">=", "==", "!=", "&&", "||", "+", "-", "*", "/", "%", "^", "<", ">"];
  for (const op of operators) {
    const idx = src.indexOf(op);
    if (idx > 0) {
      const leftText = src.slice(0, idx).trim();
      const rightText = src.slice(idx + op.length).trim();
      if (!leftText || !rightText) continue;
      const left = parseFallbackExpression(leftText) ?? asLiteral(leftText);
      const right = parseFallbackExpression(rightText) ?? asLiteral(rightText);
      return normalizeValueDto({
        valueType: "BINARY",
        operator: normalizeOperator(op, "=="),
        left,
        right,
      });
    }
  }

  // 간단한 식별자는 변수로 취급, 나머지는 문자열 리터럴
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(src)) {
    return asVariable(src);
  }

  return asLiteral(stripQuotes(src));
};

function inferBlockType(b) {
  if (b?.blockType) return b.blockType;

  const typeFromShape = inferTypeFromShape(b?.shape);
  if (typeFromShape) return typeFromShape;

  const shape = (b?.shape ?? "").toString();
  const text = (b?.text ?? "").toString();
  const category = (b?.category ?? "").toString();

  if (shape === "variable-set") {
    return "VAR_ASSIGN";
  }
  if (shape === "command-if" || shape === "command-if-else") return "IF";
  if (shape === "command-while") return "WHILE";
  if (shape === "command-repeat") return "FOR";
  if (shape === "command-print") return "PRINT";
  if (shape === "command-alert") return "ALERT";
  if (shape === "command-draw") return "DRAW";

  if (text.includes("깃발") || text.toLowerCase().includes("start")) return "START";
  if (text.includes("만약") || text.toLowerCase().includes("if")) return "IF";
  if (text.includes("동안") || text.toLowerCase().includes("while")) return "WHILE";
  if (category.includes("출력") || text.toLowerCase().includes("print")) return "PRINT";
  if (category.includes("변수") || text.toLowerCase().includes("var")) return "VAR_DECLARE";

  return "PRINT";
}

function buildChildIndex(blocks) {
  const byParent = new Map();
  for (const b of blocks) {
    const pid = b?.parentId;
    if (pid == null) continue;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(b);
  }
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

const isValueShape = (b) => valueShapes.has(b?.shape);

const findChildBySlot = (blocks = [], parentId, slotNames = []) => {
  const names = slotNames.map((s) => s?.toString().toLowerCase());
  return (
    blocks.find(
      (b) =>
        b?.parentId === parentId &&
        names.includes((b?.parentSlot ?? "").toString().toLowerCase())
    ) ?? null
  );
};

export const buildValueDto = (block, allBlocks = []) => {
  if (!block) return null;
  const shape = (block.shape ?? "").toString();
  const text = (block.text ?? "").toString();
  const childDto = (slots, fallback) =>
    buildValueDto(findChildBySlot(allBlocks, block.id, slots), allBlocks) ?? fallback;
  const addPos = (dto) => {
    if (!dto) return dto;
    return normalizeValueDto({
      ...dto,
      positionX: block.x ?? block.positionX,
      positionY: block.y ?? block.positionY,
      localId: block.id,
    });
  };
  const reuseExpression = (b, builder) => {
    const exprId = b?.expressionId ?? b?.expressionBlockId;
    if (exprId != null) return normalizeValueDto({ blockId: exprId, localId: b.id });
    return builder();
  };

  if (shape === "value-input") {
    return reuseExpression(block, () => {
      const n = Number(text);
      return addPos(asLiteral(Number.isFinite(n) ? n : stripQuotes(text)));
    });
  }
  if (shape === "value-string") {
    return reuseExpression(block, () => addPos(asLiteral(stripQuotes(text))));
  }
  if (shape === "boolean") {
    return reuseExpression(block, () => {
      const lower = text.toLowerCase();
      return addPos(asLiteral(lower === "false" ? false : true));
    });
  }
  if (shape === "value-pill") {
    const name = block.selectedVar ?? block.variableName ?? text;
    return reuseExpression(block, () => addPos(asVariable(name, block.variableId)));
  }
  if (shape === "boolean-not") {
    return reuseExpression(block, () => {
      const operand =
        childDto(["condition", "cond", "value"], asLiteral(false)) ?? asLiteral(false);
      return addPos(
        normalizeValueDto({
          valueType: "UNARY",
          operator: "!",
          operand,
        })
      );
    });
  }
  if (shape === "value-operator-2slot") {
    return reuseExpression(block, () => {
      const left = childDto(["left"], asLiteral(0));
      const right = childDto(["right"], asLiteral(0));
      return addPos(
        normalizeValueDto({
          valueType: "BINARY",
          operator: normalizeOperator(text, "+"),
          left,
          right,
        })
      );
    });
  }
  if (shape === "boolean-binary") {
    return reuseExpression(block, () => {
      const left = childDto(["left"], asLiteral(0));
      const right = childDto(["right"], asLiteral(0));
      return addPos(
        normalizeValueDto({
          valueType: "BINARY",
          operator: normalizeOperator(text, "=="),
          left,
          right,
        })
      );
    });
  }

  if (isValueShape(block)) {
    return reuseExpression(block, () => addPos(asLiteral(stripQuotes(text || "0"))));
  }

  return null;
};

export function compileBlocks(blocks = []) {
  const list = Array.isArray(blocks) ? blocks : [];
  const childrenByParent = buildChildIndex(list);

  const warnings = [];

  const getChildBySlot = (parentId, slots) => {
    const kids = childrenByParent.get(parentId) ?? [];
    if (kids.length === 0) return null;
    return (
      kids.find((c) => slotMatches(c?.parentSlot ?? null, slots)) ??
      kids.find((c) => slotMatches((c?.parentSlot ?? "").toString(), slots)) ??
      null
    );
  };

  // UI 값 블록 -> ValueDto 변환
  const toValueDto = (block) => {
    if (!block) return null;
    const shape = (block.shape ?? "").toString();
    const text = (block.text ?? "").toString();
    const childDto = (slots, fallback) =>
      toValueDto(getChildBySlot(block.id, slots)) ?? fallback;
    const addPos = (dto) => {
      if (!dto) return dto;
      return normalizeValueDto({
        ...dto,
        positionX: block.x ?? block.positionX,
        positionY: block.y ?? block.positionY,
        localId: block.id,
      });
    };
    const reuseExpression = (b, builder) => {
      const exprId = b?.expressionId ?? b?.expressionBlockId;
      if (exprId != null) return normalizeValueDto({ blockId: exprId });
      return builder();
    };

    if (shape === "value-input") {
      return reuseExpression(block, () => {
        const n = Number(text);
        return addPos(asLiteral(Number.isFinite(n) ? n : stripQuotes(text)));
      });
    }
    if (shape === "value-string") {
      return reuseExpression(block, () => addPos(asLiteral(stripQuotes(text))));
    }
    if (shape === "boolean") {
      return reuseExpression(block, () => {
        const lower = text.toLowerCase();
        return addPos(asLiteral(lower === "false" ? false : true));
      });
    }
    if (shape === "value-pill") {
      const name = block.selectedVar ?? block.variableName ?? text;
      return reuseExpression(block, () => addPos(asVariable(name, block.variableId)));
    }
    if (shape === "boolean-not") {
      return reuseExpression(block, () => {
        const operand =
          childDto(["condition", "cond", "value"], asLiteral(false)) ?? asLiteral(false);
        return addPos(normalizeValueDto({
          valueType: "UNARY",
          operator: "!",
          operand,
        }));
      });
    }
    if (shape === "value-operator-2slot") {
      return reuseExpression(block, () => {
        const left = childDto(["left"], asLiteral(0));
        const right = childDto(["right"], asLiteral(0));
        return addPos(normalizeValueDto({
          valueType: "BINARY",
          operator: normalizeOperator(text, "+"),
          left,
          right,
        }));
      });
    }
    if (shape === "boolean-binary") {
      return reuseExpression(block, () => {
        const left = childDto(["left"], asLiteral(0));
        const right = childDto(["right"], asLiteral(0));
        return addPos(normalizeValueDto({
          valueType: "BINARY",
          operator: normalizeOperator(text, "=="),
          left,
          right,
        }));
      });
    }

    if (valueShapes.has(shape)) {
      return reuseExpression(block, () => addPos(asLiteral(stripQuotes(text || "0"))));
    }

    return null;
  };

  const buildValueFromSlots = (parentId, slots = [], fallbackText = null, defaultLiteral = null) => {
    const child = getChildBySlot(parentId, slots);
    const dto = toValueDto(child);
    if (dto) return normalizeValueDto(dto);
    if (fallbackText !== null && fallbackText !== undefined) {
      const parsed = parseFallbackExpression(fallbackText);
      if (parsed) return parsed;
    }
    if (defaultLiteral !== null && defaultLiteral !== undefined) {
      return asLiteral(defaultLiteral);
    }
    return null;
  };

  const findStart = () => {
    const explicit = list.find((b) => inferBlockType(b) === "START");
    if (explicit) return explicit;
    return list.find((b) => (b?.text ?? "").toString().includes("깃발")) ?? null;
  };

  const start = findStart();
  if (!start) {
    warnings.push("START 블록을 찾지 못했어요. 그래도 서버로 동기화합니다.");
  }

  const getValueChild = (parentId) => {
    const kids = childrenByParent.get(parentId) ?? [];
    if (kids.length === 0) return null;
    const slot = (b) => b?.parentSlot ?? null;

    return (
      kids.find((c) => slotMatches(slot(c), ["value", "val"])) ??
      kids.find((c) => slotMatches(slot(c), ["times", "time"])) ??
      kids.find((c) => isValueShape(c)) ??
      null
    );
  };

  const getChild = (parentId, kind) => {
    const kids = childrenByParent.get(parentId) ?? [];
    if (kids.length === 0) return null;

    const slot = (b) => b?.parentSlot ?? null;

    const pick = (candidates, allowValue = false) =>
      candidates.find((c) => allowValue || !isValueShape(c)) ?? null;

    if (kind === "true") {
      return pick(
        kids.filter((c) =>
          slotMatches(slot(c), ["true", "then", "t", "1", "substack1", "body"])
        )
      );
    }
    if (kind === "false") {
      return pick(
        kids.filter((c) =>
          slotMatches(slot(c), ["false", "else", "f", "0", "substack2"])
        )
      );
    }
    if (kind === "condition") {
      return pick(
        kids.filter((c) => slotMatches(slot(c), ["cond", "condition", "조건"])),
        true
      );
    }
    if (kind === "value") {
      const val = getValueChild(parentId);
      if (val) return val;
    }

    return (
      pick(
        kids.filter((c) => slotMatches(slot(c), ["next", "body", "statement", "do"]))
      ) ??
      pick(kids.filter((c) => c?.parentSlot == null)) ??
      pick(kids, true)
    );
  };

  const localNextOf = (b) => {
    if (b?.nextBlockId != null) return b.nextBlockId;
    const child = getChild(b.id, "next");
    if (child?.id != null) return child.id;

    return null;
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
    const direct = pickValueDto(b?.condition);
    if (direct) return direct;
    return (
      buildValueFromSlots(
        b.id,
        ["condition", "cond", "times", "value"],
        b?.conditionExpression ?? null,
        true
      ) ?? asLiteral(true)
    );
  };

  const valueExpressionOf = (b) => {
    const direct = pickValueDto(b?.value, b?.message, b?.messageValue);
    if (direct) return direct;
    return (
      buildValueFromSlots(b.id, ["value"], b?.valueExpression ?? b?.text ?? null) ??
      asLiteral("")
    );
  };

  const variableNameOf = (b) => b?.selectedVar ?? b?.variableName ?? b?.text ?? "var";

  const orderedBlocks = [...list].sort(
    (a, b) => safeNum(a.y) - safeNum(b.y) || safeNum(a.x) - safeNum(b.x)
  );

  const orderMap = new Map();
  orderedBlocks
    .filter((b) => !valueShapes.has(b.shape))
    .forEach((b, idx) => orderMap.set(b.id, idx + 1));

  const nodes = orderedBlocks.map((b) => {
    const type = inferBlockType(b);
    // 값/조건 전용 블록은 백엔드에 별도 노드로 보낼 필요 없음
    if (valueShapes.has(b.shape)) return null;

    const base = {
      localId: b.id,
      blockType: type,
      positionX: safeNum(b.x),
      positionY: safeNum(b.y),
      order: orderMap.get(b.id) ?? 1,
      nextLocalId: null,
      trueLocalId: null,
      falseLocalId: null,
      condition: null,
      variableName: null,
      variableId: b.variableId ?? null,
      variableType: null,
      initial: null,
      value: null,
      message: null,
      init: null,
      increment: null,
      operand1: null,
      operand2: null,
      resultVariable: null,
      resultVariableId: b.resultVariableId ?? null,
    };

    if (type === "START") {
      base.nextLocalId = localNextOf(b);
      return base;
    }

    if (type === "IF") {
      base.condition = localConditionExprOf(b);
      base.trueLocalId = localTrueOf(b);
      base.falseLocalId = localFalseOf(b);
      base.nextLocalId = localNextOf(b);
      return base;
    }

    if (type === "WHILE") {
      base.condition = localConditionExprOf(b);
      base.trueLocalId = localTrueOf(b);
      base.nextLocalId = localNextOf(b);
      return base;
    }

    if (type === "FOR") {
      base.condition =
        pickValueDto(b?.condition) ||
        buildValueFromSlots(
          b.id,
          ["condition", "cond", "times"],
          b?.conditionExpression ?? null,
          true
        ) ||
        asLiteral(true);
      base.init =
        pickValueDto(b?.init) ||
        buildValueFromSlots(b.id, ["init"], b?.initExpression ?? null) ||
        null;
      base.increment =
        pickValueDto(b?.increment) ||
        buildValueFromSlots(b.id, ["increment"], b?.incrementExpression ?? null) ||
        null;
      base.trueLocalId = localTrueOf(b);
      base.nextLocalId = localNextOf(b);
      return base;
    }

    if (type === "VAR_DECLARE") {
      base.variableName = variableNameOf(b);
      base.variableId = b.variableId ?? base.variableId;
      base.initial =
        pickValueDto(b?.initial) ||
        buildValueFromSlots(
          b.id,
          ["value"],
          b?.initialValue ?? b?.valueExpression ?? b?.text ?? null,
          0
        ) ||
        asLiteral(0);
      base.variableType = b.variableType ?? "number";
      base.nextLocalId = localNextOf(b);
      return base;
    }

    if (type === "VAR_ASSIGN") {
      base.variableName = variableNameOf(b);
      base.variableId = b.variableId ?? base.variableId;
      base.value =
        pickValueDto(b?.value) ||
        buildValueFromSlots(b.id, ["value"], b?.valueExpression ?? null, "") ||
        asLiteral("");
      base.nextLocalId = localNextOf(b);
      return base;
    }



    if (type === "PRINT") {
      base.message = valueExpressionOf(b);
      base.nextLocalId = localNextOf(b);
      return base;
    }

    if (type === "ALERT") {
      base.message = b.message ?? b.text ?? "";
      base.nextLocalId = localNextOf(b);
      return base;
    }

    if (type === "DRAW") {
      base.shape = b.shapeType ?? b.shapeName ?? "circle";
      base.color = b.color ?? b.drawColor ?? "#000000";
      base.size = b.size ?? b.drawSize ?? "20";
      base.message = b.message ?? null;
      base.nextLocalId = localNextOf(b);
      return base;
    }

    base.message = b.message ?? b.text ?? `[${type}]`;
    base.nextLocalId = localNextOf(b);
    return base;
  });

  const filteredNodes = nodes.filter(Boolean);

  for (const n of filteredNodes) {
    if (n.blockType === "IF" && n.trueLocalId == null && n.falseLocalId == null) {
      warnings.push(`IF 블록(localId=${n.localId})에 true/false branch 연결이 안 잡혔어요.`);
    }
    if (n.blockType === "START" && n.nextLocalId == null) {
      warnings.push(`START 블록 다음(next)이 null이라 실행 흐름이 끊길 수 있어요.`);
    }
  }

  return { nodes: filteredNodes, startLocalId: start?.id ?? null, warnings };
}
