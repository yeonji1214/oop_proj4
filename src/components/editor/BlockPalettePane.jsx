import React from "react";
import Block from "./Block";

export function BlockPalettePane({ onDragStart }) {
  const blockList = [
    { id: 1, text: "깃발 클릭했을 때", color: "#00B400", shape: "command" },
    { id: 2, text: "10만큼 이동",        color: "#3399FF", shape: "command" },
    { id: 3, text: "오른쪽 회전",        color: "#3399FF", shape: "command" },
    { id: 4, text: "무한 반복하기",      color: "#8C68CD", shape: "command" },
    { id: 5, text: "만약 (조건) 이라면", color: "#8C68CD", shape: "command-with-condition-slot" },
    { id: 6, text: "x > 10",             color: "#44c3ff", shape: "boolean" },
    { id: 7, text: "x 값",               color: "#0fbd8c", shape: "value-pill" },
  ];

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <svg width="100%" height="100%">
        {blockList.map((block, index) => (
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
                y={20 + index * 50}
              />
            </g>

            <rect
              x={20}
              y={20 + index * 50}
              width={180}
              height={40}
              fill="transparent"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
