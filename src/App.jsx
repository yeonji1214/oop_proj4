import React, { useState, useRef } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { BlockEditorPane } from "./components/editor/BlockEditorPane";
import { BlockPalettePane } from "./components/editor/BlockPalettePane";
import Block from "./components/editor/Block";
import { RunPane } from "./components/run/RunPane";

const App = () => {
  const [blocks, setBlocks] = useState([]);
  const [dragInfo, setDragInfo] = useState(null);
  const editorRef = useRef(null);

  // -----------------------------
  // 자식 블록(후손) 재귀적으로 찾기
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
  // [A] 팔레트에서 드래그 시작 (새 블록)
  // -----------------------------
  const handlePaletteDragStart = (blockTemplate, e) => {
    setDragInfo({
      isDragging: true,
      type: "NEW", // 새로 생성
      text: blockTemplate.text,
      color: blockTemplate.color,
      shape: blockTemplate.shape || "command",
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
    });
  };

  // -----------------------------
  // [B] 워크스페이스 위 기존 블록 드래그 시작
  // -----------------------------
  const handleWorkspaceBlockDown = (id, e) => {
    const targetBlock = blocks.find((b) => b.id === id);
    if (!targetBlock || !editorRef.current) return;

    const editorRect = editorRef.current.getBoundingClientRect();
    const currentScreenX = editorRect.left + targetBlock.x;
    const currentScreenY = editorRect.top + targetBlock.y;

    // 자식들(후손들) 전부 찾고, 부모 기준 상대좌표 저장
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
  // [C] 마우스 이동 중
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
  };

  // -----------------------------
  // [D] 마우스 뗐을 때 (스냅 + 그룹 이동)
  // -----------------------------
  const handleMouseUp = (e) => {
    if (!dragInfo?.isDragging || !editorRef.current) return;

    const editorRect = editorRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragInfo.startX;
    const deltaY = e.clientY - dragInfo.startY;

    // 에디터 영역 안에 놓였는지 확인
    const isInside =
      e.clientX >= editorRect.left &&
      e.clientX <= editorRect.right &&
      e.clientY >= editorRect.top &&
      e.clientY <= editorRect.bottom;

    if (!isInside) {
      setDragInfo(null);
      return;
    }

    let finalX = 0;
    let finalY = 0;
    let newParentId = null;

    if (dragInfo.type === "NEW") {
      // 새 블록은 마우스 위치 기준으로 에디터 내 좌표로 변환
      finalX = e.clientX - editorRect.left;
      finalY = e.clientY - editorRect.top;
    } else if (dragInfo.type === "MOVE") {
      // 기존 블록은 원래 위치 + 이동량
      finalX = dragInfo.initialBlockX + deltaX;
      finalY = dragInfo.initialBlockY + deltaY;
    }

    // -------------------------
    // 자석 효과 (아래에 붙이기)
    // -------------------------
    const SNAP_DISTANCE = 20;
    const BLOCK_HEIGHT = 40;

    const targetBlock = blocks.find((other) => {
      if (dragInfo.type === "MOVE" && other.id === dragInfo.id) return false;

      const dockingPointX = other.x;
      const dockingPointY = other.y + BLOCK_HEIGHT;

      const dist = Math.hypot(dockingPointX - finalX, dockingPointY - finalY);
      return dist < SNAP_DISTANCE;
    });

    if (targetBlock) {
      finalX = targetBlock.x;
      finalY = targetBlock.y + BLOCK_HEIGHT;
      newParentId = targetBlock.id;
    } else {
      newParentId = null;
    }

    // -------------------------
    // 상태 업데이트
    // -------------------------
    if (dragInfo.type === "NEW") {
      const newBlock = {
        id: Date.now(),
        text: dragInfo.text,
        color: dragInfo.color,
        shape: dragInfo.shape || "command",
        x: finalX,
        y: finalY,
        parentId: newParentId,
      };
      setBlocks((prev) => [...prev, newBlock]);
    } else if (dragInfo.type === "MOVE") {
      const actualDeltaX = finalX - dragInfo.initialBlockX;
      const actualDeltaY = finalY - dragInfo.initialBlockY;

      setBlocks((prevBlocks) => {
        const nextBlocks = [...prevBlocks];

        // 1) 나 자신 위치 + 부모 갱신
        const myIndex = nextBlocks.findIndex((b) => b.id === dragInfo.id);
        if (myIndex !== -1) {
          nextBlocks[myIndex] = {
            ...nextBlocks[myIndex],
            x: finalX,
            y: finalY,
            parentId: newParentId,
          };
        }

        // 2) 자식들 재귀적으로 이동
        const moveChildrenRecursive = (parentId, dx, dy) => {
          const children = nextBlocks.filter((b) => b.parentId === parentId);
          children.forEach((child) => {
            const idx = nextBlocks.findIndex((b) => b.id === child.id);
            if (idx !== -1) {
              nextBlocks[idx] = {
                ...nextBlocks[idx],
                x: nextBlocks[idx].x + dx,
                y: nextBlocks[idx].y + dy,
              };
              moveChildrenRecursive(child.id, dx, dy);
            }
          });
        };

        moveChildrenRecursive(dragInfo.id, actualDeltaX, actualDeltaY);
        return nextBlocks;
      });
    }

    setDragInfo(null);
  };

  // 드래그 중일 때 워크스페이스에서 숨길 블록들 (유령 블록 대신)
  const hiddenIds =
    dragInfo?.isDragging && dragInfo.type === "MOVE"
      ? [dragInfo.id, ...(dragInfo.groupBlocks?.map((b) => b.id) || [])]
      : [];

  // 레이아웃에 넘길 내용들
  const editorContent = (
    <div
      ref={editorRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      <BlockEditorPane
        blocks={blocks}
        hiddenIds={hiddenIds}
        onBlockDown={handleWorkspaceBlockDown}
      />
    </div>
  );

  const paletteContent = (
    <BlockPalettePane onDragStart={handlePaletteDragStart} />
  );

  const outputContent = <RunPane />;

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

      {/* 유령 블록 레이어 */}
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
          {/* 대장 블록 */}
          <Block
            text={dragInfo.text}
            color={dragInfo.color}
            shape={dragInfo.shape}
            x={dragInfo.x}
            y={dragInfo.y}
          />
          {/* 자식(쫄병)들 */}
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
