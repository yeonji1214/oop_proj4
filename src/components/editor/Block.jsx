import React from "react";

const Block = ({
  id,
  text,
  color = "#3399FF",
  shape = "command", // "command" | "value-pill" | "value-square" | "boolean" | "command-with-condition-slot" | "value-operator-2slot"
  x = 0,
  y = 0,
  onMouseDown,
  variables = [], // 변수 목록 (예: ["my variable", "score"])
  onVarChange,    // 변경 함수

  // --- [레이아웃 관련 Props] ---
  // 부모(App.jsx)에서 계산된 크기 정보를 받아옵니다.
  totalWidth,      // 블록의 전체 너비
  slotWidth = 100, // "만약" 블록의 육각형 슬롯 너비
  height,
  onEdit,
  subText,
  selectedVar,
  
  // 연산자 블록용 자식 슬롯 너비
  leftSlotWidth = 30,  
  rightSlotWidth = 30, 
  subStack1Height = 0, // C모양 내부 높이
  subStack2Height = 0, // E모양 두번째 내부 높이
}) => {
  const safeX = isNaN(x) ? 0 : x;
  const safeY = isNaN(y) ? 0 : y;

  // 기본 텍스트 기반 너비 계산 (totalWidth가 없을 때를 대비한 백업)
  const textLen = text ? text.length : 0;
  const defaultTextWidth = textLen * 12; // 글자당 12px

  // 기본 높이 (일반 블록용)
  const defaultHeight = 40;

  const renderShape = () => {
    const renderDropdown = (x, y, w, currentVal) => {
      // label이 없으면 기본값 표시
      const displayLabel = currentVal || "my variable";
      
      return (
        <g>
          {/* 드롭다운 배경 */}
          <rect
            x={x} y={y} width={w} height={30}
            rx={4} ry={4}
            fill="#E67E22" 
            stroke="#CF711F"
            strokeWidth="1"
          />
          {/* 변수 이름 텍스트 */}
          <text
            x={x + 10} y={y + 20}
            fill="white" fontSize="12px" fontWeight="bold"
            style={{ pointerEvents: "none" }}
          >
            {displayLabel}
          </text>
          {/* 화살표 (▼) */}
          <path
            d={`M ${x + w - 18} ${y + 12} l 4 0 l -2 4 z`}
            fill="white"
          />
          <foreignObject x={x} y={y} width={w} height={30}>
            <select
              value={displayLabel}
              onChange={(e) => {
                // 선택하면 부모에게 알림
                if (onVarChange) onVarChange(id, e.target.value);
              }}
              style={{
                width: "100%",
                height: "100%",
                opacity: 0, // ★ 투명하게 만들어서 주황색 박스 위에 덮어씌움
                cursor: "pointer",
                border: "none",
              }}
            >
              {/* 변수 목록으로 옵션 생성 */}
              {variables.length > 0 ? (
                variables.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))
              ) : (
                <option value="my variable">my variable</option>
              )}
            </select>
          </foreignObject>
        </g>
      );
    };
    switch (shape) {
      
      // ============================================================
      // [NEW] 이항 연산자 블록 (구멍 2개, 동적 너비)
      // ============================================================
      case "value-operator-2slot": {
        // ★ [수정] props.height -> height 로 변경
        const currentHeight = height || 30;
        
        // 1. 전체 몸통 너비 결정
        const width = totalWidth || (defaultTextWidth + 80); 
        
        // 2. 텍스트 너비 추정
        const estimatedTextWidth = Math.max(textLen * 12, 10);

        // --- [높이 보정 로직] ---
        // 높이가 30보다 크면 그만큼 위로 올려서 그림 (중앙 정렬 효과)
        const yOffset = (currentHeight - 30) / 2;
        const startY = 5 - yOffset;

        // ... (나머지 로직은 동일) ...

        // (A) 왼쪽 구멍 위치
        const leftSlotX = 15;
        const currentLeftSlotW = leftSlotWidth || 30;
        const leftSlotEnd = leftSlotX + currentLeftSlotW;

        // (B) 텍스트 위치
        const textCenterX = leftSlotEnd + 10 + (estimatedTextWidth / 2);
        const textEnd = leftSlotEnd + 10 + estimatedTextWidth;

        // (C) 오른쪽 구멍 위치
        const rightSlotX = textEnd + 10;
        const currentRightSlotW = rightSlotWidth || 30;

        return (
          <g>
            {/* 메인 몸체 */}
            <rect
              x={0}
              y={startY} // 계산된 시작 Y좌표
              rx={15}
              ry={15}
              width={width}
              height={currentHeight} // 늘어난 높이 적용
              fill={color}
              stroke="#fff"
              strokeWidth="1"
            />
            
            {/* 왼쪽 구멍 (높이 30 고정) */}
            <rect
              x={leftSlotX}
              y={5} 
              width={currentLeftSlotW}
              height={30}
              rx={15}
              fill="rgba(0,0,0,0.15)"
            />

            {/* 오른쪽 구멍 (높이 30 고정) */}
             <rect
              x={rightSlotX}
              y={5}
              width={currentRightSlotW}
              height={30}
              rx={15}
              fill="rgba(0,0,0,0.15)"
            />

            {/* 연산자 기호 */}
            <text
              x={textCenterX}
              y={25}
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
      case "variable-set": {
        const currentSlotWidth = slotWidth || 30;
        
        // 1. 텍스트 너비 계산
        const label1 = text || "set";
        const label1W = label1.length * 12;
        
        const label2 = subText || ""; 
        const label2W = label2.length * 12;

        // 2. 좌표 계산 (공식 통일)
        const dropdownW = 100;
        
        // 드롭다운 위치 = 15 + 텍스트1 + 10
        const dropdownX = 15 + label1W + 10;
        
        // 텍스트2 위치 = 드롭다운끝 + 10
        const label2X = dropdownX + dropdownW + 10;
        
        // 슬롯 위치 = 텍스트2끝 + 10
        const slotX = label2X + label2W + 10;
        
        // 전체 너비 = 슬롯끝 + 15
        // (App.jsx에서 totalWidth를 안 줬을 때를 대비한 자체 계산)
        const calculatedWidth = slotX + currentSlotWidth + 15;
        const totalW = totalWidth || calculatedWidth;

        const pathData = `
          M 0 4 a 4 4 0 0 1 4 -4 h 10 l 4 4 h 12 l 4 -4
          h ${totalW - 34} a 4 4 0 0 1 4 4 v 32
          a 4 4 0 0 1 -4 4 h -${totalW - 34} l -4 4 h -12
          l -4 -4 h -10 a 4 4 0 0 1 -4 -4 Z
        `;

        return (
          <g>
            <path d={pathData} fill={color} stroke="#fff" strokeWidth="1" />
            
            <text x={15 + label1W/2} y={25} fill="white" fontSize="13px" fontWeight="bold" textAnchor="middle" style={{ pointerEvents: "none" }}>
              {label1}
            </text>

            {/* 드롭다운 (100px) */}
            {renderDropdown(dropdownX, 5, dropdownW, selectedVar)}

            <text x={label2X + label2W/2} y={25} fill="white" fontSize="13px" fontWeight="bold" textAnchor="middle" style={{ pointerEvents: "none" }}>
              {label2}
            </text>

            {/* 입력 슬롯 */}
            <rect x={slotX} y={5} width={currentSlotWidth} height={30} rx={15} fill="white" />
          </g>
        );
      }

      // ============================================================
      // [NEW] 변수 보이기/숨기기 블록 (show variable ...)
      // ============================================================
      case "variable-show": {
        const label1 = text || "show variable";
        const label1W = label1.length * 12;
        
        const dropdownW = 100;
        const dropdownX = 15 + label1W + 10;
        const totalW = totalWidth || (dropdownX + dropdownW + 15);

        const pathData = `
          M 0 4 a 4 4 0 0 1 4 -4 h 10 l 4 4 h 12 l 4 -4
          h ${totalW - 34} a 4 4 0 0 1 4 4 v 32
          a 4 4 0 0 1 -4 4 h -${totalW - 34} l -4 4 h -12
          l -4 -4 h -10 a 4 4 0 0 1 -4 -4 Z
        `;

        return (
          <g>
            <path d={pathData} fill={color} stroke="#fff" strokeWidth="1" />
            
            <text 
              x={15 + label1W/2} y={25} 
              fill="white" fontSize="13px" fontWeight="bold" 
              textAnchor="middle" style={{ pointerEvents: "none" }}
            >
              {label1}
            </text>

            {/* 변수 선택 드롭다운 */}
            {renderDropdown(dropdownX, 5, dropdownW, selectedVar)}
          </g>
        );
      }
      // ============================================================
      // [NEW] 횟수 반복문 (변수/숫자 구멍) - "n번 반복하기"
      // ============================================================
      case "command-repeat": {
        const headerHeight = 50; 
        const footerHeight = 30;
        const contentHeight = Math.max(subStack1Height, 30); 
        
        // 너비 계산 (텍스트 + 타원형 구멍)
        const leftLabel = ""; // 필요하면 "다음" 등 추가
        const rightLabel = "번 반복하기";
        
        const currentSlotWidth = slotWidth || 30; // 기본 30
        const topWidth = 20 + currentSlotWidth + 10 + (rightLabel.length * 14) + 20; 
        const w = Math.max(totalWidth || topWidth, topWidth);

        // ㄷ자 경로
        let path = `M 0 4 a 4 4 0 0 1 4 -4 h 10 l 4 4 h 12 l 4 -4 h ${w - 34}`;
        path += ` a 4 4 0 0 1 4 4 v ${headerHeight - 8}`;
        path += ` a 4 4 0 0 1 -4 4 h -${w - 34 - 15}`; 
        path += ` l -4 4 h -12 l -4 -4 h -10 a 4 4 0 0 0 -4 4 v ${contentHeight - 8}`;
        path += ` a 4 4 0 0 0 4 4 h 10 l 4 4 h 12 l 4 -4 h ${w - 34 - 15}`;
        path += ` a 4 4 0 0 1 4 4 v ${footerHeight - 8}`;
        path += ` a 4 4 0 0 1 -4 4 h -${w - 34}`;
        path += ` l -4 4 h -12 l -4 -4 h -10 a 4 4 0 0 1 -4 -4 Z`;

        // 타원형 구멍 (변수용)
        const slotX = 15;
        const slotY = 10;
        
        return (
          <g>
            <path d={path} fill={color} stroke="#fff" strokeWidth="1" />
            
            {/* 타원형 구멍 (Value Slot) */}
            <rect
              x={slotX}
              y={slotY}
              width={currentSlotWidth}
              height={30}
              rx={15}
              fill="rgba(0,0,0,0.15)"
            />

            <text x={slotX + currentSlotWidth + 10} y={30} fill="white" fontSize="14px" fontWeight="bold" style={{ pointerEvents: "none" }}>
              {rightLabel}
            </text>
          </g>
        );
      }

      // ============================================================
      // [NEW] 조건 반복문 (마름모/육각형 구멍) - "참인 동안 반복하기"
      // ============================================================
      case "command-while": {
        const headerHeight = 50; 
        const footerHeight = 30;
        const contentHeight = Math.max(subStack1Height, 30); 
        
        const rightLabel = "인 동안 반복하기";
        const currentSlotWidth = slotWidth || 100; // 육각형은 좀 더 넓게
        
        const topWidth = 20 + currentSlotWidth + 10 + (rightLabel.length * 14) + 20;
        const w = Math.max(totalWidth || topWidth, topWidth);

        // ㄷ자 경로 (동일)
        let path = `M 0 4 a 4 4 0 0 1 4 -4 h 10 l 4 4 h 12 l 4 -4 h ${w - 34}`;
        path += ` a 4 4 0 0 1 4 4 v ${headerHeight - 8}`;
        path += ` a 4 4 0 0 1 -4 4 h -${w - 34 - 15}`; 
        path += ` l -4 4 h -12 l -4 -4 h -10 a 4 4 0 0 0 -4 4 v ${contentHeight - 8}`;
        path += ` a 4 4 0 0 0 4 4 h 10 l 4 4 h 12 l 4 -4 h ${w - 34 - 15}`;
        path += ` a 4 4 0 0 1 4 4 v ${footerHeight - 8}`;
        path += ` a 4 4 0 0 1 -4 4 h -${w - 34}`;
        path += ` l -4 4 h -12 l -4 -4 h -10 a 4 4 0 0 1 -4 -4 Z`;

        // 육각형 구멍
        const slotX = 15; 
        const slotY = 10;
        const sh = 30;
        const cy = slotY + sh / 2;
        const hexPoints = `
          ${slotX},${cy}
          ${slotX + 10},${slotY}
          ${slotX + currentSlotWidth - 10},${slotY}
          ${slotX + currentSlotWidth},${cy}
          ${slotX + currentSlotWidth - 10},${slotY + sh}
          ${slotX + 10},${slotY + sh}
        `;

        return (
          <g>
            <path d={path} fill={color} stroke="#fff" strokeWidth="1" />
            
            {/* 육각형 구멍 (Condition Slot) */}
            <polygon points={hexPoints} fill="#000" fillOpacity="0.2" />

            <text x={slotX + currentSlotWidth + 10} y={30} fill="white" fontSize="14px" fontWeight="bold" style={{ pointerEvents: "none" }}>
              {rightLabel}
            </text>
          </g>
        );
      }
      // ============================================================
      // [NEW] 조건문 ㄷ자 (IF) - "만약 [조건] 이라면"
      // ============================================================
      case "command-if": {
        const headerHeight = 50; // 구멍이 들어가야 하므로 헤더를 50으로 키움
        const footerHeight = 30;
        const contentHeight = Math.max(subStack1Height, 30); 
        
        // --- 헤더 너비 계산 (구멍 포함) ---
        const leftLabel = "만약";
        const rightLabel = "이라면";
        const currentSlotWidth = slotWidth || 100; // 기본 100
        const topWidth = 40 + currentSlotWidth + 40 + 20; // 텍스트 + 슬롯 + 텍스트 + 여백
        const w = Math.max(totalWidth || topWidth, topWidth);

        // --- SVG 경로 그리기 ---
        let path = `M 0 4 a 4 4 0 0 1 4 -4 h 10 l 4 4 h 12 l 4 -4 h ${w - 34}`;
        path += ` a 4 4 0 0 1 4 4 v ${headerHeight - 8}`; // 헤더 높이만큼 내려옴
        
        // 내부 입 (천장)
        path += ` a 4 4 0 0 1 -4 4 h -${w - 34 - 15}`; 
        path += ` l -4 4 h -12 l -4 -4 h -10 a 4 4 0 0 0 -4 4 v ${contentHeight - 8}`;
        
        // 내부 입 (바닥)
        path += ` a 4 4 0 0 0 4 4 h 10 l 4 4 h 12 l 4 -4 h ${w - 34 - 15}`;
        
        // 바닥 닫기
        path += ` a 4 4 0 0 1 4 4 v ${footerHeight - 8}`;
        path += ` a 4 4 0 0 1 -4 4 h -${w - 34}`;
        path += ` l -4 4 h -12 l -4 -4 h -10 a 4 4 0 0 1 -4 -4 Z`;

        // --- 육각형 슬롯 좌표 ---
        const slotX = 50; // "만약"(40) + 여백(10)
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

        return (
          <g>
            <path d={path} fill={color} stroke="#fff" strokeWidth="1" />
            
            {/* 조건 구멍 (육각형) */}
            <polygon points={hexPoints} fill="#000" fillOpacity="0.2" />

            {/* 텍스트 */}
            <text x={15} y={30} fill="white" fontSize="14px" fontWeight="bold" style={{ pointerEvents: "none" }}>
              {leftLabel}
            </text>
            <text x={slotX + currentSlotWidth + 10} y={30} fill="white" fontSize="14px" fontWeight="bold" style={{ pointerEvents: "none" }}>
              {rightLabel}
            </text>
          </g>
        );
      }

      // ============================================================
      // [NEW] 조건문 ㅌ자 (IF-ELSE) - "만약 [조건] 이라면 / 아니면"
      // ============================================================
      case "command-if-else": {
        const headerHeight = 50; // 헤더 50
        const midHeight = 40;   
        const footerHeight = 30;
        
        const contentH1 = Math.max(subStack1Height, 30);
        const contentH2 = Math.max(subStack2Height, 30);
        
        // 너비 계산
        const leftLabel = "만약";
        const rightLabel = "이라면";
        const currentSlotWidth = slotWidth || 100;
        const topWidth = 40 + currentSlotWidth + 40 + 20;
        const w = Math.max(totalWidth || topWidth, topWidth);

        // 1. 헤더
        let path = `M 0 4 a 4 4 0 0 1 4 -4 h 10 l 4 4 h 12 l 4 -4 h ${w - 34}`;
        path += ` a 4 4 0 0 1 4 4 v ${headerHeight - 8}`;
        
        // 2. 첫번째 입 (참)
        path += ` a 4 4 0 0 1 -4 4 h -${w - 34 - 15}`; 
        path += ` l -4 4 h -12 l -4 -4 h -10 a 4 4 0 0 0 -4 4 v ${contentH1 - 8}`;
        path += ` a 4 4 0 0 0 4 4 h 10 l 4 4 h 12 l 4 -4 h ${w - 34 - 15}`;

        // 3. 중간 바
        path += ` a 4 4 0 0 1 4 4 v ${midHeight - 8}`;
        
        // 4. 두번째 입 (거짓)
        path += ` a 4 4 0 0 1 -4 4 h -${w - 34 - 15}`; 
        path += ` l -4 4 h -12 l -4 -4 h -10 a 4 4 0 0 0 -4 4 v ${contentH2 - 8}`;
        path += ` a 4 4 0 0 0 4 4 h 10 l 4 4 h 12 l 4 -4 h ${w - 34 - 15}`;

        // 5. 바닥
        path += ` a 4 4 0 0 1 4 4 v ${footerHeight - 8}`;
        path += ` a 4 4 0 0 1 -4 4 h -${w - 34}`;
        path += ` l -4 4 h -12 l -4 -4 h -10 a 4 4 0 0 1 -4 -4 Z`;

        // 슬롯 좌표 (IF와 동일)
        const slotX = 50; 
        const slotY = 10;
        const sh = 30;
        const cy = slotY + sh / 2;
        const hexPoints = `
          ${slotX},${cy}
          ${slotX + 10},${slotY}
          ${slotX + currentSlotWidth - 10},${slotY}
          ${slotX + currentSlotWidth},${cy}
          ${slotX + currentSlotWidth - 10},${slotY + sh}
          ${slotX + 10},${slotY + sh}
        `;

        return (
          <g>
            <path d={path} fill={color} stroke="#fff" strokeWidth="1" />
            <polygon points={hexPoints} fill="#000" fillOpacity="0.2" />
            
            <text x={15} y={30} fill="white" fontSize="14px" fontWeight="bold" style={{ pointerEvents: "none" }}>
              {leftLabel}
            </text>
            <text x={slotX + currentSlotWidth + 10} y={30} fill="white" fontSize="14px" fontWeight="bold" style={{ pointerEvents: "none" }}>
              {rightLabel}
            </text>
            
            {/* 아니면 텍스트 */}
            <text x={15} y={headerHeight + contentH1 + 25} fill="white" fontSize="14px" fontWeight="bold" style={{ pointerEvents: "none" }}>
              아니면
            </text>
          </g>
        );
      }
      // ============================================================
      // [NEW] 출력하기 블록 (구멍 있는 커맨드)
      // ============================================================
      case "command-print": {
        // 내부 슬롯(값) 너비
        const currentSlotWidth = slotWidth || 30;
        
        // 전체 너비: 왼쪽슬롯(currentSlotWidth) + 여백(10) + 텍스트 + 여백
        const textLabel = text || "출력하기";
        const labelWidth = textLabel.length * 14;
        
        // 슬롯을 왼쪽에 둘지 오른쪽에 둘지 결정 (보통: "출력하기 [값]")
        // 여기서는: [값] 출력하기 (또는 반대) -> 요청하신 "연산자 출력하기" 어순 고려
        // 한국어 어순: [ 값 ] (을) 출력하기 -> 슬롯이 왼쪽
        // 영어 어순: print [ 值 ] -> 슬롯이 오른쪽
        // -> 한국어니까 [ 슬롯 ] 출력하기 로 배치해 보겠습니다.
        
        const slotX = 15;
        const textX = slotX + currentSlotWidth + 10;
        const totalW = totalWidth || (textX + labelWidth + 20);

        // 퍼즐 경로 그리기 (일반 command와 동일)
        const pathData = `
          M 0 4 a 4 4 0 0 1 4 -4 h 10 l 4 4 h 12 l 4 -4
          h ${totalW - 34} a 4 4 0 0 1 4 4 v 32
          a 4 4 0 0 1 -4 4 h -${totalW - 34} l -4 4 h -12
          l -4 -4 h -10 a 4 4 0 0 1 -4 -4 Z
        `;

        return (
          <g>
            <path d={pathData} fill={color} stroke="#fff" strokeWidth="1" />
            
            {/* 값 들어갈 구멍 (Oval) */}
            <rect
              x={slotX}
              y={5} // 높이 40인 블록에서 y=5 (높이 30짜리 구멍)
              width={currentSlotWidth}
              height={30}
              rx={15}
              fill="rgba(0,0,0,0.15)"
            />

            <text
              x={textX}
              y={25}
              fill="white"
              fontSize="14px"
              fontWeight="bold"
              style={{ pointerEvents: "none" }}
            >
              {textLabel}
            </text>
          </g>
        );
      }

      // ============================================================
      // [NEW] 문자열 값 블록 (따옴표 느낌)
      // ============================================================
      case "value-string": {
        // 기존 value-pill과 비슷하지만, 나중에 텍스트 에디팅 기능 확장을 위해 분리
        const pillHeight = 30;
        const pillWidth = totalWidth || (textLen * 12 + 24);
        
        return (
          <g>
            <rect
              x={0}
              y={5}
              rx={4} // 문자열은 약간 각지게 (알약보다 덜 둥글게) 표현하여 구분
              ry={4}
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
      case "value-input": {
        const pillHeight = 30;
        const pillWidth = totalWidth || (textLen * 12 + 24);
        
        // 흰색 입력창 크기 (테두리 살짝 안쪽)
        const inputW = pillWidth - 10; 
        const inputH = 20;
        const inputX = 5;
        const inputY = 5; // (30 - 20) / 2

        return (
          <g>
            {/* 1. 주황색 배경 (테두리 역할) */}
            <rect
              x={0}
              y={5}
              rx={pillHeight / 2}
              ry={pillHeight / 2}
              width={pillWidth}
              height={pillHeight}
              fill={color} // 주황색
              stroke="#fff"
              strokeWidth="1"
            />

            {/* 2. 흰색 입력창 (여기를 클릭하면 입력!) */}
            <rect
              x={inputX}
              y={5 + inputY}
              rx={10}
              ry={10}
              width={inputW}
              height={inputH}
              fill="white"
              style={{ cursor: "text" }} // 텍스트 커서
              
              // ★ 핵심: 마우스를 누르면 드래그를 막고(StopPropagation) 입력창을 띄움
              onMouseDown={(e) => {
                e.stopPropagation(); // 드래그 방지
                if (onEdit) onEdit(id, text);
                else {
                    console.log("onEdit 함수가 전달되지 않았습니다!");
                }
              }}
            />

            {/* 3. 텍스트 (검은색으로 잘 보이게) */}
            <text
              x={pillWidth / 2}
              y={25}
              fill="#333" // 흰 배경 위니까 검은 글씨
              fontSize="13px"
              fontWeight="bold"
              textAnchor="middle"
              style={{ pointerEvents: "none" }}
            >
              {text}
            </text>
          </g>
        );
      }
      case "boolean-binary": {
        const currentHeight = height || 30;
        const width = totalWidth || (defaultTextWidth + 80); 
        const currentLeftSlotW = leftSlotWidth || 30;
        const currentRightSlotW = rightSlotWidth || 30;

        // ★ [핵심] 논리 연산자(AND, OR)인지 확인
        const isLogical = ["그리고", "또는"].includes(text);

        // ... (좌표 계산 로직은 동일) ...
        const leftSlotX = 15;
        const leftSlotEnd = leftSlotX + currentLeftSlotW;
        
        const estimatedTextWidth = Math.max(textLen * 12, 10);
        const textCenterX = leftSlotEnd + 10 + (estimatedTextWidth / 2);
        const textEnd = leftSlotEnd + 10 + estimatedTextWidth;
        const rightSlotX = textEnd + 10;
        const midY = currentHeight / 2;
        
        // 육각형 몸체
        const hexPoints = `
          0,${midY} 
          10,0 
          ${width - 10},0 
          ${width},${midY} 
          ${width - 10},${currentHeight} 
          10,${currentHeight}
        `;

        // 구멍 Y 위치
        const slotY = midY - 15;

        // ★ 육각형 구멍 그리는 헬퍼 함수 (Path string 생성)
        const makeHexHole = (bx, by, bw) => {
           const h = 30; 
           const my = by + h/2;
           return `M ${bx} ${my} L ${bx+10} ${by} H ${bx+bw-10} L ${bx+bw} ${my} L ${bx+bw-10} ${by+h} H ${bx+10} Z`;
        };

        return (
          <g>
            <polygon points={hexPoints} fill={color} stroke="#fff" strokeWidth="1" />
            
            {/* 왼쪽 구멍: 논리연산이면 육각형, 아니면 둥근사각형 */}
            {isLogical ? (
                <path d={makeHexHole(leftSlotX, slotY, currentLeftSlotW)} fill="rgba(0,0,0,0.15)" />
            ) : (
                <rect x={leftSlotX} y={slotY} width={currentLeftSlotW} height={30} rx={15} fill="rgba(0,0,0,0.15)" />
            )}

            {/* 오른쪽 구멍 */}
            {isLogical ? (
                <path d={makeHexHole(rightSlotX, slotY, currentRightSlotW)} fill="rgba(0,0,0,0.15)" />
            ) : (
                <rect x={rightSlotX} y={slotY} width={currentRightSlotW} height={30} rx={15} fill="rgba(0,0,0,0.15)" />
            )}

            <text x={textCenterX} y={midY + 1} fill="white" fontSize="14px" fontWeight="bold" textAnchor="middle" style={{ pointerEvents: "none" }} dominantBaseline="middle">
              {text}
            </text>
          </g>
        );
      }

      // ============================================================
      // [수정] 단항 조건 블록 (NOT) - 육각형 구멍
      // ============================================================
      case "boolean-not": {
        const currentHeight = height || 30;
        const width = totalWidth || (defaultTextWidth + 60);
        const currentSlotW = slotWidth || 30;
        
        const textLabelWidth = text.length * 12;
        const textX = 15 + (textLabelWidth / 2);
        const slotX = 15 + textLabelWidth + 10;
        const midY = currentHeight / 2;
        
        const hexPoints = `
          0,${midY} 
          10,0 
          ${width - 10},0 
          ${width},${midY} 
          ${width - 10},${currentHeight} 
          10,${currentHeight}
        `;
        
        const slotY = midY - 15;

        // 육각형 구멍 Path
        const holePath = `
            M ${slotX} ${midY} 
            L ${slotX+10} ${slotY} 
            H ${slotX+currentSlotW-10} 
            L ${slotX+currentSlotW} ${midY} 
            L ${slotX+currentSlotW-10} ${slotY+30} 
            H ${slotX+10} Z
        `;

        return (
          <g>
            <polygon points={hexPoints} fill={color} stroke="#fff" strokeWidth="1" />
            <text x={textX} y={midY + 1} fill="white" fontSize="14px" fontWeight="bold" textAnchor="middle" style={{ pointerEvents: "none" }} dominantBaseline="middle">
              {text}
            </text>
            
            {/* 육각형 구멍 */}
            <path d={holePath} fill="rgba(0,0,0,0.15)" />
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