import type { ShapeModel } from "../model/ShapeIR.js";
import type { ShapeModelJson } from "./abi.js";

/** Rehydrate the JSON shape model (arrays) into the {@link ShapeModel} (Maps). */
export function shapeModelFromJson(json: ShapeModelJson): ShapeModel {
  return {
    nodeShapes: new Map(json.nodeShapes.map((s) => [s.id, s])),
    groups: new Map(json.groups.map((g) => [g.id, g])),
    byTargetClass: new Map(json.byTargetClass),
  };
}
