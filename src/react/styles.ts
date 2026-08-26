import type { CSSProperties } from "react";

/**
 * The library's own layout values, as inline styles.
 *
 * **Not utility classes, on purpose.** `@kanzo-tech/ui/styles.css` is compiled and
 * ships exactly the utilities the design system's own components use — nothing
 * generates ours. A class we invent is not an error anywhere: it is a silent
 * no-op in every consumer's app, and the only way it surfaces is somebody
 * noticing a panel is the wrong width. Three of them shipped that way
 * (`max-w-70`, `max-h-80`, `bottom-6`) before a guard test caught them.
 *
 * So the rule this file exists to keep: **a component library needs nothing but
 * the component library.** We compose its components, and where the design system
 * deliberately has no primitive — it ships no Box, Flex or Grid, its layout
 * vocabulary being the region tree plus components that own their own spacing —
 * we write the value here rather than borrow a class we cannot guarantee.
 *
 * Colours are the exception, and they are still not classes: they are the theme's
 * own custom properties, which are its documented surface and follow a re-skin.
 */

/** A horizontal row of controls, vertically centred. */
export const row: CSSProperties = { display: "flex", alignItems: "center", gap: "0.5rem" };

/** A vertical stack. `gap` is the caller's to override. */
export const column: CSSProperties = { display: "flex", flexDirection: "column", gap: "0.5rem" };

/** Fills the space a field row gives it, and may shrink below its content. */
export const grow: CSSProperties = { flex: 1, width: "100%", minWidth: 0 };

/**
 * The form's vertical rhythm, taken from the design system's own metadata-form
 * showcase: **tight inside a field, generous between them.** A label, its
 * description and its control are one thing and read as one; two fields are two
 * questions and need the air to say so. Ours had them at the same 0.75rem, which
 * is what made the form look like an undifferentiated list.
 */
export const fieldGap = "0.375rem";
export const betweenFields = "1.25rem";
/** A label row keeps its height whether or not it carries a trailing control. */
export const labelRow: CSSProperties = { ...row, minHeight: "1.5rem" };

/** Theme tokens, read straight from the cascade. */
export const ink = {
  muted: "var(--muted-foreground)",
  warning: "var(--warning)",
  destructive: "var(--destructive-foreground)",
} as const;
