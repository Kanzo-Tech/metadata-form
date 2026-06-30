import { useMemo, useState } from "react";
import { EXAMPLES } from "@examples/index.js";
import { useDebounced } from "../hooks/useDebounced.js";

/** The playground's editable source: which example is selected, the live shape/data
 *  Turtle, and the debounced `applied` snapshot fed to the form (no Apply button). */
export function useWorkspace() {
  const [shapeId, setShapeId] = useState(EXAMPLES[0].id);
  const [dataId, setDataId] = useState(EXAMPLES[0].data[0].id);
  const [shapeText, setShapeText] = useState(EXAMPLES[0].shapes);
  const [dataText, setDataText] = useState(EXAMPLES[0].data[0].ttl);

  const shape = useMemo(() => EXAMPLES.find((e) => e.id === shapeId)!, [shapeId]);

  const pickShape = (id: string) => {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    setShapeId(id);
    setShapeText(ex.shapes);
    setDataId(ex.data[0].id);
    setDataText(ex.data[0].ttl);
  };
  const pickData = (id: string) => {
    const d = shape.data.find((x) => x.id === id);
    if (!d) return;
    setDataId(id);
    setDataText(d.ttl);
  };

  // Live, debounced — apply edits 350ms after typing stops. Memoize the snapshot so
  // unrelated re-renders don't reset the debounce timer.
  const pending = useMemo(() => ({ shapes: shapeText, data: dataText }), [shapeText, dataText]);
  const applied = useDebounced(pending, 350);

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
  };
}
