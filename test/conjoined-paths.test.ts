import { describe, it, expect } from "vitest";
import { buildFormModel } from "@/form/buildFormModel.js";
import { createRudofEngine } from "@/engine/index.js";
import { GraphState } from "@/engine/GraphState.js";
import { allFields, type FieldModel, type FormModel } from "@/form/FormModel.js";
import { Editors } from "@/form/vocab/shacl-ui.js";
import { namedNode } from "@/engine/factory.js";
import type { Diagnostic } from "@/form/buildFormModel.js";
import type { NodeShapeIR, PropertyShapeIR, ShapeModel } from "@/form/ShapeIR.js";

/**
 * Several property shapes on one path are ONE field.
 *
 * SHACL §3.4: a focus node conforms to a node shape when it conforms to every
 * constraint the shape states, `sh:property` included — so two property shapes
 * with the same path describe one property whose values must satisfy both. The
 * form model already says the same thing in its own terms: `FieldModel.id` is
 * `fieldKey(focusNode, path)`, the key the projection files values under and the
 * key validation results are matched by. Two fields on one path were therefore
 * always two fields with one id.
 *
 * The fixture is DCAT-AP 3.0.1's, whose generated SHACL puts each constraint in
 * its own shape: `spdx:algorithm` on `spdx:Checksum` arrives as four property
 * shapes and rendered as four controls. Only the shape ids are shortened.
 */

const EX = "http://example.org/";
const SPDX = "http://spdx.org/rdf/terms#";
const FOCUS = `${EX}c1`;

const prefix = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix ex: <${EX}> .
  @prefix spdx: <${SPDX}> .
`;

/** One rudof session over a whole shapes document, as `useMetadataForm` runs it. */
async function form(shapesBody: string, dataTtl = "", shapeId = `${EX}S`) {
  const engine = createRudofEngine();
  const shapes = await engine.loadShapes(`${prefix}${shapesBody}`);
  const session = await engine.createGraph(
    shapes,
    `${prefix}\n${dataTtl}`,
    "text/turtle",
    namedNode(FOCUS),
    namedNode(shapeId),
  );
  const graph = new GraphState(session.backend);
  const diagnostics: Diagnostic[] = [];
  const { values, satisfied } = engine.projectValues(shapes, session.focusNode, session.rootShapeId);
  const model = buildFormModel({
    shapes,
    focusNode: session.focusNode,
    shape: shapes.nodeShapes.get(session.rootShapeId)!,
    locale: "en",
    values,
    satisfied,
    readStep: graph.readStep,
    onDiagnostic: (d) => diagnostics.push(d),
  });
  return { model, diagnostics, fields: allFields(model) };
}

const byPath = (fields: FieldModel[], path: string): FieldModel[] =>
  fields.filter((f) => f.path.value === path);

const one = (fields: FieldModel[], path: string): FieldModel => {
  const matching = byPath(fields, path);
  expect(matching).toHaveLength(1);
  return matching[0];
};

/** Every field id in the form, sub-forms included. The invariant the model
 *  declares and nothing checked: one field per (focus node, path). */
function idsOf(model: FormModel): string[] {
  return allFields(model).flatMap((f) => [
    f.id,
    ...f.values.flatMap((v) => (v.nested ? idsOf(v.nested) : [])),
  ]);
}

const expectUniqueIds = (model: FormModel) => {
  const ids = idsOf(model);
  expect(ids).toEqual([...new Set(ids)]);
};

/** DCAT-AP 3.0.1's spdx:Checksum shape, one constraint per property shape. */
const CHECKSUM = `
  ex:S a sh:NodeShape ; sh:targetClass spdx:Checksum ; sh:closed false ;
    sh:property ex:alg1, ex:alg2, ex:alg3, ex:alg4, ex:val1, ex:val2, ex:val3, ex:val4 .

  ex:alg1 sh:path spdx:algorithm ; sh:name "algorithm"@en ;
    sh:description "The algorithm used to produce the subject Checksum."@en ;
    sh:nodeKind sh:BlankNodeOrIRI .
  ex:alg2 sh:path spdx:algorithm ; sh:name "algorithm"@en ;
    sh:description "The algorithm used to produce the subject Checksum."@en ;
    sh:maxCount 1 .
  ex:alg3 sh:path spdx:algorithm ; sh:name "algorithm"@en ;
    sh:description "The algorithm used to produce the subject Checksum."@en ;
    sh:minCount 1 .
  ex:alg4 sh:path spdx:algorithm ; sh:name "algorithm"@en ;
    sh:description "The algorithm used to produce the subject Checksum."@en ;
    sh:class spdx:ChecksumAlgorithm .

  ex:val1 sh:path spdx:checksumValue ; sh:name "checksum value"@en ; sh:nodeKind sh:Literal .
  ex:val2 sh:path spdx:checksumValue ; sh:name "checksum value"@en ; sh:datatype xsd:hexBinary .
  ex:val3 sh:path spdx:checksumValue ; sh:name "checksum value"@en ; sh:maxCount 1 .
  ex:val4 sh:path spdx:checksumValue ; sh:name "checksum value"@en ; sh:minCount 1 .
