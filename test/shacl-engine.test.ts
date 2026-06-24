import { describe, it, expect } from "vitest";
import { Store } from "n3";
import { shaclAdapter } from "@/core/adapters/shacl/index.js";
import { Editors } from "@/core/editors/ids.js";
import { allFields } from "@/core/schema/FormModel.js";
import { computeFormReport } from "@/react/validation/useFormReport.js";
import type { FieldError } from "@/core/schema/validation.js";
import { mapResults } from "@/core/validation/mapResults.js";
import { toJsonLd, toTurtle } from "@/core/rdf/serialize.js";
import type { Diagnostic } from "@/core/schema/SchemaAdapter.js";
import { parseTurtle } from "@/core/rdf/parse.js";
import { namedNode } from "@/core/rdf/factory.js";
import { healthDcatApShapes, healthDcatApRootShape } from "@examples/health-dcat-ap/index.js";

const shapesTtl = healthDcatApShapes;
const rootShape = namedNode(healthDcatApRootShape);

function build(dataStore: Store, focusNode = namedNode("http://example.org/d1")) {
  const schema = shaclAdapter.parseSchema(shapesTtl);
  const model = shaclAdapter.buildFormModel({
    schema,
    data: dataStore,
    focusNode,
    rootShape,
    locale: "en",
  });
  return { schema, model };
}

describe("SHACL → FormModel", () => {
  it("builds ordered groups and fields from the profile", () => {
    const { model } = build(new Store());
    const groupLabels = model.groups.map((g) => g.label);
    expect(groupLabels).toEqual(["General", "Provenance", "Health-specific", "Distributions"]);

    const fields = allFields(model);
    const title = fields.find((f) => f.path.value.endsWith("/title"));
    expect(title?.label).toBe("Title");
    expect(title?.required).toBe(true);
    expect(title?.editorId).toBe(Editors.TextField);
  });

  it("selects DASH editors via heuristics", () => {
    const { model } = build(new Store());
    const fields = allFields(model);
    const byPath = (suffix: string) => fields.find((f) => f.path.value.endsWith(suffix));

    expect(byPath("/description")?.editorId).toBe(Editors.TextArea);
    expect(byPath("/issued")?.editorId).toBe(Editors.DatePicker);
    expect(byPath("accessRights")?.editorId).toBe(Editors.EnumSelect);
    expect(byPath("/publisher")?.editorId).toBe(Editors.Details);
    expect(byPath("numberOfRecords")?.editorId).toBe(Editors.TextField);
  });

  it("projects existing values from the data graph", () => {
    const data = new Store();
    data.addQuads(
      parseTurtle(`
        @prefix dcterms: <http://purl.org/dc/terms/> .
        <http://example.org/d1> dcterms:title "Hello" .
      `) as never[],
    );
    const { model } = build(data);
    const title = allFields(model).find((f) => f.path.value.endsWith("/title"));
    expect(title?.values.map((v) => v.value?.value)).toEqual(["Hello"]);
  });

  it("marks multi-value properties repeatable and projects all values", () => {
    const data = new Store();
    data.addQuads(
      parseTurtle(`
        @prefix dcat: <http://www.w3.org/ns/dcat#> .
        <http://example.org/d1> dcat:keyword "a", "b", "c" .
      `) as never[],
    );
    const { model } = build(data);
    const keyword = allFields(model).find((f) => f.path.value.endsWith("keyword"));
    expect(keyword?.repeatable).toBe(true);
    expect(keyword?.values.map((v) => v.value?.value).sort()).toEqual(["a", "b", "c"]);
  });

  it("renders sh:inversePath as a read-only field with the inverse subjects", () => {
    const shape = `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      ex:S a sh:NodeShape ; sh:targetClass ex:Thing ;
        sh:property [ sh:path [ sh:inversePath ex:parent ] ; sh:name "Children" ] .
    `;
    const data = new Store();
    data.addQuads(
      parseTurtle(`
        @prefix ex: <http://example.org/> .
        ex:c1 ex:parent ex:d1 .
        ex:c2 ex:parent ex:d1 .
      `) as never[],
    );
    const schema = shaclAdapter.parseSchema(shape);
    const model = shaclAdapter.buildFormModel({
      schema,
      data,
      focusNode: namedNode("http://example.org/d1"),
      rootShape: namedNode("http://example.org/S"),
      locale: "en",
    });
    const children = allFields(model).find((f) => f.label === "Children");
    expect(children?.readOnly).toBe(true);
    expect(children?.values.map((v) => v.value?.value).sort()).toEqual([
      "http://example.org/c1",
      "http://example.org/c2",
    ]);
  });

  it("builds nested sub-forms for sh:node properties", () => {
    const data = new Store();
    data.addQuads(
      parseTurtle(`
        @prefix dcterms: <http://purl.org/dc/terms/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        <http://example.org/d1> dcterms:publisher <http://example.org/agent1> .
        <http://example.org/agent1> foaf:name "ACME" .
      `) as never[],
    );
    const { model } = build(data);
    const publisher = allFields(model).find((f) => f.path.value.endsWith("/publisher"));
    const nested = publisher?.values[0]?.nested;
    expect(nested).toBeDefined();
    const name = nested && allFields(nested).find((f) => f.path.value.endsWith("/name"));
    expect(name?.values[0]?.value?.value).toBe("ACME");
  });
});

