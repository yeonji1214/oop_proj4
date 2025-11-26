import React, { useState } from "react";
import Block from "./Block";

export function BlockPalettePane({ onDragStart }) {
  const [selectedCategory, setSelectedCategory] = useState("control"); // 테스트 위해 control 기본 선택

  const categories = [
    { id: "event",     label: "이벤트", color: "#00B400" },
    { id: "motion",    label: "동작",   color: "#3399FF" },
    { id: "control",   label: "제어",   color: "#8C68CD" },
    { id: "condition", label: "조건",   color: "#5CB1D6" },
    { id: "calc",      label: "연산",   color: "#4CBFE6" },
    { id: "output",    label: "출력",   color: "#E91E63" },
    { id: "var",       label: "변수",   color: "#FF8C1A" },
  ];

  const allBlocks = [
    // [이벤트]
    { id: 1, category: "event", text: "깃발 클릭했을 때", color: "#00B400", shape: "command" },
    
    // [동작]
    { id: 2, category: "motion", text: "10만큼 이동", color: "#3399FF", shape: "command" },
    { id: 3, category: "motion", text: "오른쪽 회전", color: "#3399FF", shape: "command" },
    
    // [제어] (새로 만든 블록들)
    { id: 4, category: "control", text: "10",       color: "#8C68CD", shape: "command-repeat" }, 
    { id: 5, category: "control", text: "참",       color: "#8C68CD", shape: "command-while" },
    { id: 6, category: "control", text: "조건",     color: "#8C68CD", shape: "command-if" },
    { id: 7, category: "control", text: "조건",     color: "#8C68CD", shape: "command-if-else" },
    
    // [조건]
    { id: 30, category: "condition", text: ">",      color: "#5CB1D6", shape: "boolean-binary" }, // 크다
    { id: 31, category: "condition", text: "<",      color: "#5CB1D6", shape: "boolean-binary" }, // 작다
    { id: 32, category: "condition", text: "=",      color: "#5CB1D6", shape: "boolean-binary" }, // 같다
    { id: 33, category: "condition", text: "그리고", color: "#5CB1D6", shape: "boolean-binary" }, // AND
    { id: 34, category: "condition", text: "또는",   color: "#5CB1D6", shape: "boolean-binary" }, // OR
    { id: 35, category: "condition", text: "아니라면", color: "#5CB1D6", shape: "boolean-not" },  // NOT
    
    // [연산]
    { id: 10, category: "calc", text: "+", color: "#4CBFE6", shape: "value-operator-2slot" },
    { id: 12, category: "calc", text: "-", color: "#4CBFE6", shape: "value-operator-2slot" },
    { id: 13, category: "calc", text: "*", color: "#4CBFE6", shape: "value-operator-2slot" },
    { id: 14, category: "calc", text: "/", color: "#4CBFE6", shape: "value-operator-2slot" },
    { id: 15, category: "calc", text: "^", color: "#4CBFE6", shape: "value-operator-2slot" },
    { id: 16, category: "calc", text: "%", color: "#4CBFE6", shape: "value-operator-2slot" },

    // [출력]
    { id: 80, category: "output", text: "출력하기",  color: "#E91E63", shape: "command-print" }, // 구멍 있는 커맨드
    { id: 81, category: "output", text: '"안녕"',    color: "#E91E63", shape: "value-string" },  // 문자열 값
    
    // [변수]
    { id: 20, category: "var", text: "내 변수", color: "#FF8C1A", shape: "value-pill" },
    { id: 22, category: "var", text: "0", color: "#FF8C1A", shape: "value-input" },
  ];

  const filteredBlocks = allBlocks.filter((b) => b.category === selectedCategory);

  // ----------------------------------------------------------------
  // [계산 로직] 각 블록의 높이와 너비를 미리 계산하여 Y좌표를 누적합니다.
  // ----------------------------------------------------------------
  let accumulatedY = 20; // 시작 Y 위치
  
  const displayBlocks = filteredBlocks.map((block) => {
    const textLen = block.text.length;
    const textWidth = Math.max(textLen * 12, 10);
    
    let width = 0;
    let height = 0;
    
    // 팔레트에서 보여줄 때 사용할 기본 속성들
    let extraProps = {}; 

    switch (block.shape) {
      case "command-if":
      case "command-if-else": {
        // 만약(40) + 슬롯(100) + 이라면(40) + 여백들
        width = 40 + 10 + 100 + 10 + 40 + 20;
        
        // 높이: 헤더(50) + 내용(30) + 바닥(30) = 110 (if-else는 더 큼)
        const baseH = 50 + 30 + 30;
        height = block.shape === "command-if-else" ? baseH + 40 + 30 : baseH;
        
        extraProps = { 
            slotWidth: 100, 
            subStack1Height: 30, 
            subStack2Height: 30 
        };
        break;
      }
      case "command-repeat": {
        // 슬롯(30) + "번 반복하기"(~100)
        const labelLen = "번 반복하기".length * 14;
        width = 20 + 30 + 10 + labelLen + 20;
        height = 50 + 30 + 30; // 110
        extraProps = { slotWidth: 30, subStack1Height: 30 };
        break;
      }
      case "command-while": {
        // 슬롯(100) + "인 동안 반복하기"
        const labelLen = "인 동안 반복하기".length * 14;
        width = 20 + 100 + 10 + labelLen + 20;
        height = 50 + 30 + 30; // 110
        extraProps = { slotWidth: 100, subStack1Height: 30 };
        break;
      }
      case "command-print": { // [NEW] 출력하기 블록
         // 텍스트 + 슬롯(30) + 여백
         const textW = block.text.length * 14;
         width = 15 + 30 + 10 + textW + 20; 
         height = 40;
         extraProps = { slotWidth: 30 }; // 기본 슬롯 크기
         break;
      }
      case "value-string": { // [NEW] 문자열 블록
         const textW = block.text.length * 12;
         width = textW + 30;
         height = 30;
         break;
      }
      case "value-operator-2slot": {
        width = 15 + 30 + 10 + textWidth + 10 + 30 + 15;
        height = 30;
        extraProps = { leftSlotWidth: 30, rightSlotWidth: 30 };
        break;
      }
      case "boolean": {
        width = textWidth + 50;
        height = 30;
        break;
      }
      case "value-pill": {
        width = textWidth + 24;
        height = 30;
        break;
      }
      case "boolean-binary": {
        // [구멍] 연산자 [구멍] 형태
        const textW = block.text.length * 12;
        width = 15 + 30 + 10 + textW + 10 + 30 + 15; // 값 연산자랑 비슷
        height = 30;
        extraProps = { leftSlotWidth: 30, rightSlotWidth: 30 };
        break;
      }
      case "boolean-not": {
        // "아니라면" [구멍] 형태
        const textW = block.text.length * 12;
        width = 15 + textW + 10 + 30 + 15;
        height = 30;
        extraProps = { slotWidth: 30 };
        break;
      }
      default: { // command
        width = textWidth + 40;
        height = 40;
        break;
      }
    }

    // 현재 블록의 Y 위치 저장
    const currentY = accumulatedY;
    
    // 다음 블록을 위해 Y 좌표 누적 (블록높이 + 여백 20)
    accumulatedY += height + 20;

    return {
      ...block,
      x: 20,
      y: currentY,
      calculatedWidth: width,
      calculatedHeight: height,
      extraProps
    };
  });

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      
      {/* 탭 메뉴 */}
      <div
        style={{
          padding: "10px",
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          borderBottom: "1px solid #ddd",
          background: "#f5f5f5",
          flexShrink: 0,
        }}
      >
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "20px",
              border: "none",
              cursor: "pointer",
              backgroundColor: selectedCategory === cat.id ? cat.color : "white",
              color: selectedCategory === cat.id ? "white" : "#333",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              fontSize: "13px",
              fontWeight: "bold",
              transition: "all 0.2s",
              whiteSpace: "nowrap",
            }}
          >
            {selectedCategory !== cat.id && (
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: cat.color,
                }}
              />
            )}
            {cat.label}
          </button>
        ))}
      </div>

      {/* 블록 리스트 */}
      <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
        {/* SVG 전체 높이를 누적된 Y만큼 설정 */}
        <svg width="100%" height={accumulatedY + 50}>
          {displayBlocks.map((block) => (
            <g
              key={block.id}
              style={{ cursor: "grab" }}
              onMouseDown={(e) => {
                if (onDragStart) {
                  onDragStart(block, e);
                }
              }}
            >
              <g style={{ pointerEvents: "none" }}>
                <Block
                  text={block.text}
                  color={block.color}
                  shape={block.shape}
                  x={block.x}
                  y={block.y}
                  
                  // 계산된 크기 및 추가 속성 주입
                  totalWidth={block.calculatedWidth}
                  height={block.calculatedHeight}
                  {...block.extraProps}
                />
              </g>

              {/* 드래그 감지 영역 */}
              <rect
                x={block.x}
                y={block.y}
                width={block.calculatedWidth}
                height={block.calculatedHeight}
                fill="transparent"
              />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}