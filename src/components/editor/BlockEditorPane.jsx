import React from "react";
import Block from "./Block";

// isOverTrash props 추가
export function BlockEditorPane({
  blocks = [],
  onBlockDown,
  hiddenIds = [],
  isOverTrash = false, // 휴지통 호버 상태
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
        position: "relative", // 휴지통 절대 배치를 위해
      }}
    >
      <svg width="100%" height="100%">
        {blocks.map((block) => {
          const isHidden = hiddenIds.includes(block.id);

          return (
            <g key={block.id} style={{ opacity: isHidden ? 0 : 1 }}>
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

      {/* --- 휴지통 UI 시작 --- */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          width: 60,
          height: 60,
          borderRadius: "50%",
          backgroundColor: isOverTrash ? "#ffcccc" : "white",
          border: isOverTrash ? "3px solid red" : "2px solid #aaa",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          transition: "all 0.2s ease",
          zIndex: 10,
          pointerEvents: "none", // 마우스 이벤트가 아래 SVG 방해하지 않도록
        }}
      >
        {/* 간단한 휴지통 아이콘 SVG */}
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 6H5H21"
            stroke={isOverTrash ? "red" : "#666"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z"
            stroke={isOverTrash ? "red" : "#666"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {/* --- 휴지통 UI 끝 --- */}
    </div>
  );
}