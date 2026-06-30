import { Flex, Select as RSelect, Separator } from "@radix-ui/themes";
import { Field } from "./Field.js";
import type { Preset, ShapeExample } from "../presets.js";

/** The Shape / Data example pickers (utility strip) — a selector over permalink
 *  presets. Deliberately low-key ghost selects so they read as context, not
 *  primary controls. Picking either applies that preset's state. */
export function ExamplePickers({
  examples,
  shapeId,
  presets,
  presetId,
  onPickShape,
  onPickPreset,
}: {
  examples: ShapeExample[];
  shapeId: string;
  presets: Preset[];
  presetId: string;
  onPickShape: (id: string) => void;
  onPickPreset: (id: string) => void;
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
        <RSelect.Root size="1" value={presetId} onValueChange={onPickPreset}>
          <RSelect.Trigger variant="ghost" color="gray" />
          <RSelect.Content>
            {presets.map((p) => (
              <RSelect.Item key={p.id} value={p.id}>
                {p.label}
              </RSelect.Item>
            ))}
          </RSelect.Content>
        </RSelect.Root>
      </Field>
    </Flex>
  );
}
