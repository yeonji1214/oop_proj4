import React from "react";

const Block = ({
  id,
  text,
  color = "#3399FF",
  shape = "command", // "command" | "value-pill" | "value-square" | "boolean" | "command-with-condition-slot"
  x = 0,
  y = 0,
  onMouseDown,
}) => {
  const safeX = isNaN(x) ? 0 : x;
  const safeY = isNaN(y) ? 0 : y;

  const baseWidth = text ? text.length * 14 + 30 : 80;
  const height = 40;

  const renderShape = () => {
    switch (shape) {
      // 타원형 값 블록
      case "value-pill":
        return (
          <g>
            <rect
              x={0}
              y={5}
              rx={20}
              ry={20}
              width={baseWidth}
              height={30}
              fill={color}
              stroke="#fff"
              strokeWidth="1"
            />
            <text
              x={baseWidth / 2}
              y={25}
              fill="white"
              fontSize="14px"
              fontWeight="bold"
              textAnchor="middle"
              style={{ pointerEvents: "none" }}
            >
              {text}
            </text>
          </g>
        );

      // 네모 값 블록
      case "value-square":
        return (
          <g>
            <rect
              x={0}
              y={5}
              width={baseWidth}
              height={30}
              fill={color}
              stroke="#fff"
              strokeWidth="1"
              rx={4}
              ry={4}
            />
            <text
              x={baseWidth / 2}
              y={25}
              fill="white"
              fontSize="14px"
              fontWeight="bold"
              textAnchor="middle"
              style={{ pointerEvents: "none" }}
            >
              {text}
            </text>
          </g>
        );

      // 육각형 불리언 블록
      case "boolean": {
        const h = 30;                // 육각형 높이
        const pad = 6;               // 좌우/위아래 오프셋
        const w = baseWidth;         // 텍스트 기반 가로 길이
        const midY = h / 2 + 5;

        const hexPoints = `
          ${pad},${midY}
          ${pad + 10},${5}
          ${w - pad - 10},${5}
          ${w - pad},${midY}
          ${w - pad - 10},${h + 5}
          ${pad + 10},${h + 5}
        `;

        return (
          <g>
            <polygon
              points={hexPoints}
              fill={color}
              stroke="#fff"
              strokeWidth="1"
            />

            <text
              x={w / 2}
              y={midY + 4}
              fill="white"
              fontSize="14px"
              fontWeight="bold"
              textAnchor="middle"
              style={{ pointerEvents: "none" }}
            >
              {text}
            </text>
          </g>
        );
      }


      // 퍼즐형 블록 + 가운데 육각형 조건 슬롯 
      case "command-with-condition-slot": {
        // 바깥 퍼즐형 블록 path 
        const pathData = `
          M 0 4 a 4 4 0 0 1 4 -4 h 10 l 4 4 h 12 l 4 -4
          h ${baseWidth - 34} a 4 4 0 0 1 4 4 v ${height - 8}
          a 4 4 0 0 1 -4 4 h -${baseWidth - 34} l -4 4 h -12
          l -4 -4 h -10 a 4 4 0 0 1 -4 -4 Z
        `;

        const slotWidth = 80;
        const slotHeight = 22;

        // 가운데에 육각형 슬롯 배치
        const slotX = baseWidth / 2 - slotWidth / 2;
        const slotY = 9;
        const sw = slotWidth;
        const sh = slotHeight;
        const cy = slotY + sh / 2;

        const hexPoints = `
          ${slotX},${cy}
          ${slotX + sh / 2},${slotY}
          ${slotX + sw - sh / 2},${slotY}
          ${slotX + sw},${cy}
          ${slotX + sw - sh / 2},${slotY + sh}
          ${slotX + sh / 2},${slotY + sh}
        `;

        // 텍스트 위치: "만약" / "이라면"
        const leftLabel = "만약";
        const rightLabel = "이라면";
        const textY = 25;
        const leftX = slotX - 40; 
        const rightX = slotX + sw + 10; 

        return (
          <g>
            <path d={pathData} fill={color} stroke="#fff" strokeWidth="1" />

            <polygon
              points={hexPoints}
              fill="#6b4bb0"
              opacity="0.9"
              stroke="#ffffff"
              strokeWidth="0.8"
            />

            <text
              x={leftX}
              y={textY}
              fill="white"
              fontSize="14px"
              fontWeight="bold"
              textAnchor="start"
              style={{ pointerEvents: "none" }}
            >
              {leftLabel}
            </text>

            <text
              x={rightX}
              y={textY}
              fill="white"
              fontSize="14px"
              fontWeight="bold"
              textAnchor="start"
              style={{ pointerEvents: "none" }}
            >
              {rightLabel}
            </text>
          </g>
        );
      }

      // 기본 퍼즐형 커맨드 블록 
      case "command":
      default: {
        const pathData = `
          M 0 4 a 4 4 0 0 1 4 -4 h 10 l 4 4 h 12 l 4 -4
          h ${baseWidth - 34} a 4 4 0 0 1 4 4 v ${height - 8}
          a 4 4 0 0 1 -4 4 h -${baseWidth - 34} l -4 4 h -12
          l -4 -4 h -10 a 4 4 0 0 1 -4 -4 Z
        `;
        return (
          <g>
            <path d={pathData} fill={color} stroke="#fff" strokeWidth="1" />
            <text
              x={10}
              y={25}
              fill="white"
              fontSize="14px"
              fontWeight="bold"
              style={{ pointerEvents: "none" }}
            >
              {text}
            </text>
          </g>
        );
      }
    }
  };

  return (
    <g
      transform={`translate(${safeX}, ${safeY})`}
      style={{ cursor: "grab", userSelect: "none" }}
      onMouseDown={(e) => {
        e.stopPropagation();
        if (onMouseDown) onMouseDown(id, e);
      }}
    >
      {renderShape()}
    </g>
  );
};

export default Block;
