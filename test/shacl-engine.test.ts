import { describe, it, expect, beforeAll } from "vitest";
import { Store } from "n3";
import type { Term } from "@rdfjs/types";
import { buildFormModel } from "@/form/buildFormModel.js";
import type { Diagnostic, DiagnosticSink } from "@/form/buildFormModel.js";
import { createRudofEngine } from "@/engine/index.js";
import { projectTree } from "@/engine/projectTree.js";
import { Editors } from "@/form/vocab/shacl-ui.js";
import { allFields } from "@/form/FormModel.js";
import { computeFormReport } from "@/react/validation/useFormReport.js";
import type { FieldError, ValidationResult } from "@/form/validation.js";
import { mapResults } from "@/form/validation.js";
import { toJsonLd, toTurtle } from "@/engine/serialize.js";
import { parseTurtle } from "@/engine/parse.js";
import { namedNode } from "@/engine/factory.js";
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
  return buildFormModel({ shapes, focusNode, shape, locale: "en", onDiagnostic });
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
  const values = await projectTree((f, s) => engine.projectForm(f, s), model, rootIri, focusNode);
  return buildFormModel({ shapes: model, focusNode, shape, values, locale: "en" });
}

/** Validate a data graph against shapes, in rudof-over-WASM. */
async function validateAgainst(ttl: string, data: Store): Promise<ValidationResult[]> {
  const engine = createRudofEngine();
  await engine.loadShapes(ttl);
  await engine.loadData(await toTurtle(data.getQuads(null, null, null, null) as never));
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

  it("renders sh:inversePath as a read-only field with the inverse subjects", async () => {
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
    expect(children?.readOnly).toBe(true);
    expect(children?.values.map((v) => v.value?.value).sort()).toEqual([
      "http://example.org/c1",
      "http://example.org/c2",
    ]);
  });

  it("renders a complex path (sequence) as a read-only field with projected values", async () => {
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
    const field = allFields(model).find((f) => f.pathKind === "complex");
    expect(field).toBeDefined();
    expect(field?.readOnly).toBe(true);
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
      [title.id, [{ message: "Required", severity: "violation" } as FieldError]],
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

describe("serialization — JSON-LD is compacted by default", () => {
  it("returns compact form (with @context), not raw expanded quads", async () => {
    const data = new Store();
    data.addQuads(
      parseTurtle(`
        @prefix dcterms: <http://purl.org/dc/terms/> .
        <http://example.org/d1> dcterms:title "Hello" .
      `) as never[],
    );
    const jsonld = (await toJsonLd(data)) as Record<string, unknown>;
    expect(jsonld).not.toBeInstanceOf(Array);
    expect(jsonld["@context"]).toBeDefined();
  });
});

describe("SHACL validation", () => {
  it("reports missing required fields", async () => {
    const data = new Store();
    data.addQuads(
      parseTurtle(`
        @prefix dcat: <http://www.w3.org/ns/dcat#> .
        <http://example.org/d1> a dcat:Dataset .
      `) as never[],
    );
    const results = await validateAgainst(shapesTtl, data);
    const errors = mapResults(results);
    // title, description and publisher are required (minCount >= 1)
    const allMessages = [...errors.values()].flat();
    expect(allMessages.length).toBeGreaterThan(0);
    const titleKey = "http://example.org/d1|http://purl.org/dc/terms/title";
    expect(errors.has(titleKey)).toBe(true);
  });

  it("surfaces nested errors per node (typed nodes validated as targets)", async () => {
    const data = new Store();
    data.addQuads(
      parseTurtle(`
        @prefix dcat: <http://www.w3.org/ns/dcat#> .
        @prefix dcterms: <http://purl.org/dc/terms/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        <http://example.org/d1> a dcat:Dataset ;
          dcterms:title "T" ; dcterms:description "D" ;
          dcterms:publisher <http://example.org/agent1> .
        <http://example.org/agent1> a foaf:Agent .
      `) as never[],
    );
    const results = await validateAgainst(shapesTtl, data);
    // The Agent (publisher) is missing foaf:name (minCount 1) — reported on the
    // agent node, not the root dataset (no focus filter drops it).
    const nameError = results.find((r) => r.path?.value.endsWith("/name"));
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
    const shapes = await engine.parseShapes(ttl);
    const focus = namedNode("http://example.org/d1");
    const session = await engine.createGraph(shapes, [], focus, namedNode("http://example.org/S"));
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
  it("round-trips Turtle output", async () => {
    const data = new Store();
    data.addQuads(
      parseTurtle(`
        @prefix dcterms: <http://purl.org/dc/terms/> .
        <http://example.org/d1> dcterms:title "Round trip" .
      `) as never[],
    );
    const ttl = await toTurtle(data);
    expect(ttl).toContain("Round trip");
    const reparsed = parseTurtle(ttl);
    expect(reparsed.length).toBe(1);
  });
});
