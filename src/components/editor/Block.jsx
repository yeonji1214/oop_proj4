import React, { useState } from "react";
import { BlockBase } from "./BlockBase";
import { buildBlockSpec } from "./buildBlockSpec";

/**
 * Block
 * - 팔레트/워크스페이스 공용 렌더러
 * - buildBlockSpec으로 스펙을 만들고 BlockBase가 그린다.
 */
const Block = (props) => {
  const {
    id,
    x = 0,
    y = 0,
    onMouseDown,
    onValueEditStart,
    onValueEditCommit,
    onValueEditCancel,
    isEditingValue,
    text = "",
  } = props;

  // React hooks는 항상 상단에서 호출되어야 함
  const [editText, setEditText] = useState(text || props.variableName || "");

  const safeX = isNaN(x) ? 0 : x;
  const safeY = isNaN(y) ? 0 : y;

  // 스펙 계산 (에러 처리 포함, useMemo 없이)
  let spec = null;
  try {
    spec = buildBlockSpec(props);
  } catch (err) {
    console.error("Block render error:", props.id, props.shape, err);
  }

  // spec이 null이면 빈 그룹 렌더링 (hooks 호출 후)
  if (!spec) {
    return <g />;
  }

  const editableShapes = new Set(["value-input", "value-string", "value-pill", "boolean"]);
  const isEditable = editableShapes.has(props.shape) || props.blockType === "VAR_DECLARE";

  const commitEdit = () => {
    if (onValueEditCommit) onValueEditCommit(id, editText);
  };
  const cancelEdit = () => {
    setEditText(text);
    if (onValueEditCancel) onValueEditCancel(id);
  };

  return (
    <g
      transform={`translate(${safeX}, ${safeY})`}
      onMouseDown={(e) => onMouseDown && onMouseDown(id, e)}
      onDoubleClick={() => {
        if (!isEditable) return;
        setEditText(text || props.variableName || "");
        if (onValueEditStart) onValueEditStart(id);
      }}
      style={{ cursor: "grab" }}
    >
      <BlockBase spec={spec} />
      {isEditable && isEditingValue && (
        <foreignObject x={0} y={0} width={spec?.width ?? 80} height={spec?.height ?? 30}>
          <input
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitEdit();
              } else if (e.key === "Escape") {
                cancelEdit();
              }
            }}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              outline: "none",
              padding: "6px 10px",
              background: "#fff",
              fontSize: "14px",
              fontWeight: "bold",
              fontFamily: "inherit",
              color: "#000",
              textAlign: "center",
              borderRadius: `${(spec?.height ?? 30) / 2}px`,
              boxSizing: "border-box",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.08) inset",
            }}
          />
        </foreignObject>
      )}
    </g>
  );
};

export default Block;
