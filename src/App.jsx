import React, { useState, useRef, useEffect } from "react";
import { API_ROOT, PROJECT_ID } from "./config";
import { AppLayout } from "./components/layout/AppLayout";
import { BlockEditorPane } from "./components/editor/BlockEditorPane";
import { BlockPalettePane } from "./components/editor/BlockPalettePane";
import Block from "./components/editor/Block";
import { BlockBase } from "./components/editor/BlockBase";
import { buildBlockSpec } from "./components/editor/buildBlockSpec";
import { BLOCK, PADDING, SLOT } from "./components/editor/blockLayout";
import { RunPane } from "./components/run/RunPane";
import {
  registerServerBlocks,
  registerServerExpressions,
  syncPartialBlocks,
  deleteServerBlocks,
  deleteServerExpressions,
  setProjectId as syncerSetProjectId,
} from "./utils/blockSyncer";
import { mapServerBlocksToClient, mapServerExpressionsToBlocks } from "./utils/serverBlockMapper";
import { VALUE_SHAPES, applyTypeDefaults } from "./utils/blockTypes";

// [2] 블록 ID를 받아 재귀적으로 크기와 레이아웃 정보를 계산하는 헬퍼 함수
// buildBlockSpec에 완전히 위임하여 팔레트/에디터 간 일관성 보장
const getLayoutInfo = (block, allBlocks, visited = new Set()) => {
  if (!block) return { width: 0, height: 0, leftSlotWidth: 0, rightSlotWidth: 0 };

  const visitKey = block.id ?? `${block.blockType}-${block.shape}-${block.text}`;
  if (visitKey && visited.has(visitKey)) {
    return { width: 0, height: 0, leftSlotWidth: 0, rightSlotWidth: 0 };
  }
  if (visitKey) visited.add(visitKey);

  // --------------------------------------------------------------------
  // [헬퍼 함수] 연결된 블록들의 높이 합산 (Stack Height)
  // "내 높이" + "내 밑에 붙은(next) 녀석들의 높이"를 재귀적으로 구함
  // --------------------------------------------------------------------
  const getStackHeight = (node) => {
    if (!node) return 0;

    const stackKey = node.id ?? `${node.blockType}-${node.shape}-${node.text}-stack`;
    if (stackKey && visited.has(stackKey)) return 0;
    if (stackKey) visited.add(stackKey);

    const nodeSpec = buildBlockSpec(node) || {};
    const nodeHeight = nodeSpec.height ?? 40;

    const nextNode = allBlocks.find(b => b.parentId === node.id && b.parentSlot === "next");
    return nodeHeight + getStackHeight(nextNode);
  };

  // --------------------------------------------------------------------
  // 자식 슬롯 너비 계산 (재귀)
  // --------------------------------------------------------------------
  const getChildWidth = (parentId, slot) => {
    const child = allBlocks.find(b => b.parentId === parentId && b.parentSlot === slot);
    if (!child) return 32; // SLOT.MIN_WIDTH
    const childInfo = getLayoutInfo(child, allBlocks, new Set(visited));
    return childInfo.width;
  };

  // 제어 블록의 내부 영역 높이 계산
  const getSubStackHeight = (parentId, slot) => {
    const firstChild = allBlocks.find(b => b.parentId === parentId && b.parentSlot === slot);
    if (!firstChild) return 40; // 기본 빈 영역 높이
    return Math.max(getStackHeight(firstChild), 40);
  };

  // --------------------------------------------------------------------
  // buildBlockSpec에 필요한 동적 값들을 계산해서 전달
  // --------------------------------------------------------------------
  const dynamicProps = {};

  // 연산자/조건 블록의 슬롯 너비
  if (block.shape === "value-operator-2slot" || block.shape === "boolean-binary") {
    dynamicProps.leftSlotWidth = getChildWidth(block.id, "left");
    dynamicProps.rightSlotWidth = getChildWidth(block.id, "right");
  }

  // 출력/변수설정 블록의 값 슬롯 너비
  if (block.shape === "command-print" || block.shape === "variable-set") {
    dynamicProps.slotWidth = getChildWidth(block.id, "value");
  }

  // 반복문의 횟수 슬롯 너비
  if (block.shape === "command-repeat") {
    dynamicProps.slotWidth = getChildWidth(block.id, "times");
    dynamicProps.subStack1Height = getSubStackHeight(block.id, "subStack1");
  }

  // 조건문의 조건 슬롯 너비 및 내부 영역 높이
  if (["command-while", "command-if", "command-if-else"].includes(block.shape)) {
    dynamicProps.slotWidth = getChildWidth(block.id, "condition");
    dynamicProps.subStack1Height = getSubStackHeight(block.id, "subStack1");

    if (block.shape === "command-if-else") {
      dynamicProps.subStack2Height = getSubStackHeight(block.id, "subStack2");
    }
  }

  // NOT 블록
  if (block.shape === "boolean-not") {
    dynamicProps.slotWidth = getChildWidth(block.id, "condition");
  }

  // buildBlockSpec 호출 (동적 props 병합)
  const spec = buildBlockSpec({ ...block, ...dynamicProps }) || {};

  // 반환값 구성
  return {
    width: spec.width ?? 48,
    height: spec.height ?? 40,
    leftSlotWidth: dynamicProps.leftSlotWidth ?? spec.slots?.[0]?.w ?? 32,
    rightSlotWidth: dynamicProps.rightSlotWidth ?? spec.slots?.[1]?.w ?? 32,
    slotWidth: dynamicProps.slotWidth ?? spec.slots?.[0]?.w ?? 32,
    slotHeight: spec.slots?.[0]?.h ?? 24,
    subStack1Height: dynamicProps.subStack1Height ?? 40,
    subStack2Height: dynamicProps.subStack2Height ?? 40,
  };
};

