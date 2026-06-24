import type { ReactNode } from "react";

/** The assistant's current disposition, derived from `form.report.health`. */
export type MascotMood = "idle" | "guiding" | "celebrating" | "warning";

/**
 * The mascot's *body* — a swappable presentation (same idea as a widget). It
 * receives the current `mood` and renders a character. The library ships a
 * minimal, dependency-free default; swap it for something richer (e.g. a Lottie
 * or Rive character — see the playground) via `<FormAssistant character={...} />`.
 */
export type MascotCharacter = (props: { mood: MascotMood; size?: number }) => ReactNode;

/** The emoji shown per mood — playful and colourful, zero dependencies. */
const FACE: Record<MascotMood, string> = {
  idle: "🙂",
  guiding: "🤔",
  celebrating: "🎉",
  warning: "😟",
};

/** A soft mood-tinted halo behind the emoji. */
const HALO: Record<MascotMood, string> = {
  idle: "var(--accent-a3)",
  guiding: "var(--accent-a3)",
  celebrating: "var(--grass-a3)",
  warning: "var(--amber-a3)",
};

/**
 * Minimal, canonical default mascot: a single emoji on a soft mood-tinted halo —
 * colourful and fun, with no dependencies and no animation. Swap it for something
 * richer (e.g. a Lottie/Rive character) through the same `character` seam.
 */
export const defaultMascot: MascotCharacter = ({ mood, size = 44 }) => (
  <span
    role="img"
    aria-hidden="true"
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: size,
      height: size,
      borderRadius: "50%",
      background: HALO[mood],
      fontSize: Math.round(size * 0.58),
      lineHeight: 1,
      userSelect: "none",
    }}
  >
    {FACE[mood]}
  </span>
);
