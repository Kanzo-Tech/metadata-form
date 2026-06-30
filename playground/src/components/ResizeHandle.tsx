import { useRef } from "react";
import { PANEL_BG } from "./panel.js";

/** Native, dependency-free splitter (Radix ships no resizable primitive): pointer
 *  drags adjust the neighbouring aside's width, double-click restores its default.
 *  A thin hit-strip with a hairline that lights up on hover/drag, like an IDE divider. */
export function ResizeHandle({ onDrag, onReset }: { onDrag: (dx: number) => void; onReset: () => void }) {
  const last = useRef<number | null>(null);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className="mf-resize-handle"
      title="Drag to resize · double-click to reset"
      onDoubleClick={onReset}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = e.clientX;
      }}
      onPointerMove={(e) => {
        if (last.current === null) return;
        const dx = e.clientX - last.current;
        last.current = e.clientX;
        onDrag(dx);
      }}
      onPointerUp={(e) => {
        last.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      style={{
        flexShrink: 0,
        width: 7,
        cursor: "col-resize",
        display: "flex",
        justifyContent: "center",
        background: PANEL_BG,
        touchAction: "none",
      }}
    >
      <span style={{ width: 1, background: "var(--gray-a6)" }} />
    </div>
  );
}
