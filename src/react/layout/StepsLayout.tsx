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
import { useEffect, useRef } from "react";
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
  const rail = useRef<HTMLDivElement>(null);
  const groups = model.groups;
  const found = groups.findIndex((g) => g.id === activeGroup);
  const index = found < 0 ? 0 : found;

  // The current step's title is kept in view on its rail. Only the rail is
  // scrolled (not scrollIntoView, which would also move the page around it, or
  // the app's page around an iframe).
  useEffect(() => {
    const el = rail.current;
    const item = el?.querySelectorAll<HTMLElement>("[data-slot=steps-item]")[index];
    if (!el || !item) return;
    const left = item.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
    if (left < el.scrollLeft) el.scrollLeft = left;
    else if (left + item.offsetWidth > el.scrollLeft + el.clientWidth)
      el.scrollLeft = left + item.offsetWidth - el.clientWidth;
  }, [index]);

  if (groups.length === 0) return null;

  return (
    <Steps
      count={groups.length}
      step={index}
      onStepChange={(d) => {
        const next = groups[Math.min(d.step, groups.length - 1)];
        if (next) onActiveGroupChange?.(next.id);
      }}
    >
      {/* With many groups the titles do not fit the width. They scroll on their
          own rail, so the page around the form does not scroll sideways. */}
      <div ref={rail} className="overflow-x-auto pb-1">
        <StepsList className="w-max min-w-full">
          {groups.map((group, i) => {
            const gi = issues.get(group.id);
            return (
              <StepsItem index={i} key={group.id}>
                {/* Each step a small card of its own, so titles that sit close
                    together still read apart; the current one is outlined. */}
                <StepsTrigger className="rounded-lg border bg-background py-1.5 ps-1.5 pe-3 data-current:border-primary">
                  <StepsIndicator>{i + 1}</StepsIndicator>
                  <StepsTitle className="flex items-center gap-1.5 whitespace-nowrap">
                    <span lang={group.labelLang}>{group.label || fill(chrome.step, { n: i + 1 })}</span>
                    <GroupIssuesBadge issues={gi} />
                  </StepsTitle>
                </StepsTrigger>
                <StepsSeparator className="min-w-6" />
              </StepsItem>
            );
          })}
        </StepsList>
      </div>
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
