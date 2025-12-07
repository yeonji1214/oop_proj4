import {
  BLOCK,
  PADDING,
  SLOT,
  TEXT,
  DROPDOWN,
  DROPDOWN_STYLES,
  withDefaultColor,
  measureText,
  calcBlockWidth,
  pillSlot,
  hexSlot,
} from "./blockLayout";

// ===== 헬퍼 함수 =====

/**
 * 육각형(boolean) 폴리곤 포인트 생성
 */
const hexagonPolygon = (width, height) => {
  const tipX = 10; // 좌우 뾰족한 부분 길이
  const midY = height / 2;
  return `
    0,${midY}
    ${tipX},0
    ${width - tipX},0
    ${width},${midY}
    ${width - tipX},${height}
    ${tipX},${height}
  `;
};

/**
 * 커맨드 블럭 SVG path 생성 (상단 톱니, 하단 톱니)
 */
const commandPath = (width, height, r = BLOCK.CORNER_RADIUS) => {
  const notchW = BLOCK.NOTCH_WIDTH;
  const notchH = BLOCK.NOTCH_HEIGHT;
  return `
    M 0 ${r} a ${r} ${r} 0 0 1 ${r} -${r} 
    h 10 l ${notchH} ${notchH} h ${notchW} l ${notchH} -${notchH}
    h ${width - 34} a ${r} ${r} 0 0 1 ${r} ${r} 
    v ${height - r * 2}
    a ${r} ${r} 0 0 1 -${r} ${r} 
    h -${width - 34} l -${notchH} ${notchH} h -${notchW} l -${notchH} -${notchH} 
    h -10 a ${r} ${r} 0 0 1 -${r} -${r} Z
  `;
};

/**
 * 시작 블럭 path (상단 평평, 하단 톱니)
 */
const startPath = (width, height, r = BLOCK.CORNER_RADIUS) => {
  const notchW = BLOCK.NOTCH_WIDTH;
  const notchH = BLOCK.NOTCH_HEIGHT;
  return `
    M 0 ${r} a ${r} ${r} 0 0 1 ${r} -${r}
    h ${width - r * 2}
    a ${r} ${r} 0 0 1 ${r} ${r}
    v ${height - r * 2}
    a ${r} ${r} 0 0 1 -${r} ${r}
    h -${width - 34} l -${notchH} ${notchH} h -${notchW} l -${notchH} -${notchH} h -10
    a ${r} ${r} 0 0 1 -${r} -${r} Z
  `;
};

/**
 * 알약형 값 블럭 (value-pill)
 */
const pill = (text, color, overrideW, overrideH) => {
  const height = overrideH ?? BLOCK.VALUE_HEIGHT;
  const textWidth = measureText(text);
  const width = overrideW ?? Math.max(textWidth + PADDING.HORIZONTAL * 2, BLOCK.MIN_WIDTH);
  const r = height / 2;
  const innerPad = 3;

  return {
    width,
    height,
    body: { type: "rect", x: 0, y: 0, w: width, h: height, rx: r, ry: r, fill: color, stroke: "#fff", strokeWidth: 1 },
    layers: [],
    slots: [],
    inners: [
      { x: innerPad, y: innerPad, w: width - innerPad * 2, h: height - innerPad * 2, rx: r - innerPad, ry: r - innerPad, fill: "#fff" },
    ],
    labels: [{
      x: width / 2,
      y: height / 2 + TEXT.LABEL_OFFSET_Y,
      text,
      anchor: "middle",
      fontSize: TEXT.SIZE,
      fontWeight: TEXT.WEIGHT,
      color: "#000"
    }],
    controls: [],
  };
};

/**
 * 팔레트용 알약형 블럭 (흰색 내부 없음, 수정 불가)
 */
