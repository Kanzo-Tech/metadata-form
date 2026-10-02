import { Badge } from "@kanzo-tech/ui";
import { useStrings } from "../form/context.js";
import { count } from "../../i18n/strings.js";
import type { GroupIssues } from "../validation/formReport.js";

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
 * Never a control: it sits inside a tab or a step trigger, which is already the
 * button that goes there, and a button inside a button is announced as neither.
 * Going to a particular issue is the tally's.
 */
export function GroupIssuesBadge({ issues }: { issues?: GroupIssues }) {
  const strings = useStrings();
  if (!issues || issues.count === 0) return null;
  return (
    <Badge
      aria-label={count(strings, strings.chrome.issues, issues.count)}
      pill
      size="xs"
      variant={issues.hasViolation ? "destructive" : "warning"}
    >
      {issues.count}
    </Badge>
  );
}
