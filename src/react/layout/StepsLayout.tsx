import {
  Button,
  Card,
  CardContent,
  Steps,
  StepsContent,
  StepsIndicator,
  StepsItem,
  StepsList,
  StepsNext,
  StepsPrevious,
  StepsSeparator,
  StepsTitle,
  StepsTrigger,
} from "@kanzo-tech/ui";
import type { FormModel } from "../../form/FormModel.js";
import { useStrings, type GridLayout } from "../form/context.js";
import { fill } from "../../i18n/strings.js";
import type { GroupIssues } from "../validation/formReport.js";
import { GroupFieldSet } from "./GroupFieldSet.js";
import { GroupIssuesBadge } from "./GroupIssuesBadge.js";

/**
 * A wizard — one group per step.
 *
 * This used to be a heading, two buttons and an index, because Radix had no
 * stepper. The design system does, so the progress rail, the reachable triggers,
 * the separators and the Back/Next disabled edges all come from the machine and
 * none of it is arithmetic here any more. Still controlled by `activeGroup`, so a
 * step can be switched externally (e.g. by `form.revealField`), and the badge
 * beside a step's title jumps to that step's first error.
 */
export function StepsLayout({
  model,
  grid,
  issues,
  activeGroup,
  onActiveGroupChange,
}: {
  model: FormModel;
  grid?: GridLayout;
  issues: Map<string, GroupIssues>;
  activeGroup?: string;
  onActiveGroupChange?: (groupId: string) => void;
}) {
  const { chrome } = useStrings();
  const groups = model.groups;
  if (groups.length === 0) return null;
  const found = groups.findIndex((g) => g.id === activeGroup);
  const index = found < 0 ? 0 : found;

  return (
    <Steps
      count={groups.length}
      step={index}
      onStepChange={(d) => {
        const next = groups[Math.min(d.step, groups.length - 1)];
        if (next) onActiveGroupChange?.(next.id);
      }}
    >
      <StepsList>
        {groups.map((group, i) => {
          const gi = issues.get(group.id);
          return (
            <StepsItem index={i} key={group.id}>
              <StepsTrigger>
                <StepsIndicator>{i + 1}</StepsIndicator>
                <StepsTitle className="flex items-center gap-1.5">
                  <span lang={group.labelLang}>{group.label || fill(chrome.step, { n: i + 1 })}</span>
                  <GroupIssuesBadge issues={gi} />
                </StepsTitle>
              </StepsTrigger>
              <StepsSeparator />
            </StepsItem>
          );
        })}
      </StepsList>
      {groups.map((group, i) => (
        <StepsContent index={i} key={group.id}>
          <Card>
            <CardContent>
              <GroupFieldSet group={group} grid={grid} />
            </CardContent>
          </Card>
        </StepsContent>
      ))}
      <div className="flex justify-between gap-2">
        <StepsPrevious asChild>
          <Button size="sm" variant="outline">
            {chrome.back}
          </Button>
        </StepsPrevious>
        <StepsNext asChild>
          <Button size="sm">{chrome.next}</Button>
        </StepsNext>
      </div>
    </Steps>
  );
}
