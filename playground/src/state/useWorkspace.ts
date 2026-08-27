import { useMemo, useState } from "react";
import { defaultState, shapeSets } from "../instance.js";
import { useDebounced } from "../hooks/useDebounced.js";
import type { PermalinkOptions, PermalinkState } from "../lib/permalink.js";

/** The playground's editable source: the selected example/data preset, the live
 *  shape/data Turtle, and the debounced `applied` snapshot fed to the form.
 *
 *  Everything flows through one model ({@link PermalinkState}). A decoded permalink
 *  (`initial`) and a preset pick are the same thing — both `applyPreset`. Discrete
 *  picks call `onPick` to sync the URL (the URL is the source of truth); free-text
 *  edits don't — those are committed only by an explicit Share. */
export function useWorkspace(
  initial: PermalinkState | null,
  onPick: (state: PermalinkState, pristine: boolean) => void,
) {
  const seed = initial ?? defaultState();
  const seedShape = shapeSets.find((e) => e.id === seed.exampleId) ?? shapeSets[0];
  // A by-reference link names its preset outright; otherwise match by content (a shared
  // link's data is usually custom, which lands on the first).
  const seedPreset =
    seedShape.presets.find((p) => p.id === seed.presetId) ??
    seedShape.presets.find((p) => p.state.dataText === seed.dataText) ??
    seedShape.presets[0];

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
  // The state as it was APPLIED — what "unedited" is measured against. A permalink
  // may reference a bundled preset by id only while the text is still that preset's,
  // and the sole way to know is to keep what was handed over.
  const [appliedState, setApplied] = useState<PermalinkState>(seed);

  const shape = useMemo(() => shapeSets.find((e) => e.id === shapeId) ?? shapeSets[0], [shapeId]);

  // Apply a preset's full state (preset pick = navigating to its permalink) and sync
  // the URL. The single place example selection and URL hydration converge.
  const applyPreset = (presetId: string, state: PermalinkState) => {
    setShapeId(state.exampleId);
    setPresetId(presetId);
    setShapeText(state.shapesText);
    setDataText(state.dataText);
    setOptions(state.options);
    setApplied(state);
    onPick(state, !!state.presetId);
  };

  const pickShape = (id: string) => {
    const ex = shapeSets.find((e) => e.id === id);
    if (ex) applyPreset(ex.presets[0].id, { ...ex.presets[0].state, presetId: ex.presets[0].id });
  };
  const pickPreset = (id: string) => {
    const p = shape.presets.find((x) => x.id === id);
    if (p) applyPreset(p.id, { ...p.state, presetId: p.id });
  };

  // Live, debounced — apply edits 350ms after typing stops. Memoize the snapshot so
  // unrelated re-renders don't reset the debounce timer.
  const pending = useMemo(() => ({ shapes: shapeText, data: dataText }), [shapeText, dataText]);
  const applied = useDebounced(pending, 350);

  // The current state: the base Share captures (the Share handler swaps in the
  // form's live data). Read only at click time, so no memo is needed.
  const permalink: PermalinkState = {
    exampleId: shapeId,
    presetId: appliedState.presetId,
    shapesText: shapeText,
    dataText,
    options,
  };

  // Half of "shareable by reference": the Turtle in the editors is still the preset's.
  // The other half is the form's own graph, which only the page holding the form can
  // answer for — see the baseline in `App.tsx`.
  const sourcePristine =
    !!appliedState.presetId && shapeText === appliedState.shapesText && dataText === appliedState.dataText;

  return {
    examples: shapeSets,
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
    sourcePristine,
  };
}
