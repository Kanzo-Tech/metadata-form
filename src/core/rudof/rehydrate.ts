import type { ShapeModel } from "../shape/ShapeIR.js";
import type { ShapeModelJson } from "./abi.js";

/** Rehydrate the JSON shape model (arrays) into the {@link ShapeModel} (Maps). */
export function shapeModelFromJson(json: ShapeModelJson): ShapeModel {
  return {
    nodeShapes: new Map(json.nodeShapes.map((s) => [s.id, s])),
    groups: new Map(json.groups.map((g) => [g.id, g])),
    byTargetClass: new Map(json.byTargetClass),
  };
}

/** Dehydrate a {@link ShapeModel} (Maps) into the JSON form (arrays). */
export function shapeModelToJson(model: ShapeModel): ShapeModelJson {
  return {
    nodeShapes: [...model.nodeShapes.values()],
    groups: [...model.groups.values()],
    byTargetClass: [...model.byTargetClass],
  };
}
