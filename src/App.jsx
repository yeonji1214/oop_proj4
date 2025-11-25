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
    case "command":                     // 무한 반복하기, 이동하기 등
      return 40;
    default:
      return 40;                        // 기본값
  }
};

// [2] 블록 ID를 받아 재귀적으로 크기와 레이아웃 정보를 계산하는 헬퍼 함수
const getLayoutInfo = (block, allBlocks) => {
  if (!block) return { width: 0, leftSlotWidth: 0, rightSlotWidth: 0 };

  const textLen = block.text ? block.text.length : 0;
  
  // 1. 값(알약) 블록
  if (block.shape === "value-pill") {
    const baseWidth = textLen * 12 + 24;
    const width = Math.max(baseWidth, 30);
    return { width, leftSlotWidth: 0, rightSlotWidth: 0 };
  }

  // 2. 연산자 블록 (구멍 2개)
  if (block.shape === "value-operator-2slot") {
    // 자식 찾기
    const leftChild = allBlocks.find(b => b.parentId === block.id && b.parentSlot === "left");
    const rightChild = allBlocks.find(b => b.parentId === block.id && b.parentSlot === "right");

    // 자식들의 너비 계산 (재귀 호출)
    const leftChildInfo = leftChild ? getLayoutInfo(leftChild, allBlocks) : { width: 30 }; 
    const rightChildInfo = rightChild ? getLayoutInfo(rightChild, allBlocks) : { width: 30 };

    const leftSlotWidth = Math.max(leftChildInfo.width, 30);
    const rightSlotWidth = Math.max(rightChildInfo.width, 30);

    // 전체 너비 계산: 좌측여백(15) + 왼쪽슬롯 + 중간(10) + 텍스트 + 중간(10) + 오른쪽슬롯 + 우측여백(15)
    const textWidth = textLen * 12;
    const totalWidth = 15 + leftSlotWidth + 10 + textWidth + 10 + rightSlotWidth + 15;

    return { 
      width: totalWidth, 
      leftSlotWidth, 
      rightSlotWidth 
    };
  }

  // 3. 그 외
  return { width: textLen * 14 + 30, leftSlotWidth: 0, rightSlotWidth: 0 };
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
      category: blockTemplate.category, // 카테고리 정보 전달
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
    const targetBlock = blocks.find((b) => b.id === id);
    if (!targetBlock || !editorRef.current) return;

    const editorRect = editorRef.current.getBoundingClientRect();
    const currentScreenX = editorRect.left + targetBlock.x;
    const currentScreenY = editorRect.top + targetBlock.y;

    const descendants = getAllDescendants(blocks, targetBlock.id);
    const groupBlocks = descendants.map((child) => ({
      ...child,
      offsetX: child.x - targetBlock.x,
      offsetY: child.y - targetBlock.y,
    }));

    setDragInfo({
      isDragging: true,
      type: "MOVE",
      id: targetBlock.id,
      text: targetBlock.text,
      color: targetBlock.color,
      shape: targetBlock.shape || "command",
      
      // ★ [핵심] 드래그 시작 시점의 부모 ID 저장 (분리 로직용)
      initialParentId: targetBlock.parentId, 

      startX: e.clientX,
      startY: e.clientY,
      initialBlockX: targetBlock.x,
      initialBlockY: targetBlock.y,
      ghostStartX: currentScreenX,
      ghostStartY: currentScreenY,
      x: currentScreenX,
      y: currentScreenY,
      groupBlocks,
    });
  };

  // -----------------------------
  // [C] 마우스 이동
  // -----------------------------
  const handleMouseMove = (e) => {
    if (!dragInfo?.isDragging) return;

    // 1. 블록 이동
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

    // 2. 휴지통 감지
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

    let finalX = 0;
    let finalY = 0;

    // 1. 기본 위치 계산
    if (dragInfo.type === "NEW") {
      finalX = e.clientX - editorRect.left;
      finalY = e.clientY - editorRect.top;
    } else {
      const deltaX = e.clientX - dragInfo.startX;
      const deltaY = e.clientY - dragInfo.startY;
      finalX = dragInfo.initialBlockX + deltaX;
      finalY = dragInfo.initialBlockY + deltaY;
    }

    // 2. 자석 효과 (Snap)
    const SNAP_DISTANCE = 30; // 일반 블록용
    const SNAP_RANGE_OP = 50; // 연산자 블록용 (더 넓게)
    
    let newParentId = null;
    let newParentSlot = null; 

    const myGroupIds = [dragInfo.id, ...(dragInfo.groupBlocks?.map((b) => b.id) || [])];

    // ----------------------------------------------------------------
    // [CASE A] 값/연산자 블록 -> 연산자 구멍에 넣기
    // ----------------------------------------------------------------
    if (dragInfo.shape === "value-pill" || dragInfo.shape === "value-operator-2slot") {
      
      const targetBlock = blocks.find((other) => {
        if (myGroupIds.includes(other.id)) return false;
        if (other.shape !== "value-operator-2slot") return false;

        // ★ [핵심] 원래 붙어있던 부모라면 자석 효과 무시 (분리되도록 함)
        if (dragInfo.type === "MOVE" && other.id === dragInfo.initialParentId) {
            return false;
        }

        // 레이아웃 정보 가져오기
        const layout = getLayoutInfo(other, blocks);

        // --- 왼쪽 구멍 위치 ---
        const leftSocketX = other.x + 15 + (layout.leftSlotWidth / 2);
        const leftSocketY = other.y + 20;

        // --- 오른쪽 구멍 위치 ---
        const rightSocketX = other.x + layout.width - 15 - (layout.rightSlotWidth / 2);
        const rightSocketY = other.y + 20;

        // --- 내 중심 좌표 ---
        // 드래그 중인 블록의 크기 계산 (getBlockWidth 대신 getLayoutInfo 사용)
        const myLayout = getLayoutInfo({ ...dragInfo, id: dragInfo.id }, blocks);
        const myCenterX = finalX + myLayout.width / 2;
        const myCenterY = finalY + 20; 

        // 거리 측정
        const distLeft = Math.hypot(leftSocketX - myCenterX, leftSocketY - myCenterY);
        const distRight = Math.hypot(rightSocketX - myCenterX, rightSocketY - myCenterY);
        
        if (distLeft < SNAP_RANGE_OP) {
          newParentSlot = "left";
          return true;
        }
        if (distRight < SNAP_RANGE_OP) {
          newParentSlot = "right";
          return true;
        }
        return false;
      });

      if (targetBlock) {
        newParentId = targetBlock.id;
        
        // 위치 보정
        const layout = getLayoutInfo(targetBlock, blocks);
        const myLayout = getLayoutInfo({ ...dragInfo, id: dragInfo.id }, blocks);

        if (newParentSlot === "left") {
          const socketCenterX = targetBlock.x + 15 + (layout.leftSlotWidth / 2);
          finalX = socketCenterX - (myLayout.width / 2);
          finalY = targetBlock.y; 
        } else {
          const socketCenterX = targetBlock.x + layout.width - 15 - (layout.rightSlotWidth / 2);
          finalX = socketCenterX - (myLayout.width / 2);
          finalY = targetBlock.y;
        }
      }
    }
    // ----------------------------------------------------------------
    // [CASE B] 육각형(Boolean) 블록 -> 조건 슬롯
    // ----------------------------------------------------------------
    else if (dragInfo.shape === "boolean") {
      const targetBlock = blocks.find((other) => {
        if (myGroupIds.includes(other.id)) return false;
        if (other.shape !== "command-with-condition-slot") return false;

        const SLOT_CENTER_OFFSET = 100; 
        const slotCenterX = other.x + SLOT_CENTER_OFFSET;
        const slotY = other.y + 25; 

        // getLayoutInfo 사용하여 정확한 너비 계산
        const myLayout = getLayoutInfo({ text: dragInfo.text, shape: dragInfo.shape }, blocks);
        const myCenterX = finalX + myLayout.width / 2;
        const myCenterY = finalY + 20; 

        const dist = Math.hypot(slotCenterX - myCenterX, slotY - myCenterY);
        return dist < SNAP_DISTANCE;
      });

      if (targetBlock) {
        const myLayout = getLayoutInfo({ text: dragInfo.text, shape: dragInfo.shape }, blocks);
        finalX = targetBlock.x + 100 - (myLayout.width / 2);
        finalY = targetBlock.y + 5; 
        newParentId = targetBlock.id;
      }
    }
    // ----------------------------------------------------------------
    // [CASE C] 일반 블록 -> 아래 붙이기
    // ----------------------------------------------------------------
    else {
      const targetBlock = blocks.find((other) => {
        if (myGroupIds.includes(other.id)) return false;
        if (other.shape === "boolean" || other.shape === "value-pill" || other.shape === "value-operator-2slot") return false;

        const targetHeight = getBlockHeight(other.shape);
        const dockingPointX = other.x;
        const dockingPointY = other.y + targetHeight;

        const dist = Math.hypot(dockingPointX - finalX, dockingPointY - finalY);
        return dist < SNAP_DISTANCE;
      });

      if (targetBlock) {
        const targetHeight = getBlockHeight(targetBlock.shape);
        finalX = targetBlock.x;
        finalY = targetBlock.y + targetHeight; 
        newParentId = targetBlock.id;
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
          category: dragInfo.category || "calc",
        },
      ]);
    } else if (dragInfo.type === "MOVE") {
      const actualDeltaX = finalX - dragInfo.initialBlockX;
      const actualDeltaY = finalY - dragInfo.initialBlockY;

      setBlocks((prevBlocks) => {
        const descendants = getAllDescendants(prevBlocks, dragInfo.id);
        const movingFamilyIds = [dragInfo.id, ...descendants.map((b) => b.id)];
        const staticBlocks = prevBlocks.filter(
          (b) => !movingFamilyIds.includes(b.id)
        );

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

  // ★ EditorPane에 전달하기 전에 레이아웃 정보를 주입합니다.
  // 이렇게 해야 Block.jsx에서 totalWidth 등을 받아 동적으로 그려집니다.
  const blocksWithLayout = blocks.map(b => {
    const layout = getLayoutInfo(b, blocks);
    return {
      ...b,
      totalWidth: layout.width,
      leftSlotWidth: layout.leftSlotWidth,
      rightSlotWidth: layout.rightSlotWidth,
    };
  });

  const editorContent = (
    <div
      ref={editorRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      <BlockEditorPane
        blocks={blocksWithLayout}
        hiddenIds={hiddenIds}
        onBlockDown={handleWorkspaceBlockDown}
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

      {/* 유령 블록 */}
      {dragInfo?.isDragging && (
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
          {/* 드래그 중인 메인 블록에도 동적 크기 적용 */}
          <Block
            text={dragInfo.text}
            color={dragInfo.color}
            shape={dragInfo.shape}
            x={dragInfo.x}
            y={dragInfo.y}
            // 유령 블록은 자식이 없다고 가정하거나(단순표시), 
            // 필요하다면 여기서도 getLayoutInfo를 호출할 수 있지만 
            // 복잡도를 줄이기 위해 기본값 사용 (또는 재귀 계산된 너비 사용 가능)
          />
          {dragInfo.groupBlocks &&
            dragInfo.groupBlocks.map((child) => (
              <Block
                key={"ghost-" + child.id}
                text={child.text}
                color={child.color}
                shape={child.shape}
                x={dragInfo.x + child.offsetX}
                y={dragInfo.y + child.offsetY}
              />
            ))}
        </svg>
      )}
    </div>
  );
};

export default App;