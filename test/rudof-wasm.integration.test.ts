import { describe, it, expect, beforeAll } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Store } from "n3";
import { useMetadataForm } from "@/react/hooks/useMetadataForm.js";
import { createRudofShaclAdapter } from "@/core/rudof/adapter.js";
import { RudofEngine } from "@/core/rudof/RudofEngine.js";
import { namedNode, literal } from "@/core/rdf/factory.js";
import { buildFormModel } from "@/core/form/buildFormModel.js";
import { projectTree, projectTreeSync } from "@/core/rudof/projectTree.js";
import { allFields } from "@/core/schema/FormModel.js";
import { Editors } from "@/core/vocab/shacl-ui.js";
import type { RudofModule, RudofSession } from "@/core/rudof/abi.js";
import type { ProjectedForm } from "@/core/shape/ShapeIR.js";
import { healthDcatApShapes, healthDcatApRootShape, healthDcatApSampleData } from "@examples/health-dcat-ap/index.js";

/**
 * End-to-end against the REAL rudof wasm (built by `npm run build:wasm`). Proves
 * the wasm `Session` satisfies the `RudofModule`/`RudofSession` ABI through the
 * TS `RudofEngine` — the same assertions as the fake test, but on the real crate.
 *
 * Skipped automatically if the pkg hasn't been built yet (no fork `rudof_wasm/pkg`).
 */
const wasmDir = resolve(process.cwd(), "../rudof-fork/rudof_wasm/pkg") + "/";
const built = existsSync(wasmDir + "rudof_wasm.js") && existsSync(wasmDir + "rudof_wasm_bg.wasm");
const d = built ? describe : describe.skip;

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

d("RudofEngine over the REAL wasm", () => {
  let engine: RudofEngine;
  let wasmModule: RudofModule;

  beforeAll(async () => {
    const mod = (await import(/* @vite-ignore */ pathToFileURL(wasmDir + "rudof_wasm.js").href)) as typeof import("rudof-wasm");
    await mod.default({ module_or_path: readFileSync(wasmDir + "rudof_wasm_bg.wasm") } as never);
    wasmModule = { newSession: () => new mod.Session() as unknown as RudofSession };
    engine = new RudofEngine(async () => wasmModule);
    await engine.ready();
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

  it("exposes a live editable GraphBackend (add / match / remove / serialize)", async () => {
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
      data: new Store(),
      focusNode: namedNode("http://example.org/d1"),
      shape,
      locale: "en",
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
    const values = await projectTree(engine, model, healthDcatApRootShape, dataset);

    // Data store is EMPTY — all values come from rudof's projection.
    const form = buildFormModel({
      shapes: model,
      data: new Store(),
      focusNode: dataset,
      shape: model.nodeShapes.get(healthDcatApRootShape)!,
      locale: "en",
      values,
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

  it("drives useMetadataForm live via the rudof-backed SchemaAdapter (real wasm)", async () => {
    const adapter = createRudofShaclAdapter(new RudofEngine(async () => wasmModule));
    const { result } = renderHook(() =>
      useMetadataForm({
        shapes: healthDcatApShapes,
        data: healthDcatApSampleData,
        adapter,
        rootShape: healthDcatApRootShape,
        locale: "en",
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
      const values = await projectTree(engine, model, SHAPE, alice);
      return buildFormModel({ shapes: model, data: new Store(), focusNode: alice, shape, values });
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

    // Fully synchronous: projectTreeSync → buildFormModel, no await.
    const values = projectTreeSync((f, s) => engine.projectFormSync(f, s), model, SHAPE, alice);
    const form = buildFormModel({ shapes: model, data: new Store(), focusNode: alice, shape, values });
    expect(allFields(form).find((f) => f.path.value === `${EX}name`)?.values[0]?.value?.value).toBe("Alice");
  });
});