`;

describe("property shapes sharing a path (SHACL conjunction)", () => {
  it("renders ONE field for DCAT-AP's four spdx:algorithm shapes, with every constraint", async () => {
    const { fields, diagnostics } = await form(CHECKSUM);

    expect(fields).toHaveLength(2); // eight property shapes, two properties
    const algorithm = one(fields, `${SPDX}algorithm`);
    expect(algorithm.label).toBe("algorithm");
    expect(algorithm.minCount).toBe(1);
    expect(algorithm.required).toBe(true);
    expect(algorithm.maxCount).toBe(1);
    expect(algorithm.repeatable).toBe(false);
    expect(algorithm.constraints.classIri).toBe(`${SPDX}ChecksumAlgorithm`);
    expect(algorithm.constraints.nodeKind).toBe("http://www.w3.org/ns/shacl#BlankNodeOrIRI");
    // The editor is re-derived from the merged facts: rudof resolved a text box
    // for the three shapes that state no type, and a class is a reference.
    expect(algorithm.editorId).toBe(Editors.AutoComplete);
    expect(algorithm.readOnly).toBeFalsy();
    expect(algorithm.write).toBeDefined();

    expect(diagnostics.filter((d) => d.code === "conjoined-property")).toHaveLength(2);
  });

  it("narrows sh:nodeKind by a sibling shape's sh:datatype", async () => {
    const { fields } = await form(CHECKSUM);
    const value = one(fields, `${SPDX}checksumValue`);
    expect(value.constraints.datatype).toBe("http://www.w3.org/2001/XMLSchema#hexBinary");
    // sh:Literal ∩ (what sh:datatype admits) is still Literal — stated, not invented.
    expect(value.constraints.nodeKind).toBe("http://www.w3.org/ns/shacl#Literal");
    expect(value.minCount).toBe(1);
    expect(value.maxCount).toBe(1);
  });

  it("holds the one-field-per-(focus, path) invariant the model declares", async () => {
    const { model, fields } = await form(CHECKSUM);
    expectUniqueIds(model);
    expect(fields.map((f) => f.id)).toEqual([
      `${FOCUS}|${SPDX}algorithm`,
      `${FOCUS}|${SPDX}checksumValue`,
    ]);
  });

  it("takes the tighter bound from each side", async () => {
    const { fields } = await form(`
      ex:S a sh:NodeShape ; sh:targetClass ex:Thing ; sh:property ex:p1, ex:p2 .
      ex:p1 sh:path ex:tag ; sh:minCount 1 ; sh:maxCount 5 ; sh:minLength 2 ; sh:maxLength 40 .
      ex:p2 sh:path ex:tag ; sh:minCount 2 ; sh:maxCount 3 ; sh:minLength 8 ; sh:maxLength 20 .
    `);
    const tag = one(fields, `${EX}tag`);
    expect(tag.minCount).toBe(2);
    expect(tag.maxCount).toBe(3);
    expect(tag.constraints.minLength).toBe(8);
    expect(tag.constraints.maxLength).toBe(20);
  });

  it("intersects two enumerations, and the select is the only control on the path", async () => {
    const { fields } = await form(`
      ex:S a sh:NodeShape ; sh:targetClass ex:Thing ; sh:property ex:p1, ex:p2, ex:p3 .
      ex:p1 sh:path ex:status ; sh:in ( "draft" "review" "final" ) .
      ex:p2 sh:path ex:status ; sh:in ( "review" "final" "archived" ) .
      ex:p3 sh:path ex:status ; sh:name "status"@en ; sh:maxCount 1 .
    `);
    const status = one(fields, `${EX}status`);
    expect(status.constraints.options?.map((o) => o.value.value)).toEqual(["review", "final"]);
    // The E5 finding, inverted: a closed enumeration no longer stands beside two
    // open text boxes on the same predicate, so the bad value is untypable.
    expect(status.editorId).toBe(Editors.EnumSelect);
    expect(status.label).toBe("status");
  });

  it("refuses input where the shapes contradict each other, and says why", async () => {
    const { fields, diagnostics } = await form(`
      ex:S a sh:NodeShape ; sh:targetClass ex:Thing ; sh:property ex:p1, ex:p2 .
      ex:p1 sh:path ex:ref ; sh:datatype xsd:string .
      ex:p2 sh:path ex:ref ; sh:nodeKind sh:IRI .
    `);
    const ref = one(fields, `${EX}ref`);
    expect(ref.readOnly).toBe(true);
    expect(ref.write).toBeUndefined();
    expect(ref.readOnlyReason?.code).toBe("unsatisfiable-conjunction");
    expect(ref.readOnlyReason?.message).toContain("contradict one another");
    expect(diagnostics.map((d) => d.code)).toContain("unsatisfiable-property");
  });

  it("reports a demand it cannot carry rather than dropping it quietly", async () => {
    const { fields, diagnostics } = await form(`
      ex:S a sh:NodeShape ; sh:targetClass ex:Thing ; sh:property ex:p1, ex:p2 .
      ex:p1 sh:path ex:agent ; sh:class ex:Organisation .
      ex:p2 sh:path ex:agent ; sh:class ex:Publisher .
    `);
    const agent = one(fields, `${EX}agent`);
    // A node CAN be an instance of both, so the field still takes input; one
    // reference control can only search one of them, and that is said out loud.
    expect(agent.readOnly).toBeFalsy();
    expect(agent.constraints.classIri).toBe(`${EX}Organisation`);
    const conflict = diagnostics.find((d) => d.code === "conflicting-constraint");
    expect(conflict?.message).toContain("sh:class");
    expect(conflict?.message).toContain(`${EX}Publisher`);
  });

  it("ignores a sh:deactivated shape's constraints in the conjunction", async () => {
    const { fields } = await form(`
      ex:S a sh:NodeShape ; sh:targetClass ex:Thing ; sh:property ex:p1, ex:p2 .
      ex:p1 sh:path ex:title ; sh:minCount 1 .
      ex:p2 sh:path ex:title ; sh:deactivated true ; sh:minCount 3 ; sh:maxCount 3 .
    `);
    const title = one(fields, `${EX}title`);
    expect(title.minCount).toBe(1);
    expect(title.maxCount).toBeUndefined();
  });

  it("keeps a complex path writable through the merge", async () => {
    const { fields } = await form(
      `
      ex:S a sh:NodeShape ; sh:targetClass ex:Thing ; sh:property ex:p1, ex:p2 .
      ex:p1 sh:path [ sh:inversePath ex:parent ] ; sh:minCount 1 .
      ex:p2 sh:path [ sh:inversePath ex:parent ] ; sh:class ex:Child .
    `,
      `ex:kid ex:parent ex:c1 .`,
    );
    const child = one(fields, "^http://example.org/parent");
    expect(child.pathKind).toBe("complex");
    expect(child.readOnly).toBeFalsy();
    expect(child.write?.branches.map((b) => [b.via.length, b.step.predicate.value, b.step.direction]))
      .toEqual([[0, `${EX}parent`, "inverse"]]);
    expect(child.values.map((v) => v.value?.value)).toEqual([`${EX}kid`]);
    expect(child.minCount).toBe(1);
    expect(child.constraints.classIri).toBe(`${EX}Child`);
  });

  it("keeps an sh:or's alternatives through the merge", async () => {
    const { fields } = await form(`
      ex:S a sh:NodeShape ; sh:targetClass ex:Thing ; sh:property ex:p1, ex:p2 .
      ex:p1 sh:path ex:issued ;
        sh:or ( [ sh:datatype xsd:date ] [ sh:datatype xsd:dateTime ] ) .
      ex:p2 sh:path ex:issued ; sh:maxCount 1 ; sh:name "release date"@en .
    `);
    const issued = one(fields, `${EX}issued`);
    expect(issued.label).toBe("release date");
    expect(issued.maxCount).toBe(1);
    expect(issued.alternatives?.map((a) => a.label)).toEqual(["date", "dateTime"]);
    expect(issued.editorId).toBe(Editors.DatePicker);
  });
});

/**
 * The conditional case, on a hand-built IR because what is under test is which
 * property shapes apply — not rudof's evaluation of the `sh:if`, which
 * `conditionals.integration.test.ts` covers.
 */
describe("conjunction across a SHACL 1.2 conditional branch", () => {
  const CONDITION = "_:cond";
  const prop = (iri: string, extra: Partial<PropertyShapeIR> = {}): PropertyShapeIR => ({
    path: { kind: "predicate", iri },
    pathKey: iri,
    cardinality: {},
    value: {},
    logical: {},
    presentation: { names: [], descriptions: [] },
    components: [],
    ...extra,
  });

  const shape: NodeShapeIR = {
    id: `${EX}DatasetShape`,
    targetClasses: [`${EX}Dataset`],
    properties: [prop(`${EX}accessRights`)],
    conditionals: [
      {
        conditionId: CONDITION,
        then: [
          prop(`${EX}accessRights`, { cardinality: { min: 1 } }),
          prop(`${EX}justification`, { cardinality: { min: 1 } }),
        ],
        else: [],
      },
    ],
  };
  const shapes: ShapeModel = {
    nodeShapes: new Map([[shape.id, shape]]),
    groups: new Map(),
    byTargetClass: new Map([[`${EX}Dataset`, shape.id]]),
  };
  const focusNode = namedNode(`${EX}d1`);

  it("conjoins an active branch's shape with the node shape's own, once", () => {
    const model = buildFormModel({
      shapes,
      focusNode,
      shape,
      satisfied: new Map([[focusNode.value, new Set([CONDITION])]]),
    });
    expectUniqueIds(model);
    const fields = allFields(model);
    const accessRights = one(fields, `${EX}accessRights`);
    // The condition made an existing property required; it did not add a second
    // one. The field is not itself conditional — it renders either way.
    expect(accessRights.minCount).toBe(1);
    expect(accessRights.guard).toBeUndefined();
    // A property only the branch states stays guarded by it.
    expect(one(fields, `${EX}justification`).guard).toEqual({
      conditionId: CONDITION,
      branch: "then",
    });
  });

  it("leaves the property alone when the condition does not hold", () => {
    const model = buildFormModel({ shapes, focusNode, shape });
    const fields = allFields(model);
    expect(fields.map((f) => f.path.value)).toEqual([`${EX}accessRights`]);
    expect(fields[0].minCount).toBe(0);
  });
});
