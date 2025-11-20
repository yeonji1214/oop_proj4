import React from "react";

// 1. props에서 x, y를 받을 때 기본값을 0으로 설정
const Block = ({ id, text, color, x = 0, y = 0, onMouseDown }) => {
  
  // 2. 만약 x나 y가 NaN으로 들어오면 강제로 0으로 바꿔버림 (에러 방지)
  const safeX = isNaN(x) ? 0 : x;
  const safeY = isNaN(y) ? 0 : y;

  const width = text.length * 14 + 30;
  const height = 40;

  const pathData = `
    M 0 4 a 4 4 0 0 1 4 -4 h 10 l 4 4 h 12 l 4 -4 
    h ${width - 34} a 4 4 0 0 1 4 4 v ${height - 8} 
    a 4 4 0 0 1 -4 4 h -${width - 34} l -4 4 h -12 
    l -4 -4 h -10 a 4 4 0 0 1 -4 -4 Z
  `;

  return (
    <g
      // 3. 여기서 x, y 대신 safeX, safeY를 사용합니다!
      transform={`translate(${safeX}, ${safeY})`}
      style={{ cursor: "grab", userSelect: "none" }}
      onMouseDown={(e) => {
        e.stopPropagation();
        if (onMouseDown) onMouseDown(id, e);
      }}
    >
      <path d={pathData} fill={color} stroke="#fff" strokeWidth="1" />
      <text x="10" y="25" fill="white" fontSize="14px" fontWeight="bold" style={{ pointerEvents: "none" }}>
        {text}
      </text>
    </g>
  );
};

export default Block;