import React, { useState, useRef } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { BlockEditorPane } from "./components/editor/BlockEditorPane";
import { BlockPalettePane } from "./components/editor/BlockPalettePane";
import Block from "./components/editor/Block";

const App = () => {
  const [blocks, setBlocks] = useState([]);
  const [dragInfo, setDragInfo] = useState(null);
  const editorRef = useRef(null);

  // ----------------------------------------------------------------
  // [헬퍼 함수] 블록과 그 자식들을 재귀적으로 모두 이동시키는 함수
  // ----------------------------------------------------------------
  const moveBlockAndChildren = (allBlocks, rootId, deltaX, deltaY) => {
    // 원본 배열 복사 (불변성 유지)
    let newBlocks = [...allBlocks];

    // 재귀 함수 정의
    const moveRecursive = (id) => {
      const index = newBlocks.findIndex((b) => b.id === id);
      if (index === -1) return;

      // 1. 현재 블록 이동
      newBlocks[index] = {
        ...newBlocks[index],
        x: newBlocks[index].x + deltaX,
        y: newBlocks[index].y + deltaY,
      };

      // 2. 내 자식들(나를 parentId로 가진 블록)을 찾아서 똑같이 이동
      const children = newBlocks.filter((b) => b.parentId === id);
      children.forEach((child) => moveRecursive(child.id));
    };

    // 시작!
    moveRecursive(rootId);
    return newBlocks;
  };
  const getAllDescendants = (allBlocks, rootId) => {
    let results = [];
    const find = (parentId) => {
      const children = allBlocks.filter(b => b.parentId === parentId);
      children.forEach(child => {
        results.push(child);
        find(child.id); // 재귀 호출
      });
    };
    find(rootId);
    return results;
  };
  // [A] 팔레트 드래그 시작
  const handlePaletteDragStart = (blockTemplate, e) => {
    setDragInfo({
      isDragging: true,
      type: "NEW",
      text: blockTemplate.text,
      color: blockTemplate.color,
      x: e.clientX,
      y: e.clientY,
    });
  };

  // [B] 워크스페이스 드래그 시작
  const handleWorkspaceBlockDown = (id, e) => {
    const targetBlock = blocks.find((b) => b.id === id);
    if (!targetBlock) return;

    const editorRect = editorRef.current.getBoundingClientRect();
    const currentScreenX = editorRect.left + targetBlock.x;
    const currentScreenY = editorRect.top + targetBlock.y;

    // 1. 나를 따라와야 하는 모든 자식 블록 찾기
    const descendants = getAllDescendants(blocks, targetBlock.id);
    
    // 2. 자식들의 "상대 좌표(나랑 얼마나 떨어져 있나)" 미리 계산해서 저장
    const groupBlocks = descendants.map(child => ({
      ...child,
      offsetX: child.x - targetBlock.x, // 대장 블록과의 X 차이
      offsetY: child.y - targetBlock.y, // 대장 블록과의 Y 차이
    }));

    setDragInfo({
      isDragging: true,
      type: "MOVE",
      id: targetBlock.id,
      text: targetBlock.text,
      color: targetBlock.color,
      startX: e.clientX,
      startY: e.clientY,
      initialBlockX: targetBlock.x,
      initialBlockY: targetBlock.y,
      ghostStartX: currentScreenX,
      ghostStartY: currentScreenY,
      x: currentScreenX,
      y: currentScreenY,
      
      // ★ 추가됨: 함께 움직일 그룹 정보 (나 자신은 제외하고 자식들만)
      groupBlocks: groupBlocks, 
    });
  };

  // [C] 마우스 이동
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

  // [D] 마우스 뗌 (자석 효과 & 그룹 이동 핵심 로직)
  const handleMouseUp = (e) => {
    if (!dragInfo?.isDragging) return;

    const editorRect = editorRef.current.getBoundingClientRect();
    
    // 마우스가 움직인 거리
    const deltaX = e.clientX - dragInfo.startX;
    const deltaY = e.clientY - dragInfo.startY;

    // 1. 범위 체크
    const isInside =
      e.clientX >= editorRect.left &&
      e.clientX <= editorRect.right &&
      e.clientY >= editorRect.top &&
      e.clientY <= editorRect.bottom;

    if (!isInside) {
      setDragInfo(null);
      return;
    }

    // 2. 최종적으로 놓일 좌표 계산 (일단 마우스 위치 기준)
    let finalX = 0;
    let finalY = 0;
    let newParentId = null; // 누구 밑에 붙었는지 저장

    if (dragInfo.type === "NEW") {
      finalX = e.clientX - editorRect.left;
      finalY = e.clientY - editorRect.top;
    } else if (dragInfo.type === "MOVE") {
      finalX = dragInfo.initialBlockX + deltaX;
      finalY = dragInfo.initialBlockY + deltaY;
    }

    // ----------------------------------------------------
    // ★ [자석 효과] 다른 블록 밑에 가까이 갔는지 검사 ★
    // ----------------------------------------------------
    const SNAP_DISTANCE = 20; // 20px 이내면 붙음
    const BLOCK_HEIGHT = 40;  // 블록 높이

    // 나 자신을 제외한 다른 블록들을 검사
    const targetBlock = blocks.find((other) => {
      if (dragInfo.type === "MOVE" && other.id === dragInfo.id) return false;
      
      // "다른 블록의 바닥(y + 40)"과 "내 머리(finalY)"가 가까운가?
      const dockingPointX = other.x;
      const dockingPointY = other.y + BLOCK_HEIGHT;

      const dist = Math.sqrt(
        Math.pow(dockingPointX - finalX, 2) + 
        Math.pow(dockingPointY - finalY, 2)
      );

      return dist < SNAP_DISTANCE;
    });

    // 자석이 발동했다면?
    if (targetBlock) {
      // 좌표를 타겟 바로 밑으로 강제 고정!
      finalX = targetBlock.x;
      finalY = targetBlock.y + BLOCK_HEIGHT;
      newParentId = targetBlock.id; // 부모 설정
    } else {
      // 허공에 놓았으면 부모 없음 (연결 끊기)
      newParentId = null; 
    }
    // ----------------------------------------------------

    // 3. 상태 업데이트
    if (dragInfo.type === "NEW") {
      // 새 블록 추가
      const newBlock = {
        id: Date.now(),
        text: dragInfo.text,
        color: dragInfo.color,
        x: finalX,
        y: finalY,
        parentId: newParentId, // 부모 정보 저장
      };
      setBlocks((prev) => [...prev, newBlock]);
    } 
    else if (dragInfo.type === "MOVE") {
      // 기존 블록 이동 (그룹 이동 포함!)
      
      // (1) 만약 자석이 붙었다면? -> 내 좌표만 바꾸면 됨 (나중에 자식들은 따라옴)
      // 하지만 여기선 "움직인 거리(delta)"가 아니라 "최종 좌표(final)"로 계산해야 깔끔함.
      
      // 로직 단순화를 위해:
      // 1. 우선 내 위치를 finalX, finalY로 옮김.
      // 2. 내 원래 위치와 final 위치의 차이(실제 이동량)를 구함.
      // 3. 그 차이만큼 자식들도 이동시킴.

      const actualDeltaX = finalX - dragInfo.initialBlockX;
      const actualDeltaY = finalY - dragInfo.initialBlockY;

      setBlocks((prevBlocks) => {
        let nextBlocks = [...prevBlocks];
        
        // 나 자신 업데이트 (좌표 + 부모정보 갱신)
        const myIndex = nextBlocks.findIndex(b => b.id === dragInfo.id);
        if (myIndex !== -1) {
          nextBlocks[myIndex] = {
            ...nextBlocks[myIndex],
            x: finalX,
            y: finalY,
            parentId: newParentId, // 부모 갱신 (붙거나 떨어짐)
          };
        }

        // 자식들 업데이트 (재귀 함수 사용)
        // 주의: 내 위치는 위에서 이미 바꿨으므로, "자식들만" 찾아서 actualDelta만큼 이동
        const moveChildrenRecursive = (parentId, dx, dy) => {
          const children = nextBlocks.filter(b => b.parentId === parentId);
          children.forEach(child => {
            const childIndex = nextBlocks.findIndex(b => b.id === child.id);
            if (childIndex !== -1) {
              nextBlocks[childIndex] = {
                ...nextBlocks[childIndex],
                x: nextBlocks[childIndex].x + dx,
                y: nextBlocks[childIndex].y + dy
              };
              // 그 자식의 자식도 이동
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

  const hiddenIds = dragInfo?.isDragging && dragInfo.type === "MOVE"
    ? [dragInfo.id, ...(dragInfo.groupBlocks?.map(b => b.id) || [])]
    : [];

  const editorContent = (
    <div ref={editorRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <BlockEditorPane 
        blocks={blocks} 
        onBlockDown={handleWorkspaceBlockDown}
        hiddenIds={hiddenIds} // draggingId 대신 이거 사용! (아래 단계에서 수정함)
      />
    </div>
  );

  const paletteContent = (
    <BlockPalettePane onDragStart={handlePaletteDragStart} />
  );

  const outputContent = (
    <div style={{ padding: "20px" }}>블록 개수: {blocks.length}</div>
  );
  
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

      {/* ★ 유령 블록 그리기 (수정됨) ★ */}
      {dragInfo?.isDragging && (
        <svg
          style={{
            position: "fixed", left: 0, top: 0, width: "100%", height: "100%",
            pointerEvents: "none", zIndex: 9999
          }}
        >
          {/* 1. 대장 블록 (내가 잡은 놈) */}
          <Block 
            text={dragInfo.text} 
            color={dragInfo.color} 
            x={dragInfo.x} 
            y={dragInfo.y} 
          />
          
          {/* 2. 쫄병 블록들 (대장 위치 + 아까 계산한 오차) */}
          {dragInfo.groupBlocks && dragInfo.groupBlocks.map(child => (
            <Block
              key={"ghost-" + child.id}
              text={child.text}
              color={child.color}
              // 대장의 현재 유령 위치(dragInfo.x) + 떨어진 거리(child.offsetX)
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