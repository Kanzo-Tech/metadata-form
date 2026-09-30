import { describe, it, expect, beforeAll } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { useMetadataForm } from "@/react/hooks/useMetadataForm.js";
import { RudofEngine } from "@/engine/RudofEngine.js";
import { namedNode, literal } from "@/form/factory.js";
import { mapResults, type FieldError } from "@/form/validation.js";
import { catalogFromTriples, englishMessages, mergeCatalogs, resolveMessage, type MessageCatalog } from "@/i18n/messages.js";
import { es, ca } from "metadata-form/i18n";
import { computeFormReport } from "@/react/validation/formReport.js";
import { buildFormModel } from "@/form/buildFormModel.js";
import { projectTree } from "@/engine/projectTree.js";
import { allFields } from "@/form/FormModel.js";
import { Editors } from "@/form/vocab/shacl-ui.js";
import type { RudofModule, RudofSession } from "@/engine/abi.js";
import type { ProjectedForm } from "@/form/ShapeIR.js";
import { healthDcatApShapes, healthDcatApRootShape, healthDcatApSampleData } from "@examples/health-dcat-ap/index.js";

/**
 * End-to-end against the REAL rudof wasm (`@kanzo-tech/rudof-wasm`). Proves
 * the wasm `Session` satisfies the `RudofModule`/`RudofSession` ABI through the
 * TS `RudofEngine` — the same assertions as the fake test, but on the real crate.
 *
 * Runs against the published @kanzo-tech/rudof-wasm package (a declared dependency).
 */
const require = createRequire(import.meta.url);
const wasmDir = dirname(require.resolve("@kanzo-tech/rudof-wasm"));

const EX = "http://example.org/";
const SHAPE = `${EX}PersonShape`;
const shapesTtl = `
  @prefix sh:  <http://www.w3.org/ns/shacl#> .
  @prefix ex:  <${EX}> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  ex:PersonShape a sh:NodeShape ; sh:targetClass ex:Person ;
    sh:property [ sh:path ex:name ; sh:name "Name"@en ; sh:datatype xsd:string ; sh:minCount 1 ] ;
    sh:property [ sh:path ex:knows ; sh:class ex:Person ] ;
    sh:property [ sh:path [ sh:inversePath ex:knows ] ] ;
    sh:property [ sh:path ( ex:knows ex:name ) ] .
`;
const dataTtl = `
  @prefix ex: <${EX}> .
  ex:alice a ex:Person ; ex:name "Alice" ; ex:knows ex:bob .
  ex:bob   a ex:Person ; ex:name "Bob"   ; ex:knows ex:alice .
`;

const valuesFor = (form: ProjectedForm, key: string) =>
  form.properties.find((p) => p.pathKey === key)?.values.map((v) => v.value.value) ?? [];

