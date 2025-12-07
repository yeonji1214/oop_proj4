// 공통: 프론트 컴파일 결과를 백엔드 API payload로 변환
// RunPane과 blockSyncer에서 동일한 규칙을 사용하도록 통합

const normalizeValue = (dto) => {
  if (!dto || typeof dto !== "object") return null;
  const result = {};
  const exprId = dto.blockId ?? dto.expressionId;
  if (exprId != null) result.blockId = exprId;
  if (dto.valueType) result.valueType = dto.valueType;
  if (dto.data !== undefined) result.data = dto.data;
  if (dto.variableName) result.variableName = dto.variableName;
  if (dto.variableId) result.variableId = dto.variableId;
  if (dto.operator) result.operator = dto.operator;
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

export function buildCreatePayload(node) {
  const base = {
    blockType: node.blockType,
    positionX: node.positionX,
    positionY: node.positionY,
    order: node.order,
    nextBlockId: null,
  };

  switch (node.blockType) {
    case "IF":
      return {
        ...base,
        condition: normalizeValue(node.condition) ?? null,
        trueBranchId: null,
        falseBranchId: null,
      };
    case "WHILE":
      return {
        ...base,
        condition: normalizeValue(node.condition) ?? null,
        trueBranchId: null,
      };
    case "FOR":
      return {
        ...base,
        condition: normalizeValue(node.condition) ?? null,
        init: normalizeValue(node.init) ?? null,
        increment: normalizeValue(node.increment) ?? null,
        trueBranchId: null,
      };
    case "VAR_DECLARE":
      return {
        ...base,
        variableName: node.variableName ?? "x",
        variableId: node.variableId ?? null,
        initial: normalizeValue(node.initial) ?? null,
        variableType: node.variableType ?? "number",
      };
    case "VAR_ASSIGN":
      return {
        ...base,
        variableName: node.variableName ?? "x",
        variableId: node.variableId ?? null,
        value: normalizeValue(node.value) ?? null,
      };
    case "PRINT":
      return {
        ...base,
        message: normalizeValue(node.message) ?? null,
      };

    case "ALERT":
      return { ...base, message: normalizeValue(node.message) ?? null };
    case "DRAW":
      return {
        ...base,
        shape: node.shape ?? node.shapeType ?? "circle",
        color: node.color ?? "#000000",
        size: node.size ?? "20",
        message: node.message ?? null,
      };
    default:
      return { ...base, message: normalizeValue(node.message) ?? null };
  }
}

export function buildUpdatePayload(
  node,
  resolveId = (id) => id ?? null,
  options = {}
) {
  const includePosition = options.includePosition !== false;
  const base = {
    blockType: node.blockType,
    positionX: includePosition ? node.positionX : null,
    positionY: includePosition ? node.positionY : null,
    order: node.order,
    nextBlockId: resolveId(node.nextLocalId),
  };

  switch (node.blockType) {
    case "IF":
      return {
        ...base,
        condition: normalizeValue(node.condition) ?? null,
        trueBranchId: resolveId(node.trueLocalId),
        falseBranchId: resolveId(node.falseLocalId),
      };
    case "WHILE":
      return {
        ...base,
        condition: normalizeValue(node.condition) ?? null,
        trueBranchId: resolveId(node.trueLocalId),
      };
    case "FOR":
      return {
        ...base,
        condition: normalizeValue(node.condition) ?? null,
        init: normalizeValue(node.init) ?? null,
        increment: normalizeValue(node.increment) ?? null,
        trueBranchId: resolveId(node.trueLocalId),
      };
    case "VAR_DECLARE":
      return {
        ...base,
        variableName: node.variableName ?? "x",
        variableId: node.variableId ?? null,
        initial: normalizeValue(node.initial) ?? null,
        variableType: node.variableType ?? null,
      };
    case "VAR_ASSIGN":
      return {
        ...base,
        variableName: node.variableName ?? "x",
        variableId: node.variableId ?? null,
        value: normalizeValue(node.value) ?? null,
      };
    case "PRINT":
      return { ...base, message: normalizeValue(node.message) ?? null };

    case "DRAW":
      return {
        ...base,
        shape: node.shape ?? node.shapeType ?? "circle",
        color: node.color ?? "#000000",
        size: node.size ?? "20",
        message: node.message ?? null,
      };
    case "ALERT":
      return { ...base, message: normalizeValue(node.message) ?? null };
    default:
      return { ...base, message: normalizeValue(node.message) ?? null };
  }
}
