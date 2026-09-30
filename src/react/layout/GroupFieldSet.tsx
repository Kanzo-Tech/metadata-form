import { FieldGroup, FieldLegend, FieldSet } from "@kanzo-tech/ui";
import type { ReactNode } from "react";
import type { FieldModel, GroupModel } from "../../form/FormModel.js";
import type { Columns, GridLayout } from "../form/context.js";
import { FieldRenderer } from "../form/FieldRenderer.js";

/**
 * One property group: a `FieldSet` (its `FieldLegend` is `legend`, when the layout
 * does not already name the group) around a `FieldGroup` of N columns. Nested
 * fields span the full row.
 *
 * The spans are whole class names on purpose: the sheet is generated from the
 * literals it finds, so `col-span-${n}` would generate nothing.
 */
const SPAN = { 1: undefined, 2: "col-span-2", 3: "col-span-3", 4: "col-span-4" } as const;

export function GroupFieldSet({
  group,
  grid,
  legend,
}: {
  group: GroupModel;
  grid?: GridLayout;
  legend?: ReactNode;
}) {
  const columns = grid?.groups?.[group.id]?.columns ?? grid?.columns ?? 1;
  return (
    <FieldSet>
      {legend && <FieldLegend className="flex items-center gap-2">{legend}</FieldLegend>}
      <FieldGroup className="items-start" columns={columns}>
        {group.fields.map((field) => (
          <div className={spanOf(field, columns, grid?.spans)} key={field.id}>
            <FieldRenderer field={field} />
          </div>
        ))}
      </FieldGroup>
    </FieldSet>
  );
}

function spanOf(field: FieldModel, columns: Columns, spans: GridLayout["spans"]): string | undefined {
  if (field.nodeShape) return "col-span-full";
  return SPAN[Math.min(spans?.[field.path.value] ?? 1, columns) as Columns];
}
