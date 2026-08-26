import type { FieldModel, GroupModel } from "../../form/FormModel.js";
import type { GridLayout } from "../form/context.js";
import { FieldRenderer } from "../form/FieldRenderer.js";

/**
 * Axis B: lay a group's fields out in N columns; nested fields span the full row.
 *
 * Plain CSS grid rather than a layout component. The design system deliberately
 * ships no `Box`/`Grid` primitive — its layout vocabulary is the region tree
 * (`Shell*`) plus components that own their own spacing — so a column count
 * driven by a prop belongs in a `style`, where the number can actually reach it.
 */
export function FieldsGrid({ group, grid }: { group: GroupModel; grid?: GridLayout }) {
  const columns = grid?.groups?.[group.id]?.columns ?? grid?.columns ?? 1;
  if (columns <= 1) {
    return (
      <div className="flex flex-col gap-3">
        {group.fields.map((field) => (
          <FieldRenderer key={field.id} field={field} />
        ))}
      </div>
    );
  }
  return (
    <div
      className="grid items-start gap-3"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {group.fields.map((field) => (
        <div key={field.id} style={{ gridColumn: spanFor(field, columns, grid?.spans) }}>
          <FieldRenderer field={field} />
        </div>
      ))}
    </div>
  );
}

function spanFor(field: FieldModel, columns: number, spans: GridLayout["spans"]): string | undefined {
  if (field.nodeShape) return "1 / -1";
  const n = spans?.[field.path.value];
  if (n && n > 1) return `span ${Math.min(n, columns)}`;
  return undefined;
}