const solidPill = (text, color, overrideW, overrideH) => {
  const height = overrideH ?? BLOCK.VALUE_HEIGHT;
  const textWidth = measureText(text);
  const width = overrideW ?? Math.max(textWidth + PADDING.HORIZONTAL * 2, BLOCK.MIN_WIDTH);
  const r = height / 2;

  return {
    width,
    height,
    body: { type: "rect", x: 0, y: 0, w: width, h: height, rx: r, ry: r, fill: color, stroke: "#fff", strokeWidth: 1 },
    layers: [],
    slots: [],
    inners: [],  // 흰색 내부 없음
    labels: [{
      x: width / 2,
      y: height / 2 + TEXT.LABEL_OFFSET_Y,
      text,
      anchor: "middle",
      fontSize: TEXT.SIZE,
      fontWeight: TEXT.WEIGHT,
      color: "#fff"  // 흰색 텍스트
    }],
    controls: [],
  };
};

/**
 * 입력 값 블럭 (value-input, value-string)
 */
const inputShape = (text, color, overrideW, overrideH) => {
  const height = overrideH ?? BLOCK.VALUE_HEIGHT;
  const innerText = text || "";
  const textWidth = measureText(innerText);
  const width = overrideW ?? Math.max(textWidth + PADDING.HORIZONTAL * 2, BLOCK.MIN_WIDTH);
  const r = height / 2;
  const innerPad = 4;

  return {
    width,
    height,
    body: { type: "rect", x: 0, y: 0, w: width, h: height, rx: r, ry: r, fill: color, stroke: "#fff", strokeWidth: 1 },
    layers: [],
    slots: [],
    inners: [
      { x: innerPad, y: innerPad, w: width - innerPad * 2, h: height - innerPad * 2, rx: r - innerPad, ry: r - innerPad, fill: "#fff" },
    ],
    labels: [{
      x: width / 2,
      y: height / 2 + TEXT.LABEL_OFFSET_Y,
      text: innerText,
      anchor: "middle",
      fontSize: TEXT.SIZE,
      fontWeight: TEXT.WEIGHT,
      color: "#000"
    }],
    controls: [],
  };
};

// ===== 메인 빌드 함수 =====

