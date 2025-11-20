// src/components/editor/BlockEditorPane.jsx

import React from "react";
import Block from "./Block";

// props 이름 변경: draggingId -> hiddenIds (배열)
export function BlockEditorPane({ blocks = [], onBlockDown, hiddenIds = [] }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#dcdcdc",
        overflow: "hidden",
      }}
    >
      <svg width="100%" height="100%">
        {blocks.map((block) => {
          // 이 블록의 ID가 '숨김 목록'에 포함되어 있는지 확인
          const isHidden = hiddenIds.includes(block.id);

          return (
            <g 
              key={block.id} 
              style={{ opacity: isHidden ? 0 : 1 }} // 포함되면 투명하게
            >
              <Block
                id={block.id}
                text={block.text}
                color={block.color}
                x={block.x}
                y={block.y}
                onMouseDown={onBlockDown} 
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}