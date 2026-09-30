import { describe, it, expect, beforeAll } from "vitest";
import type { Term } from "@rdfjs/types";
import { buildFormModel } from "@/form/buildFormModel.js";
import type { Diagnostic, DiagnosticSink } from "@/form/buildFormModel.js";
import { createRudofEngine } from "@/engine/index.js";
import { projectTree } from "@/engine/projectTree.js";
import { Editors } from "@/form/vocab/shacl-ui.js";
import { allFields } from "@/form/FormModel.js";
import { computeFormReport } from "@/react/validation/formReport.js";
import type { FieldError, ValidationResult } from "@/form/validation.js";
import { mapResults } from "@/form/validation.js";
import { EN } from "@/i18n/strings.js";
import { namedNode } from "@/form/factory.js";
import type { ShapeModel } from "@/form/ShapeIR.js";
import { healthDcatApShapes, healthDcatApRootShape } from "@examples/health-dcat-ap/index.js";

const shapesTtl = healthDcatApShapes;
const rootShape = namedNode(healthDcatApRootShape);

/** Parse a SHACL document into the agnostic ShapeModel via rudof (a fresh,
 *  isolated session per call). */
function parseShapes(ttl: string): Promise<ShapeModel> {
  return Promise.resolve(createRudofEngine().loadShapes(ttl));
}

/** Build a structure-only FormModel (no data → empty value slots). The single-graph
 *  path projects values from an engine session; tests that assert values use
 *  {@link buildWithData} instead. */
function buildFrom(
  shapes: ShapeModel,
  focusNode: Term,
  rootIri: string,
  onDiagnostic?: DiagnosticSink,
) {
  const shape = shapes.nodeShapes.get(rootIri);
  if (!shape) throw new Error(`No node shape ${rootIri}`);
  return buildFormModel({ shapes, focusNode, shape, languages: ["en"], onDiagnostic });
}

/** Build a FormModel whose values come from a real rudof session: load shapes AND
 *  data into ONE session, project the focus's value tree, then build over it — the
 *  single-graph projection path (mirrors `test/rudof-wasm.integration.test.ts`). */
async function buildWithData(
  dataTtl: string,
  opts: { shapesTtl?: string; rootIri?: string; focusNode?: Term } = {},
) {
  const sTtl = opts.shapesTtl ?? shapesTtl;
  const rootIri = opts.rootIri ?? rootShape.value;
  const focusNode = opts.focusNode ?? namedNode("http://example.org/d1");
  const engine = createRudofEngine();
  const model = await engine.loadShapes(sTtl);
  await engine.loadData(dataTtl);
  const shape = model.nodeShapes.get(rootIri)!;
  const { values, satisfied } = projectTree((f, s) => engine.projectFormSync(f, s), model, rootIri, focusNode);
  return buildFormModel({ shapes: model, focusNode, shape, values, satisfied, languages: ["en"] });
}

/** Validate a data graph (Turtle string) against shapes, in rudof-over-WASM. */
async function validateAgainst(ttl: string, dataTtl: string): Promise<ValidationResult[]> {
  const engine = createRudofEngine();
  await engine.loadShapes(ttl);
  await engine.loadData(dataTtl);
  return engine.validate();
}

let shapes: ShapeModel;
beforeAll(async () => {
  shapes = await parseShapes(shapesTtl);
});

function build(focusNode = namedNode("http://example.org/d1")) {
  return { model: buildFrom(shapes, focusNode, rootShape.value) };
}

