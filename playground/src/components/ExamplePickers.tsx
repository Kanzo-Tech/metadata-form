import { Flex, Select as RSelect, Separator } from "@radix-ui/themes";
import { Field } from "./Field.js";
import type { ShapeExample } from "@examples/index.js";

/** The Shape / Data example pickers (utility strip): deliberately low-key ghost
 *  selects so they read as context, not primary controls. */
export function ExamplePickers({
  examples,
  shapeId,
  dataOptions,
  dataId,
  onPickShape,
  onPickData,
}: {
  examples: ShapeExample[];
  shapeId: string;
  dataOptions: ShapeExample["data"];
  dataId: string;
  onPickShape: (id: string) => void;
  onPickData: (id: string) => void;
}) {
  return (
    <Flex align="center" gap="4">
      <Field label="Shape" size="1">
        <RSelect.Root size="1" value={shapeId} onValueChange={onPickShape}>
          <RSelect.Trigger variant="ghost" color="gray" />
          <RSelect.Content>
            {examples.map((e) => (
              <RSelect.Item key={e.id} value={e.id}>
                {e.label}
              </RSelect.Item>
            ))}
          </RSelect.Content>
        </RSelect.Root>
      </Field>
      <Separator orientation="vertical" />
      <Field label="Data" size="1">
        <RSelect.Root size="1" value={dataId} onValueChange={onPickData}>
          <RSelect.Trigger variant="ghost" color="gray" />
          <RSelect.Content>
            {dataOptions.map((d) => (
              <RSelect.Item key={d.id} value={d.id}>
                {d.label}
              </RSelect.Item>
            ))}
          </RSelect.Content>
        </RSelect.Root>
      </Field>
    </Flex>
  );
}
