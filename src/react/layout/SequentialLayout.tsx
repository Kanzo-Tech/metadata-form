import { Card, CardContent, CardHeader, CardTitle } from "@kanzo-tech/ui";
import type { FormModel } from "../../form/FormModel.js";
import type { GridLayout } from "../form/context.js";
import type { GroupIssues } from "../validation/useFormReport.js";
import { FieldsGrid } from "./FieldsGrid.js";
import { GroupIssuesBadge } from "./GroupIssuesBadge.js";
import { column, row } from "../styles.js";

/** Default layout: a Card per property group, stacked. */
export function SequentialLayout({
  model,
  grid,
  issues,
}: {
  model: FormModel;
  grid?: GridLayout;
  issues?: Map<string, GroupIssues>;
}) {
  return (
    <div style={{ ...column, gap: "1rem" }}>
      {model.groups.map((group) => (
        <Card key={group.id}>
          {group.label && (
            <CardHeader>
              <div style={row}>
                <CardTitle>{group.label}</CardTitle>
                <GroupIssuesBadge issues={issues?.get(group.id)} />
              </div>
            </CardHeader>
          )}
          <CardContent>
            <FieldsGrid group={group} grid={grid} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
