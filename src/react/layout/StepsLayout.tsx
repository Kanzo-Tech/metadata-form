import {
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
import type { GridLayout } from "../form/context.js";
import type { GroupIssues } from "../validation/useFormReport.js";
import { scrollToField } from "../utils/scrollToField.js";
import { FieldsGrid } from "./FieldsGrid.js";
import { GroupIssuesBadge } from "./GroupIssuesBadge.js";
import { row } from "../styles.js";

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
                <StepsTitle style={{ ...row, gap: "0.375rem" }}>
                  {group.label || `Step ${i + 1}`}
                  <GroupIssuesBadge
                    issues={gi}
                    onJump={gi?.firstFieldId ? () => scrollToField(gi.firstFieldId!) : undefined}
                  />
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
              <FieldsGrid group={group} grid={grid} />
            </CardContent>
          </Card>
        </StepsContent>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
        <StepsPrevious />
        <StepsNext />
      </div>
    </Steps>
  );
}
