import { Box } from "@radix-ui/themes";
import type { GroupIssues } from "../validation/useFormReport.js";

/** Per-section error indicator (tabs/steps) — **wayfinding only**: a small dot
 * meaning "this section has errors", not a counter. The global `<ValidationSummary>`
 * is the actionable list ("what + jump"); this just answers "where" at a glance
 * (cf. Material UI Stepper's error state). Optionally jumps on click. */
export function GroupIssuesBadge({ issues, onJump }: { issues?: GroupIssues; onJump?: () => void }) {
  if (!issues || issues.count === 0) return null;
  const label = `${issues.count} issue${issues.count === 1 ? "" : "s"}`;
  const dot = (
    <Box
      role="img"
      aria-label={label}
      style={{
        width: 8,
        height: 8,
        flex: "none",
        borderRadius: "50%",
        display: "inline-block",
        background: issues.hasViolation ? "var(--red-9)" : "var(--amber-9)",
        cursor: onJump ? "pointer" : undefined,
      }}
    />
  );
  if (!onJump) return dot;
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={label}
      style={{ display: "inline-flex" }}
      onClick={onJump}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onJump()}
    >
      {dot}
    </span>
  );
}
