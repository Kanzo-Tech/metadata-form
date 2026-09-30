import { Card, CardContent } from "@kanzo-tech/ui";
import type { FormModel } from "../../form/FormModel.js";
import type { GridLayout } from "../form/context.js";
import type { GroupIssues } from "../validation/formReport.js";
import { GroupFieldSet } from "./GroupFieldSet.js";
import { GroupIssuesBadge } from "./GroupIssuesBadge.js";

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
    <div className="flex flex-col gap-4">
      {model.groups.map((group) => (
        <Card key={group.id}>
          <CardContent>
            <GroupFieldSet
              group={group}
              grid={grid}
              legend={
                group.label && (
                  <>
                    <span lang={group.labelLang}>{group.label}</span>
                    <GroupIssuesBadge issues={issues?.get(group.id)} />
                  </>
                )
              }
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
