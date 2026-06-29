import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";
import type { FormModel } from "../../model/FormModel.js";
import type { GridLayout } from "../form/context.js";
import type { GroupIssues } from "../validation/useFormReport.js";
import { scrollToField } from "../utils/scrollToField.js";
import { FieldsGrid } from "./FieldsGrid.js";
import { GroupIssuesBadge } from "./GroupIssuesBadge.js";

/** A wizard — one group per step, Back/Next. Radix has no Stepper, so it's
 * composed from primitives. Controlled by `activeGroup` so the step can be
 * switched externally (e.g. by `form.revealField`). The footer badge jumps to
 * the step's first error. */
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
  const current = groups[index];
  const gi = issues.get(current.id);
  const goTo = (i: number) => onActiveGroupChange?.(groups[i].id);
  return (
    <Flex direction="column" gap="4">
      <Flex align="center" justify="between">
        <Heading size="3">{current.label || `Step ${index + 1}`}</Heading>
        <Text size="1" color="gray">
          Step {index + 1} of {groups.length}
        </Text>
      </Flex>
      <Card>
        <FieldsGrid group={current} grid={grid} />
      </Card>
      <Flex align="center" justify="between">
        <Button type="button" variant="soft" color="gray" disabled={index === 0} onClick={() => goTo(Math.max(0, index - 1))}>
          ← Back
        </Button>
        <GroupIssuesBadge issues={gi} onJump={gi?.firstFieldId ? () => scrollToField(gi.firstFieldId!) : undefined} />
        <Button type="button" variant="soft" disabled={index >= groups.length - 1} onClick={() => goTo(Math.min(groups.length - 1, index + 1))}>
          Next →
        </Button>
      </Flex>
    </Flex>
  );
}
