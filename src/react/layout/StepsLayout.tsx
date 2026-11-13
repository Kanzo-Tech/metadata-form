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
 * the separators and Back's disabled edge all come from the machine. Next's end is
 * the exception: the machine counts a "completed" step after the last one, so on
 * the last group its Next stayed enabled and led nowhere (the step it reached is
 * not a group, and is clamped back). Here it is disabled on the last group. Still
 * controlled by `activeGroup`, so a step can be switched externally (e.g. by
 * `form.revealField`), and the badge beside a step's title jumps to that step's
 * first error.
 *
 * Back and Next bring the top of the steps into view: from the bottom of a long
 * group, the next one would otherwise open with the reader halfway down it. When
 * the form sits in something with a top of its own (the frame page, with its
 * profile, Shape/Data and counts), that something carries `data-form-top` and the
 * view goes up to there instead, so the reader sees where the form starts.
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

  // "nearest" moves nothing while the rail is on screen, and only Back and Next
  // call it, so a step switched externally (e.g. to reveal a field) is left to
  // scroll to that field. In an iframe it moves the app's page as well, which is
  // what the reader needs there. Up to `data-form-top` it goes as the rail's scroll
  // margin: the rail stays small enough for "nearest", the view still starts there.
  const toTop = () => {
    const el = rail.current;
    if (!el) return;
    const top = el.closest<HTMLElement>("[data-form-top]");
    el.style.scrollMarginTop = top
      ? `${Math.max(0, el.getBoundingClientRect().top - top.getBoundingClientRect().top)}px`
      : "";
    el.scrollIntoView({ block: "nearest" });
  };
  const last = index >= groups.length - 1;

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
      <div ref={rail} className="scroll-mt-4 overflow-x-auto pb-1">
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
          <Button size="sm" variant="outline" onClick={toTop}>
            {chrome.back}
          </Button>
        </StepsPrevious>
        <StepsNext asChild>
          <Button size="sm" disabled={last} onClick={toTop}>
            {chrome.next}
          </Button>
        </StepsNext>
      </div>
    </Steps>
  );
}
