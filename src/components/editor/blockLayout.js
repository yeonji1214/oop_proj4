// ===== 블럭 기본 치수 (Entry/Scratch 레퍼런스) =====
export const BLOCK = {
  // 기본 높이
  COMMAND_HEIGHT: 40,        // 커맨드 블럭 높이
  VALUE_HEIGHT: 32,          // 값 블럭 높이 (알약형)
  CONTROL_HEADER_HEIGHT: 40, // 제어블럭 헤더 높이
  CONTROL_FOOTER_HEIGHT: 24, // 제어블럭 푸터 높이
  CONTROL_MID_HEIGHT: 32,    // else 바 높이

  // 최소 너비
  MIN_WIDTH: 48,             // 최소 블럭 너비

  // 코너 반경
  CORNER_RADIUS: 4,          // 블럭 모서리 반경
  NOTCH_WIDTH: 12,           // 톱니 너비
  NOTCH_HEIGHT: 4,           // 톱니 높이
};

// ===== 패딩 & 간격 =====
export const PADDING = {
  HORIZONTAL: 12,            // 좌우 패딩
  VERTICAL: 8,               // 상하 패딩
  ELEMENT_GAP: 8,            // 요소간 간격
  SLOT_GAP: 4,               // 슬롯과 라벨 간격
};

// ===== 슬롯 치수 =====
export const SLOT = {
  HEIGHT: 24,                // 슬롯 높이 (알약형 input)
  MIN_WIDTH: 32,             // 최소 슬롯 너비
  RADIUS: 12,                // 알약형 반경 (height / 2)
  FILL: "rgba(0,0,0,0.15)",
};

// ===== 텍스트 치수 =====
export const TEXT = {
  SIZE: 12,
  WEIGHT: "600",
  CHAR_WIDTH: 7,             // 평균 문자 너비 (12px bold 기준)
  LABEL_OFFSET_Y: 1,         // 수직 보정
};

// ===== 드롭다운 치수 =====
export const DROPDOWN = {
  HEIGHT: 24,
  MIN_WIDTH: 48,
  PADDING: 8,
  RADIUS: 4,
};

// ===== 레거시 호환 (기존 코드와의 호환성 유지) =====
export const BODY_PADDING = PADDING.HORIZONTAL;
export const SLOT_HEIGHT = SLOT.HEIGHT;
export const SLOT_RADIUS = SLOT.RADIUS;
export const TEXT_SIZE = TEXT.SIZE;
export const TEXT_WEIGHT = TEXT.WEIGHT;
export const SLOT_FILL = SLOT.FILL;

export const DROPDOWN_STYLES = {
  variable: { fill: "#E67E22", stroke: "#CF711F", strokeWidth: 1 },
  condition: { fill: "#1f4a7a", stroke: "#16375a", strokeWidth: 1.2 },
};

// ===== 헬퍼 함수 =====

/**
 * 텍스트 너비 측정 (문자 수 기반)
 * @param {string} text - 측정할 텍스트
 * @returns {number} 픽셀 너비
 */
export const measureText = (text) => {
  if (!text) return 0;
  // 한글은 영문보다 넓으므로 가중치 적용
  let width = 0;
  for (const char of text) {
    if (/[\u3131-\uD79D]/.test(char)) {
      // 한글 (자음/모음/완성형)
      width += TEXT.CHAR_WIDTH * 1.6;
    } else {
      width += TEXT.CHAR_WIDTH;
    }
  }
  return Math.ceil(width);
};

/**
 * 블럭 너비 계산
 * @param {Array} elements - 블럭 내 요소들 [{type: 'label'|'slot'|'dropdown', width?, text?}]
 * @param {number} minWidth - 최소 너비 (기본값: BLOCK.MIN_WIDTH)
 * @returns {number} 계산된 너비
 */
export const calcBlockWidth = (elements, minWidth = BLOCK.MIN_WIDTH) => {
  let width = PADDING.HORIZONTAL * 2; // 좌우 패딩

  elements.forEach((el, idx) => {
    if (idx > 0) width += PADDING.ELEMENT_GAP; // 요소간 간격

    switch (el.type) {
      case 'label':
        width += measureText(el.text);
        break;
      case 'slot':
        width += el.width || SLOT.MIN_WIDTH;
        break;
      case 'dropdown':
        width += el.width || DROPDOWN.MIN_WIDTH;
        break;
      default:
        width += el.width || 0;
    }
  });

  return Math.max(width, minWidth);
};

/**
 * 통일된 알약형 슬롯 사양을 반환하는 헬퍼
 */
export const pillSlot = (x, y, w, h = SLOT.HEIGHT) => ({
  x,
  y,
  w,
  h,
  rx: SLOT.RADIUS,
  ry: SLOT.RADIUS,
  fill: SLOT.FILL,
});

/**
 * 육각형 슬롯 (boolean 조건용)
 */
export const hexSlot = (x, y, w, h = SLOT.HEIGHT) => ({
  x,
  y,
  w,
  h,
  type: 'hexagon',
  fill: SLOT.FILL,
});

// ===== 색상 정의 =====
export const DEFAULT_COLORS = {
  command: "#4CBFE6",
  boolean: "#5CB1D6",
  variable: "#FF8C1A",
  output: "#E91E63",
  control: "#8C68CD",
  start: "#00B400",
};

export const withDefaultColor = (blockType, color) => {
  if (color) return color;
  switch (blockType) {
    case "START":
      return DEFAULT_COLORS.start;
    case "IF":
    case "WHILE":
    case "FOR":
      return DEFAULT_COLORS.control;
    case "VAR_DECLARE":
    case "VAR_ASSIGN":
      return DEFAULT_COLORS.variable;
    case "PRINT":
      return DEFAULT_COLORS.output;
    default:
      return DEFAULT_COLORS.command;
  }
};
