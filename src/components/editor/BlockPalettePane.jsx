import React from 'react';
import Block from './Block';

export function BlockPalettePane({onDragStart}) {
  const blockList = [
    { id: 1, text: "시작하기", color: "#00B400" },
    { id: 2, text: "10만큼 이동", color: "#3399FF" },
    { id: 3, text: "오른쪽 회전", color: "#3399FF" },
    { id: 4, text: "무한 반복하기", color: "#8C68CD" },
    { id: 5, text: "만약 ~라면", color: "#8C68CD" },
    { id: 6, text: "모양 숨기기", color: "#E9506C" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <svg width="100%" height="100%">
        {blockList.map((block, index) => (
          <g 
            key={block.id}
            style={{ cursor: "grab" }}
            // 2. 마우스를 누르면 부모에게 알림 (드래그 시작)
            onMouseDown={(e) => {
              if (onDragStart) {
                onDragStart(block, e);
              }
            }}
          >
            {/* 3. 내부 Block 컴포넌트가 클릭 이벤트를 먹어버리지 못하게 막음 */}
            <g style={{ pointerEvents: "none" }}>
              <Block
                text={block.text} 
                color={block.color} 
                x={20} 
                y={20 + (index * 50)} 
              />
            </g>
            
            {/* 4. (선택사항) 클릭 잘 되게 투명 덮개 씌우기 */}
            <rect 
              x={20} 
              y={20 + (index * 50)} 
              width={150} 
              height={40} 
              fill="transparent" 
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
