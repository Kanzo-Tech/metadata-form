import { Box, Flex, Grid } from "@radix-ui/themes";
import type { FieldModel, GroupModel } from "../../model/FormModel.js";
import type { GridLayout } from "../form/context.js";
import { FieldRenderer } from "../form/FieldRenderer.js";

/** Eje B: lay a group's fields out in N columns; nested fields span the full row. */
export function FieldsGrid({ group, grid }: { group: GroupModel; grid?: GridLayout }) {
  const columns = grid?.groups?.[group.id]?.columns ?? grid?.columns ?? 1;
  if (columns <= 1) {
    return (
      <Flex direction="column" gap="3">
        {group.fields.map((field) => (
          <FieldRenderer key={field.id} field={field} />
        ))}
      </Flex>
    );
  }
  return (
    <Grid columns={String(columns)} gap="3" align="start">
      {group.fields.map((field) => (
        <Box key={field.id} gridColumn={spanFor(field, columns, grid?.spans)}>
          <FieldRenderer field={field} />
        </Box>
      ))}
    </Grid>
  );
}

function spanFor(field: FieldModel, columns: number, spans: GridLayout["spans"]): string | undefined {
  if (field.nodeShape) return "1 / -1";
  const n = spans?.[field.path.value];
  if (n && n > 1) return `span ${Math.min(n, columns)}`;
  return undefined;
}
