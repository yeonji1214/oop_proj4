import React from "react";

const Block = ({
  id,
  text,
  color = "#3399FF",
  shape = "command", // "command" | "value-pill" | "value-square" | "boolean" | "command-with-condition-slot" | "value-operator-2slot"
  x = 0,
  y = 0,
  onMouseDown,
  
  // --- [레이아웃 관련 Props] ---
  // 부모(App.jsx)에서 계산된 크기 정보를 받아옵니다.
  totalWidth,      // 블록의 전체 너비
  slotWidth = 100, // "만약" 블록의 육각형 슬롯 너비
  
  // 연산자 블록용 자식 슬롯 너비
  leftSlotWidth = 30,  
  rightSlotWidth = 30, 
}) => {
  const safeX = isNaN(x) ? 0 : x;
  const safeY = isNaN(y) ? 0 : y;

  // 기본 텍스트 기반 너비 계산 (totalWidth가 없을 때를 대비한 백업)
  const textLen = text ? text.length : 0;
  const defaultTextWidth = textLen * 12; // 글자당 12px

  // 기본 높이 (일반 블록용)
  const defaultHeight = 40;

  const renderShape = () => {
    switch (shape) {
      
      // ============================================================
      // [NEW] 이항 연산자 블록 (구멍 2개, 동적 너비)
      // ============================================================
      case "value-operator-2slot": {
        const height = 30;
        
        // 1. 전체 몸통 너비 결정 (props 우선, 없으면 기본 계산)
        const width = totalWidth || (defaultTextWidth + 80); 
        
        // 2. 왼쪽 구멍 위치 및 너비
        // 시작점(15)에서 그립니다.
        const currentLeftSlotW = leftSlotWidth || 30;

        // 3. 오른쪽 구멍 위치 및 너비
        // 끝점(width-15)에서 너비만큼 뺀 위치가 시작점입니다.
        const currentRightSlotW = rightSlotWidth || 30;
        const rightSlotX = width - 15 - currentRightSlotW;

        // 4. 텍스트 위치 (블록 전체의 정중앙)
        const textCenter = width / 2;

        return (
          <g>
            {/* 메인 몸체 (알약 모양) */}
            <rect
              x={0}
              y={5}
              rx={15}
              ry={15}
              width={width}
              height={height}
              fill={color}
              stroke="#fff"
              strokeWidth="1"
            />
            
            {/* 왼쪽 구멍 (음영 처리) */}
            <rect
              x={15}
              y={5}
              width={currentLeftSlotW}
              height={30}
              rx={15}
              fill="rgba(0,0,0,0.15)" // 살짝 어둡게 해서 구멍처럼 보이게 함
            />

            {/* 오른쪽 구멍 (음영 처리) */}
             <rect
              x={rightSlotX}
              y={5}
              width={currentRightSlotW}
              height={30}
              rx={15}
              fill="rgba(0,0,0,0.15)"
            />

            {/* 연산자 기호 (+, -, * 등) */}
            <text
              x={textCenter}
              y={25} // y=5 시작 + 높이중앙(15) + 텍스트보정(5)
              fill="white"
              fontSize="16px"
              fontWeight="bold"
              textAnchor="middle"
              style={{ pointerEvents: "none" }}
            >
              {text}
            </text>
          </g>
        );
      }

      // ============================================================
      // 타원형 값 블록 (변수, 숫자 등)
      // ============================================================
      case "value-pill": {
        const pillHeight = 30;
        // 텍스트 길이에 따라 늘어나거나, 최소 높이와 같게(정원) 설정
        const pillWidth = totalWidth || Math.max(textLen * 12 + 24, pillHeight);
        
        return (
          <g>
            <rect
              x={0}
              y={5}
              rx={pillHeight / 2}
              ry={pillHeight / 2}
              width={pillWidth}
              height={pillHeight}
              fill={color}
              stroke="#fff"
              strokeWidth="1"
            />
            <text
              x={pillWidth / 2}
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
      }

      // ============================================================
      // 네모 값 블록 (예전 호환성 유지)
      // ============================================================
      case "value-square": {
        const baseWidth = defaultTextWidth + 30;
        return (
          <g>
            <rect
              x={0}
              y={5}
              width={Math.max(baseWidth, 80)}
              height={30}
              fill={color}
              stroke="#fff"
              strokeWidth="1"
              rx={4}
              ry={4}
            />
            <text
              x={Math.max(baseWidth, 80) / 2}
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
      }

      // ============================================================
      // 육각형 불리언 블록 (조건, 참/거짓)
      // ============================================================
      case "boolean": {
        const h = 30;                
        const pad = 6;               
        const w = totalWidth || Math.max(defaultTextWidth + 40, 80); 
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
              y={midY + 5}
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


      // ============================================================
      // 퍼즐형 블록 + 육각형 조건 슬롯 (만약 ... 이라면)
      // ============================================================
      case "command-with-condition-slot": {
        const leftLabel = "만약";
        const rightLabel = "이라면";
        const labelWidth = 40; 
        const padding = 10;
        
        // 전체 너비: 왼쪽텍스트 + 슬롯너비 + 오른쪽텍스트 + 여백
        const currentSlotWidth = slotWidth; // props로 받은 슬롯 너비 사용
        const blockTotalWidth = labelWidth + currentSlotWidth + labelWidth + (padding * 2);
        
        const blockHeight = 50; 
        
        const pathData = `
          M 0 4 a 4 4 0 0 1 4 -4 h 10 l 4 4 h 12 l 4 -4
          h ${blockTotalWidth - 34} a 4 4 0 0 1 4 4 v ${blockHeight - 8}
          a 4 4 0 0 1 -4 4 h -${blockTotalWidth - 34} l -4 4 h -12
          l -4 -4 h -10 a 4 4 0 0 1 -4 -4 Z
        `;

        // 슬롯 위치 계산
        const slotX = labelWidth + padding;
        const slotY = 10; 
        const sh = 30; // 슬롯 높이
        const cy = slotY + sh / 2;

        const hexPoints = `
          ${slotX},${cy}
          ${slotX + 10},${slotY}
          ${slotX + currentSlotWidth - 10},${slotY}
          ${slotX + currentSlotWidth},${cy}
          ${slotX + currentSlotWidth - 10},${slotY + sh}
          ${slotX + 10},${slotY + sh}
        `;

        const textY = 30; 
        const leftX = 15; 
        const rightX = slotX + currentSlotWidth + 10; 

        return (
          <g>
            <path d={pathData} fill={color} stroke="#fff" strokeWidth="1" />
            
            {/* 육각형 슬롯 (구멍) */}
            <polygon
              points={hexPoints}
              fill="#000" 
              fillOpacity="0.2" // 구멍 느낌
              stroke="#ffffff"
              strokeWidth="0.8"
            />

            <text x={leftX} y={textY} fill="white" fontSize="14px" fontWeight="bold" textAnchor="start" style={{ pointerEvents: "none" }}>
              {leftLabel}
            </text>

            <text x={rightX} y={textY} fill="white" fontSize="14px" fontWeight="bold" textAnchor="start" style={{ pointerEvents: "none" }}>
              {rightLabel}
            </text>
          </g>
        );
      }

      // ============================================================
      // 기본 퍼즐형 커맨드 블록 
      // ============================================================
      case "command":
      default: {
        const w = totalWidth || Math.max(defaultTextWidth + 30, 80);
        const pathData = `
          M 0 4 a 4 4 0 0 1 4 -4 h 10 l 4 4 h 12 l 4 -4
          h ${w - 34} a 4 4 0 0 1 4 4 v ${defaultHeight - 8}
          a 4 4 0 0 1 -4 4 h -${w - 34} l -4 4 h -12
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