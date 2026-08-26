import { useMemo, useState } from "react";
import { EXAMPLES } from "../presets.js";
import { useDebounced } from "../hooks/useDebounced.js";
import type { PermalinkOptions, PermalinkState } from "../lib/permalink.js";

/** The playground's editable source: the selected example/data preset, the live
 *  shape/data Turtle, and the debounced `applied` snapshot fed to the form.
 *
 *  Everything flows through one model ({@link PermalinkState}). A decoded permalink
 *  (`initial`) and a preset pick are the same thing — both `applyPreset`. Discrete
 *  picks call `onPick` to sync the URL (the URL is the source of truth); free-text
 *  edits don't — those are committed only by an explicit Share. */
export function useWorkspace(initial: PermalinkState | null, onPick: (state: PermalinkState) => void) {
  const seed = initial ?? EXAMPLES[0].presets[0].state;
  const seedShape = EXAMPLES.find((e) => e.id === seed.exampleId) ?? EXAMPLES[0];
  // Match the data preset by content (a shared link's data is usually custom → first).
  const seedPreset = seedShape.presets.find((p) => p.state.dataText === seed.dataText) ?? seedShape.presets[0];

  const [shapeId, setShapeId] = useState(seedShape.id);
  const [presetId, setPresetId] = useState(seedPreset.id);
  const [shapeText, setShapeText] = useState(seed.shapesText);
  const [dataText, setDataText] = useState(seed.dataText);
  // The form knobs (no UI to change them yet — restored from a permalink if present).
  // A setter, and its absence was the whole of "sharing does not work". These froze
  // at mount, so every example kept the FIRST-loaded one's `rootShape`: picking a
  // second shape killed the form with "Could not resolve a root node shape", and
  // Share emitted a permalink pairing one example's shapes with another's options —
  // overwriting the correct URL the pick had already written.
  const [options, setOptions] = useState<PermalinkOptions>(seed.options);

  const shape = useMemo(() => EXAMPLES.find((e) => e.id === shapeId)!, [shapeId]);

  // Apply a preset's full state (preset pick = navigating to its permalink) and sync
  // the URL. The single place example selection and URL hydration converge.
  const applyPreset = (presetId: string, state: PermalinkState) => {
    setShapeId(state.exampleId);
    setPresetId(presetId);
    setShapeText(state.shapesText);
    setDataText(state.dataText);
    setOptions(state.options);
    onPick(state);
  };

  const pickShape = (id: string) => {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (ex) applyPreset(ex.presets[0].id, ex.presets[0].state);
  };
  const pickPreset = (id: string) => {
    const p = shape.presets.find((x) => x.id === id);
    if (p) applyPreset(p.id, p.state);
  };

  // Live, debounced — apply edits 350ms after typing stops. Memoize the snapshot so
  // unrelated re-renders don't reset the debounce timer.
  const pending = useMemo(() => ({ shapes: shapeText, data: dataText }), [shapeText, dataText]);
  const applied = useDebounced(pending, 350);

  // The current state: the base Share captures (the Share handler swaps in the
  // form's live data). Read only at click time, so no memo is needed.
  const permalink: PermalinkState = { v: 1, exampleId: shapeId, shapesText: shapeText, dataText, options };

  return {
    examples: EXAMPLES,
    shapeId,
    presetId,
    shape,
    shapeText,
    dataText,
    setShapeText,
    setDataText,
    pickShape,
    pickPreset,
    applied,
    options,
    permalink,
  };
}
