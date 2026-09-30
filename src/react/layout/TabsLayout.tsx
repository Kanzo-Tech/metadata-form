import { Card, CardContent, Tabs, TabsContent, TabsList, TabsTrigger } from "@kanzo-tech/ui";
import type { FormModel } from "../../form/FormModel.js";
import type { GridLayout } from "../form/context.js";
import type { GroupIssues } from "../validation/formReport.js";
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
    <Tabs
      value={activeGroup ?? groups[0].id}
      onValueChange={(d) => onActiveGroupChange?.(d.value)}
    >
      <TabsList className="w-full justify-start">
        {groups.map((group, i) => (
          <TabsTrigger key={group.id} value={group.id}>
            {group.label || `Group ${i + 1}`}
            <GroupIssuesBadge issues={issues.get(group.id)} />
          </TabsTrigger>
        ))}
      </TabsList>
      {groups.map((group) => (
        <TabsContent key={group.id} value={group.id}>
          <Card>
            <CardContent>
              <FieldsGrid group={group} grid={grid} />
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}
