import { Badge } from "@kanzo-tech/ui";
import type { GroupIssues } from "../validation/useFormReport.js";

/**
 * Per-section issue count — **wayfinding**: it says which section is wrong and by
 * how much, so a reader can pick where to go without opening anything. The global
 * `<ValidationSummary>` is still the actionable list ("what + jump"); this answers
 * "where".
 *
 * It was a bare 8px dot, on the argument that a count here would compete with that
 * summary. It does not: the design system's own metadata-form showcase puts a
 * counting pill beside every group title, and reading "3" against a section is
 * strictly more than reading "something". The dot also had to invent its own
 * geometry, where the pill is the house's `Badge` at its smallest and inherits a
 * re-skin for free.
 *
 * Optionally jumps on click.
 */
export function GroupIssuesBadge({ issues, onJump }: { issues?: GroupIssues; onJump?: () => void }) {
  if (!issues || issues.count === 0) return null;
  const label = `${issues.count} issue${issues.count === 1 ? "" : "s"}`;
  const badge = (
    <Badge pill size="xs" variant={issues.hasViolation ? "destructive" : "warning"}>
      {issues.count}
    </Badge>
  );
  if (!onJump) return <span aria-label={label}>{badge}</span>;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onJump}
      style={{ display: "inline-flex", background: "none", border: 0, padding: 0, cursor: "pointer" }}
    >
      {badge}
    </button>
  );
}
