import React from "react";
import Block from "./Block";

export function BlockEditorPane({
  blocks = [],
  onBlockDown,
  hiddenIds = [],
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#dcdcdc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <svg width="100%" height="100%">
        {blocks.map((block) => {
          const isHidden = hiddenIds.includes(block.id);

          return (
            <g
              key={block.id}
              style={{ opacity: isHidden ? 0 : 1 }}
            >
              <Block
                id={block.id}
                text={block.text}
                color={block.color}
                shape={block.shape}
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
