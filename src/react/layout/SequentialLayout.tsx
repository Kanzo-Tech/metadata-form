import { Card, CardContent, CardHeader, CardTitle } from "@kanzo-tech/ui";
import type { FormModel } from "../../form/FormModel.js";
import type { GridLayout } from "../form/context.js";
import { FieldsGrid } from "./FieldsGrid.js";
import { column } from "../styles.js";

/** Default layout: a Card per property group, stacked. */
export function SequentialLayout({ model, grid }: { model: FormModel; grid?: GridLayout }) {
  return (
    <div style={{ ...column, gap: "1rem" }}>
      {model.groups.map((group) => (
        <Card key={group.id}>
          {group.label && (
            <CardHeader>
              <CardTitle>{group.label}</CardTitle>
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
