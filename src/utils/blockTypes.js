// 공통 블록 메타데이터와 헬퍼
// - backend blockType과 프론트 표현(shape/color/label)을 한 곳에서 관리
// - 값 전용(shape)이면 백엔드로 전송하지 않도록 VALUE_SHAPES에 정의

export const BLOCK_TYPE_META = {
  START: { label: "시작", shape: "start-flat", color: "#00B400" },

  IF: { label: "만약", shape: "command-if", color: "#8C68CD" },
  WHILE: { label: "조건 반복", shape: "command-while", color: "#8C68CD" },
  FOR: { label: "반복", shape: "command-repeat", color: "#8C68CD" },

  PRINT: { label: "출력하기", shape: "command-print", color: "#E91E63" },
  ALERT: { label: "알림", shape: "command-alert", color: "#E91E63" },
  DRAW: { label: "그리기", shape: "command-draw", color: "#E91E63" },

  VAR_DECLARE: { label: "변수 선언", shape: "command", color: "#FF8C1A" },
  VAR_ASSIGN: { label: "값 넣기", shape: "variable-set", color: "#FF8C1A" },


};

export const VALUE_SHAPES = new Set([
  "value-pill",
  "value-operator-2slot",
  "value-input",
  "value-string",
  "boolean",
  "boolean-binary",
  "boolean-not",
]);

const SHAPE_TO_TYPE = {
  "command-if": "IF",
  "command-if-else": "IF",
  "command-while": "WHILE",
  "command-repeat": "FOR",
  "command-print": "PRINT",
  "variable-set": "VAR_ASSIGN",
  "command-alert": "ALERT",
  "command-draw": "DRAW",
};

export function getTypeMeta(blockType) {
  return BLOCK_TYPE_META[blockType] ?? null;
}

export function inferTypeFromShape(shape) {
  if (!shape) return null;
  return SHAPE_TO_TYPE[shape] ?? null;
}

export function applyTypeDefaults(block = {}) {
  const meta = getTypeMeta(block.blockType);
  if (!meta) return { ...block };

  return {
    ...block,
    text: block.text ?? meta.label,
    shape: block.shape ?? meta.shape,
    color: block.color ?? meta.color,
  };
}