// [3] ★ 핵심 추가: 블록들의 화면상 위치(x, y)를 부모 기준으로 재계산하는 함수
// [3] 블록들의 화면상 위치(x, y)를 부모 기준으로 재계산하는 함수
const calculateDisplayPositions = (blocks) => {
  // 1단계: 모든 블록의 크기(Layout)를 먼저 계산
  const blocksWithSize = blocks.map((b) => ({
    ...b,
    layout: getLayoutInfo(b, blocks),
  }));

  const blockMap = new Map(blocksWithSize.map((b) => [b.id, b]));

  // 재귀적으로 위치 조정
  const updatePosition = (blockId, absX, absY) => {
    const block = blockMap.get(blockId);
    if (!block) return;

    // 현재 블록의 화면상 위치 확정
    block.displayX = absX;
    block.displayY = absY;

    // ------------------------------------------------
    // [A] 연산자/조건 슬롯 위치 잡기 (기존 동일)
    // ------------------------------------------------
    if (block.shape === "value-operator-2slot") {
      const leftSlotWidth = block.layout?.leftSlotWidth || SLOT.MIN_WIDTH;
      const rightSlotWidth = block.layout?.rightSlotWidth || SLOT.MIN_WIDTH;
      const textLen = block.text ? block.text.length : 0;
      const textWidth = Math.max(textLen * 7, 10); // TEXT.CHAR_WIDTH = 7

      const leftChild = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "left");
      if (leftChild) {
        const childW = leftChild.layout?.width || SLOT.MIN_WIDTH;
        const offsetX = PADDING.HORIZONTAL + (leftSlotWidth - childW) / 2;
        updatePosition(leftChild.id, absX + offsetX, absY);
      }
      const rightChild = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "right");
      if (rightChild) {
        const childW = rightChild.layout?.width || SLOT.MIN_WIDTH;
        const rightSlotStart = PADDING.HORIZONTAL + leftSlotWidth + PADDING.ELEMENT_GAP + textWidth + PADDING.ELEMENT_GAP;
        const offsetX = rightSlotStart + (rightSlotWidth - childW) / 2;
        updatePosition(rightChild.id, absX + offsetX, absY);
      }
    }

    // ------------------------------------------------
    // [B] 헤더 슬롯 위치 잡기 (반복 횟수, 조건 등)
    // ------------------------------------------------
    // 1. 횟수 반복 (command-repeat)
    if (block.shape === "command-repeat") {
      const timesChild = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "times");
      if (timesChild) {
        const slotY = (BLOCK.CONTROL_HEADER_HEIGHT - SLOT.HEIGHT) / 2;
        updatePosition(timesChild.id, absX + PADDING.HORIZONTAL, absY + slotY);
      }
    }
    // 2. 조건/IF (while, if, if-else)
    if (["command-while", "command-if", "command-if-else"].includes(block.shape)) {
      const conditionChild = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "condition");
      if (conditionChild) {
        // 육각형 슬롯: x=50, y=10 (가운데 정렬)
        const slotX = block.shape === "command-while" ? 15 : 50; // while은 라벨이 뒤에 있어서 앞쪽 배치
        const slotY = 10; // 원래 위치로 복원
        const slotW = block.layout?.slotWidth || 100;
        const slotH = block.layout?.slotHeight || 30;
        const childW = conditionChild.layout?.width || 0;
        const childH = conditionChild.layout?.height || 30;
        const offsetX = slotX + (slotW - childW) / 2;
        const isValueShape = ["value-pill", "value-input", "value-string"].includes(
          conditionChild.shape
        );
        const offsetY = slotY + (slotH - childH) / 2 + (isValueShape ? -3 : 0);
        updatePosition(conditionChild.id, absX + offsetX, absY + offsetY);
      }
    }

    // ------------------------------------------------
    // [C] 내부 연결 (subStack) 배치 ★ [수정 포인트]
    // ------------------------------------------------

    // 1. ㄷ자 블록 (loop, repeat, while, if)
    if (["command-loop", "command-repeat", "command-while", "command-if"].includes(block.shape)) {
      const child = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "subStack1");
      if (child) {
        const headerHeight = BLOCK.CONTROL_HEADER_HEIGHT;
        updatePosition(child.id, absX + PADDING.HORIZONTAL, absY + headerHeight);
      }
    }

    // 2. ㅌ자 블록 (if-else)
    if (block.shape === "command-if-else") {
      // 첫 번째 입
      const child1 = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "subStack1");
      if (child1) {
        updatePosition(child1.id, absX + PADDING.HORIZONTAL, absY + BLOCK.CONTROL_HEADER_HEIGHT);
      }

      // 두 번째 입
      const child2 = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "subStack2");
      if (child2) {
        const h1 = block.layout.subStack1Height || BLOCK.COMMAND_HEIGHT;
        updatePosition(child2.id, absX + PADDING.HORIZONTAL, absY + BLOCK.CONTROL_HEADER_HEIGHT + h1 + BLOCK.CONTROL_MID_HEIGHT);
      }
    }
    // 이항 조건 배치
    if (block.shape === "boolean-binary") {
      const textW = (block.text || "").length * 7; // TEXT.CHAR_WIDTH
      const leftSlotW = block.layout?.leftSlotWidth || SLOT.MIN_WIDTH;
      const rightSlotW = block.layout?.rightSlotWidth || SLOT.MIN_WIDTH;

      const myHeight = block.layout?.height || BLOCK.VALUE_HEIGHT;
      const childYOffset = (myHeight - SLOT.HEIGHT) / 2;

      // 왼쪽 자식
      const leftChild = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "left");
      if (leftChild) {
        const childW = leftChild.layout?.width || SLOT.MIN_WIDTH;
        const offsetX = PADDING.HORIZONTAL + (leftSlotW - childW) / 2;
        updatePosition(leftChild.id, absX + offsetX, absY + childYOffset);
      }
      // 오른쪽 자식
      const rightChild = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "right");
      if (rightChild) {
        const childW = rightChild.layout?.width || SLOT.MIN_WIDTH;
        const startX = PADDING.HORIZONTAL + leftSlotW + PADDING.ELEMENT_GAP + textW + PADDING.ELEMENT_GAP;
        const offsetX = startX + (rightSlotW - childW) / 2;
        updatePosition(rightChild.id, absX + offsetX, absY + childYOffset);
      }
    }

    // [수정] NOT 블록 배치 (boolean-not) - 중앙 정렬 보정
    if (block.shape === "boolean-not") {
      const child = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "condition");
      if (child) {
        const myHeight = block.layout?.height || 30;

        // ★ [핵심 수정] (높이/2) - 15
        const childYOffset = (myHeight / 2) - 15;

        const textW = (block.text || "").length * 12;
        const slotW = block.layout?.slotWidth || 30;
        const childW = child.layout?.width || 30;

        const startX = 15 + textW + 10;
        const offsetX = startX + (slotW - childW) / 2;

        updatePosition(child.id, absX + offsetX, absY + childYOffset);
      }
    }
    if (block.shape === "variable-set") {
      const valueChild = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "value");
      if (valueChild) {
        // 레이아웃에서 실제 너비 정보 가져오기
        const label1W = (block.text || "set").length * 11;  // 한글 고려
        const varNameSlotW = block.layout?.leftSlotWidth || 70;  // 변수명 슬롯
        const label2W = (block.subText || "").length * 11;
        const valueSlotW = block.layout?.slotWidth || 50;

        // 두 번째 슬롯(value) 위치 계산: 라벨1 + 변수명슬롯 + 라벨2 뒤
        const slotX = PADDING.HORIZONTAL + label1W + PADDING.ELEMENT_GAP + varNameSlotW + PADDING.ELEMENT_GAP + label2W + PADDING.ELEMENT_GAP;
        const slotY = (BLOCK.COMMAND_HEIGHT - SLOT.HEIGHT) / 2;

        // 자식 블록 중앙 정렬
        const childW = valueChild.layout?.width || 50;
        const offsetX = slotX + (valueSlotW - childW) / 2;

        updatePosition(valueChild.id, absX + offsetX, absY + slotY);
      }
    }
    // ------------------------------------------------
    // [D] 외부 연결 (Next) 배치 ★ [수정 포인트]
    // ------------------------------------------------
    const nextChild = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "next");
    if (nextChild) {
      const myHeight = block.layout.height || 40;

      // ★ [수정] -3px (퍼즐 조각이 겹치도록 3픽셀 올려서 배치)
      updatePosition(nextChild.id, absX, absY + myHeight);
    }
    // [NEW] 출력하기 블록 내부 배치
    if (block.shape === "command-print") {
      const valueChild = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "value");
      if (valueChild) {
        const slotY = (BLOCK.COMMAND_HEIGHT - SLOT.HEIGHT) / 2;
        updatePosition(valueChild.id, absX + PADDING.HORIZONTAL, absY + slotY);
      }
    }
  };

  // 루트 블록부터 시작
  blocksWithSize.filter((b) => !b.parentId).forEach((root) => {
    let startX = root.x;
    let startY = root.y;
    // 극단적인 좌표값 처리 (서버에서 잘못된 좌표가 올 경우 리셋)
    if (isNaN(startX) || isNaN(startY) || startX > 5000 || startX < -1000 || startY > 3000 || startY < -1000) {
      console.warn(`Root block ${root.id} had extreme coordinates (${root.x}, ${root.y}), resetting to (100, 100)`);
      startX = 100;
      startY = 100;
    }
    updatePosition(root.id, startX, startY);
  });

  return blocksWithSize;
};