describe("SHACL → FormModel", () => {
  it("builds ordered groups and fields from the profile", () => {
    const { model } = build();
    const groupLabels = model.groups.map((g) => g.label);
    expect(groupLabels).toEqual(["General", "Provenance", "Health-specific", "Distributions"]);

    const fields = allFields(model);
    const title = fields.find((f) => f.path.value.endsWith("/title"));
    expect(title?.label).toBe("Title");
    expect(title?.required).toBe(true);
    expect(title?.editorId).toBe(Editors.TextField);
  });

  it("selects SHACL-UI editors via the resolver rules", () => {
    const { model } = build();
    const fields = allFields(model);
    const byPath = (suffix: string) => fields.find((f) => f.path.value.endsWith(suffix));

    expect(byPath("/description")?.editorId).toBe(Editors.TextArea);
    expect(byPath("/issued")?.editorId).toBe(Editors.DatePicker);
    expect(byPath("accessRights")?.editorId).toBe(Editors.EnumSelect);
    expect(byPath("/publisher")?.editorId).toBe(Editors.Details);
    expect(byPath("numberOfRecords")?.editorId).toBe(Editors.NumberField);
  });

  it("projects existing values from the data graph", async () => {
    const model = await buildWithData(`
      @prefix dcterms: <http://purl.org/dc/terms/> .
      <http://example.org/d1> dcterms:title "Hello" .
    `);
    const title = allFields(model).find((f) => f.path.value.endsWith("/title"));
    expect(title?.values.map((v) => v.value?.value)).toEqual(["Hello"]);
  });

  it("marks multi-value properties repeatable and projects all values", async () => {
    const model = await buildWithData(`
      @prefix dcat: <http://www.w3.org/ns/dcat#> .
      <http://example.org/d1> dcat:keyword "a", "b", "c" .
    `);
    const keyword = allFields(model).find((f) => f.path.value.endsWith("keyword"));
    expect(keyword?.repeatable).toBe(true);
    expect(keyword?.values.map((v) => v.value?.value).sort()).toEqual(["a", "b", "c"]);
  });

  it("renders sh:inversePath as an EDITABLE field holding the inverse subjects", async () => {
    const inverseShapes = `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      ex:S a sh:NodeShape ; sh:targetClass ex:Thing ;
        sh:property [ sh:path [ sh:inversePath ex:parent ] ; sh:name "Children" ] .
    `;
    const model = await buildWithData(
      `
        @prefix ex: <http://example.org/> .
        ex:c1 ex:parent ex:d1 .
        ex:c2 ex:parent ex:d1 .
      `,
      { shapesTtl: inverseShapes, rootIri: "http://example.org/S" },
    );
    const children = allFields(model).find((f) => f.label === "Children");
    // Writing through `^ex:parent` is asserting (value, ex:parent, focus) — one
    // statement, so the field takes input like any other.
    expect(children?.readOnly).toBeFalsy();
    expect(children?.readOnlyReason).toBeUndefined();
    expect(children?.write?.branches).toHaveLength(1);
    expect(children?.write?.branches[0].via).toEqual([]);
    expect(children?.write?.branches[0].step.direction).toBe("inverse");
    expect(children?.write?.branches[0].step.predicate.value).toBe("http://example.org/parent");
    expect(children?.values.map((v) => v.value?.value).sort()).toEqual([
      "http://example.org/c1",
      "http://example.org/c2",
    ]);
  });

  it("leaves a sequence path read-only, with the reason, while its intermediate is unknown", async () => {
    const sequenceShapes = `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      ex:S a sh:NodeShape ; sh:targetClass ex:Thing ;
        sh:property [ sh:path ( ex:a ex:b ) ] .
    `;
    const model = await buildWithData(
      `
        @prefix ex: <http://example.org/> .
        ex:d1 ex:a ex:x .
        ex:x  ex:b "deep" .
      `,
      { shapesTtl: sequenceShapes, rootIri: "http://example.org/S" },
    );
    // `buildWithData` passes no `readStep`, i.e. the build has no data graph to
    // resolve the intermediate against — the structure-only case, which is
    // exactly "no intermediate node".
    const field = allFields(model).find((f) => f.pathKind === "complex");
    expect(field).toBeDefined();
    expect(field?.readOnly).toBe(true);
    expect(field?.readOnlyReason?.code).toBe("intermediate-missing");
    expect(EN.readOnly[field!.readOnlyReason!.code]).toMatch(/does not exist yet/);
        expect(field?.readOnlyReason?.detail).toBe("(http://example.org/a/http://example.org/b)");
    expect(field?.values.map((v) => v.value?.value)).toEqual(["deep"]);
  });

  it("builds nested sub-forms for sh:node properties", async () => {
    const model = await buildWithData(`
      @prefix dcterms: <http://purl.org/dc/terms/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      <http://example.org/d1> dcterms:publisher <http://example.org/agent1> .
      <http://example.org/agent1> foaf:name "ACME" .
    `);
    const publisher = allFields(model).find((f) => f.path.value.endsWith("/publisher"));
    const nested = publisher?.values[0]?.nested;
    expect(nested).toBeDefined();
    const name = nested && allFields(nested).find((f) => f.path.value.endsWith("/name"));
    expect(name?.values[0]?.value?.value).toBe("ACME");
  });
});

describe("computeFormReport (single derived state)", () => {
  it("derives issues (rows + per-group), completion and health from one source", () => {
    const { model } = build();
    const title = allFields(model).find((f) => f.path.value.endsWith("/title"))!;
    const errors = new Map<string, FieldError[]>([
      [title.id, [{ messages: [{ value: "Required", language: "" }], severity: "violation" } as FieldError]],
    ]);

    const report = computeFormReport(model, errors);
    expect(report.issues.total).toBe(1);
    expect(report.issues.hasViolations).toBe(true);
    expect(report.issues.rows[0]).toMatchObject({ key: title.id, label: "Title", severity: "violation" });

    const group = model.groups.find((g) => g.fields.some((f) => f.id === title.id))!;
    expect(report.issues.byGroup.get(group.id)).toMatchObject({ count: 1, hasViolation: true, firstFieldId: title.id });

    // completion + health derived in the same pass
    expect(report.progress.requiredTotal).toBeGreaterThan(0);
    expect(report.health.mood).toBe("warning");
  });
});

