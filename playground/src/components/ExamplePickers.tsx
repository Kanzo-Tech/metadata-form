import type { ReactNode } from "react";
import { NativeSelect, NativeSelectOption } from "@kanzo-tech/ui";
import { useChrome } from "../i18n.js";
import type { Preset, ShapeExample } from "../presets.js";

/**
 * The Shape and Data pickers, and they are two components rather than one row.
 *
 * They used to sit together in the Source pane's header. That is the right half of
 * the design system's rule — a control belongs against the thing it acts on, not in
 * the page header beside Share — but it stopped one step short: the Source pane
 * shows **two** documents, and each of these replaces exactly one of them. So each
 * goes beside the tab whose document it swaps, which is what the showcase does with
 * every panel it has.
 *
 * No visible labels: at this size the strip has room for the values or for two
 * words naming what everyone can already see. The accessible names carry them.
 *
 * Each is drawn only when it has a choice to offer. An instance that ships one shape
 * set — a client's, carrying their shapes and nothing else — would otherwise get a
 * picker whose single option is the name of the product they are already using.
 */
function PaneSelect({
  children,
  label,
  onChange,
  value,
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  // The flex basis is on a wrapper, not on the select: `NativeSelect`'s own box is
  // `w-fit`, so a width set on the control is a floor the strip cannot squeeze past
  // — and this strip shares its row with the tabs.
  return (
    <div style={{ flex: "0 1 8rem", minWidth: "4.5rem" }}>
      <NativeSelect
        aria-label={label}
        className="w-full"
        onChange={(e) => onChange(e.target.value)}
        size="sm"
        style={{ width: "100%", minWidth: 0 }}
        value={value}
      >
        {children}
      </NativeSelect>
    </div>
  );
}

/** Which shape set the whole Source panel is showing. It replaces the data graph
 *  too — a shape set arrives with the sample that fits it — which is why it sits
 *  with the shape and not between the two. */
export function ShapePicker({
  examples,
  onPick,
  shapeId,
}: {
  examples: ShapeExample[];
  onPick: (id: string) => void;
  shapeId: string;
}) {
  const chrome = useChrome();
  if (examples.length < 2) return null;
  return (
    <PaneSelect label={chrome.source.shapePicker} onChange={onPick} value={shapeId}>
      {examples.map((e) => (
        <NativeSelectOption key={e.id} value={e.id}>
          {e.label}
        </NativeSelectOption>
      ))}
    </PaneSelect>
  );
}

/** Which sample data the form starts from, within the active shape set. */
export function PresetPicker({
  onPick,
  presetId,
  presets,
}: {
  onPick: (id: string) => void;
  presetId: string;
  presets: Preset[];
}) {
  const chrome = useChrome();
  if (presets.length < 2) return null;
  return (
    <PaneSelect label={chrome.source.dataPicker} onChange={onPick} value={presetId}>
      {presets.map((p) => (
        <NativeSelectOption key={p.id} value={p.id}>
          {p.label}
        </NativeSelectOption>
      ))}
    </PaneSelect>
  );
}
