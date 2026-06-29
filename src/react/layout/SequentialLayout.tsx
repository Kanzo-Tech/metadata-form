import { Card, Flex, Heading } from "@radix-ui/themes";
import type { FormModel } from "../../model/FormModel.js";
import type { GridLayout } from "../form/context.js";
import { FieldsGrid } from "./FieldsGrid.js";

/** Default layout: a Card per property group, stacked. */
export function SequentialLayout({ model, grid }: { model: FormModel; grid?: GridLayout }) {
  return (
    <Flex direction="column" gap="4">
      {model.groups.map((group) => (
        <Card key={group.id}>
          <Flex direction="column" gap="3">
            {group.label && <Heading size="3">{group.label}</Heading>}
            <FieldsGrid group={group} grid={grid} />
          </Flex>
        </Card>
      ))}
    </Flex>
  );
}