describe("build diagnostics (no silent failures)", () => {
  it("resolves a sh:node to an undefined shape leniently (rudof stubs it as empty)", async () => {
    // rudof's parser registers a referenced-but-undefined shape as an empty node
    // shape, so the build resolves it (empty sub-form) rather than crashing. The
    // legacy n3 reader flagged this as a `missing-shape` diagnostic; rudof is more
    // lenient — a dangling sh:node yields an empty sub-form, not an error.
    const shapes = await parseShapes(`
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      ex:S a sh:NodeShape ; sh:targetClass ex:Thing ;
        sh:property [ sh:path ex:child ; sh:node ex:Missing ] .
    `);
    expect(shapes.nodeShapes.get("http://example.org/Missing")?.properties).toEqual([]);
    const diags: Diagnostic[] = [];
    buildFrom(shapes, namedNode("http://example.org/d1"), "http://example.org/S", (d) =>
      diags.push(d),
    );
    expect(diags.some((d) => d.code === "missing-shape")).toBe(false);
  });
});

describe("serialization — rudof emits JSON-LD", () => {
  it("serializes the data graph to JSON-LD carrying the values", async () => {
    const engine = createRudofEngine();
    await engine.loadData(`
      @prefix dcterms: <http://purl.org/dc/terms/> .
      <http://example.org/d1> dcterms:title "Hello" .
    `);
    const jsonldText = await engine.serialize("application/ld+json");
    const parsed = JSON.parse(jsonldText);
    expect(parsed).toBeTruthy();
    expect(JSON.stringify(parsed)).toContain("Hello");
  });
});

describe("SHACL validation", () => {
  it("reports missing required fields", async () => {
    const results = await validateAgainst(
      shapesTtl,
      `
        @prefix dcat: <http://www.w3.org/ns/dcat#> .
        <http://example.org/d1> a dcat:Dataset .
      `,
    );
    const errors = mapResults(results);
    // title, description and publisher are required (minCount >= 1)
    const allMessages = [...errors.values()].flat();
    expect(allMessages.length).toBeGreaterThan(0);
    const titleKey = "http://example.org/d1|http://purl.org/dc/terms/title";
    expect(errors.has(titleKey)).toBe(true);
  });

  it("surfaces nested errors per node (typed nodes validated as targets)", async () => {
    const results = await validateAgainst(
      shapesTtl,
      `
        @prefix dcat: <http://www.w3.org/ns/dcat#> .
        @prefix dcterms: <http://purl.org/dc/terms/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        <http://example.org/d1> a dcat:Dataset ;
          dcterms:title "T" ; dcterms:description "D" ;
          dcterms:publisher <http://example.org/agent1> .
        <http://example.org/agent1> a foaf:Agent .
      `,
    );
    // The Agent (publisher) is missing foaf:name (minCount 1) — reported on the
    // agent node, not the root dataset (no focus filter drops it).
    const nameError = results.find((r) => r.pathKey?.endsWith("/name"));
    expect(nameError).toBeDefined();
    expect(nameError!.focusNode.value).toBe("http://example.org/agent1");
  });
});

describe("session seeding", () => {
  it("seeds sh:defaultValue / sh:hasValue + targetClass type into a new focus node", async () => {
    const ttl = `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      ex:S a sh:NodeShape ; sh:targetClass ex:Thing ;
        sh:property [ sh:path ex:status ; sh:defaultValue "draft" ] ;
        sh:property [ sh:path ex:kind ; sh:hasValue ex:Dataset ] .
    `;
    // The single-graph runtime seeds directly into the session backend (createGraph).
    const engine = createRudofEngine();
    const shapes = await engine.loadShapes(ttl);
    const focus = namedNode("http://example.org/d1");
    const session = await engine.createGraph(shapes, undefined, undefined, focus, namedNode("http://example.org/S"));
    const objects = session.backend
      .match(session.focusNode, null, null)
      .map((q) => q.object.value)
      .sort();
    expect(objects).toContain("draft");
    expect(objects).toContain("http://example.org/Dataset");
    expect(objects).toContain("http://example.org/Thing"); // rdf:type from targetClass
  });
});

describe("serialization", () => {
  it("serializeFocus emits only the focus's subgraph, not unrelated subjects", async () => {
    const engine = createRudofEngine();
    await engine.loadData(`
      @prefix ex: <http://example.org/> .
      ex:d1 ex:title "Mine" ; ex:pub ex:p1 .
      ex:p1 ex:name "ACME" .
      ex:other ex:title "Unrelated" .
    `);
    const ttl = await engine.serializeFocus(namedNode("http://example.org/d1"), "text/turtle");
    expect(ttl).toContain("Mine"); // the focus record
    expect(ttl).toContain("ACME"); // its nested resource (reachable)
    expect(ttl).not.toContain("Unrelated"); // a different subject — excluded
  });

  it("round-trips Turtle output through rudof", async () => {
    const engine = createRudofEngine();
    const ttl = `
      @prefix dcterms: <http://purl.org/dc/terms/> .
      <http://example.org/d1> dcterms:title "Round trip" .
    `;
    await engine.loadData(ttl);
    const out = await engine.serialize("text/turtle");
    expect(out).toContain("Round trip");
    // Reload the serialized output: it parses and still carries the value.
    const engine2 = createRudofEngine();
    await engine2.loadData(out);
    expect(await engine2.serialize("text/turtle")).toContain("Round trip");
  });
});
