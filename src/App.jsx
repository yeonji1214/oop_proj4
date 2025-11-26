import React, { useState, useRef } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { BlockEditorPane } from "./components/editor/BlockEditorPane";
import { BlockPalettePane } from "./components/editor/BlockPalettePane";
import Block from "./components/editor/Block";
import { RunPane } from "./components/run/RunPane";

// [1] 블록 모양에 따른 높이 반환 헬퍼 함수
const getBlockHeight = (shape) => {
  switch (shape) {
    case "command-with-condition-slot": // 만약 ... 이라면
      return 50;
    case "command": // 무한 반복하기, 이동하기 등
      return 40;
    default:
      return 40; // 기본값
  }
};

// [2] 블록 ID를 받아 재귀적으로 크기와 레이아웃 정보를 계산하는 헬퍼 함수
// [2] 블록 ID를 받아 재귀적으로 크기와 레이아웃 정보를 계산하는 헬퍼 함수
const getLayoutInfo = (block, allBlocks) => {
  if (!block) return { width: 0, height: 0, leftSlotWidth: 0, rightSlotWidth: 0 };

  // --------------------------------------------------------------------
  // [헬퍼 함수] 연결된 블록들의 높이 합산 (Stack Height)
  // "내 높이" + "내 밑에 붙은(next) 녀석들의 높이"를 재귀적으로 구함
  // --------------------------------------------------------------------
  const getStackHeight = (node) => {
    if (!node) return 0;
    
    // 1. 현재 노드의 자체 크기 계산 (재귀 호출로 정확한 크기 확보)
    // 주의: 여기서 무한루프 방지를 위해 node가 block 자신이면 안됨 (그럴 일은 없지만)
    const nodeLayout = getLayoutInfo(node, allBlocks);
    
    // 2. 내 바로 밑(next)에 붙은 블록 찾기
    const nextNode = allBlocks.find(b => b.parentId === node.id && b.parentSlot === "next");
    
    // 3. 내 높이 + 내 다음 블록들의 높이 합
    return nodeLayout.height + getStackHeight(nextNode);
  };
  // --------------------------------------------------------------------


  const textLen = block.text ? block.text.length : 0;
  const textWidth = Math.max(textLen * 12, 10);

  // ====================================================
  // 1. 값(알약) & 육각형 블록 (기본 높이 30)
  // ====================================================
  if (block.shape === "value-pill" || block.shape === "boolean") {
    const isHex = block.shape === "boolean";
    const padding = isHex ? 40 : 24;
    return { 
      width: textWidth + padding, 
      height: 30, 
      leftSlotWidth: 0, 
      rightSlotWidth: 0 
    };
  }


  // ====================================================
  // 2. 연산자 블록 (자식 높이에 따라 자동 조절)
  // ====================================================
  if (block.shape === "value-operator-2slot") {
    const leftChild = allBlocks.find(b => b.parentId === block.id && b.parentSlot === "left");
    const rightChild = allBlocks.find(b => b.parentId === block.id && b.parentSlot === "right");

    const leftInfo = leftChild ? getLayoutInfo(leftChild, allBlocks) : { width: 30, height: 30 };
    const rightInfo = rightChild ? getLayoutInfo(rightChild, allBlocks) : { width: 30, height: 30 };

    const maxChildHeight = Math.max(leftInfo.height, rightInfo.height);
    const myHeight = (leftChild || rightChild) ? maxChildHeight + 2 : 30;

    const totalWidth = 15 + leftInfo.width + 10 + textWidth + 10 + rightInfo.width + 15;

    return {
      width: totalWidth,
      height: myHeight,
      leftSlotWidth: leftInfo.width,
      rightSlotWidth: rightInfo.width,
    };
  }

  // ====================================================
  // 3. ㄷ자 블록 (loop, repeat, while, if) - 높이 늘어남!
  // ====================================================
  const isLoop = ["command-loop", "command-repeat", "command-while"].includes(block.shape);
  const isIf = ["command-if"].includes(block.shape);
  
  if (isLoop || isIf) {
    let slotWidth = 30; 

    // 헤더에 있는 구멍(Slot) 너비 계산
    if (block.shape === "command-repeat") {
        const child = allBlocks.find(b => b.parentId === block.id && b.parentSlot === "times");
        slotWidth = child ? getLayoutInfo(child, allBlocks).width : 30;
    } else if (block.shape === "command-while" || block.shape === "command-if") {
        const child = allBlocks.find(b => b.parentId === block.id && (b.parentSlot === "condition" || b.parentSlot === "cond"));
        slotWidth = child ? getLayoutInfo(child, allBlocks).width : 100;
    }

    // ★ [핵심 수정] 내부 내용물 높이 계산 (getStackHeight 사용)
    const firstStackBlock = allBlocks.find(b => b.parentId === block.id && b.parentSlot === "subStack1");
    
    // 자식이 있으면 전체 스택 높이, 없으면 0
    const rawContentHeight = firstStackBlock ? getStackHeight(firstStackBlock) : 0;
    // 최소 높이는 30 유지
    const contentHeight = Math.max(rawContentHeight, 30);

    // 너비 계산
    let labelWidth = textWidth;
    if (block.shape === "command-repeat") labelWidth = 20 + slotWidth + 10 + ("번 반복하기".length*14) + 20;
    else if (block.shape === "command-while") labelWidth = 20 + slotWidth + 10 + ("인 동안 반복하기".length*14) + 20;
    else if (block.shape === "command-if") labelWidth = 40 + 10 + slotWidth + 10 + 40 + 20;
    
    const totalWidth = Math.max(labelWidth, textWidth + 40);

    // 헤더 높이: 일반 loop는 40, 나머지는 구멍 때문에 50
    const headerHeight = (block.shape === "command-loop") ? 40 : 50;

    return {
      width: totalWidth,
      // 전체 높이 = 헤더 + 늘어난 내용 + 바닥(30)
      height: headerHeight + contentHeight + 30, 
      slotWidth,
      subStack1Height: contentHeight, // Block.jsx가 이 값을 보고 입을 벌림
    };
  }

  // ====================================================
  // 4. ㅌ자 블록 (IF-ELSE) - 높이 늘어남!
  // ====================================================
  if (block.shape === "command-if-else") {
    const condChild = allBlocks.find(b => b.parentId === block.id && b.parentSlot === "condition");
    const slotWidth = condChild ? getLayoutInfo(condChild, allBlocks).width : 100;

    // 첫 번째 입 높이
    const firstStack1 = allBlocks.find(b => b.parentId === block.id && b.parentSlot === "subStack1");
    const h1 = Math.max(firstStack1 ? getStackHeight(firstStack1) : 0, 30);

    // 두 번째 입 높이
    const firstStack2 = allBlocks.find(b => b.parentId === block.id && b.parentSlot === "subStack2");
    const h2 = Math.max(firstStack2 ? getStackHeight(firstStack2) : 0, 30);

    const totalWidth = 40 + 10 + slotWidth + 10 + 40 + 20;

    return {
      width: totalWidth,
      // 전체 높이 = 헤더(50) + 내용1 + 중간바(40) + 내용2 + 바닥(30)
      height: 50 + h1 + 40 + h2 + 30, 
      slotWidth,
      subStack1Height: h1,
      subStack2Height: h2,
    };
  }
  if (block.shape === "command-print") {
      // "value"라는 이름의 슬롯에 자식이 있다고 가정
      const valueChild = allBlocks.find(b => b.parentId === block.id && b.parentSlot === "value");
      const slotWidth = valueChild ? getLayoutInfo(valueChild, allBlocks).width : 30;
      
      const labelW = (block.text || "출력하기").length * 14;
      const totalWidth = 15 + slotWidth + 10 + labelW + 20;

      return {
          width: totalWidth,
          height: 40, // 높이는 고정
          slotWidth,  // Block.jsx로 전달
      };
  }

  if (block.shape === "value-input") {
    // 텍스트 길이 + 좌우 여백(24)
    const w = textWidth + 24; 
    return { width: w, height: 30, leftSlotWidth: 0, rightSlotWidth: 0 };
  }
  // [NEW] 문자열 블록 크기 계산
  if (block.shape === "value-string") {
      return { width: textWidth + 30, height: 30, leftSlotWidth: 0, rightSlotWidth: 0 };
  }
  if (block.shape === "boolean-binary") {
    const leftChild = allBlocks.find(b => b.parentId === block.id && b.parentSlot === "left");
    const rightChild = allBlocks.find(b => b.parentId === block.id && b.parentSlot === "right");

    const leftInfo = leftChild ? getLayoutInfo(leftChild, allBlocks) : { width: 30, height: 30 };
    const rightInfo = rightChild ? getLayoutInfo(rightChild, allBlocks) : { width: 30, height: 30 };

    const textW = (block.text || "").length * 12;
    const totalWidth = 15 + leftInfo.width + 10 + textW + 10 + rightInfo.width + 15;
    
    // ★ [핵심] 자식 중 큰 높이 + 2px (부모가 감싸야 하므로)
    const maxChildHeight = Math.max(leftInfo.height, rightInfo.height);
    const myHeight = (leftChild || rightChild) ? maxChildHeight + 2 : 30;

    return {
      width: totalWidth,
      height: myHeight, // 동적 높이
      leftSlotWidth: leftInfo.width,
      rightSlotWidth: rightInfo.width,
    };
  }

  // ====================================================
  // [수정] 단항 조건 (NOT) - 높이 계산 추가
  // ====================================================
  if (block.shape === "boolean-not") {
    const child = allBlocks.find(b => b.parentId === block.id && b.parentSlot === "condition");
    const slotW = child ? getLayoutInfo(child, allBlocks).width : 30;
    const slotH = child ? getLayoutInfo(child, allBlocks).height : 30;
    
    const textW = (block.text || "").length * 12;
    const totalWidth = 15 + textW + 10 + slotW + 15;

    // ★ [핵심] 자식 높이 + 2px
    const myHeight = child ? slotH + 2 : 30;

    return {
      width: totalWidth,
      height: myHeight,
      slotWidth: slotW
    };
  }
  // ====================================================
  // 5. 일반 커맨드 블록
  // ====================================================
  return { width: textWidth + 40, height: 40, leftSlotWidth: 0, rightSlotWidth: 0 };
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
       // ... (이전 코드 유지: 연산자 자식 배치 로직) ...
       const leftSlotWidth = block.layout?.leftSlotWidth || 30;
       const rightSlotWidth = block.layout?.rightSlotWidth || 30;
       const textLen = block.text ? block.text.length : 0;
       const textWidth = Math.max(textLen * 12, 10);

       const leftChild = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "left");
       if (leftChild) {
         const childW = leftChild.layout?.width || 30;
         const offsetX = 15 + (leftSlotWidth - childW) / 2;
         updatePosition(leftChild.id, absX + offsetX, absY);
       }
       const rightChild = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "right");
       if (rightChild) {
         const childW = rightChild.layout?.width || 30;
         const rightSlotStart = 15 + leftSlotWidth + 10 + textWidth + 10;
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
         // 타원형 슬롯 위치: x=15, y=10
         updatePosition(timesChild.id, absX + 15, absY + 10); 
       }
    }
    // 2. 조건/IF (while, if, if-else)
    if (["command-while", "command-if", "command-if-else"].includes(block.shape)) {
       const conditionChild = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "condition");
       if (conditionChild) {
         // 육각형 슬롯: x=50, y=10 (가운데 정렬)
         const slotX = block.shape === "command-while" ? 15 : 50; // while은 라벨이 뒤에 있어서 앞쪽 배치
         const slotY = 10;
         const slotW = block.layout?.slotWidth || 100;
         const childW = conditionChild.layout?.width || 0;
         const offsetX = slotX + (slotW - childW) / 2;
         updatePosition(conditionChild.id, absX + offsetX, absY + slotY);
       }
    }

    // ------------------------------------------------
    // [C] 내부 연결 (subStack) 배치 ★ [수정 포인트]
    // ------------------------------------------------
    
    // 1. ㄷ자 블록 (loop, repeat, while, if)
    if (["command-loop", "command-repeat", "command-while", "command-if"].includes(block.shape)) {
       const child = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "subStack1");
       if (child) {
         // 헤더 높이 확인 (일반 loop는 40, 나머지는 50)
         const isSimpleLoop = block.shape === "command-loop";
         const headerHeight = isSimpleLoop ? 40 : 50; 
         
         // ★ [수정] 헤더 높이만큼 정확히 내려줍니다. (기존 40 고정에서 변경)
         updatePosition(child.id, absX + 15, absY + headerHeight);
       }
    }

    // 2. ㅌ자 블록 (if-else)
    if (block.shape === "command-if-else") {
       // 첫 번째 입
       const child1 = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "subStack1");
       if (child1) {
         updatePosition(child1.id, absX + 15, absY + 50); // 헤더 50
       }

       // 두 번째 입
       const child2 = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "subStack2");
       if (child2) {
         const h1 = block.layout.subStack1Height || 30;
         const headerH = 50;
         const midH = 40;
         updatePosition(child2.id, absX + 15, absY + headerH + h1 + midH);
       }
    }
    // 이항 조건 배치
    if (block.shape === "boolean-binary") {
       const textW = (block.text || "").length * 12;
       const leftSlotW = block.layout?.leftSlotWidth || 30;
       const rightSlotW = block.layout?.rightSlotWidth || 30;

       // 왼쪽 자식
       const leftChild = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "left");
       if (leftChild) {
         const childW = leftChild.layout?.width || 30;
         const offsetX = 15 + (leftSlotW - childW)/2;
         updatePosition(leftChild.id, absX + offsetX, absY - 4);
       }
       // 오른쪽 자식
       const rightChild = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "right");
       if (rightChild) {
         const childW = rightChild.layout?.width || 30;
         const startX = 15 + leftSlotW + 10 + textW + 10;
         const offsetX = startX + (rightSlotW - childW)/2;
         updatePosition(rightChild.id, absX + offsetX, absY - 4);
       }
    }

    // [NEW] NOT 블록 배치
    if (block.shape === "boolean-not") {
       const child = blocksWithSize.find(b => b.parentId === block.id && b.parentSlot === "condition");
       if (child) {
         const textW = (block.text || "").length * 12;
         const slotW = block.layout?.slotWidth || 30;
         const childW = child.layout?.width || 30;
         
         const startX = 15 + textW + 10;
         const offsetX = startX + (slotW - childW)/2;
         updatePosition(child.id, absX + offsetX, absY + 5);
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
           // 구멍 위치: x=15, y=5
           updatePosition(valueChild.id, absX + 15, absY);
       }
    }
  };

  // 루트 블록부터 시작
  blocksWithSize.filter((b) => !b.parentId).forEach((root) => {
    updatePosition(root.id, root.x, root.y);
  });

  return blocksWithSize;
};

