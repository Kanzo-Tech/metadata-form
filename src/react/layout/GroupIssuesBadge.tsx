import { Badge } from "@kanzo-tech/ui";
import { useStrings } from "../form/context.js";
import { count, type Plural } from "../../i18n/strings.js";
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
 *
 * Two pills, not one: violations (red) and warnings (amber), each only when there
 * are some. A single count read "17" for a section with 3 violations and 14
 * recommended fields left empty, and a reader could not tell what blocks the form
 * from what only advises.
 */
export function GroupIssuesBadge({ issues }: { issues?: GroupIssues }) {
  const strings = useStrings();
  if (!issues || issues.count === 0) return null;
  const pill = (n: number, forms: Plural, variant: "destructive" | "warning") => {
    const label = count(strings, forms, n);
    return (
      <Badge aria-label={label} title={label} pill size="xs" variant={variant}>
        {n}
      </Badge>
    );
  };
  return (
    <span className="inline-flex gap-1">
      {issues.errors > 0 && pill(issues.errors, strings.chrome.violationCount, "destructive")}
      {issues.warnings > 0 && pill(issues.warnings, strings.chrome.warningCount, "warning")}
    </span>
  );
}