describe("computeFormReport (single derived state)", () => {
  it("derives issues (rows + per-group), completion and health from one source", () => {
    const { model } = build(new Store());
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
  function diagnosticsFor(shape: string): Diagnostic[] {
    const diags: Diagnostic[] = [];
    shaclAdapter.buildFormModel({
      schema: shaclAdapter.parseSchema(shape),
      data: new Store(),
      focusNode: namedNode("http://example.org/d1"),
      rootShape: namedNode("http://example.org/S"),
      locale: "en",
      onDiagnostic: (d) => diags.push(d),
    });
    return diags;
  }

  it("reports a sh:node pointing at a missing shape", () => {
    const diags = diagnosticsFor(`
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      ex:S a sh:NodeShape ; sh:targetClass ex:Thing ;
        sh:property [ sh:path ex:child ; sh:node ex:Missing ] .
    `);
    expect(diags.some((d) => d.code === "missing-shape")).toBe(true);
  });

  it("reports a dropped unsupported complex path (sequence)", () => {
    const diags = diagnosticsFor(`
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      ex:S a sh:NodeShape ; sh:targetClass ex:Thing ;
        sh:property [ sh:path ( ex:a ex:b ) ] .
    `);
    expect(diags.some((d) => d.code === "unsupported-path")).toBe(true);
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
    const schema = shaclAdapter.parseSchema(shapesTtl);
    const validator = shaclAdapter.createValidator(schema);
    const results = await validator.validate({ data: data.getQuads(null, null, null, null) });
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
    const schema = shaclAdapter.parseSchema(shapesTtl);
    const validator = shaclAdapter.createValidator(schema);
    const results = await validator.validate({ data: data.getQuads(null, null, null, null) });
    // The Agent (publisher) is missing foaf:name (minCount 1) — reported on the
    // agent node, not the root dataset (no focus filter drops it).
    const nameError = results.find((r) => r.path?.value.endsWith("/name"));
    expect(nameError).toBeDefined();
    expect(nameError!.focusNode.value).toBe("http://example.org/agent1");
  });
});

describe("seedFocusNode", () => {
  it("seeds sh:defaultValue / sh:hasValue into an empty focus node", () => {
    const ttl = `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      ex:S a sh:NodeShape ; sh:targetClass ex:Thing ;
        sh:property [ sh:path ex:status ; sh:defaultValue "draft" ] ;
        sh:property [ sh:path ex:kind ; sh:hasValue ex:Dataset ] .
    `;
    const schema = shaclAdapter.parseSchema(ttl);
    const store = new Store();
    const focus = namedNode("http://example.org/d1");
    shaclAdapter.seedFocusNode!(schema, store, focus, namedNode("http://example.org/S"));
    const objects = store
      .getQuads(focus, null, null, null)
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
