import React, { useState } from "react";
import Block from "./Block";
import { buildBlockSpec } from "./buildBlockSpec";

export function BlockPalettePane({ onDragStart, variables = [], onCreateVariable }) {
  const [selectedCategory, setSelectedCategory] = useState("calc");

  const lit = (data) => ({ valueType: "LITERAL", data });
  const variable = (name) => ({ valueType: "VARIABLE", variableName: name });
  const binary = (op, left, right) => ({ valueType: "BINARY", operator: op, left, right });

  const categories = [
    { id: "event", label: "이벤트", color: "#00B400" },
    { id: "control", label: "제어", color: "#8C68CD" },
    { id: "condition", label: "조건", color: "#5CB1D6" },
    { id: "calc", label: "연산", color: "#4CBFE6" },
    { id: "output", label: "출력", color: "#E91E63" },
    { id: "var", label: "변수", color: "#FF8C1A" },
  ];

  const staticBlocks = [
    // [이벤트]
    { id: 1, category: "event", blockType: "START", text: "시작", color: "#00B400", shape: "command" },

    // [제어]
    { id: 4, category: "control", blockType: "FOR", text: "반복", color: "#8C68CD", shape: "command-repeat", conditionExpression: "i<5", initExpression: "0", incrementExpression: "1", condition: binary("<", variable("i"), lit(5)), init: lit(0), increment: lit(1) },
    { id: 5, category: "control", blockType: "WHILE", text: "조건 반복", color: "#8C68CD", shape: "command-while", conditionExpression: "true", condition: lit(true) },
    { id: 6, category: "control", blockType: "IF", text: "만약", color: "#8C68CD", shape: "command-if", conditionExpression: "true", condition: lit(true) },
    { id: 7, category: "control", blockType: "IF", text: "만약 아니면", color: "#8C68CD", shape: "command-if-else", conditionExpression: "true", condition: lit(true) },

    // [조건]
    { id: 30, category: "condition", text: ">", color: "#5CB1D6", shape: "boolean-binary" },
    { id: 31, category: "condition", text: "<", color: "#5CB1D6", shape: "boolean-binary" },
    { id: 32, category: "condition", text: "==", color: "#5CB1D6", shape: "boolean-binary" },
    { id: 33, category: "condition", text: "!=", color: "#5CB1D6", shape: "boolean-binary" },
    { id: 34, category: "condition", text: "&&", color: "#5CB1D6", shape: "boolean-binary" },
    { id: 35, category: "condition", text: "||", color: "#5CB1D6", shape: "boolean-binary" },
    { id: 36, category: "condition", text: "true", color: "#5CB1D6", shape: "boolean" },
    { id: 37, category: "condition", text: "false", color: "#5CB1D6", shape: "boolean" },

    // [연산]
    { id: 10, category: "calc", text: "+", color: "#4CBFE6", shape: "value-operator-2slot" },
    { id: 12, category: "calc", text: "-", color: "#4CBFE6", shape: "value-operator-2slot" },
    { id: 13, category: "calc", text: "*", color: "#4CBFE6", shape: "value-operator-2slot" },
    { id: 14, category: "calc", text: "/", color: "#4CBFE6", shape: "value-operator-2slot" },
    { id: 16, category: "calc", text: "%", color: "#4CBFE6", shape: "value-operator-2slot" },
    { id: 17, category: "calc", text: "0", color: "#4CBFE6", shape: "value-input" },

    // [출력]
    { id: 18, category: "output", text: "\"text\"", color: "#E91E63", shape: "value-string" },
    { id: 80, category: "output", blockType: "PRINT", text: "출력하기", color: "#E91E63", shape: "command-print" },

    // [변수]
    { id: 20, category: "var", blockType: "VAR_DECLARE", text: "변수 선언", subText: "=", color: "#FF8C1A", shape: "variable-set", variableName: "변수", variableType: "number", initialValue: "0", initial: lit(0) },
    { id: 21, category: "var", blockType: "VAR_ASSIGN", text: "값 넣기", subText: "=", color: "#FF8C1A", shape: "variable-set", variableName: "변수", variableType: "number", valueExpression: "0", value: lit(0) },
  ];

  const variableBlocks = variables.map((varName, index) => ({
    id: `var-${index}`,
    category: "var",
    text: varName,
    color: "#FF8C1A",
    shape: "value-pill",
    isPalette: true,  // 팔레트용 (수정 불가, solid 스타일)
  }));

  const allBlocks = [...staticBlocks, ...variableBlocks];
  const filteredBlocks = allBlocks.filter((b) => b.category === selectedCategory);

  // 각 블록의 레이아웃 정보 계산 (에러 처리 포함)
  const displayBlocks = filteredBlocks.map((block) => {
    const baseBlock = {
      ...block,
      variables,
      // 드롭다운 제거로 콜백 불필요
    };
    try {
      const spec = buildBlockSpec(baseBlock);
      if (!spec) {
        console.warn(`buildBlockSpec returned null for block:`, block.id, block.shape);
        return null;
      }
      return {
        ...baseBlock,
        calculatedWidth: spec.width ?? 100,
        calculatedHeight: spec.height ?? 40,
      };
    } catch (err) {
      console.error(`buildBlockSpec error for block:`, block.id, block.shape, err);
      return null;
    }
  }).filter(Boolean); // null 제거

  // 드래그 핸들러 - 마우스다운 이벤트를 직접 처리
  const handleBlockMouseDown = (block, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDragStart) {
      onDragStart(block, e);
    }
  };

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
            data-category={cat.id}
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

      {/* 변수 탭일 때만 "Make a Variable" 버튼 표시 */}
      {selectedCategory === "var" && (
        <div style={{ padding: "10px 15px", background: "#fff" }}>
          <button
            onClick={onCreateVariable}
            style={{
              width: "100%",
              padding: "10px",
              background: "#eee",
              border: "1px solid #ccc",
              borderRadius: "4px",
              color: "#333",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "13px"
            }}
          >
            Make a Variable
          </button>
        </div>
      )}

      {/* 블록 리스트 - DIV 기반 레이아웃 */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {displayBlocks.map((block) => (
          <div
            key={block.id}
            data-block-id={block.id}
            data-block-type={block.blockType}
            data-block-shape={block.shape}
            style={{
              cursor: "grab",
              userSelect: "none",
              display: "inline-block",
              width: "fit-content",
            }}
            onMouseDown={(e) => handleBlockMouseDown(block, e)}
          >
            {/* SVG 블록 렌더링 */}
            <svg
              width={block.calculatedWidth}
              height={block.calculatedHeight}
              style={{ display: "block", pointerEvents: "none" }}
            >
              <Block
                {...block}
                x={0}
                y={0}
                onMouseDown={() => { }} // 부모 div에서 처리
              />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}