const App = () => {
  const [blocks, setBlocks] = useState([]);
  const [dragInfo, setDragInfo] = useState(null);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const editorRef = useRef(null);

  // -----------------------------
  // [헬퍼] 자손 블록 찾기
  // -----------------------------
  const getAllDescendants = (allBlocks, rootId) => {
    const results = [];
    const find = (parentId) => {
      const children = allBlocks.filter((b) => b.parentId === parentId);
      children.forEach((child) => {
        results.push(child);
        find(child.id);
      });
    };
    find(rootId);
    return results;
  };
  const handleBlockEdit = (id, currentText) => {
    // 1. 입력창 띄우기
    const newText = window.prompt("새로운 값을 입력하세요:", currentText);
    
    // 2. 값이 있고 변경되었으면 업데이트
    if (newText !== null && newText !== undefined) {
      setBlocks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, text: newText } : b))
      );
    }
  };

  // -----------------------------
  // [A] 팔레트 드래그 시작
  // -----------------------------
  const handlePaletteDragStart = (blockTemplate, e) => {
    setDragInfo({
      isDragging: true,
      type: "NEW",
      text: blockTemplate.text,
      color: blockTemplate.color,
      shape: blockTemplate.shape || "command",
      category: blockTemplate.category,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
    });
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

    const editorRect = editorRef.current.getBoundingClientRect();
    
    // ★ 2. 실제 좌표(x)가 아니라 화면상 좌표(displayX)를 사용합니다.
    const currentBlockX = targetBlock.displayX !== undefined ? targetBlock.displayX : targetBlock.x;
    const currentBlockY = targetBlock.displayY !== undefined ? targetBlock.displayY : targetBlock.y;

    const currentScreenX = editorRect.left + currentBlockX;
    const currentScreenY = editorRect.top + currentBlockY;

    // ★ 3. 자식 블록들도 '계산된 목록'에서 찾아야 올바른 위치를 알 수 있습니다.
    const descendants = getAllDescendants(calculatedBlocks, targetBlock.id);
    
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

    setDragInfo({
      isDragging: true,
      type: "MOVE",
      id: targetBlock.id,
      text: targetBlock.text,
      color: targetBlock.color,
      shape: targetBlock.shape || "command",
      
      initialParentId: targetBlock.parentId, 

      startX: e.clientX,
      startY: e.clientY,
      
      // 드래그 중 위치 계산을 위해 초기값도 화면상 좌표로 저장
      initialBlockX: currentBlockX,
      initialBlockY: currentBlockY,
      
      ghostStartX: currentScreenX,
      ghostStartY: currentScreenY,
      x: currentScreenX,
      y: currentScreenY,
      groupBlocks, // 이제 자식들도 정확한 상대 위치를 가집니다.
    });
  };

  // -----------------------------
  // [C] 마우스 이동
  // -----------------------------
  const handleMouseMove = (e) => {
    if (!dragInfo?.isDragging) return;

    const deltaX = e.clientX - dragInfo.startX;
    const deltaY = e.clientY - dragInfo.startY;

    if (dragInfo.type === "MOVE") {
      setDragInfo((prev) => ({
        ...prev,
        x: prev.ghostStartX + deltaX,
        y: prev.ghostStartY + deltaY,
      }));
    } else if (dragInfo.type === "NEW") {
      setDragInfo((prev) => ({
        ...prev,
        x: e.clientX,
        y: e.clientY,
      }));
    }

    if (editorRef.current) {
      const editorRect = editorRef.current.getBoundingClientRect();
      const TRASH_SIZE = 80;
      const trashZone = {
        left: editorRect.right - TRASH_SIZE,
        top: editorRect.bottom - TRASH_SIZE,
        right: editorRect.right,
        bottom: editorRect.bottom,
      };

      const isInsideTrash =
        e.clientX >= trashZone.left &&
        e.clientX <= trashZone.right &&
        e.clientY >= trashZone.top &&
        e.clientY <= trashZone.bottom;

      setIsOverTrash(isInsideTrash);
    }
  };
  // -----------------------------
  // [D] 마우스 뗐을 때
  // -----------------------------
  const handleMouseUp = (e) => {
    if (!dragInfo?.isDragging || !editorRef.current) return;

    // 0. 휴지통 처리
    if (isOverTrash) {
      if (dragInfo.type === "MOVE") {
        const descendants = getAllDescendants(blocks, dragInfo.id);
        const deleteIds = [dragInfo.id, ...descendants.map((b) => b.id)];
        setBlocks((prev) => prev.filter((b) => !deleteIds.includes(b.id)));
      }
      setDragInfo(null);
      setIsOverTrash(false);
      return;
    }

    const editorRect = editorRef.current.getBoundingClientRect();
    const isInside =
      e.clientX >= editorRect.left &&
      e.clientX <= editorRect.right &&
      e.clientY >= editorRect.top &&
      e.clientY <= editorRect.bottom;

    if (!isInside) {
      setDragInfo(null);
      setIsOverTrash(false);
      return;
    }

    const mouseX = e.clientX - editorRect.left;
    const mouseY = e.clientY - editorRect.top;

    let finalX = 0;
    let finalY = 0;

    // 1. 기본 위치 계산
    if (dragInfo.type === "NEW") {
      finalX = mouseX;
      finalY = mouseY;
    } else {
      const deltaX = e.clientX - dragInfo.startX;
      const deltaY = e.clientY - dragInfo.startY;
      finalX = dragInfo.initialBlockX + deltaX;
      finalY = dragInfo.initialBlockY + deltaY;
    }

    // 2. 자석 효과 (Snap)
    const SNAP_DISTANCE = 30;     
    const SNAP_RANGE_OP = 40;     
    
    let newParentId = null;
    let newParentSlot = null;

    const myGroupIds = [dragInfo.id, ...(dragInfo.groupBlocks?.map((b) => b.id) || [])];
    
    // 이 블록이 '문장(Statement)' 형태인지 확인 (값이나 조건 블록이 아닌 경우)
    const isStatementBlock = !["value-pill", "value-operator-2slot", "boolean"].includes(dragInfo.shape);


    // =================================================================
    // [CASE A] 값/연산자 블록 (기존 유지)
    // =================================================================
    const isValueBlock = ["value-pill", "value-operator-2slot", "value-input", "value-string"].includes(dragInfo.shape);
    
    if (isValueBlock) {
      
      let bestCandidate = null; 
      let minDistance = SNAP_RANGE_OP; 

      blocks.forEach((other) => {
        // 자기 자신이나 그룹은 제외
        if (myGroupIds.includes(other.id)) return;
        // 부모에서 떼어내는 중이라면 제외
        if (dragInfo.type === "MOVE" && other.id === dragInfo.initialParentId) return;

        // -------------------------------------------------------------
        // 1. 산술 연산자 블록 (+, -, *, /) 구멍
        // -------------------------------------------------------------
        if (other.shape === "value-operator-2slot") {
            const isLeftFull = blocks.some(b => b.parentId === other.id && b.parentSlot === "left" && b.id !== dragInfo.id);
            const isRightFull = blocks.some(b => b.parentId === other.id && b.parentSlot === "right" && b.id !== dragInfo.id);
            
            const layout = getLayoutInfo(other, blocks);
            // 왼쪽 구멍 중심
            const lX = other.x + 15 + (layout.leftSlotWidth / 2);
            const lY = other.y + 20; // 높이 중간
            // 오른쪽 구멍 중심
            const rX = other.x + layout.width - 15 - (layout.rightSlotWidth / 2);
            const rY = other.y + 20;

            const dL = Math.hypot(lX - mouseX, lY - mouseY);
            const dR = Math.hypot(rX - mouseX, rY - mouseY);

            if (dL < minDistance && !isLeftFull) {
                minDistance = dL;
                bestCandidate = { block: other, slot: "left" };
            }
            if (dR < minDistance && !isRightFull) {
                minDistance = dR;
                bestCandidate = { block: other, slot: "right" };
            }
        }

        // -------------------------------------------------------------
        // 2. [NEW] 논리 연산자 블록 (>, <, =, AND, OR) 구멍 ★ 추가됨
        // -------------------------------------------------------------
        if (other.shape === "boolean-binary") {
          if (["그리고", "또는"].includes(other.text)) return;
            const isLeftFull = blocks.some(b => b.parentId === other.id && b.parentSlot === "left" && b.id !== dragInfo.id);
            const isRightFull = blocks.some(b => b.parentId === other.id && b.parentSlot === "right" && b.id !== dragInfo.id);
            
            const layout = getLayoutInfo(other, blocks);
            
            // 높이의 절반 (중앙 정렬)
            const midY = layout.height / 2;

            // 왼쪽 구멍 중심
            const lX = other.x + 15 + (layout.leftSlotWidth / 2);
            const lY = other.y + midY;
            
            // 오른쪽 구멍 중심
            const rX = other.x + layout.width - 15 - (layout.rightSlotWidth / 2);
            const rY = other.y + midY;

            const dL = Math.hypot(lX - mouseX, lY - mouseY);
            const dR = Math.hypot(rX - mouseX, rY - mouseY);

            if (dL < minDistance && !isLeftFull) {
                minDistance = dL;
                bestCandidate = { block: other, slot: "left" };
            }
            if (dR < minDistance && !isRightFull) {
                minDistance = dR;
                bestCandidate = { block: other, slot: "right" };
            }
        }

        // -------------------------------------------------------------
        // 3. [NEW] NOT 블록 (아니라면) 구멍 ★ 추가됨
        // -------------------------------------------------------------
        if (other.shape === "boolean-not") {
            const isFull = blocks.some(b => b.parentId === other.id && b.parentSlot === "condition" && b.id !== dragInfo.id);
            const layout = getLayoutInfo(other, blocks);
            
            // 구멍은 오른쪽에 위치
            const sX = other.x + layout.width - 15 - (layout.slotWidth / 2);
            const sY = other.y + (layout.height / 2);

            const dist = Math.hypot(sX - mouseX, sY - mouseY);
            if (dist < minDistance && !isFull) {
                minDistance = dist;
                bestCandidate = { block: other, slot: "condition" };
            }
        }

        // -------------------------------------------------------------
        // 4. 반복문 (n번 반복) 횟수 구멍
        // -------------------------------------------------------------
        if (other.shape === "command-repeat") {
            const isFull = blocks.some(b => b.parentId === other.id && b.parentSlot === "times" && b.id !== dragInfo.id);
            
            // 구멍 위치 (x=15 근처)
            const sX = other.x + 15 + 15; 
            const sY = other.y + 25; // 헤더(50)의 중간

            const dist = Math.hypot(sX - mouseX, sY - mouseY);
            if (dist < minDistance && !isFull) {
                minDistance = dist;
                bestCandidate = { block: other, slot: "times" };
            }
        }

        // -------------------------------------------------------------
        // 5. 출력하기 블록 구멍
        // -------------------------------------------------------------
        if (other.shape === "command-print") {
            const isFull = blocks.some(b => b.parentId === other.id && b.parentSlot === "value" && b.id !== dragInfo.id);
            
            // 구멍 위치 (x=15 근처)
            const sX = other.x + 15 + 15; 
            const sY = other.y + 20;

            const dist = Math.hypot(sX - mouseX, sY - mouseY);
            if (dist < minDistance && !isFull) {
                minDistance = dist;
                bestCandidate = { block: other, slot: "value" };
            }
        }
      });

      if (bestCandidate) {
        const target = bestCandidate.block;
        newParentId = target.id;
        newParentSlot = bestCandidate.slot;
        
        // 위치 보정은 렌더링 시 자동 처리되므로 부모 위치로 일단 이동
        finalX = target.x;
        finalY = target.y;
      }
    }
    // =================================================================
    // [CASE B] 조건(Boolean) 블록 (기존 유지)
    // =================================================================
    // App.jsx - handleMouseUp - [CASE B] (조건 블록 드래그) 내부
    else if (dragInfo.shape === "boolean" || dragInfo.shape === "boolean-binary" || dragInfo.shape === "boolean-not") {
      
      let bestCandidate = null;
      let minDistance = SNAP_DISTANCE; 

      blocks.forEach((other) => {
        if (myGroupIds.includes(other.id)) return;
        
        // -------------------------------------------------------------
        // 1. 제어문 헤더 구멍 (만약, 반복 등)
        // -------------------------------------------------------------
        if (["command-with-condition-slot", "command-if", "command-if-else", "command-while"].includes(other.shape)) {
            // (기존 제어문 구멍 로직 동일...)
            const isOccupied = blocks.some(b => b.parentId === other.id && (b.parentSlot === "condition"||b.parentSlot === "cond") && b.id !== dragInfo.id);
            if (isOccupied) return;

            const slotCenterX = other.shape === "command-while" ? other.x + 15 + 50 : other.x + 50 + 50; // 대략
            const slotCenterY = other.y + 25; 

            const dist = Math.hypot(slotCenterX - mouseX, slotCenterY - mouseY);
            if (dist < minDistance) {
                minDistance = dist;
                bestCandidate = { block: other, slot: "condition" };
            }
        }

        // -------------------------------------------------------------
        // 2. [NEW] 논리 연산자 (AND, OR) 구멍에 '조건' 넣기
        // -------------------------------------------------------------
        if (other.shape === "boolean-binary" && ["그리고", "또는"].includes(other.text)) {
            const isLeftFull = blocks.some(b => b.parentId === other.id && b.parentSlot === "left" && b.id !== dragInfo.id);
            const isRightFull = blocks.some(b => b.parentId === other.id && b.parentSlot === "right" && b.id !== dragInfo.id);
            
            const layout = getLayoutInfo(other, blocks);
            const midY = layout.height / 2;

            const lX = other.x + 15 + (layout.leftSlotWidth / 2);
            const lY = other.y + midY;
            const rX = other.x + layout.width - 15 - (layout.rightSlotWidth / 2);
            const rY = other.y + midY;

            const dL = Math.hypot(lX - mouseX, lY - mouseY);
            const dR = Math.hypot(rX - mouseX, rY - mouseY);

            if (dL < minDistance && !isLeftFull) {
                minDistance = dL;
                bestCandidate = { block: other, slot: "left" };
            }
            if (dR < minDistance && !isRightFull) {
                minDistance = dR;
                bestCandidate = { block: other, slot: "right" };
            }
        }

        // -------------------------------------------------------------
        // 3. [NEW] NOT 블록 구멍에 '조건' 넣기
        // -------------------------------------------------------------
        if (other.shape === "boolean-not") {
             const isFull = blocks.some(b => b.parentId === other.id && b.parentSlot === "condition" && b.id !== dragInfo.id);
             const layout = getLayoutInfo(other, blocks);
             
             // 구멍은 오른쪽
             const sX = other.x + layout.width - 15 - (layout.slotWidth / 2);
             const sY = other.y + (layout.height / 2);
             
             const dist = Math.hypot(sX - mouseX, sY - mouseY);
             if (dist < minDistance && !isFull) {
                 minDistance = dist;
                 bestCandidate = { block: other, slot: "condition" };
             }
        }
      });

      if (bestCandidate) {
        const target = bestCandidate.block;
        newParentId = target.id;
        newParentSlot = bestCandidate.slot; // slot 이름 주의 (condition, left, right)
        
        // 위치 보정 (단순화)
        finalX = target.x;
        finalY = target.y;
      }
    }
    
    // ★★★ [여기서부터 새로 추가/변경된 부분] ★★★
    
    else if (isStatementBlock) {
        
        let snapped = false;

        // =================================================================
        // [CASE C] ㄷ자 블록 내부 연결 (subStack) - 우선 순위 높음
        // =================================================================
        // 마우스가 블록의 "입" 근처에 있으면 안으로 넣습니다.
        
        let bestInner = null;
        let minInnerDist = SNAP_DISTANCE;

        blocks.forEach((other) => {
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

            const dist1 = Math.hypot(dockX - mouseX, dockY - mouseY);
            
            // 이미 첫 칸에 누군가 있으면 못 들어감 (간단한 구현을 위해)
            const isSub1Full = blocks.some(b => b.parentId === other.id && b.parentSlot === "subStack1" && b.id !== dragInfo.id);

            if (dist1 < minInnerDist && !isSub1Full) {
                minInnerDist = dist1;
                bestInner = { block: other, slot: "subStack1", y: dockY };
            }

            // 2. 두 번째 입 (subStack2) - IF-ELSE 인 경우만
            if (other.shape === "command-if-else") {
                const layout = getLayoutInfo(other, blocks);
                const h1 = layout.subStack1Height || 30;
                const midHeight = 40; // '아니면' 바 높이

                const dockY2 = other.y + headerHeight + h1 + midHeight;
                const dist2 = Math.hypot(dockX - mouseX, dockY2 - mouseY);
                
                const isSub2Full = blocks.some(b => b.parentId === other.id && b.parentSlot === "subStack2" && b.id !== dragInfo.id);

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
        // =================================================================
        if (!snapped) {
            let bestNext = null;
            let minNextDist = SNAP_DISTANCE;

            blocks.forEach((other) => {
                if (myGroupIds.includes(other.id)) return;
                // 값/조건 블록 등은 아래에 붙일 수 없음
                if (["value-pill", "value-operator-2slot", "boolean"].includes(other.shape)) return;

                // 이미 내 밑에 누가 붙어있으면 안됨 (단순화)
                const isNextOccupied = blocks.some(b => b.parentId === other.id && b.parentSlot === "next" && b.id !== dragInfo.id);
                if (isNextOccupied) return;

                const layout = getLayoutInfo(other, blocks);
                const dockX = other.x;
                const dockY = other.y + layout.height; // 블록 발끝

                const dist = Math.hypot(dockX - mouseX, dockY - mouseY);

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

    // 3. 상태 업데이트
    if (dragInfo.type === "NEW") {
      setBlocks((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: dragInfo.text,
          color: dragInfo.color,
          shape: dragInfo.shape,
          x: finalX,
          y: finalY,
          parentId: newParentId,
          parentSlot: newParentSlot,
          category: dragInfo.category || "control",
        },
      ]);
    } else if (dragInfo.type === "MOVE") {
      const actualDeltaX = finalX - dragInfo.initialBlockX;
      const actualDeltaY = finalY - dragInfo.initialBlockY;

      setBlocks((prevBlocks) => {
        const descendants = getAllDescendants(prevBlocks, dragInfo.id);
        const movingFamilyIds = [dragInfo.id, ...descendants.map((b) => b.id)];
        
        const staticBlocks = prevBlocks.filter((b) => !movingFamilyIds.includes(b.id));

        const targetBlock = prevBlocks.find((b) => b.id === dragInfo.id);
        const movedTarget = {
          ...targetBlock,
          x: finalX,
          y: finalY,
          parentId: newParentId,
          parentSlot: newParentSlot,
        };

        const movedDescendants = descendants.map((child) => ({
          ...child,
          x: child.x + actualDeltaX,
          y: child.y + actualDeltaY,
        }));

        return [...staticBlocks, movedTarget, ...movedDescendants];
      });
    }

    setDragInfo(null);
    setIsOverTrash(false);
  };

  const hiddenIds =
    dragInfo?.isDragging && dragInfo.type === "MOVE"
      ? [dragInfo.id, ...(dragInfo.groupBlocks?.map((b) => b.id) || [])]
      : [];

  // ★ [중요] 렌더링 직전에 모든 블록의 위치와 크기를 다시 계산합니다.
  // 이렇게 하면 부모가 커질 때 자식의 위치도 자동으로 수정된 좌표(displayX, displayY)를 갖게 됩니다.
  const blocksToRender = calculateDisplayPositions(blocks).map(b => ({
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

  const editorContent = (
    <div
      ref={editorRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      <BlockEditorPane
        blocks={blocksToRender}
        hiddenIds={hiddenIds}
        onBlockDown={handleWorkspaceBlockDown}
        
        // ★ [NEW] 편집 함수 전달
        onBlockEdit={handleBlockEdit} 
        
        isOverTrash={isOverTrash}
      />
    </div>
  );

  const paletteContent = (
    <BlockPalettePane onDragStart={handlePaletteDragStart} />
  );

  const outputContent = <RunPane blocks={blocks} />;

  return (
    <div
      className="app-container-logic"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ height: "100vh" }}
    >
      <AppLayout
        editor={editorContent}
        palette={paletteContent}
        output={outputContent}
      />

      {/* --- [수정] 유령 블록 (드래그 중 마우스 따라다니는 녀석) --- */}
      {dragInfo?.isDragging && (() => {
        // 1. 유령 블록의 레이아웃(크기)을 즉석에서 계산합니다.
        let ghostLayout = { width: 0, height: 0, leftSlotWidth: 0, rightSlotWidth: 0, slotWidth: 0 };
        
        // 기본 텍스트 너비
        const textLen = dragInfo.text ? dragInfo.text.length : 0;
        const textWidth = Math.max(textLen * 12, 10);

        if (dragInfo.type === "NEW") {
           // ===============================================================
           // [CASE 1] 팔레트에서 막 꺼냈을 때 (기본 크기 지정)
           // ===============================================================
           
           if (dragInfo.shape === "command-print") {
              // [출력하기] 15 + 슬롯(30) + 10 + 텍스트 + 20
              ghostLayout.width = 15 + 30 + 10 + textWidth + 20;
              ghostLayout.height = 40;
              ghostLayout.slotWidth = 30; 
           } 
           else if (dragInfo.shape === "value-input") {
              // [상수 입력]
              ghostLayout.width = textWidth + 24;
              ghostLayout.height = 30;
           }
           else if (dragInfo.shape === "boolean-binary") {
              // [논리 연산] 15 + 30 + 10 + 텍스트 + 10 + 30 + 15
              ghostLayout.width = 15 + 30 + 10 + textWidth + 10 + 30 + 15;
              ghostLayout.height = 30;
              ghostLayout.leftSlotWidth = 30;
              ghostLayout.rightSlotWidth = 30;
           }
           else if (dragInfo.shape === "boolean-not") {
              // [NOT] 15 + 텍스트 + 10 + 30 + 15
              ghostLayout.width = 15 + textWidth + 10 + 30 + 15;
              ghostLayout.height = 30;
              ghostLayout.slotWidth = 30;
           }
           else if (dragInfo.shape === "command-if") {
              // [IF] 만약(40)+10+슬롯(100)+10+이라면(40)+20
              ghostLayout.width = 40 + 10 + 100 + 10 + 40 + 20;
              // 높이: 헤더(50) + 내용(30) + 바닥(30)
              ghostLayout.height = 50 + 30 + 30;
              ghostLayout.slotWidth = 100;
              ghostLayout.subStack1Height = 30; // 기본 내부 높이
           }
           else if (dragInfo.shape === "command-if-else") {
              // [IF-ELSE]
              ghostLayout.width = 40 + 10 + 100 + 10 + 40 + 20;
              // 높이: 헤더(50) + 내용1(30) + 중간(40) + 내용2(30) + 바닥(30)
              ghostLayout.height = 50 + 30 + 40 + 30 + 30;
              ghostLayout.slotWidth = 100;
              ghostLayout.subStack1Height = 30;
              ghostLayout.subStack2Height = 30;
           }
           else if (dragInfo.shape === "command-repeat") {
              // [REPEAT] 20 + 슬롯(30) + ...
              const labelLen = "번 반복하기".length * 14;
              ghostLayout.width = 20 + 30 + 10 + labelLen + 20;
              ghostLayout.height = 50 + 30 + 30; 
              ghostLayout.slotWidth = 30;
              ghostLayout.subStack1Height = 30;
           }
           else if (dragInfo.shape === "command-while") {
              // [WHILE] 20 + 슬롯(100) + ...
              const labelLen = "인 동안 반복하기".length * 14;
              ghostLayout.width = 20 + 100 + 10 + labelLen + 20;
              ghostLayout.height = 50 + 30 + 30;
              ghostLayout.slotWidth = 100;
              ghostLayout.subStack1Height = 30;
           }
           else if (dragInfo.shape === "value-operator-2slot") {
              ghostLayout.width = 15 + 30 + 10 + textWidth + 10 + 30 + 15;
              ghostLayout.height = 30;
              ghostLayout.leftSlotWidth = 30;
              ghostLayout.rightSlotWidth = 30;
           } 
           else if (dragInfo.shape === "boolean") {
              ghostLayout.width = textWidth + 50;
              ghostLayout.height = 30;
           } 
           else if (dragInfo.shape === "command-with-condition-slot") {
              ghostLayout.width = 40 + 10 + 100 + 10 + 40 + 20;
              ghostLayout.height = 50;
              ghostLayout.slotWidth = 100;
           } 
           else {
              // 일반 커맨드
              ghostLayout.width = textWidth + 40;
              ghostLayout.height = 40;
           }
        } else {
           // ===============================================================
           // [CASE 2] 에디터에서 집어 올렸을 때 (getLayoutInfo 재사용)
           // ===============================================================
           const ghostRoot = { ...dragInfo, id: dragInfo.id };
           const ghostFamily = [ghostRoot, ...(dragInfo.groupBlocks || [])];
           ghostLayout = getLayoutInfo(ghostRoot, ghostFamily);
        }

        return (
          <svg
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 9999,
            }}
          >
            {/* 메인 유령 블록 */}
            <Block
              text={dragInfo.text}
              color={dragInfo.color}
              shape={dragInfo.shape}
              x={dragInfo.x}
              y={dragInfo.y}
              
              // ★ 계산된 크기 정보 전달 (높이 포함!)
              totalWidth={ghostLayout.width}
              height={ghostLayout.height} 
              
              leftSlotWidth={ghostLayout.leftSlotWidth}
              rightSlotWidth={ghostLayout.rightSlotWidth}
              slotWidth={ghostLayout.slotWidth}
              
              // ㄷ자 블록 내부 높이 전달
              subStack1Height={ghostLayout.subStack1Height}
              subStack2Height={ghostLayout.subStack2Height}
            />

            {/* 딸려오는 자식 블록들 (MOVE 상태일 때만 존재) */}
            {dragInfo.groupBlocks &&
              dragInfo.groupBlocks.map((child) => {
                const childLayout = getLayoutInfo(child, dragInfo.groupBlocks);

                return (
                  <Block
                    key={"ghost-" + child.id}
                    text={child.text}
                    color={child.color}
                    shape={child.shape}
                    x={dragInfo.x + child.offsetX}
                    y={dragInfo.y + child.offsetY}
                    
                    totalWidth={childLayout.width}
                    height={childLayout.height}
                    leftSlotWidth={childLayout.leftSlotWidth}
                    rightSlotWidth={childLayout.rightSlotWidth}
                    slotWidth={childLayout.slotWidth}
                    subStack1Height={childLayout.subStack1Height}
                    subStack2Height={childLayout.subStack2Height}
                  />
                );
              })}
          </svg>
        );
      })()}
    </div>
  );
};

export default App;