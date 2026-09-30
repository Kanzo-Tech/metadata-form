import { describe, it, expect } from "vitest";
import { namedNode } from "@/form/factory.js";
import { buildFormModel } from "@/form/buildFormModel.js";
import { allFields } from "@/form/FormModel.js";
import type { NodeShapeIR, PropertyShapeIR, ShapeModel } from "@/form/ShapeIR.js";

/**
 * Pure (no-wasm) test of SHACL-1.2 conditional rendering in `buildFormModel`:
 * a node shape's `sh:then` fields appear only when the projection reports the
 * condition satisfied; the `sh:else` fields appear otherwise. Locks the TS gate
 * independently of the rudof conformance evaluation (mirrored via `satisfied`).
 */

const EX = "http://example.org/";

function prop(pathIri: string, opts: Partial<PropertyShapeIR> = {}): PropertyShapeIR {
  return {
    path: { kind: "predicate", iri: pathIri },
    pathKey: pathIri,
    cardinality: {},
    value: {},
    logical: {},
    presentation: { names: [{ value: pathIri.split(/[#/]/).pop()!, language: "" }], descriptions: [] },
    components: [],
    ...opts,
  };
}

const CONDITION_ID = "_:restrictedCondition";

const shape: NodeShapeIR = {
  id: `${EX}DatasetShape`,
  targetClasses: [`${EX}Dataset`],
  instanceClass: `${EX}Dataset`,
  properties: [prop(`${EX}accessRights`)],
  conditionals: [
    {
      conditionId: CONDITION_ID,
      then: [prop(`${EX}accessJustification`, { cardinality: { min: 1 } })],
      else: [prop(`${EX}publicNote`)],
    },
  ],
};

const shapes: ShapeModel = {
  nodeShapes: new Map([[shape.id, shape]]),
  groups: new Map(),
  byTargetClass: new Map([[`${EX}Dataset`, shape.id]]),
};

const focus = namedNode(`${EX}d1`);

function pathsOf(satisfied: Map<string, Set<string>>): string[] {
  const model = buildFormModel({ shapes, focusNode: focus, shape, satisfied });
  return allFields(model).map((f) => f.path.value);
}

describe("SHACL 1.2 conditional rendering (buildFormModel)", () => {
  it("shows the sh:then field (required) when the condition is satisfied", () => {
    const satisfied = new Map([[focus.value, new Set([CONDITION_ID])]]);
    const model = buildFormModel({ shapes, focusNode: focus, shape, satisfied });
    const paths = allFields(model).map((f) => f.path.value);
    expect(paths).toContain(`${EX}accessJustification`);
    expect(paths).not.toContain(`${EX}publicNote`);

    const justification = allFields(model).find((f) => f.path.value === `${EX}accessJustification`)!;
    expect(justification.required).toBe(true);
    expect(justification.guard).toEqual({ conditionId: CONDITION_ID, branch: "then" });
  });

  it("shows the sh:else field when the condition is NOT satisfied", () => {
    const paths = pathsOf(new Map([[focus.value, new Set()]]));
    expect(paths).toContain(`${EX}publicNote`);
    expect(paths).not.toContain(`${EX}accessJustification`);
  });

  it("treats a missing satisfied entry as the else branch", () => {
    const paths = pathsOf(new Map());
    expect(paths).toContain(`${EX}publicNote`);
    expect(paths).not.toContain(`${EX}accessJustification`);
  });

  it("always keeps the base properties regardless of the condition", () => {
    for (const satisfied of [new Map([[focus.value, new Set([CONDITION_ID])]]), new Map()]) {
      expect(pathsOf(satisfied as Map<string, Set<string>>)).toContain(`${EX}accessRights`);
    }
  });
});