export function buildBlockSpec(block) {
  const {
    id,
    blockType,
    shape,
    text = "",
    color,
    leftSlotWidth = SLOT.MIN_WIDTH,
    rightSlotWidth = SLOT.MIN_WIDTH,
    slotWidth = SLOT.MIN_WIDTH,
    subStack1Height = BLOCK.COMMAND_HEIGHT,
    subStack2Height = BLOCK.COMMAND_HEIGHT,
    onOpChange,
    subText = "",
    selectedVar,
    totalWidth,
    height: heightOverride,
  } = block;

  const col = withDefaultColor(blockType, color);

  // 안전장치: valueType만 있고 shape가 없을 때 알약으로 처리
  if (!shape && block?.valueType) {
    return pill(text || "", col);
  }

  // ===== 조건 블럭 (boolean-binary): 육각형, 좌우 슬롯, 드롭다운 없음 =====
  if (shape === "boolean-binary") {
    const height = heightOverride ?? BLOCK.VALUE_HEIGHT;
    const displayOp = text || "==";
    const opTextWidth = Math.max(measureText(displayOp) + PADDING.HORIZONTAL, 24);

    // 너비 계산: 좌슬롯 + 간격 + 연산자 + 간격 + 우슬롯
    const width = totalWidth ?? calcBlockWidth([
      { type: 'slot', width: leftSlotWidth },
      { type: 'label', text: displayOp },
      { type: 'slot', width: rightSlotWidth },
    ], 120);

    const midY = height / 2;
    const slotY = midY - SLOT.HEIGHT / 2;

    // 요소 배치
    const leftSlotX = PADDING.HORIZONTAL;
    const opCenterX = PADDING.HORIZONTAL + leftSlotWidth + PADDING.ELEMENT_GAP + opTextWidth / 2;
    const rightSlotX = width - PADDING.HORIZONTAL - rightSlotWidth;

    return {
      id,
      width,
      height,
      body: { type: "polygon", points: hexagonPolygon(width, height), fill: col, stroke: "#fff", strokeWidth: 1 },
      slots: [
        pillSlot(leftSlotX, slotY, leftSlotWidth),
        pillSlot(rightSlotX, slotY, rightSlotWidth),
      ],
      labels: [{
        x: opCenterX,
        y: midY + TEXT.LABEL_OFFSET_Y,
        text: displayOp,
        anchor: "middle",
        fontSize: TEXT.SIZE,
        fontWeight: TEXT.WEIGHT
      }],
      controls: [],  // 드롭다운 없음
    };
  }

  // ===== 연산자 블럭 (value-operator-2slot): 둥근 사각형, 좌우 슬롯 =====
  if (shape === "value-operator-2slot") {
    const height = heightOverride ?? BLOCK.VALUE_HEIGHT;
    const textWidth = measureText(text);

    const width = totalWidth ?? calcBlockWidth([
      { type: 'slot', width: leftSlotWidth },
      { type: 'label', text },
      { type: 'slot', width: rightSlotWidth },
    ], 100);

    const midY = height / 2;
    const slotY = midY - SLOT.HEIGHT / 2;

    const leftSlotX = PADDING.HORIZONTAL;
    const textCenterX = PADDING.HORIZONTAL + leftSlotWidth + PADDING.ELEMENT_GAP + textWidth / 2;
    const rightSlotX = width - PADDING.HORIZONTAL - rightSlotWidth;

    return {
      id,
      width,
      height,
      body: { type: "rect", x: 0, y: 0, w: width, h: height, rx: height / 2, ry: height / 2, fill: col, stroke: "#fff", strokeWidth: 1 },
      slots: [
        pillSlot(leftSlotX, slotY, leftSlotWidth),
        pillSlot(rightSlotX, slotY, rightSlotWidth),
      ],
      labels: [{
        x: textCenterX,
        y: midY + TEXT.LABEL_OFFSET_Y,
        text,
        anchor: "middle",
        fontSize: TEXT.SIZE,
        fontWeight: TEXT.WEIGHT
      }],
      controls: [],
    };
  }

  // ===== 값 블럭 타입들 =====
  if (shape === "value-pill") {
    // 팔레트용 변수 블록은 흰색 내부 없이 solid 스타일
    if (block.isPalette) return solidPill(text, col, totalWidth, heightOverride);
    return pill(text, col, totalWidth, heightOverride);
  }
  if (shape === "value-input") return inputShape(text, col, totalWidth, heightOverride);
  if (shape === "value-string") return inputShape(text, col, totalWidth, heightOverride);
  if (shape === "boolean") return inputShape(text, col, totalWidth, heightOverride);

  // ===== 변수 설정 블럭 (variable-set): 드롭다운 대신 변수명 입력 슬롯 =====
  if (shape === "variable-set") {
    const height = BLOCK.COMMAND_HEIGHT;
    const label1Width = measureText(text);
    const label2Width = measureText(subText);
    const varNameSlotW = Math.max(measureText(selectedVar || "변수") + PADDING.HORIZONTAL * 2, SLOT.MIN_WIDTH + 20);
    const valueSlotW = slotWidth || SLOT.MIN_WIDTH;

    const width = calcBlockWidth([
      { type: 'label', text },
      { type: 'slot', width: varNameSlotW },
      { type: 'label', text: subText },
      { type: 'slot', width: valueSlotW },
    ], 150);

    // 요소 배치
    let x = PADDING.HORIZONTAL;
    const label1X = x;
    x += label1Width + PADDING.ELEMENT_GAP;
    const varNameSlotX = x;
    x += varNameSlotW + PADDING.ELEMENT_GAP;
    const label2CenterX = x + label2Width / 2;
    x += label2Width + PADDING.ELEMENT_GAP;
    const valueSlotX = x;

    const midY = height / 2;
    const slotY = (height - SLOT.HEIGHT) / 2;

    return {
      id,
      width,
      height,
      body: { type: "path", d: commandPath(width, height), fill: col, stroke: "#fff", strokeWidth: 1 },
      slots: [
        pillSlot(varNameSlotX, slotY, varNameSlotW),  // 변수명 입력 슬롯
        pillSlot(valueSlotX, slotY, valueSlotW),       // 값 슬롯
      ],
      labels: [
        { x: label1X, y: midY + TEXT.LABEL_OFFSET_Y, text, anchor: "start", fontSize: TEXT.SIZE, fontWeight: TEXT.WEIGHT },
        { x: label2CenterX, y: midY + TEXT.LABEL_OFFSET_Y, text: subText, anchor: "middle", fontSize: TEXT.SIZE, fontWeight: TEXT.WEIGHT },
      ],
      controls: [],  // 드롭다운 없음
    };
  }

  // ===== 출력 블럭 (command-print) =====
  if (shape === "command-print") {
    const height = BLOCK.COMMAND_HEIGHT;
    const slotW = slotWidth || SLOT.MIN_WIDTH;
    const textWidth = measureText(text);

    const width = calcBlockWidth([
      { type: 'slot', width: slotW },
      { type: 'label', text },
    ], 100);

    const slotX = PADDING.HORIZONTAL;
    const labelX = slotX + slotW + PADDING.ELEMENT_GAP;
    const midY = height / 2;
    const slotY = (height - SLOT.HEIGHT) / 2;

    return {
      id,
      width,
      height,
      body: { type: "path", d: commandPath(width, height), fill: col, stroke: "#fff", strokeWidth: 1 },
      slots: [pillSlot(slotX, slotY, slotW)],
      labels: [{ x: labelX, y: midY + TEXT.LABEL_OFFSET_Y, text, anchor: "start", fontSize: TEXT.SIZE, fontWeight: TEXT.WEIGHT }],
      controls: [],
    };
  }

  // ===== 제어 블럭 (if, if-else, repeat, while) =====
  if (["command-if", "command-if-else", "command-repeat", "command-while"].includes(shape)) {
    const headerHeight = BLOCK.CONTROL_HEADER_HEIGHT;
    const midBarHeight = BLOCK.CONTROL_MID_HEIGHT;
    const footerHeight = BLOCK.CONTROL_FOOTER_HEIGHT;

    // 슬롯 타입 결정: repeat은 숫자(pill), 나머지는 조건(hex)
    const isRepeat = shape === "command-repeat";
    const slotW = slotWidth || (isRepeat ? SLOT.MIN_WIDTH : SLOT.MIN_WIDTH * 2.5);
    const slotH = SLOT.HEIGHT;

    // 라벨 설정
    let labelBefore = "";
    let labelAfter = "";
    if (isRepeat) {
      labelBefore = "";
      labelAfter = "번 반복하기";
    } else if (shape === "command-while") {
      labelBefore = "";
      labelAfter = "인 동안 반복";
    } else {
      labelBefore = "만약";
      labelAfter = "이라면";
    }

    const labelBeforeW = measureText(labelBefore);
    const labelAfterW = measureText(labelAfter);

    // 너비 계산 (출력하기 블록과 동일한 방식)
    const elements = [];
    if (labelBefore) elements.push({ type: 'label', text: labelBefore });
    elements.push({ type: 'slot', width: slotW });
    if (labelAfter) elements.push({ type: 'label', text: labelAfter });

    const bodyW = calcBlockWidth(elements, 140);

    // 슬롯 위치 (출력하기 블록처럼 중앙 정렬)
    const midY = headerHeight / 2;
    const slotY = midY - slotH / 2;

    let slotX;
    if (labelBefore) {
      slotX = PADDING.HORIZONTAL + labelBeforeW + PADDING.ELEMENT_GAP;
    } else {
      slotX = PADDING.HORIZONTAL;
    }

    // 라벨 배열 구성
    const labels = [];
    if (labelBefore) {
      labels.push({
        x: PADDING.HORIZONTAL,
        y: midY + TEXT.LABEL_OFFSET_Y,
        text: labelBefore,
        anchor: "start",
        fontSize: TEXT.SIZE,
        fontWeight: TEXT.WEIGHT
      });
    }
    if (labelAfter) {
      const labelAfterX = slotX + slotW + PADDING.ELEMENT_GAP;
      labels.push({
        x: labelAfterX,
        y: midY + TEXT.LABEL_OFFSET_Y,
        text: labelAfter,
        anchor: "start",
        fontSize: TEXT.SIZE,
        fontWeight: TEXT.WEIGHT
      });
    }

    // 슬롯: repeat은 pillSlot, if/while은 hexSlot
    const slots = isRepeat
      ? [pillSlot(slotX, slotY, slotW, slotH)]
      : [hexSlot(slotX, slotY, slotW, slotH)];

    const inner1H = subStack1Height ?? BLOCK.COMMAND_HEIGHT;
    const inner2H = subStack2Height ?? BLOCK.COMMAND_HEIGHT;

    let totalHeight = headerHeight + inner1H + footerHeight;

    if (shape === "command-if-else") {
      totalHeight = headerHeight + inner1H + midBarHeight + inner2H + footerHeight;
      labels.push({
        x: PADDING.HORIZONTAL,
        y: headerHeight + inner1H + midBarHeight / 2 + TEXT.LABEL_OFFSET_Y,
        text: "아니면",
        anchor: "start",
        fontSize: TEXT.SIZE,
        fontWeight: TEXT.WEIGHT
      });
    }

    // C-블럭 path 생성
    const r = BLOCK.CORNER_RADIUS;
    const notchW = BLOCK.NOTCH_WIDTH;
    const notchH = BLOCK.NOTCH_HEIGHT;
    const innerInset = 16;

    const bodyPath = (() => {
      const p = [];
      // 시작 (좌상단)
      p.push(`M 0 ${r}`);
      p.push(`a ${r} ${r} 0 0 1 ${r} -${r}`);
      // 상단 노치
      p.push(`h 10`);
      p.push(`l ${notchH} ${notchH} h ${notchW} l ${notchH} -${notchH}`);
      p.push(`h ${bodyW - 34 - r}`);
      p.push(`a ${r} ${r} 0 0 1 ${r} ${r}`);

      // 헤더 끝 → 첫 번째 입
      p.push(`v ${headerHeight - r * 2}`);
      p.push(`a ${r} ${r} 0 0 1 -${r} ${r}`);
      p.push(`h -${bodyW - innerInset - 34}`);
      p.push(`l -${notchH} ${notchH} h -${notchW} l -${notchH} -${notchH}`);
      p.push(`h -10`);
      p.push(`v ${inner1H}`);
      p.push(`h 10`);
      p.push(`l ${notchH} ${notchH} h ${notchW} l ${notchH} -${notchH}`);
      p.push(`h ${bodyW - innerInset - 34}`);
      p.push(`a ${r} ${r} 0 0 1 ${r} ${r}`);

      if (shape === "command-if-else") {
        // else 바
        p.push(`v ${midBarHeight - r * 2}`);
        p.push(`a ${r} ${r} 0 0 1 -${r} ${r}`);
        p.push(`h -${bodyW - innerInset - 34}`);
        p.push(`l -${notchH} ${notchH} h -${notchW} l -${notchH} -${notchH}`);
        p.push(`h -10`);
        p.push(`v ${inner2H}`);
        p.push(`h 10`);
        p.push(`l ${notchH} ${notchH} h ${notchW} l ${notchH} -${notchH}`);
        p.push(`h ${bodyW - innerInset - 34}`);
        p.push(`a ${r} ${r} 0 0 1 ${r} ${r}`);
      }

      // 푸터
      p.push(`v ${footerHeight - r * 2}`);
      p.push(`a ${r} ${r} 0 0 1 -${r} ${r}`);
      p.push(`h -${bodyW - 34 - r}`);
      p.push(`l -${notchH} ${notchH} h -${notchW} l -${notchH} -${notchH}`);
      p.push(`h -10`);
      p.push(`a ${r} ${r} 0 0 1 -${r} -${r} Z`);
      return p.join(" ");
    })();

    return {
      id,
      width: bodyW,
      height: totalHeight,
      body: { type: "path", d: bodyPath, fill: col, stroke: "#fff", strokeWidth: 1 },
      slots,
      labels,
      inners: [],
      layers: [],
      controls: [],
    };
  }

  // ===== START 블럭 =====
  if (blockType === "START" || shape === "start-flat") {
    const height = BLOCK.COMMAND_HEIGHT;
    const label = text || "시작하기";
    const labelWidth = measureText(label);

    const width = calcBlockWidth([{ type: 'label', text: label }], 100);

    return {
      id,
      width,
      height,
      body: { type: "path", d: startPath(width, height), fill: col, stroke: "#fff", strokeWidth: 1 },
      layers: [],
      slots: [],
      labels: [{
        x: PADDING.HORIZONTAL,
        y: height / 2 + TEXT.LABEL_OFFSET_Y,
        text: label,
        anchor: "start",
        fontSize: TEXT.SIZE,
        fontWeight: TEXT.WEIGHT
      }],
      controls: [],
    };
  }

  // ===== 변수 선언 블럭 (VAR_DECLARE) =====
  if (blockType === "VAR_DECLARE") {
    const height = BLOCK.COMMAND_HEIGHT;
    const label = text || "변수 선언";
    const name = block.variableName || "변수";
    const nameWidth = measureText(name);
    const labelWidth = measureText(label);
    const pillW = Math.max(nameWidth + PADDING.HORIZONTAL * 2, 60);

    const width = calcBlockWidth([
      { type: 'custom', width: pillW },
      { type: 'label', text: label },
    ], 120);

    const pillX = PADDING.HORIZONTAL;
    const labelX = pillX + pillW + PADDING.ELEMENT_GAP;
    const midY = height / 2;
    const pillH = height - PADDING.VERTICAL * 2;

    return {
      id,
      width,
      height,
      body: { type: "path", d: commandPath(width, height), fill: col, stroke: "#fff", strokeWidth: 1 },
      inners: [
        { x: pillX, y: PADDING.VERTICAL, w: pillW, h: pillH, rx: pillH / 2, ry: pillH / 2, fill: "#FF8C1A" },
      ],
      labels: [
        { x: pillX + pillW / 2, y: midY + TEXT.LABEL_OFFSET_Y, text: name, anchor: "middle", fontSize: TEXT.SIZE, fontWeight: TEXT.WEIGHT, color: "#fff" },
        { x: labelX, y: midY + TEXT.LABEL_OFFSET_Y, text: label, anchor: "start", fontSize: TEXT.SIZE, fontWeight: TEXT.WEIGHT },
      ],
      slots: [],
      controls: [],
    };
  }

  // ===== 기본 커맨드 블럭 =====
  const height = BLOCK.COMMAND_HEIGHT;
  const labelWidth = measureText(text);
  const width = calcBlockWidth([{ type: 'label', text }], BLOCK.MIN_WIDTH);

  return {
    id,
    width,
    height,
    body: { type: "path", d: commandPath(width, height), fill: col, stroke: "#fff", strokeWidth: 1 },
    slots: [],
    labels: [{
      x: PADDING.HORIZONTAL,
      y: height / 2 + TEXT.LABEL_OFFSET_Y,
      text,
      anchor: "start",
      fontSize: TEXT.SIZE,
      fontWeight: TEXT.WEIGHT
    }],
    controls: [],
  };
}
