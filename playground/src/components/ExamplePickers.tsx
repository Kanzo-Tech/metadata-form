import { NativeSelect, NativeSelectOption } from "@kanzo-tech/ui";
import { Field } from "./Field.js";
import type { Preset, ShapeExample } from "../presets.js";

/** The Shape / Data example pickers (utility strip) — a selector over permalink
 *  presets. Deliberately low-key so they read as context, not primary controls.
 *  Picking either applies that preset's state. */
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
    <div className="flex items-center gap-4">
      <Field label="Shape" size="xs">
        <NativeSelect
          size="sm"
          aria-label="Shape"
          value={shapeId}
          onChange={(e) => onPickShape(e.target.value)}
        >
          {examples.map((e) => (
            <NativeSelectOption key={e.id} value={e.id}>
              {e.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Data" size="xs">
        <NativeSelect
          size="sm"
          aria-label="Data"
          value={presetId}
          onChange={(e) => onPickPreset(e.target.value)}
        >
          {presets.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {p.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </div>
  );
}
