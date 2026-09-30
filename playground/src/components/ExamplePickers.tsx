import type { ReactNode } from "react";
import { NativeSelect, NativeSelectOption } from "@kanzo-tech/ui";
import { useChrome } from "../i18n.js";
import type { Preset, ShapeExample } from "../presets.js";

/**
 * Which example is open, and which of its data presets: `example / preset`, in the
 * page header beside the wordmark.
 *
 * They were in the Source pane, each against the document it swaps. But picking an
 * example replaces the shapes, the data, the form and everything the other panels
 * say about it — it acts on the whole page, which by the same rule puts it in the
 * page header. And there it is visible: the page opens with Source closed, so a
 * visitor had no sign that there was more than one example to open.
 *
 * No visible labels: the values say what they are. The accessible names carry them.
 *
 * Each is drawn only when it has a choice to offer. An instance that ships one shape
 * set — a client's, carrying their shapes and nothing else — would otherwise get a
 * picker whose single option is the name of the product they are already using.
 */
function HeaderSelect({
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
  // The control is as wide as its value (`w-fit` is the recipe's own) and the
  // wrapper is what may shrink, so a long label gives way before the actions do.
  return (
    <div className="min-w-0">
      <NativeSelect
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        size="sm"
        style={{ maxWidth: "100%" }}
        value={value}
      >
        {children}
      </NativeSelect>
    </div>
  );
}

const Slash = () => (
  <span aria-hidden className="shrink-0 text-muted-foreground">
    /
  </span>
);

export function ExamplePickers({
  examples,
  onPickPreset,
  onPickShape,
  presetId,
  presets,
  shapeId,
}: {
  examples: ShapeExample[];
  onPickPreset: (id: string) => void;
  onPickShape: (id: string) => void;
  presetId: string;
  presets: Preset[];
  shapeId: string;
}) {
  const chrome = useChrome();
  return (
    <>
      {examples.length > 1 && (
        <>
          <Slash />
          <HeaderSelect label={chrome.pickers.example} onChange={onPickShape} value={shapeId}>
            {examples.map((e) => (
              <NativeSelectOption key={e.id} value={e.id}>
                {e.label}
              </NativeSelectOption>
            ))}
          </HeaderSelect>
        </>
      )}
      {presets.length > 1 && (
        <>
          <Slash />
          <HeaderSelect label={chrome.pickers.preset} onChange={onPickPreset} value={presetId}>
            {presets.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.label}
              </NativeSelectOption>
            ))}
          </HeaderSelect>
        </>
      )}
    </>
  );
}