describe("RudofEngine over the REAL wasm", () => {
  let engine: RudofEngine;
  let wasmModule: RudofModule;
  let catalog: MessageCatalog;
  /** The text of a failure for a reader of `languages`, as the form would show it. */
  const say = (e: Pick<FieldError, "messages" | "constraint">, ...languages: string[]) => resolveMessage(e, catalog, languages);

  beforeAll(async () => {
    const mod = await import("@kanzo-tech/rudof-wasm");
    await mod.default({ module_or_path: readFileSync(join(wasmDir, "rudof_wasm_bg.wasm")) } as never);
    wasmModule = { newSession: () => new mod.Session() as unknown as RudofSession };
    engine = new RudofEngine(async () => wasmModule);
    await engine.ready();
    const graphs = await Promise.all([englishMessages, es.messages, ca.messages].map((d) => engine.parseQuads(d)));
    catalog = mergeCatalogs(graphs.map(catalogFromTriples));
  });

  it("parses shapes into the IR (full paths + presentation)", async () => {
    const model = await engine.loadShapes(shapesTtl);
    const shape = model.nodeShapes.get(SHAPE);
    expect(shape?.targetClasses).toContain(`${EX}Person`);
    expect(shape?.properties).toHaveLength(4);
    const name = shape!.properties.find((p) => p.path.kind === "predicate" && p.path.iri === `${EX}name`);
    expect(name?.presentation.names[0]).toEqual({ value: "Name", language: "en" });
    expect(name?.value.datatype).toBe("http://www.w3.org/2001/XMLSchema#string");
  });

  it("projectForm evaluates predicate, inverse and sequence paths", async () => {
    await engine.loadShapes(shapesTtl);
    await engine.loadData(dataTtl);
    const form = await engine.projectForm(namedNode(`${EX}alice`), SHAPE);
    expect(valuesFor(form, `${EX}name`)).toEqual(["Alice"]);
    expect(valuesFor(form, `${EX}knows`)).toEqual([`${EX}bob`]);
    expect(valuesFor(form, `^${EX}knows`)).toEqual([`${EX}bob`]);
    expect(valuesFor(form, `(${EX}knows/${EX}name)`)).toEqual(["Bob"]);
  });

  it("validates the current graph against the shapes (real shacl validator in wasm)", async () => {
    await engine.loadShapes(shapesTtl);
    // ex:dave is a Person with no ex:name → violates sh:minCount 1.
    await engine.loadData(`
      @prefix ex: <${EX}> .
      ex:dave a ex:Person .
    `);
    const results = await engine.validate();
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.focusNode.value === `${EX}dave` && r.severity === "violation")).toBe(true);

    // Conforming data → no violations.
    await engine.loadData(dataTtl);
    expect(await engine.validate()).toHaveLength(0);
  });

  it("carries multilingual sh:message through the report and resolveMessage picks by language", async () => {
    // A minCount constraint with author messages in es + ca. The wasm merges the
    // engine's untagged default with these lang-tagged entries; the ABI must keep
    // the tags (not flatten), so mapResults can select the locale's wording.
    await engine.loadShapes(`
      @prefix sh:  <http://www.w3.org/ns/shacl#> .
      @prefix ex:  <${EX}> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      ex:PersonShape a sh:NodeShape ; sh:targetClass ex:Person ;
        sh:property [ sh:path ex:name ; sh:datatype xsd:string ; sh:minCount 1 ;
          sh:message "El nombre es obligatorio"@es , "El nom és obligatori"@ca ] .
    `);
    await engine.loadData(`@prefix ex: <${EX}> . ex:dave a ex:Person .`);
    const results = await engine.validate();
    const daveResult = results.find((r) => r.focusNode.value === `${EX}dave`);
    expect(daveResult).toBeTruthy();
    // The lang tags survived the ABI (the whole point of the fork change).
    const langs = daveResult!.messages.map((m) => m.language).sort();
    expect(langs).toEqual(expect.arrayContaining(["ca", "es"]));

    const key = `${EX}dave|${EX}name`;
    expect(say(mapResults(results).get(key)![0], "es")).toBe("El nombre es obligatorio");
    expect(say(mapResults(results).get(key)![0], "ca")).toBe("El nom és obligatori");
    // No author message for en → localized catalog default.
    expect(say(mapResults(results).get(key)![0], "en")).toBe("This field is required");
  });

  it("validateFocus scopes validation to a single focus node (the spine's validate_focus)", async () => {
    await engine.loadShapes(shapesTtl);
    // Two Persons, both missing ex:name → both violate sh:minCount 1.
    await engine.loadData(`
      @prefix ex: <${EX}> .
      ex:dave a ex:Person .
      ex:erin a ex:Person .
    `);
    // Whole-graph validation flags BOTH.
    const all = await engine.validate();
    expect(all.some((r) => r.focusNode.value === `${EX}dave`)).toBe(true);
    expect(all.some((r) => r.focusNode.value === `${EX}erin`)).toBe(true);

    // Scoped to dave → only dave's violation, erin excluded.
    const scoped = await engine.validateFocus(namedNode(`${EX}dave`), SHAPE);
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((r) => r.focusNode.value === `${EX}dave`)).toBe(true);

    // A conforming focus → no violations.
    await engine.loadData(dataTtl);
    expect(await engine.validateFocus(namedNode(`${EX}alice`), SHAPE)).toHaveLength(0);
  });

  it("exposes a live editable RudofGraphBackend (add / match / remove / serialize)", async () => {
    const graph = await engine.newGraph();
    const s = namedNode(`${EX}carol`);
    const p = namedNode(`${EX}name`);
    graph.add(s, p, literal("Carol"));
    expect(graph.match(s, p, null).map((q) => q.object.value)).toEqual(["Carol"]);
    expect(await graph.serialize("text/turtle")).toContain("Carol");
    graph.remove(s, p, literal("Carol"));
    expect(graph.match(s, p, null)).toHaveLength(0);
  });

  it("rudof's ShapeModel drives the existing buildFormModel (parse-side cutover)", async () => {
    const model = await engine.loadShapes(healthDcatApShapes);
    const shape = model.nodeShapes.get(healthDcatApRootShape)!;
    const form = buildFormModel({
      shapes: model,
      focusNode: namedNode("http://example.org/d1"),
      shape,
      languages: ["en"],
    });

    // Groups (labels read from the shapes graph by the wasm) flow through.
    expect(form.groups.map((g) => g.label)).toEqual([
      "General",
      "Provenance",
      "Health-specific",
      "Distributions",
    ]);

    // Editors resolve: shui:editor honored (TextArea/Details), heuristics for the rest.
    const fields = allFields(form);
    const byPath = (suffix: string) => fields.find((f) => f.path.value.endsWith(suffix));
    expect(byPath("/title")?.label).toBe("Title");
    expect(byPath("/description")?.editorId).toBe(Editors.TextArea); // shui:TextAreaEditor
    expect(byPath("/publisher")?.editorId).toBe(Editors.Details); // shui:DetailsEditor + sh:node
    expect(byPath("/issued")?.editorId).toBe(Editors.DatePicker); // xsd:date
    expect(byPath("numberOfRecords")?.editorId).toBe(Editors.NumberField); // xsd:integer
    expect(byPath("accessRights")?.editorId).toBe(Editors.EnumSelect); // sh:in
  });

  it("emits the editor of each kind of value, and where it came from", async () => {
    // What `emitted` in disjunction.test.tsx reproduces by hand, pinned to the engine.
    const kinds: [string, string, string][] = [
      ["sh:datatype xsd:double", Editors.NumberField, "scored"],
      ["sh:datatype xsd:string", Editors.TextField, "scored"],
      ["sh:datatype xsd:date", Editors.DatePicker, "scored"],
      ["sh:datatype xsd:dateTime", Editors.DateTimePicker, "scored"],
      ["sh:class ex:C", Editors.InstancesSelect, "scored"],
      ["sh:nodeKind sh:IRI", Editors.IRI, "scored"],
      ["sh:in ( ex:a ex:b )", Editors.EnumSelect, "scored"],
      ["sh:datatype xsd:string ; sh:singleLine false", Editors.TextArea, "scored"],
      ["sh:datatype xsd:anyURI", Editors.TextField, "fallback"],
      ["sh:datatype xsd:positiveInteger", Editors.TextField, "fallback"],
      ["sh:node ex:PersonShape", Editors.Details, "fallback"],
      ["shui:editor shui:RichTextEditor", Editors.RichText, "declared"],
    ];
    const properties = kinds.map(([facts], i) => `sh:property [ sh:path ex:p${i} ; ${facts} ]`).join(" ; ");
    const model = await engine.loadShapes(`
      @prefix sh: <http://www.w3.org/ns/shacl#> . @prefix ex: <${EX}> .
      @prefix shui: <http://www.w3.org/ns/shacl-ui/> . @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      ex:PersonShape a sh:NodeShape .
      ex:Kinds a sh:NodeShape ; ${properties} .
    `);
    const emitted = model.nodeShapes.get(`${EX}Kinds`)!.properties
      .sort((a, b) => a.pathKey.localeCompare(b.pathKey, "en", { numeric: true }))
      .map((p) => [p.presentation.editor, p.presentation.editorSource]);
    expect(emitted).toEqual(kinds.map(([, editor, source]) => [editor, source]));
  });

  it("projectForm pulls real values (incl. a nested resource) from the data graph", async () => {
    await engine.loadShapes(healthDcatApShapes);
    await engine.loadData(healthDcatApSampleData);
    const dataset = namedNode("http://example.org/dataset/covid-registry");
    const form = await engine.projectForm(dataset, healthDcatApRootShape);

    const prop = (suffix: string) =>
      form.properties.find((p) => p.pathKey.endsWith(suffix));
    // A literal property has its value.
    expect(prop("/title")?.values[0]?.value.value).toBeTruthy();
    // A sh:node property exposes a nested sub-focus to recurse into.
    const publisher = prop("/publisher");
    expect(publisher?.values[0]?.nested).toBeTruthy();
  });

  it("builds a full FormModel from rudof alone (parse + recursive projection, no n3 values)", async () => {
    const model = await engine.loadShapes(healthDcatApShapes);
    await engine.loadData(healthDcatApSampleData);
    const dataset = namedNode("http://example.org/dataset/covid-registry");
    const { values, satisfied } = projectTree((f, s) => engine.projectFormSync(f, s), model, healthDcatApRootShape, dataset);

    // Data store is EMPTY — all values come from rudof's projection.
    const form = buildFormModel({
      shapes: model,
      focusNode: dataset,
      shape: model.nodeShapes.get(healthDcatApRootShape)!,
      languages: ["en"],
      values,
      satisfied,
    });

    const fields = allFields(form);
    expect(fields.find((f) => f.path.value.endsWith("/title"))?.values[0]?.value?.value).toBeTruthy();

    // Nested publisher sub-form is populated from the recursive projection.
    const publisher = fields.find((f) => f.path.value.endsWith("/publisher"));
    const nested = publisher?.values[0]?.nested;
    expect(nested).toBeTruthy();
    const nestedName = nested ? allFields(nested).find((f) => f.path.value.endsWith("name")) : undefined;
    expect(nestedName?.values[0]?.value?.value).toBeTruthy();
  });

  it("drives useMetadataForm live via the rudof engine (real wasm)", async () => {
    // Hoist the engine so it's a stable reference across renders (an inline
    // `new RudofEngine` would re-fire the parse effect on every render → loop).
    const liveEngine = new RudofEngine(async () => wasmModule);
    const { result } = renderHook(() =>
      useMetadataForm({
        shapes: healthDcatApShapes,
        data: healthDcatApSampleData,
        engine: liveEngine,
        rootShape: healthDcatApRootShape,
        locale: ["en"],
        validateOn: "off",
      }),
    );

    await waitFor(() => expect(result.current.ready).toBe(true), { timeout: 5000 });

    const fields = result.current.model ? allFields(result.current.model) : [];
    // Shapes parsed by rudof drive the live form: labels, SHACL-UI editors, values.
    expect(fields.find((f) => f.path.value.endsWith("/title"))?.label).toBe("Title");
    expect(fields.find((f) => f.path.value.endsWith("/description"))?.editorId).toBe(Editors.TextArea);
    expect(fields.find((f) => f.path.value.endsWith("/title"))?.values[0]?.value?.value).toBeTruthy();
  });

  it("single-graph edit cycle: mutate the rudof graph → re-project → FormModel reflects it (no n3)", async () => {
    const model = await engine.loadShapes(shapesTtl);
    const shape = model.nodeShapes.get(SHAPE)!;
    const graph = await engine.newGraph(); // the empty rudof graph IS the source of truth
    const alice = namedNode(`${EX}alice`);
    const namePred = namedNode(`${EX}name`);

    const rebuild = async () => {
      const { values, satisfied } = projectTree((f, s) => engine.projectFormSync(f, s), model, SHAPE, alice);
      return buildFormModel({ shapes: model, focusNode: alice, shape, values, satisfied });
    };
    const nameValues = (form: { groups: { fields: { path: { value: string }; values: { value: { value: string } | null }[] }[] }[] }) =>
      allFields(form as never).find((f) => f.path.value === `${EX}name`)?.values.map((v) => v.value?.value) ?? [];

    expect(nameValues(await rebuild())).toEqual([]); // empty graph → no value

    // EDIT through the rudof graph (the single source), then re-project.
    graph.add(alice, namePred, literal("Alice"));
    expect(nameValues(await rebuild())).toEqual(["Alice"]); // FormModel now reflects the edit

    // REMOVE through the rudof graph.
    graph.remove(alice, namePred, literal("Alice"));
    expect(nameValues(await rebuild())).toEqual([]);
  });

  it("sync rebuild: project + buildFormModel with NO await (the React useMemo path)", async () => {
    const model = await engine.loadShapes(shapesTtl);
    const shape = model.nodeShapes.get(SHAPE)!;
    const graph = await engine.newGraph();
    const alice = namedNode(`${EX}alice`);
    await engine.ready(); // sync projection requires ready to have resolved

    graph.add(alice, namedNode(`${EX}name`), literal("Alice"));

    // Fully synchronous: projectTree → buildFormModel, no await.
    const { values, satisfied } = projectTree((f, s) => engine.projectFormSync(f, s), model, SHAPE, alice);
    const form = buildFormModel({ shapes: model, focusNode: alice, shape, values, satisfied });
    expect(allFields(form).find((f) => f.path.value === `${EX}name`)?.values[0]?.value?.value).toBe("Alice");
  });

  it("validateTree recovers a violation inside an untargeted sh:node shape, and D7 drops the rollup", async () => {
    // The Evidenze shapes deliberately give nested shapes no sh:targetClass, so
    // nothing targets ex:AgentShape: whole-graph validate() reaches it by no
    // target, and rudof's sh:node handler keeps only a boolean. Both paths lose
    // "Name is required" — validateTree is the only one that finds it.
    const nestedShapes = `
      @prefix sh:  <http://www.w3.org/ns/shacl#> .
      @prefix ex:  <${EX}> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      ex:DatasetShape a sh:NodeShape ; sh:targetClass ex:Dataset ;
        sh:property [ sh:path ex:publisher ; sh:name "Publisher"@en ; sh:node ex:AgentShape ; sh:minCount 1 ] .
      ex:AgentShape a sh:NodeShape ;
        sh:property [ sh:path ex:name ; sh:name "Name"@en ; sh:datatype xsd:string ; sh:minCount 1 ] .
    `;
    const model = await engine.loadShapes(nestedShapes);
    await engine.loadData(`@prefix ex: <${EX}> . ex:d1 a ex:Dataset ; ex:publisher [ a ex:Agent ] .`);
    const d1 = namedNode(`${EX}d1`);

    const whole = await engine.validate();
    expect(whole).toHaveLength(1);
    expect(whole[0].constraint).toBe("http://www.w3.org/ns/shacl#NodeConstraintComponent");

    const tree = projectTree((f, s) => engine.projectFormSync(f, s), model, `${EX}DatasetShape`, d1);
    expect(tree.nodes.map((n) => n.shapeId)).toEqual([`${EX}DatasetShape`, `${EX}AgentShape`]);

    const results = await engine.validateTree(tree.nodes);
    const inner = results.find((r) => r.constraint?.endsWith("MinCountConstraintComponent"));
    expect(inner?.pathKey).toBe(`${EX}name`);

    // D7: the report keeps the actionable inner row and drops the outer rollup.
    const form = buildFormModel({
      shapes: model,
      focusNode: d1,
      shape: model.nodeShapes.get(`${EX}DatasetShape`)!,
      languages: ["en"],
      values: tree.values,
      satisfied: tree.satisfied,
    });
    const report = computeFormReport(form, mapResults(results));
    expect(report.issues.rows.map((r) => say(r, "en"))).toEqual(["At least 1 value(s) required"]);
    expect(report.issues.rows[0].label).toBe("Publisher › Name");
    expect(report.issues.rows[0].constraint).toBe("http://www.w3.org/ns/shacl#MinCountConstraintComponent");
  });

  /**
   * The cure for M6, and the reason `@kanzo-tech/rudof-wasm` was republished
   * (fork `c4362e002`): every constraint component that builds its own
   * `ValidationResult` used to drop the shape's `sh:message`, so a multilingual
   * message on a `sh:node` property shape never reached a reader — 14 of 30
   * components, on exactly the path the i18n work was built for.
   *
   * Two halves, both pinned here because nothing else pins either:
   *  - the author's messages arrive lang-TAGGED, so `resolveMessage` can pick by
   *    locale (untagged engine text is excluded from that choice by design);
   *  - `sh:node`'s own untagged default names the shape's ID and no longer
   *    `Display`s the whole `IRShape`. The dump M6 reported verbatim
   *    ("Node(NodeShape Targets: … Property Shapes: [22, 13, 23])") is gone.
   */
  it("keeps the shape's multilingual sh:message on a sh:node violation", async () => {
    await engine.loadShapes(`
      @prefix sh:  <http://www.w3.org/ns/shacl#> .
      @prefix ex:  <${EX}> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      ex:AgentShape a sh:NodeShape ;
        sh:property [ sh:path ex:name ; sh:datatype xsd:string ; sh:minCount 1 ] .
      ex:DatasetShape a sh:NodeShape ; sh:targetClass ex:Dataset ;
        sh:property [ sh:path ex:publisher ; sh:node ex:AgentShape ;
                      sh:message "El publicador está incompleto"@es ;
                      sh:message "The publisher is incomplete"@en ] .
    `);
    await engine.loadData(`@prefix ex: <${EX}> . ex:d1 a ex:Dataset ; ex:publisher ex:p1 . ex:p1 a ex:Agent .`);

    const [result] = await engine.validate();
    expect(result.constraint).toBe("http://www.w3.org/ns/shacl#NodeConstraintComponent");

    const tagged = new Map(result.messages.filter((m) => m.language).map((m) => [m.language, m.value]));
    expect(tagged.get("es")).toBe("El publicador está incompleto");
    expect(tagged.get("en")).toBe("The publisher is incomplete");

    // And ONLY those. SHACL 2.1.5: where a shape declares any `sh:message`, the
    // result carries exactly them — a generated one may be added only when the
    // shape is silent (3.6.2.7). This assertion is the inverse of what it said
    // when it was written against 0.3.5, which asserted the untagged engine text
    // sat alongside the author's; that was the defect, not the contract, and the
    // fix landed in 0.3.6. A test written from observed behaviour pins whatever
    // the engine did that day, including its bugs.
    expect(result.messages.filter((m) => !m.language)).toEqual([]);

    // And that is what a reader gets, per locale.
    const publisher = mapResults([result]).get(`${EX}d1|${EX}publisher`)![0];
    expect(say(publisher, "es")).toBe("El publicador está incompleto");
    expect(say(publisher, "en"))
      .toBe("The publisher is incomplete");
  });


  /**
   * A violation on a complex path must name the field it is about.
   *
   * `path` on a result is a TERM, and only a predicate is one, so every inverse,
   * sequence, alternative and quantified path arrived with no path at all and
   * `mapResults` filed it under the node-level key. The user got "something in
   * here is wrong" from a form that knew exactly what was wrong — the same
   * defect M6 reported for `sh:node`, entering through a different door.
   *
   * It was survivable while those fields were read-only. It stopped being
   * survivable when they became editable: Bioschemas alone contributes 530
   * alternative-path fields and they carry `sh:minCount 1`.
   *
   * `pathKey` is produced by `shapes::path_key` — the SAME serialiser that keys
   * the projected fields. Not a second implementation that agrees today.
   */
  it("reports a complex-path violation against the field, not the node", async () => {
    await engine.loadShapes(`
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <${EX}> .
      ex:OwnedShape a sh:NodeShape ; sh:targetClass ex:Owned ;
        sh:property [ sh:path [ sh:inversePath ex:owns ] ; sh:minCount 1 ] .
    `);
    await engine.loadData(`@prefix ex: <${EX}> . ex:thing a ex:Owned .`);

    const [result] = await engine.validate();
    expect(result.constraint).toBe("http://www.w3.org/ns/shacl#MinCountConstraintComponent");

    // A term cannot express it; the key can, and it is the canonical one.
    expect(result.pathKey).toBe(`^${EX}owns`);

    // And that is what makes it land on a field instead of on the node.
    const byField = mapResults([result]);
    expect([...byField.keys()]).toEqual([`${EX}thing|^${EX}owns`]);
    expect([...byField.keys()]).not.toContain(`${EX}thing|`);
  });


  /**
   * The other half of M6, and it needs a SILENT shape to be visible at all.
   *
   * The reported defect was an engine dump reaching a person —
   * "Node(NodeShape Targets: - targetClass(...) Property Shapes: [22, 13, 23])"
   * — because `sh:node` printed `Display for IRShape`. The engine's catalog words
   * it in every language now, and names no shape at all.
   *
   * That guard used to live in the test above, which is exactly where it could
   * not survive: once §2.1.5 was honoured, a shape declaring its own messages
   * stopped carrying any generated text, so there was no default left to
   * inspect. The guard was not wrong, it was attached to the wrong case.
   */
  it("words a shape-based failure in the catalog rather than dumping the shape", async () => {
    await engine.loadShapes(`
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <${EX}> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      ex:QuietAgentShape a sh:NodeShape ;
        sh:property [ sh:path ex:name ; sh:datatype xsd:string ; sh:minCount 1 ] .
      ex:QuietDatasetShape a sh:NodeShape ; sh:targetClass ex:QuietDataset ;
        sh:property [ sh:path ex:publisher ; sh:node ex:QuietAgentShape ] .
    `);
    await engine.loadData(
      `@prefix ex: <${EX}> . ex:qd a ex:QuietDataset ; ex:publisher ex:qp . ex:qp a ex:Agent .`,
    );

    const [result] = await engine.validate();
    const generated = result.messages.find((m) => m.language === "en")?.value ?? "";

    expect(generated).toBe("Value does not meet the requirements of the referenced shape");
    expect(generated).not.toContain("NodeShape Targets");
    expect(generated).not.toContain("Property Shapes:");
  });
});
