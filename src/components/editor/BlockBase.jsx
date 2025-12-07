import React from "react";
import { TEXT } from "./blockLayout";

/**
 * BlockBase
 * - spec.body: { path | polygon | rect } with fill/stroke
 * - spec.slots: [{ x,y,w,h, rx, ry, fill }]
 * - spec.labels: [{ x,y,text, color }]
 * - spec.controls: [{ type:"dropdown", x,y,w,h, options, value, onChange, disabled }]
 */
export const BlockBase = ({ x = 0, y = 0, spec }) => {
  if (!spec) return null;
  const {
    body,
    layers = [],
    slots = [],
    inners = [],
    labels = [],
    controls = [],
    width = 0,
    height = 0,
  } = spec;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {body?.type === "polygon" && (
        <polygon points={body.points} fill={body.fill} stroke={body.stroke} strokeWidth={body.strokeWidth} />
      )}
      {body?.type === "rect" && (
        <rect
          x={body.x ?? 0}
          y={body.y ?? 0}
          width={body.w ?? width}
          height={body.h ?? height}
          rx={body.rx ?? 4}
          ry={body.ry ?? 4}
          fill={body.fill}
          stroke={body.stroke}
          strokeWidth={body.strokeWidth}
        />
      )}
      {body?.type === "path" && (
        <path
          d={body.d}
          fill={body.fill}
          stroke={body.stroke}
          strokeWidth={body.strokeWidth}
          fillRule={body.fillRule ?? "nonzero"}
        />
      )}

      {layers.map((l, idx) => {
        if (l.type === "rect") {
          return (
            <rect
              key={`layer-${idx}`}
              x={l.x ?? 0}
              y={l.y ?? 0}
              width={l.w ?? width}
              height={l.h ?? height}
              rx={l.rx ?? 0}
              ry={l.ry ?? 0}
              fill={l.fill}
              stroke={l.stroke}
              strokeWidth={l.strokeWidth ?? 0}
            />
          );
        }
        if (l.type === "path") {
          return (
            <path
              key={`layer-${idx}`}
              d={l.d}
              fill={l.fill}
              stroke={l.stroke}
              strokeWidth={l.strokeWidth ?? 0}
            />
          );
        }
        return null;
      })}

      {slots.map((s, idx) => {
        // 육각형 슬롯 (boolean 조건용)
        if (s.type === 'hexagon') {
          const tipX = Math.min(8, s.h / 3);
          const midY = s.h / 2;
          const points = `
            ${s.x},${s.y + midY}
            ${s.x + tipX},${s.y}
            ${s.x + s.w - tipX},${s.y}
            ${s.x + s.w},${s.y + midY}
            ${s.x + s.w - tipX},${s.y + s.h}
            ${s.x + tipX},${s.y + s.h}
          `;
          return (
            <polygon
              key={`slot-${idx}`}
              points={points}
              fill={s.fill}
            />
          );
        }
        // 알약형 슬롯 (기본)
        return (
          <rect
            key={`slot-${idx}`}
            x={s.x}
            y={s.y}
            width={s.w}
            height={s.h}
            rx={s.rx ?? 0}
            ry={s.ry ?? 0}
            fill={s.fill}
          />
        );
      })}

      {inners.map((s, idx) => (
        <rect
          key={`inner-${idx}`}
          x={s.x}
          y={s.y}
          width={s.w}
          height={s.h}
          rx={s.rx ?? 0}
          ry={s.ry ?? 0}
          fill={s.fill}
          stroke={s.stroke}
          strokeWidth={s.strokeWidth ?? 0}
        />
      ))}

      {labels.map((l, idx) => (
        <text
          key={`label-${idx}`}
          x={l.x}
          y={l.y}
          fill={l.color ?? "white"}
          fontSize={l.fontSize ?? TEXT.SIZE}
          fontWeight={l.fontWeight ?? TEXT.WEIGHT}
          textAnchor={l.anchor ?? "start"}
          style={{ userSelect: "none", pointerEvents: "none" }}
          dominantBaseline="middle"
        >
          {l.text}
        </text>
      ))}

      {controls.map((c, idx) => {
        if (c.type === "dropdown") {
          return (
            <g key={`ctrl-${idx}`}>
              <rect
                x={c.x}
                y={c.y}
                width={c.w}
                height={c.h}
                rx={c.rx ?? 6}
                ry={c.ry ?? 6}
                fill={c.fill}
                stroke={c.stroke}
                strokeWidth={c.strokeWidth ?? 1}
                pointerEvents="none"
              />
              <text
                x={c.x + (c.padding ?? 10)}
                y={c.y + c.h / 2 + 1}
                fill="white"
                fontSize={12}
                fontWeight="bold"
                style={{ userSelect: "none", pointerEvents: "none" }}
                dominantBaseline="middle"
              >
                {c.display ?? ""}
              </text>
              <foreignObject x={c.x} y={c.y} width={c.w} height={c.h}>
                <select
                  value={c.value ?? ""}
                  disabled={c.disabled}
                  onChange={(e) => c.onChange && c.onChange(e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    cursor: c.disabled ? "default" : "pointer",
                    border: "none",
                  }}
                >
                  {(c.options ?? []).map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              </foreignObject>
            </g>
          );
        }
        return null;
      })}
    </g>
  );
};
