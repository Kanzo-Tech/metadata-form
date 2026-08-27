import { NativeSelect, NativeSelectOption } from "@kanzo-tech/ui";
import type { Preset, ShapeExample } from "../presets.js";

/**
 * The Shape / Data pickers, shown inside the Source pane's own header — they
 * replace the document that panel is showing, and a control belongs against the
 * thing it acts on rather than in the page header beside Share.
 *
 * No visible labels: at this size the pane header is a 36px strip and two words
 * would take the room the values need. The accessible names carry them.
 *
 * Each select is drawn only when it has a choice to offer. An instance that ships one
 * shape set — a client's, carrying their shapes and nothing else — would otherwise get
 * a picker whose single option is the name of the product they are already using.
 */
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
    <div className="flex min-w-0 items-center" style={{ gap: "0.375rem" }}>
      {examples.length > 1 && (
        <NativeSelect
          size="sm"
          aria-label="Shape"
          style={{ height: "1.5rem", width: "9rem", minWidth: 0 }}
          value={shapeId}
          onChange={(e) => onPickShape(e.target.value)}
        >
          {examples.map((e) => (
            <NativeSelectOption key={e.id} value={e.id}>
              {e.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
      {presets.length > 1 && (
        <NativeSelect
          size="sm"
          aria-label="Data"
          style={{ height: "1.5rem", width: "9rem", minWidth: 0 }}
          value={presetId}
          onChange={(e) => onPickPreset(e.target.value)}
        >
          {presets.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {p.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
    </div>
  );
}
