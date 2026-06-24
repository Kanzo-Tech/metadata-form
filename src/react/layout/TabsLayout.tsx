import { Box, Flex, Tabs } from "@radix-ui/themes";
import type { FormModel } from "../../core/schema/FormModel.js";
import type { GridLayout } from "../form/context.js";
import type { GroupIssues } from "../validation/useFormReport.js";
import { FieldsGrid } from "./FieldsGrid.js";
import { GroupIssuesBadge } from "./GroupIssuesBadge.js";

/** One tab per group, each badged with its issue count (a view of form.report).
 * Controlled by `activeGroup` so navigation can be driven externally. */
export function TabsLayout({
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
  return (
    <Tabs.Root value={activeGroup ?? groups[0].id} onValueChange={onActiveGroupChange}>
      <Tabs.List>
        {groups.map((group, i) => (
          <Tabs.Trigger key={group.id} value={group.id}>
            <Flex align="center" gap="2">
              {group.label || `Group ${i + 1}`}
              <GroupIssuesBadge issues={issues.get(group.id)} />
            </Flex>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {groups.map((group) => (
        <Tabs.Content key={group.id} value={group.id}>
          <Box pt="3">
            <FieldsGrid group={group} grid={grid} />
          </Box>
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