const App = () => {
  const [blocks, setBlocks] = useState([]);
  const [dragInfo, setDragInfo] = useState(null);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [dragOverlayPos, setDragOverlayPos] = useState(null);
  const editorRef = useRef(null);
  const [variables, setVariables] = useState([]);
  const [editingValueId, setEditingValueId] = useState(null);
  const [projectId, setProjectId] = useState(PROJECT_ID);
  const clearExpressionChain = (list, startId) => {
    const idMap = new Map((list ?? []).map((b) => [b.id, b]));
    const ids = new Set();
    const visited = new Set();
    let currentId = startId;

    while (currentId != null && !visited.has(currentId)) {
      visited.add(currentId);
      const node = idMap.get(currentId);
      if (!node || !VALUE_SHAPES.has(node.shape)) break;
      ids.add(currentId);
      currentId = node.parentId;
    }

    if (!ids.size) return list;
    return list.map((b) => (ids.has(b.id) ? { ...b, expressionId: null } : b));
  };
  const syncNow = (nextBlocks, targetIds = [], options = {}) => {
    const findBlock = (id) => nextBlocks?.find?.((b) => b.id === id);

    const addAncestorStatements = (startId, bucket) => {
      const visited = new Set();
      let current = findBlock(startId);
      while (current?.parentId != null && !visited.has(current.parentId)) {
        const parent = findBlock(current.parentId);
        if (!parent) break;
        bucket.add(parent.id);
        visited.add(parent.id);
        if (!VALUE_SHAPES.has(parent.shape)) break; // statement 블록을 만나면 종료
        current = parent;
      }
    };

    const expandTargets = (ids) => {
      const set = new Set(ids.filter((v) => v != null));

      ids.forEach((id) => addAncestorStatements(id, set));

      // 제어/연결 자식(서브스택/next/condition/times/value)만 포함해 링크 갱신
      ids.forEach((id) => {
        nextBlocks
          ?.filter?.(
            (b) =>
              b.parentId === id &&
              ["subStack1", "subStack2", "next", "condition", "times", "value"].includes(
                b.parentSlot
              )
          )
          ?.forEach?.((child) => set.add(child.id));
      });

      return [...set];
    };
    const ids = expandTargets(targetIds ?? []);
    if (!Array.isArray(nextBlocks) || ids.length === 0) return;
    syncPartialBlocks(nextBlocks, ids, undefined, options).catch((err) =>
      console.warn("블록 부분 동기화 실패:", err?.message ?? err)
    );
  };
  const handleCreateVariable = () => {
    const name = window.prompt("새 변수 이름:");
    if (name && !variables.includes(name)) {
      setVariables((prev) => [...prev, name]);
    }
  };
  const handleBlockVarChange = (id, newVarName) => {
    setBlocks((prev) => {
      let updated = prev.map((b) => (b.id === id ? { ...b, selectedVar: newVarName } : b));
      updated = clearExpressionChain(updated, id);
      syncNow(updated, [id], { includePosition: false });
      return updated;
    });
  };
  const handleBlockOpChange = (id, newOp) => {
    setBlocks((prev) => {
      let updated = prev.map((b) => (b.id === id ? { ...b, text: newOp } : b));
      updated = clearExpressionChain(updated, id);
      syncNow(updated, [id], { includePosition: false });
      return updated;
    });
  };
  const handleValueEditStart = (id) => setEditingValueId(id);
  const handleValueEditCommit = (id, newText) => {
    setBlocks((prev) => {
      let updated = prev.map((b) => {
        if (b.id !== id) return b;
        if (b.blockType === "VAR_DECLARE") {
          return { ...b, variableName: newText, text: b.text || "변수 선언" };
        }
        return { ...b, text: newText };
      });
      updated = clearExpressionChain(updated, id);
      syncNow(updated, [id], { includePosition: false });
      return updated;
    });
    setEditingValueId(null);
  };
  const handleValueEditCancel = () => setEditingValueId(null);
  // 프로젝트 변경 시 서버 블록 로드
  useEffect(() => {
    const loadFromServer = async () => {
      try {
        syncerSetProjectId(projectId);
        const [blockRes, exprRes] = await Promise.all([
          fetch(`${API_ROOT}/api/blocks/project/${projectId}`),
          fetch(`${API_ROOT}/api/expressions/project/${projectId}`),
        ]);

        const serverBlocks = blockRes.ok ? await blockRes.json() : [];
        const serverExpressions = exprRes.ok ? await exprRes.json() : [];

        registerServerBlocks(Array.isArray(serverBlocks) ? serverBlocks : []);

        const {
          blocks: mappedBlocks = [],
          nextVirtualId,
        } = mapServerBlocksToClient(Array.isArray(serverBlocks) ? serverBlocks : []);

        const { blocks: rawExpressionBlocks = [] } = mapServerExpressionsToBlocks(
          Array.isArray(serverExpressions) ? serverExpressions : [],
          { startVirtualId: typeof nextVirtualId === "number" ? nextVirtualId : -1 }
        );

        // 서버 블록 DTO에 이미 포함된 표현식(값)과 중복되는 것을 제거한다.
        const existingExprIds = new Set(
          mappedBlocks
            .filter((b) => VALUE_SHAPES.has(b.shape) && b.expressionId != null)
            .map((b) => b.expressionId)
        );
        const expressionBlocks = rawExpressionBlocks.filter(
          (b) => b.expressionId == null || !existingExprIds.has(b.expressionId)
        );

        registerServerExpressions(expressionBlocks);

        const combined = [...mappedBlocks, ...expressionBlocks];
        setBlocks(combined);

        // 서버에 선언된 변수들을 드롭다운에 반영
        const vars = combined
          .filter((b) => ["VAR_DECLARE", "VAR_ASSIGN"].includes(b.blockType))
          .map((b) => b.selectedVar || b.variableName || b.text)
          .filter(Boolean);
        if (vars.length) {
          const unique = Array.from(new Set(vars));
          setVariables(unique);
        } else {
          setVariables([]);
        }
      } catch (err) {
        console.warn("서버 블록 로드 실패:", err);
      }
    };

    loadFromServer();
  }, [projectId]);
  // -----------------------------
  // [헬퍼] 자손 블록 찾기
  // -----------------------------
  const getAllDescendants = (allBlocks, rootId) => {
    const results = [];
    const visited = new Set([rootId]); // 방어: 부모-자식 참조가 순환되더라도 한 번만 순회
    const find = (parentId) => {
      const children = allBlocks.filter((b) => b.parentId === parentId);
      children.forEach((child) => {
        if (visited.has(child.id)) return;
        visited.add(child.id);
        results.push(child);
        find(child.id);
      });
    };
    find(rootId);
    return results;
  };
  const handleBlockEdit = () => {
    // 더블클릭 편집(리터럴/값)으로 대체. 다른 블록은 미사용.
  };

  // -----------------------------
  // [A] 팔레트 드래그 시작
  // -----------------------------
  const handlePaletteDragStart = (blockTemplate, e) => {
    // 기본값 설정 제거 - 슬롯이 비어 보이도록 함
    const paletteDefaultsByType = {
      VAR_DECLARE: { variableName: "변수", variableType: "number" },
      VAR_ASSIGN: { variableName: "변수", variableType: "number" },
      FOR: {},
      WHILE: {},
      IF: {},
      PRINT: {},
    };
    const newId = Date.now();

    // 팔레트 클릭 위치를 에디터 좌표로 변환
    const startX = e.clientX;
    const startY = e.clientY;
    const toEditorCoords = (clientX, clientY) => {
      if (!editorRef.current) return { x: clientX, y: clientY };
      const rect = editorRef.current.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const editorPos = editorRef.current ? toEditorCoords(startX, startY) : { x: 80, y: 80 };
    const spec = buildBlockSpec({ ...blockTemplate, id: newId }) || {};
    const bodyW = spec?.width ?? 120;
    const bodyH = spec?.height ?? 40;

    // 팔레트 블록 내에서 클릭한 지점 비율을 구해 동일한 비율을 유지
    const targetRect = e.currentTarget?.getBoundingClientRect?.();
    const clickRatioX = targetRect ? (startX - targetRect.left) / targetRect.width : 0.5;
    const clickRatioY = targetRect ? (startY - targetRect.top) / targetRect.height : 0.5;
    const grabOffsetX = bodyW * clickRatioX;
    const grabOffsetY = bodyH * clickRatioY;

    const initX = editorPos.x - grabOffsetX;
    const initY = editorPos.y - grabOffsetY;

    // 팔레트 바로 위/근처에 보이도록, 초기 생성 위치는 클램프하지 않는다.
    // 살짝 위로 띄워 가려지는 느낌을 줄인다.
    const startPos = { x: initX, y: Math.max(0, initY - 10) };

    const newBlock = applyTypeDefaults({
      id: newId,
      blockType: blockTemplate.blockType,
      text: blockTemplate.text,
      color: blockTemplate.color,
      shape: blockTemplate.shape || "command",
      x: startPos.x,
      y: startPos.y,
      parentId: null,
      parentSlot: null,
      isInactive: true,
      category: blockTemplate.category || "control",
      variableName: blockTemplate.variableName,
      // 내부 슬롯은 비워둠 - null/undefined 유지
      condition: blockTemplate.condition ?? null,
      init: blockTemplate.init ?? null,
      increment: blockTemplate.increment ?? null,
      message: blockTemplate.message ?? null,
      value: blockTemplate.value ?? null,
      initial: blockTemplate.initial ?? null,
      ...paletteDefaultsByType[blockTemplate.blockType],
      totalWidth: spec?.width,
      height: spec?.height,
    });
    setBlocks((prev) => [...prev, newBlock]);

    setDragInfo({
      isDragging: true,
      type: "NEW",
      id: newId,
      text: blockTemplate.text,
      color: blockTemplate.color,
      shape: blockTemplate.shape || "command",
      category: blockTemplate.category,
      blockType: blockTemplate.blockType,
      variableName: blockTemplate.variableName,
      calculatedWidth: spec?.width,
      calculatedHeight: spec?.height,
      startX,
      startY,
      x: startPos.x,
      y: startPos.y,
      grabOffsetX,
      grabOffsetY,
    });
    setDragOverlayPos({ clientX: startX, clientY: startY });
  };

  // -----------------------------
  // [B] 에디터 블록 드래그 시작
  // -----------------------------
  const handleWorkspaceBlockDown = (id, e) => {
    // ★ 1. 드래그를 시작하기 전에, 현재 화면에 보이는 '정확한 위치'를 다시 계산합니다.
    const calculatedBlocks = calculateDisplayPositions(blocks);

    // 계산된 블록 목록에서 타겟을 찾습니다.
    const targetBlock = calculatedBlocks.find((b) => b.id === id);
    if (!targetBlock || !editorRef.current) return;

    // 값/리터럴 블록 더블클릭 시 편집 우선 (드래그 시작 방지)
    const editableShapes = new Set(["value-input", "value-string", "value-pill", "boolean"]);
    if (editableShapes.has(targetBlock.shape) && e.detail >= 2) {
      return;
    }

    const editorRect = editorRef.current.getBoundingClientRect();

    // ★ 2. 실제 좌표(x)가 아니라 화면상 좌표(displayX)를 사용합니다.
    const currentBlockX = targetBlock.displayX !== undefined ? targetBlock.displayX : targetBlock.x;
    const currentBlockY = targetBlock.displayY !== undefined ? targetBlock.displayY : targetBlock.y;

    const currentScreenX = editorRect.left + currentBlockX;
    const currentScreenY = editorRect.top + currentBlockY;

    // ★ 3. 자식 블록들도 '계산된 목록'에서 찾아야 올바른 위치를 알 수 있습니다.
    const descendants = getAllDescendants(calculatedBlocks, targetBlock.id);

    // ★ 순간이동 방지: displayX/displayY 기반으로 위치 저장
    const movingPositions = {};
    [targetBlock, ...descendants].forEach((b) => {
      const bX = b.displayX !== undefined ? b.displayX : b.x;
      const bY = b.displayY !== undefined ? b.displayY : b.y;
      movingPositions[b.id] = { x: bX, y: bY };
    });

    const groupBlocks = descendants.map((child) => {
      // 자식의 화면상 위치
      const childX = child.displayX !== undefined ? child.displayX : child.x;
      const childY = child.displayY !== undefined ? child.displayY : child.y;

      return {
        ...child,
        // 부모와의 거리 차이(Offset)를 '화면상 위치' 기준으로 계산
        offsetX: childX - currentBlockX,
        offsetY: childY - currentBlockY,
      };
    });

    // ★ 성능 최적화: 이동 대상 ID를 미리 Set으로 저장
    const movingIds = new Set([targetBlock.id, ...descendants.map((b) => b.id)]);

    // ★ 연결된 블록을 드래그 시작할 때 즉시 부모에서 분리 (한 번에 드래그 가능하도록)
    const originalParentId = targetBlock.parentId;
    const originalParentSlot = targetBlock.parentSlot;

    if (originalParentId != null) {
      setBlocks((prev) => {
        // ★ 모든 이동 대상 블록의 좌표를 displayX/displayY 기반으로 업데이트
        const updated = prev.map((b) => {
          if (b.id === targetBlock.id) {
            return { ...b, parentId: null, parentSlot: null, x: currentBlockX, y: currentBlockY };
          }
          // 자손 블록들도 displayX/Y 기반으로 좌표 갱신
          const pos = movingPositions[b.id];
          if (pos) {
            return { ...b, x: pos.x, y: pos.y };
          }
          return b;
        });
        // ★ 분리 API 호출 - 부모 블록 업데이트 (expression 분리 시 부모의 condition/value가 null로 됨)
        syncNow(updated, [targetBlock.id, originalParentId].filter(Boolean), {
          includePosition: true,
        });
        return updated;
      });
    }

    setDragInfo({
      isDragging: true,
      type: "MOVE",
      id: targetBlock.id,
      text: targetBlock.text,
      color: targetBlock.color,
      shape: targetBlock.shape || "command",

      initialParentId: originalParentId,
      initialParentSlot: originalParentSlot,

      startX: e.clientX,
      startY: e.clientY,

      // 드래그 중 위치 계산을 위해 초기값도 화면상 좌표로 저장
      initialBlockX: currentBlockX,
      initialBlockY: currentBlockY,
      grabOffsetX: e.clientX - currentScreenX,
      grabOffsetY: e.clientY - currentScreenY,

      ghostStartX: currentScreenX,
      ghostStartY: currentScreenY,
      x: currentScreenX,
      y: currentScreenY,
      groupBlocks, // 이제 자식들도 정확한 상대 위치를 가집니다.
      movingPositions,
      movingIds, // ★ 성능 최적화: 미리 계산된 이동 대상 ID Set
    });
  };

  // -----------------------------
  // [C] 마우스 이동
  // -----------------------------
  const handleMouseMove = (e) => {
    if (!dragInfo?.isDragging || !editorRef.current) return;
    if (dragInfo.type === "NEW") {
      setDragOverlayPos({ clientX: e.clientX, clientY: e.clientY });
    }

    const editorRect = editorRef.current.getBoundingClientRect();
    const rawX = e.clientX - (dragInfo.grabOffsetX ?? 0) - editorRect.left;
    const rawY = e.clientY - (dragInfo.grabOffsetY ?? 0) - editorRect.top;
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    // NEW 드래그 시에는 클램프하지 않고 자유 이동(화면 상단에서도 보이도록),
    // 기존 MOVE만 에디터 범위 내로 클램프
    const currentX = dragInfo.type === "NEW" ? rawX : clamp(rawX, 0, editorRect.width - 20);
    const currentY = dragInfo.type === "NEW" ? rawY : clamp(rawY, 0, editorRect.height - 20);

    if (dragInfo.type === "MOVE") {
      const deltaX = currentX - (dragInfo.initialBlockX ?? 0);
      const deltaY = currentY - (dragInfo.initialBlockY ?? 0);

      // ★ 성능 최적화: 드래그 시작 시 저장된 groupBlocks 사용 (getAllDescendants 재계산 제거)
      const movingIds = dragInfo.movingIds ?? new Set([
        dragInfo.id,
        ...(dragInfo.groupBlocks?.map((b) => b.id) ?? [])
      ]);

      setBlocks((prev) =>
        prev.map((b) => {
          if (!movingIds.has(b.id)) return b;
          const orig = dragInfo.movingPositions?.[b.id] ?? { x: b.x, y: b.y };
          return { ...b, x: orig.x + deltaX, y: orig.y + deltaY };
        })
      );
    } else if (dragInfo.type === "NEW") {
      setBlocks((prev) =>
        prev.map((b) => (b.id === dragInfo.id ? { ...b, x: currentX, y: currentY } : b))
      );
    }

    const TRASH_SIZE = 60;
    const TRASH_MARGIN = 20;
    const trashZone = {
      left: editorRect.right - TRASH_SIZE - TRASH_MARGIN,
      top: editorRect.bottom - TRASH_SIZE - TRASH_MARGIN,
      right: editorRect.right - TRASH_MARGIN,
      bottom: editorRect.bottom - TRASH_MARGIN,
    };
    const isInsideTrash =
      e.clientX >= trashZone.left &&
      e.clientX <= trashZone.right &&
      e.clientY >= trashZone.top &&
      e.clientY <= trashZone.bottom;

    setIsOverTrash(isInsideTrash);
  };
  // -----------------------------
  // [D] 마우스 뗐을 때
  // -----------------------------
  const handleMouseUp = (e) => {
    if (!dragInfo?.isDragging || !editorRef.current) return;

    // 클릭 수준의 아주 작은 움직임은 드래그로 처리하지 않고 무시
    const dragDistance = Math.hypot(
      e.clientX - dragInfo.startX,
      e.clientY - dragInfo.startY
    );
    if (dragInfo.type === "MOVE" && dragDistance < 4) {
      setDragInfo(null);
      setIsOverTrash(false);
      setDragOverlayPos(null);
      return;
    }

    // 0. 휴지통 처리 (MOVE/NEW 모두 삭제)
    if (isOverTrash) {
      const targetIds =
        dragInfo.type === "MOVE"
          ? [dragInfo.id, ...getAllDescendants(blocks, dragInfo.id).map((b) => b.id)]
          : [dragInfo.id];

      // Expression(value) 블록과 일반 블록 분리
      const targetBlocks = blocks.filter((b) => targetIds.includes(b.id));
      const expressionIds = targetBlocks
        .filter((b) => VALUE_SHAPES.has(b.shape))
        .map((b) => b.id);
      const commandIds = targetBlocks
        .filter((b) => !VALUE_SHAPES.has(b.shape))
        .map((b) => b.id);

      console.log("[휴지통 삭제] targetIds:", targetIds);
      console.log("[휴지통 삭제] expressionIds:", expressionIds);
      console.log("[휴지통 삭제] commandIds:", commandIds);

      setBlocks((prev) => prev.filter((b) => !targetIds.includes(b.id)));

      // 각각 적절한 API로 삭제
      if (commandIds.length > 0) {
        deleteServerBlocks(commandIds).catch((err) =>
          console.warn("블록 삭제 실패:", err?.message ?? err)
        );
      }
      if (expressionIds.length > 0) {
        deleteServerExpressions(expressionIds).catch((err) =>
          console.warn("Expression 삭제 실패:", err?.message ?? err)
        );
      }

      setDragInfo(null);
      setIsOverTrash(false);
      setDragOverlayPos(null);
      return;
    }

    const editorRect = editorRef.current.getBoundingClientRect();
    const isInside =
      e.clientX >= editorRect.left &&
      e.clientX <= editorRect.right &&
      e.clientY >= editorRect.top &&
      e.clientY <= editorRect.bottom;

    if (!isInside) {
      if (dragInfo.type === "NEW") {
        setBlocks((prev) => prev.filter((b) => b.id !== dragInfo.id));
      }
      setDragInfo(null);
      setIsOverTrash(false);
      setDragOverlayPos(null);
      return;
    }

    const mouseX = e.clientX - editorRect.left;
    const mouseY = e.clientY - editorRect.top;

    // 화면에 실제로 렌더된 좌표/크기를 기준으로 스냅 판정
    const layoutBlocks = calculateDisplayPositions(blocks);
    const snapBlocks = layoutBlocks.map((b) => ({
      ...b,
      x: b.displayX ?? b.x,
      y: b.displayY ?? b.y,
      layout: b.layout ?? getLayoutInfo(b, layoutBlocks),
    }));

    // 드래그 중인 블록의 대략적 크기 (스냅/배치용)
    const draggedLayout = getLayoutInfo(
      { ...dragInfo, id: dragInfo.id ?? -1, x: 0, y: 0 },
      snapBlocks
    );
    const dragWidth = draggedLayout?.width ?? 40;
    const dragHeight = draggedLayout?.height ?? 40;
    // Y 가중치를 1.3으로 설정해 세로 오프셋에 조금 더 민감하게
    // Y 가중치를 1.2로 설정하고, 퍼즐 돌출부만큼 약간 위로 보정(-4)
    const dist2d = (x1, y1, x2, y2) => Math.hypot(x1 - x2, (y1 - y2 - 4) * 1.2);

    let finalX = 0;
    let finalY = 0;

    // 1. 기본 위치 계산 (블록 좌상단 기준)
    const offsetX = dragInfo.grabOffsetX ?? 0;
    const offsetY = dragInfo.grabOffsetY ?? 0;
    finalX = mouseX - offsetX;
    finalY = mouseY - offsetY;

    // 2. 자석 효과 (Snap)
    const SNAP_DISTANCE = 18;
    const SNAP_RANGE_OP = 28;

    let newParentId = null;
    let newParentSlot = null;

    const myGroupIds = [dragInfo.id, ...(dragInfo.groupBlocks?.map((b) => b.id) || [])];

    // 이 블록이 '문장(Statement)' 형태인지 확인 (값이나 조건 블록이 아닌 경우)
    const isStatementBlock = !["value-pill", "value-operator-2slot", "boolean"].includes(dragInfo.shape);


    // 드롭 시에만 에디터 경계 클램프 적용 (팔레트 드래그도 포함)
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    finalX = clamp(finalX, 0, Math.max(0, editorRect.width - dragWidth));
    finalY = clamp(finalY, 0, Math.max(0, editorRect.height - dragHeight));

    // =================================================================
    // [CASE A] 값/연산자 블록 (기존 유지)
    // =================================================================
    const isValueBlock = ["value-pill", "value-operator-2slot", "value-input", "value-string"].includes(dragInfo.shape);

    if (isValueBlock) {

      let bestCandidate = null;
      let minDistance = SNAP_RANGE_OP;
      const anchorX = finalX + dragWidth / 2;
      const anchorY = finalY + dragHeight / 2;

      snapBlocks.forEach((other) => {
        // 자기 자신이나 그룹은 제외
        if (myGroupIds.includes(other.id)) return;
        // 부모에서 떼어내는 중이라면 제외
        if (dragInfo.type === "MOVE" && other.id === dragInfo.initialParentId) return;

        // -------------------------------------------------------------
        // 1. 산술 연산자 블록 (+, -, *, /) 구멍
        // -------------------------------------------------------------
        if (other.shape === "value-operator-2slot") {
          const isLeftFull = snapBlocks.some(b => b.parentId === other.id && b.parentSlot === "left" && b.id !== dragInfo.id);
          const isRightFull = snapBlocks.some(b => b.parentId === other.id && b.parentSlot === "right" && b.id !== dragInfo.id);

          const layout = other.layout ?? getLayoutInfo(other, snapBlocks);
          // 왼쪽 구멍 중심
          const lX = other.x + 15 + (layout.leftSlotWidth / 2);
          const lY = other.y + 20; // 높이 중간
          // 오른쪽 구멍 중심
          const rX = other.x + layout.width - 15 - (layout.rightSlotWidth / 2);
          const rY = other.y + 20;

          const dL = dist2d(lX, lY, anchorX, anchorY);
          const dR = dist2d(rX, rY, anchorX, anchorY);

          if (dL < minDistance && !isLeftFull) {
            minDistance = dL;
            bestCandidate = { block: other, slot: "left", snapX: lX - dragWidth / 2, snapY: lY - dragHeight / 2 };
          }
          if (dR < minDistance && !isRightFull) {
            minDistance = dR;
            bestCandidate = { block: other, slot: "right", snapX: rX - dragWidth / 2, snapY: rY - dragHeight / 2 };
          }
        }

        // -------------------------------------------------------------
        // 2. [NEW] 논리 연산자 블록 (>, <, =, AND, OR) 구멍 ★ 추가됨
        // -------------------------------------------------------------
        if (other.shape === "boolean-binary") {
          const isLeftFull = snapBlocks.some(b => b.parentId === other.id && b.parentSlot === "left" && b.id !== dragInfo.id);
          const isRightFull = snapBlocks.some(b => b.parentId === other.id && b.parentSlot === "right" && b.id !== dragInfo.id);

          const layout = other.layout ?? getLayoutInfo(other, snapBlocks);

          // 높이의 절반 (중앙 정렬)
          const midY = layout.height / 2;

          // 왼쪽 구멍 중심
          const lX = other.x + 15 + (layout.leftSlotWidth / 2);
          const lY = other.y + midY;

          // 오른쪽 구멍 중심
          const rX = other.x + layout.width - 15 - (layout.rightSlotWidth / 2);
          const rY = other.y + midY;

          const dL = dist2d(lX, lY, anchorX, anchorY);
          const dR = dist2d(rX, rY, anchorX, anchorY);

          if (dL < minDistance && !isLeftFull) {
            minDistance = dL;
            bestCandidate = { block: other, slot: "left", snapX: lX - dragWidth / 2, snapY: lY - dragHeight / 2 };
          }
          if (dR < minDistance && !isRightFull) {
            minDistance = dR;
            bestCandidate = { block: other, slot: "right", snapX: rX - dragWidth / 2, snapY: rY - dragHeight / 2 };
          }
        }

        // -------------------------------------------------------------
        // 3. [NEW] NOT 블록 (아니라면) 구멍 ★ 추가됨
        // -------------------------------------------------------------
        if (other.shape === "boolean-not") {
          const isFull = snapBlocks.some(b => b.parentId === other.id && b.parentSlot === "condition" && b.id !== dragInfo.id);
          const layout = other.layout ?? getLayoutInfo(other, snapBlocks);

          // 구멍은 오른쪽에 위치
          const sX = other.x + layout.width - 15 - (layout.slotWidth / 2);
          const sY = other.y + (layout.height / 2);

          const dist = dist2d(sX, sY, anchorX, anchorY);
          if (dist < minDistance && !isFull) {
            minDistance = dist;
            bestCandidate = { block: other, slot: "condition", snapX: sX - dragWidth / 2, snapY: sY - dragHeight / 2 };
          }
        }

        // -------------------------------------------------------------
        // 4. 반복문 (n번 반복) 횟수 구멍
        // -------------------------------------------------------------
        if (other.shape === "command-repeat") {
          const isFull = snapBlocks.some(b => b.parentId === other.id && b.parentSlot === "times" && b.id !== dragInfo.id);

          // 구멍 위치 (x=15 근처)
          const sX = other.x + 15 + 15;
          const sY = other.y + 25; // 헤더(50)의 중간

          const dist = dist2d(sX, sY, anchorX, anchorY);
          if (dist < minDistance && !isFull) {
            minDistance = dist;
            bestCandidate = { block: other, slot: "times", snapX: sX - dragWidth / 2, snapY: sY - dragHeight / 2 };
          }
        }

        // -------------------------------------------------------------
        // 5. 출력하기 블록 구멍
        // -------------------------------------------------------------
        if (other.shape === "command-print") {
          const isFull = snapBlocks.some(b => b.parentId === other.id && b.parentSlot === "value" && b.id !== dragInfo.id);

          // 구멍 위치 (x=15 근처)
          const sX = other.x + 15 + 15;
          const sY = other.y + 20;

          const dist = dist2d(sX, sY, anchorX, anchorY);
          if (dist < minDistance && !isFull) {
            minDistance = dist;
            bestCandidate = { block: other, slot: "value", snapX: sX - dragWidth / 2, snapY: sY - dragHeight / 2 };
          }
        }
        if (other.shape === "variable-set") {
          // 1. 이미 차 있는지 확인
          const isFull = snapBlocks.some(b =>
            b.parentId === other.id && b.parentSlot === "value" && b.id !== dragInfo.id
          );

          // 2. 구멍의 정확한 X 좌표 계산 (공식 적용)
          const label1W = (other.text || "set").length * 12;
          const label2W = (other.subText || "").length * 12;

          // 구멍 시작점(X) = 15 + 텍스트1 + 10 + 드롭다운(100) + 10 + 텍스트2 + 10
          const slotStartX = 15 + label1W + 10 + 100 + 10 + label2W + 10;

          // 구멍 중심점 (구멍크기 30 기준, 반지름 15 더함)
          const slotCenterX = other.x + slotStartX + 15;
          const slotCenterY = other.y + 20; // 높이 40의 중간

          // 3. 거리 측정
          const dist = dist2d(slotCenterX, slotCenterY, anchorX, anchorY);

          if (dist < minDistance && !isFull) {
            minDistance = dist;
            bestCandidate = { block: other, slot: "value", snapX: slotCenterX - dragWidth / 2, snapY: slotCenterY - dragHeight / 2 };
          }
        }
      });


      if (bestCandidate) {
        const target = bestCandidate.block;
        newParentId = target.id;
        newParentSlot = bestCandidate.slot;
        // 슬롯 중심을 기준으로 드롭 좌표를 보정
        if (bestCandidate.snapX != null && bestCandidate.snapY != null) {
          finalX = bestCandidate.snapX;
          finalY = bestCandidate.snapY;
        }
      }
    }
    // =================================================================
    // [CASE B] 조건(Boolean) 블록 (기존 유지)
    // =================================================================
    // App.jsx - handleMouseUp - [CASE B] (조건 블록 드래그) 내부
    else if (dragInfo.shape === "boolean" || dragInfo.shape === "boolean-binary" || dragInfo.shape === "boolean-not") {

      let bestCandidate = null;
      let minDistance = SNAP_DISTANCE;
      const anchorX = finalX + dragWidth / 2;
      const anchorY = finalY + dragHeight / 2;

      snapBlocks.forEach((other) => {
        if (myGroupIds.includes(other.id)) return;

        // -------------------------------------------------------------
        // 1. 제어문 헤더 구멍 (만약, 반복 등)
        // -------------------------------------------------------------
        if (["command-with-condition-slot", "command-if", "command-if-else", "command-while"].includes(other.shape)) {
          // (기존 제어문 구멍 로직 동일...)
          const isOccupied = snapBlocks.some(b => b.parentId === other.id && (b.parentSlot === "condition" || b.parentSlot === "cond") && b.id !== dragInfo.id);
          if (isOccupied) return;

          const slotCenterX = other.shape === "command-while" ? other.x + 15 + 50 : other.x + 50 + 50; // 대략
          const slotCenterY = other.y + 25;

          const dist = dist2d(slotCenterX, slotCenterY, anchorX, anchorY);
          if (dist < minDistance) {
            minDistance = dist;
            bestCandidate = { block: other, slot: "condition", snapX: slotCenterX - dragWidth / 2, snapY: slotCenterY - dragHeight / 2 };
          }
        }

        // -------------------------------------------------------------
        // 2. [NEW] 논리 연산자 (AND, OR) 구멍에 '조건' 넣기
        // -------------------------------------------------------------
        if (other.shape === "boolean-binary" && ["그리고", "또는"].includes(other.text)) {
          const isLeftFull = snapBlocks.some(b => b.parentId === other.id && b.parentSlot === "left" && b.id !== dragInfo.id);
          const isRightFull = snapBlocks.some(b => b.parentId === other.id && b.parentSlot === "right" && b.id !== dragInfo.id);

          const layout = other.layout ?? getLayoutInfo(other, snapBlocks);
          const midY = layout.height / 2;

          const lX = other.x + 15 + (layout.leftSlotWidth / 2);
          const lY = other.y + midY;
          const rX = other.x + layout.width - 15 - (layout.rightSlotWidth / 2);
          const rY = other.y + midY;

          const dL = dist2d(lX, lY, anchorX, anchorY);
          const dR = dist2d(rX, rY, anchorX, anchorY);

          if (dL < minDistance && !isLeftFull) {
            minDistance = dL;
            bestCandidate = { block: other, slot: "left", snapX: lX - dragWidth / 2, snapY: lY - dragHeight / 2 };
          }
          if (dR < minDistance && !isRightFull) {
            minDistance = dR;
            bestCandidate = { block: other, slot: "right", snapX: rX - dragWidth / 2, snapY: rY - dragHeight / 2 };
          }
        }

        // -------------------------------------------------------------
        // 3. [NEW] NOT 블록 구멍에 '조건' 넣기
        // -------------------------------------------------------------
        if (other.shape === "boolean-not") {
          const isFull = snapBlocks.some(b => b.parentId === other.id && b.parentSlot === "condition" && b.id !== dragInfo.id);
          const layout = other.layout ?? getLayoutInfo(other, snapBlocks);

          // 구멍은 오른쪽
          const sX = other.x + layout.width - 15 - (layout.slotWidth / 2);
          const sY = other.y + (layout.height / 2);

          const dist = dist2d(sX, sY, anchorX, anchorY);
          if (dist < minDistance && !isFull) {
            minDistance = dist;
            bestCandidate = { block: other, slot: "condition", snapX: sX - dragWidth / 2, snapY: sY - dragHeight / 2 };
          }
        }
      });

      if (bestCandidate) {
        const target = bestCandidate.block;
        newParentId = target.id;
        newParentSlot = bestCandidate.slot; // slot 이름 주의 (condition, left, right)

        // 슬롯 중심을 기준으로 드롭 좌표를 보정
        if (bestCandidate.snapX != null && bestCandidate.snapY != null) {
          finalX = bestCandidate.snapX;
          finalY = bestCandidate.snapY;
        }
      }
    }


    // ★★★ [여기서부터 새로 추가/변경된 부분] ★★★

    else if (isStatementBlock) {

      let snapped = false;
      const anchorX = finalX;
      const anchorY = finalY;

      // =================================================================
      // [CASE C] ㄷ자 블록 내부 연결 (subStack) - 우선 순위 높음
      // =================================================================
      // 마우스가 블록의 "입" 근처에 있으면 안으로 넣습니다.

      let bestInner = null;
      let minInnerDist = SNAP_DISTANCE;

      snapBlocks.forEach((other) => {
        if (myGroupIds.includes(other.id)) return;
        if (dragInfo.type === "MOVE" && other.id === dragInfo.initialParentId) return;

        // ㄷ자 형태 블록인지 확인
        const isCShape = ["command-loop", "command-repeat", "command-while", "command-if", "command-if-else"].includes(other.shape);
        if (!isCShape) return;

        // 1. 첫 번째 입 (subStack1) 확인
        // 헤더 높이: if/while/repeat 계열은 50, 일반 loop는 40
        const headerHeight = (other.shape === "command-loop") ? 40 : 50;

        // 도킹 포인트: 들여쓰기(15)된 곳, 헤더 바로 아래
        const dockX = other.x + 15;
        const dockY = other.y + headerHeight;

        const dist1 = dist2d(dockX, dockY, anchorX, anchorY);

        // 이미 첫 칸에 누군가 있으면 못 들어감 (간단한 구현을 위해)
        const isSub1Full = snapBlocks.some(b => b.parentId === other.id && b.parentSlot === "subStack1" && b.id !== dragInfo.id);

        if (dist1 < minInnerDist && !isSub1Full) {
          minInnerDist = dist1;
          bestInner = { block: other, slot: "subStack1", y: dockY };
        }

        // 2. 두 번째 입 (subStack2) - IF-ELSE 인 경우만
        if (other.shape === "command-if-else") {
          const layout = other.layout ?? getLayoutInfo(other, snapBlocks);
          const h1 = layout.subStack1Height || 30;
          const midHeight = 40; // '아니면' 바 높이

          const dockY2 = other.y + headerHeight + h1 + midHeight;
          const dist2 = dist2d(dockX, dockY2, anchorX, anchorY);

          const isSub2Full = snapBlocks.some(b => b.parentId === other.id && b.parentSlot === "subStack2" && b.id !== dragInfo.id);

          if (dist2 < minInnerDist && !isSub2Full) {
            minInnerDist = dist2;
            bestInner = { block: other, slot: "subStack2", y: dockY2 };
          }
        }
      });

      if (bestInner) {
        newParentId = bestInner.block.id;
        newParentSlot = bestInner.slot;
        finalX = bestInner.block.x + 15; // 들여쓰기 위치
        finalY = bestInner.y;            // 계산된 Y 위치
        snapped = true;
      }


      // =================================================================
      // [CASE D] 일반 외부 연결 (Next Block) - 내부 연결이 안 됐을 때만
      // 값/조건(알약/불린/연산자) 블록은 next 체인에 들어가지 못하게 막는다.
      // =================================================================
      const isValueShapeBeingDragged = VALUE_SHAPES.has(dragInfo?.shape);
      if (!snapped && !isValueShapeBeingDragged) {
        let bestNext = null;
        let minNextDist = SNAP_DISTANCE;

        snapBlocks.forEach((other) => {
          if (myGroupIds.includes(other.id)) return;
          // 값/조건 블록 등은 아래에 붙일 수 없음
          if (
            ["value-pill", "value-operator-2slot", "boolean", "boolean-binary", "boolean-not"].includes(
              other.shape
            )
          )
            return;

          // 이미 내 밑에 누가 붙어있으면 안됨 (단순화)
          const isNextOccupied = snapBlocks.some(b => b.parentId === other.id && b.parentSlot === "next" && b.id !== dragInfo.id);
          if (isNextOccupied) return;

          const layout = other.layout ?? getLayoutInfo(other, snapBlocks);
          const dockX = other.x;
          const dockY = other.y + layout.height; // 블록 발끝

          const dist = dist2d(dockX, dockY, anchorX, anchorY);

          if (dist < minNextDist) {
            minNextDist = dist;
            bestNext = { block: other, y: dockY };
          }
        });

        if (bestNext) {
          // ★ [핵심 변경] 좌표만 맞추는 게 아니라 부모-자식 관계를 맺어줍니다.
          newParentId = bestNext.block.id;
          newParentSlot = "next"; // "너의 다음 차례는 나야"

          // 위치는 렌더링 시 자동 계산되므로 여기선 대략적으로만
          finalX = bestNext.block.x;
          finalY = bestNext.y;
          snapped = true;
        }
      }
    }

    // 최종 위치를 에디터 영역 안으로 한 번 더 보정
    const clampPos = (v, min, max) => Math.max(min, Math.min(max, v));
    finalX = clampPos(finalX, 0, Math.max(0, editorRect.width - dragWidth));
    finalY = clampPos(finalY, 0, Math.max(0, editorRect.height - dragHeight));

    // 3. 상태 업데이트
    if (dragInfo.type === "NEW") {
      setBlocks((prev) => {
        const exists = prev.some((b) => b.id === dragInfo.id);
        if (!exists) return prev;
        const updated = prev.map((b) =>
          b.id === dragInfo.id
            ? { ...b, parentId: newParentId, parentSlot: newParentSlot, isInactive: false }
            : b
        );
        syncNow(updated, [dragInfo.id, newParentId].filter(Boolean), {
          includePosition: true,
        });
        return updated;
      });
    } else if (dragInfo.type === "MOVE") {
      // MOVE: 위치는 이미 mousemove에서 반영됨, 여기서 부모/슬롯만 갱신
      setBlocks((prevBlocks) => {
        const target = prevBlocks.find((b) => b.id === dragInfo.id);
        if (!target) return prevBlocks;

        const updated = prevBlocks.map((b) =>
          b.id === dragInfo.id ? { ...b, parentId: newParentId, parentSlot: newParentSlot } : b
        );

        // API 호출 조건:
        // 1. 새 연결이 있으면 (newParentId != null) → 연결 API 필요
        // 2. 단순 이동 (initialParent 없고 newParent도 없음) → 위치 업데이트 API
        // 3. 분리 후 새 연결 없음 (initialParent 있고 newParent 없음) → 이미 분리 API 호출됨, 스킵
        const wasDetached = dragInfo.initialParentId != null;
        const hasNewConnection = newParentId != null;
        const isSimpleMove = !wasDetached && !hasNewConnection;

        if (hasNewConnection || isSimpleMove) {
          // 새 연결이거나 단순 이동일 때만 동기화
          syncNow(updated, [dragInfo.id, newParentId].filter(Boolean), {
            includePosition: true,
          });
        }
        // wasDetached && !hasNewConnection 인 경우: 분리만 한 것이므로 이미 handleWorkspaceBlockDown에서 동기화됨

        return updated;
      });
    }

    setDragInfo(null);
    setIsOverTrash(false);
    setDragOverlayPos(null);
  };

  const hiddenIds = [];

  // ★ [중요] 렌더링 직전에 모든 블록의 위치와 크기를 다시 계산합니다.
  // 이렇게 하면 부모가 커질 때 자식의 위치도 자동으로 수정된 좌표(displayX, displayY)를 갖게 됩니다.
  const calculated = calculateDisplayPositions(blocks).map(b => ({
    ...b,
    // 1. 위치 보정값 적용
    x: (b.displayX !== undefined) ? b.displayX : b.x,
    y: (b.displayY !== undefined) ? b.displayY : b.y,

    // 2. 크기 정보 전달
    totalWidth: b.layout.width,
    height: b.layout.height,

    // ★★★ [가장 중요] 이 부분이 빠져서 안 늘어났던 것입니다! ★★★
    // 계산된 '내부 높이'를 Block.jsx에게 전달해야 ㄷ자 입을 벌립니다.
    subStack1Height: b.layout.subStack1Height,
    subStack2Height: b.layout.subStack2Height,

    // 3. 슬롯 너비 전달
    leftSlotWidth: b.layout.leftSlotWidth,
    rightSlotWidth: b.layout.rightSlotWidth,
    slotWidth: b.layout.slotWidth,
  }));
  const depthCache = new Map();
  const nodeById = new Map(calculated.map((b) => [b.id, b]));
  const getDepth = (id, visiting = new Set()) => {
    if (depthCache.has(id)) return depthCache.get(id);
    if (visiting.has(id)) {
      depthCache.set(id, 0);
      return 0;
    }
    visiting.add(id);
    const node = nodeById.get(id);
    if (!node || node.parentId == null) {
      depthCache.set(id, 0);
      visiting.delete(id);
      return 0;
    }
    const d = 1 + getDepth(node.parentId, visiting);
    depthCache.set(id, d);
    visiting.delete(id);
    return d;
  };
  const sortedByDepth = [...calculated].sort((a, b) => {
    const da = getDepth(a.id);
    const db = getDepth(b.id);
    if (da !== db) return da - db;
    return (a.order ?? 0) - (b.order ?? 0);
  });
  const blocksToRender = (() => {
    const dragId = dragInfo?.id;
    if (dragInfo?.isDragging && dragInfo.type === "NEW") {
      const list = sortedByDepth.filter((b) => b.id !== dragId);
      if (editingValueId != null) {
        return [
          ...list.filter((b) => b.id !== editingValueId),
          ...list.filter((b) => b.id === editingValueId),
        ];
      }
      return list;
    }
    if (dragInfo?.isDragging && dragInfo.type === "MOVE") {
      const groupIds = new Set([dragId, ...getAllDescendants(sortedByDepth, dragId).map((b) => b.id)]);
      const nonGroup = sortedByDepth.filter((b) => !groupIds.has(b.id));
      const group = sortedByDepth
        .filter((b) => groupIds.has(b.id))
        .sort((a, b) => {
          const da = getDepth(a.id);
          const db = getDepth(b.id);
          if (da !== db) return da - db;
          return (a.order ?? 0) - (b.order ?? 0);
        });
      let list = [...nonGroup, ...group];
      if (editingValueId != null) {
        list = [
          ...list.filter((b) => b.id !== editingValueId),
          ...list.filter((b) => b.id === editingValueId),
        ];
      }
      return list;
    }
    if (editingValueId != null) {
      return [
        ...sortedByDepth.filter((b) => b.id !== editingValueId),
        ...sortedByDepth.filter((b) => b.id === editingValueId),
      ];
    }
    return sortedByDepth;
  })();

  const dragOverlay = (() => {
    if (!dragInfo?.isDragging || dragInfo.type !== "NEW" || !dragOverlayPos) return null;
    const spec = buildBlockSpec(dragInfo) || {};
    const left = dragOverlayPos.clientX - (dragInfo.grabOffsetX ?? 0);
    const top = dragOverlayPos.clientY - (dragInfo.grabOffsetY ?? 0);
    return (
      <div
        style={{
          position: "fixed",
          left,
          top,
          pointerEvents: "none",
          zIndex: 9999,
        }}
      >
        <svg width={spec.width ?? 120} height={spec.height ?? 40}>
          <BlockBase spec={spec} />
        </svg>
      </div>
    );
  })();

  const editorContent = (
    <div
      ref={editorRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      <BlockEditorPane
        blocks={blocksToRender}
        hiddenIds={hiddenIds}
        onBlockDown={handleWorkspaceBlockDown}
        onBlockEdit={handleBlockEdit}
        isOverTrash={isOverTrash}

        // ★ [NEW] 변수 목록과 변경 함수 전달
        variables={variables}
        onVarChange={handleBlockVarChange}
        onOpChange={handleBlockOpChange}
        onValueEditStart={handleValueEditStart}
        onValueEditCommit={handleValueEditCommit}
        onValueEditCancel={handleValueEditCancel}
        editingValueId={editingValueId}
      />
    </div>
  );

  const paletteContent = (
    <BlockPalettePane
      onDragStart={handlePaletteDragStart}
      // ★ [NEW] props 전달
      variables={variables}
      onCreateVariable={handleCreateVariable}
    />
  );

  const outputContent = <RunPane blocks={blocks} projectId={projectId} />;

  const projectSelector = (
    <div
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        zIndex: 12000,
        display: "flex",
        gap: 8,
        background: "rgba(255,255,255,0.8)",
        padding: "6px 8px",
        borderRadius: "8px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
      }}
    >
      {[1, 2, 3, 4].map((pid) => (
        <button
          key={pid}
          onClick={() => {
            setBlocks([]);
            setProjectId(pid);
          }}
          style={{
            padding: "6px 10px",
            borderRadius: "6px",
            border: pid === projectId ? "2px solid #4CBFE6" : "1px solid #bbb",
            background: pid === projectId ? "#e8f7ff" : "#fff",
            fontWeight: pid === projectId ? "bold" : "normal",
            cursor: "pointer",
          }}
        >
          프로젝트 {pid}
        </button>
      ))}
    </div>
  );

  return (
    <div
      className="app-container-logic"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ height: "100vh" }}
    >
      {projectSelector}
      <AppLayout
        editor={editorContent}
        palette={paletteContent}
        output={outputContent}
      />
      {dragOverlay}
    </div>
  );
};

export default App;
