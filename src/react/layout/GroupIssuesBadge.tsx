import type { GroupIssues } from "../validation/useFormReport.js";

/** Per-section error indicator (tabs/steps) — **wayfinding only**: a small dot
 * meaning "this section has errors", not a counter. The global `<ValidationSummary>`
 * is the actionable list ("what + jump"); this just answers "where" at a glance
 * (cf. Material UI Stepper's error state). Optionally jumps on click.
 *
 * The colours are the theme's own destructive/warning tokens rather than a picked
 * hue, so the dot follows a re-skin and both themes without being told. */
export function GroupIssuesBadge({ issues, onJump }: { issues?: GroupIssues; onJump?: () => void }) {
  if (!issues || issues.count === 0) return null;
  const label = `${issues.count} issue${issues.count === 1 ? "" : "s"}`;
  const dot = (
    <span
      role="img"
      aria-label={label}
      className={`inline-block size-2 flex-none rounded-full ${
        issues.hasViolation ? "bg-destructive" : "bg-warning"
      } ${onJump ? "cursor-pointer" : ""}`}
    />
  );
  if (!onJump) return dot;
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={label}
      className="inline-flex"
      onClick={onJump}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onJump()}
    >
      {dot}
    </span>
  );
}
