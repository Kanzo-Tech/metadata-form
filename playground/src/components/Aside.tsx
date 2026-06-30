import { ResizeHandle } from "./ResizeHandle.js";
import { PANEL_BG, PANEL_BORDER } from "./panel.js";
import type { AsidePresence } from "../hooks/useAsidePresence.js";

/** Side-panel widths (px) are user-draggable; clamp keeps them in a usable band. */
export const MIN_PANEL_W = 240;
export const MAX_PANEL_W = 760;
export const clampPanelW = (w: number) => Math.max(MIN_PANEL_W, Math.min(MAX_PANEL_W, w));

/** A mounted aside plus its resize handle (wide only). Encapsulates the side-specific
 *  bits — handle order (always on the form side) and drag direction — so the two panels
 *  read as one symmetric call instead of two mirror blocks. */
export function AsideSection({
  side,
  narrow,
  presence,
  width,
  onResize,
  defaultWidth,
  children,
}: {
  side: "left" | "right";
  narrow: boolean;
  presence: AsidePresence;
  width: number;
  onResize: React.Dispatch<React.SetStateAction<number>>;
  defaultWidth: number;
  children: React.ReactNode;
}) {
  if (!presence.mounted) return null;
  const aside = (
    <Aside
      side={side}
      width={width}
      narrow={narrow}
      closing={presence.closing}
      onAnimationEnd={presence.onAnimationEnd}
    >
      {children}
    </Aside>
  );
  if (narrow) return aside;
  const handle = (
    <ResizeHandle
      onDrag={(dx) => onResize((w) => clampPanelW(w + (side === "left" ? dx : -dx)))}
      onReset={() => onResize(defaultWidth)}
    />
  );
  return side === "left" ? (
    <>
      {aside}
      {handle}
    </>
  ) : (
    <>
      {handle}
      {aside}
    </>
  );
}

/** The side panel — semantically an <aside> (the form is the page's <main>). One
 *  component for both layouts: docked with a draggable width on wide viewports, or a
 *  full-screen overlay sliding in from its own edge on narrow ones. */
function Aside({
  side,
  width,
  narrow,
  closing,
  onAnimationEnd,
  children,
}: {
  side: "left" | "right";
  width: number;
  narrow: boolean;
  closing: boolean;
  onAnimationEnd: () => void;
  children: React.ReactNode;
}) {
  const border = side === "left" ? { borderRight: PANEL_BORDER } : { borderLeft: PANEL_BORDER };
  const layout: React.CSSProperties = narrow
    ? { position: "absolute", inset: 0, zIndex: 5 }
    : { width, flexShrink: 0, minWidth: 0, ...border };
  const animClass = narrow ? `mf-aside-${closing ? "out" : "in"}-${side}` : undefined;
  return (
    <aside
      className={animClass}
      onAnimationEnd={onAnimationEnd}
      style={{
        display: "flex",
        flexDirection: "column",
        background: PANEL_BG,
        ...layout,
      }}
    >
      {children}
    </aside>
  );
}
