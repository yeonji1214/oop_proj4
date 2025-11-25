import React, { useState } from "react";
import Block from "./Block";

export function BlockPalettePane({ onDragStart }) {
  const [selectedCategory, setSelectedCategory] = useState("event");

  const categories = [
    { id: "event",     label: "이벤트", color: "#00B400" }, // 초록
    { id: "motion",    label: "동작",   color: "#3399FF" }, // 파랑
    { id: "control",   label: "제어",   color: "#8C68CD" }, // 보라
    { id: "condition", label: "조건",   color: "#5CB1D6" }, // [NEW] 하늘색 (판단)
    { id: "calc",      label: "연산",   color: "#4CBFE6" }, // 옥색 (계산)
    { id: "var",       label: "변수",   color: "#FF8C1A" }, // 주황
  ];

  const allBlocks = [
    // [이벤트]
    { id: 1, category: "event", text: "깃발 클릭했을 때", color: "#00B400", shape: "command" },
    
    // [동작]
    { id: 2, category: "motion", text: "10만큼 이동", color: "#3399FF", shape: "command" },
    { id: 3, category: "motion", text: "오른쪽 회전", color: "#3399FF", shape: "command" },
    
    // [제어]
    { id: 4, category: "control", text: "무한 반복하기",      color: "#8C68CD", shape: "command" },
    { id: 5, category: "control", text: "만약 (조건) 이라면", color: "#8C68CD", shape: "command-with-condition-slot" },
    
    // --- [새로 추가된 조건 블록들] (마름모/육각형 모양) ---
    { id: 30, category: "condition", text: "x < 10",       color: "#5CB1D6", shape: "boolean" },
    { id: 31, category: "condition", text: "x = 10",       color: "#5CB1D6", shape: "boolean" },
    { id: 32, category: "condition", text: "x > 10",       color: "#5CB1D6", shape: "boolean" },
    { id: 33, category: "condition", text: "참 그리고 참",   color: "#5CB1D6", shape: "boolean" },
    { id: 34, category: "condition", text: "참 또는 거짓",   color: "#5CB1D6", shape: "boolean" },
    { id: 35, category: "condition", text: "거짓이 아니다",  color: "#5CB1D6", shape: "boolean" },

    // [연산] (기존 값 블록)
    { id: 10, category: "calc", text: "+", color: "#4CBFE6", shape: "value-operator-2slot" },
    { id: 11, category: "calc", text: "-", color: "#4CBFE6", shape: "value-operator-2slot" },
    { id: 12, category: "calc", text: "*", color: "#4CBFE6", shape: "value-operator-2slot" },
    { id: 13, category: "calc", text: "/", color: "#4CBFE6", shape: "value-operator-2slot" },
    { id: 14, category: "calc", text: "%", color: "#4CBFE6", shape: "value-operator-2slot" },
    { id: 15, category: "calc", text: "^", color: "#4CBFE6", shape: "value-operator-2slot" },
    
    // [변수]
    { id: 20, category: "var", text: "내 변수", color: "#FF8C1A", shape: "value-pill" },
    { id: 21, category: "var", text: "점수",    color: "#FF8C1A", shape: "value-pill" },
  ];

  const filteredBlocks = allBlocks.filter((b) => b.category === selectedCategory);

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
        <svg width="100%" height={filteredBlocks.length * 60 + 20}>
          {filteredBlocks.map((block, index) => (
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
                  x={20}
                  y={20 + index * 60}
                />
              </g>

              <rect
                x={20}
                y={20 + index * 60}
                width={180}
                height={50}
                fill="transparent"
              />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}