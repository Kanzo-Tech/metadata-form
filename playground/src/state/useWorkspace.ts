import { useMemo, useState } from "react";
import { EXAMPLES } from "@examples/index.js";
import { useDebounced } from "../hooks/useDebounced.js";
import type { PermalinkOptions, PermalinkState } from "../lib/permalink.js";

/** The playground's editable source: which example is selected, the live shape/data
 *  Turtle, and the debounced `applied` snapshot fed to the form (no Apply button).
 *
 *  State flows through one model ({@link PermalinkState}): both a decoded permalink
 *  (`initial`) and an example selection hydrate the same fields. Discrete picks call
 *  `onPick` to keep the URL in sync (the URL is the source of truth); free-text edits
 *  do not — those are committed only by an explicit Share. */
export function useWorkspace(initial: PermalinkState | null, onPick: (state: PermalinkState) => void) {
  const seedEx = EXAMPLES.find((e) => e.id === initial?.exampleId) ?? EXAMPLES[0];

  const [shapeId, setShapeId] = useState(seedEx.id);
  const [dataId, setDataId] = useState(seedEx.data[0].id);
  const [shapeText, setShapeText] = useState(initial?.shapesText ?? seedEx.shapes);
  const [dataText, setDataText] = useState(initial?.dataText ?? seedEx.data[0].ttl);
  // The form knobs (no UI to change them yet — restored from a permalink if present).
  const [options] = useState<PermalinkOptions>(initial?.options ?? { validateOn: "change" });

  const shape = useMemo(() => EXAMPLES.find((e) => e.id === shapeId)!, [shapeId]);

  const state = (over: Partial<PermalinkState>): PermalinkState => ({
    v: 1,
    exampleId: shapeId,
    shapesText: shapeText,
    dataText,
    options,
    ...over,
  });

  const pickShape = (id: string) => {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    setShapeId(id);
    setShapeText(ex.shapes);
    setDataId(ex.data[0].id);
    setDataText(ex.data[0].ttl);
    onPick(state({ exampleId: id, shapesText: ex.shapes, dataText: ex.data[0].ttl }));
  };
  const pickData = (id: string) => {
    const d = shape.data.find((x) => x.id === id);
    if (!d) return;
    setDataId(id);
    setDataText(d.ttl);
    onPick(state({ dataText: d.ttl }));
  };

  // Live, debounced — apply edits 350ms after typing stops. Memoize the snapshot so
  // unrelated re-renders don't reset the debounce timer.
  const pending = useMemo(() => ({ shapes: shapeText, data: dataText }), [shapeText, dataText]);
  const applied = useDebounced(pending, 350);

  // The current state: what an example pick syncs to the URL, and the base Share
  // captures (the Share handler swaps in the form's live data). Read only at
  // click time, so no memo is needed.
  const permalink = state({});

  return {
    examples: EXAMPLES,
    shapeId,
    dataId,
    shape,
    shapeText,
    dataText,
    setShapeText,
    setDataText,
    pickShape,
    pickData,
    applied,
    options,
    permalink,
  };
}
