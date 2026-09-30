import { describe, it, expect } from "vitest";
import { createRudofEngine } from "@/engine/index.js";
import { projectTree } from "@/engine/projectTree.js";
import { buildFormModel } from "@/form/buildFormModel.js";
import { allFields } from "@/form/FormModel.js";
import { computeFormReport } from "@/react/validation/formReport.js";
import { mapResults } from "@/form/validation.js";
import { namedNode, literal } from "@/form/factory.js";
import { evidenzeShapes, evidenzeRootShape } from "@examples/evidenze-dataspace/index.js";
import { evidenzeHealthShapes, evidenzeHealthRootShape } from "@examples/evidenze-health/index.js";

/**
 * End-to-end conditional rendering through the REAL rudof wasm: the Evidenze shape states a conditional as the
 * standard implication `sh:or ( [ sh:not C ] T )` (SHACL Core §4.6.1, §4.6.3), which reveals the
 * `evds:accessJustification` field only when the focus's `dct:accessRights` is
 * RESTRICTED. rudof evaluates the condition and reports it via `satisfied`; the
 * form gains/loses the field with no per-field logic on the JS side, and the
 * branch's own validation result reaches the field inline.
 */

const ACCESS = "http://purl.org/dc/terms/accessRights";
const RESTRICTED = "http://publications.europa.eu/resource/authority/access-right/RESTRICTED";
const PUBLIC = "http://publications.europa.eu/resource/authority/access-right/PUBLIC";
const JUSTIFICATION = "https://dataspace.evidenze.example/ns#accessJustification";
const STRUCTURED = "http://healthdataportal.eu/ns/health#hasStructuredData";
const VARIABLES = "http://healthdataportal.eu/ns/health#hasVariables";
const XSD_BOOLEAN = "http://www.w3.org/2001/XMLSchema#boolean";
const SH = "http://www.w3.org/ns/shacl#";

async function open(shapesTtl: string, rootShape: string) {
  const engine = createRudofEngine();
  const shapes = await engine.loadShapes(shapesTtl);
  const session = await engine.createGraph(shapes, undefined, undefined, undefined, namedNode(rootShape));
  const focus = session.focusNode;
  const rebuild = async () => {
    const tree = projectTree((f, s) => engine.projectFormSync(f, s), shapes, session.rootShapeId, focus);
    const model = buildFormModel({
      shapes,
      focusNode: focus,
      shape: shapes.nodeShapes.get(session.rootShapeId)!,
      values: tree.values,
      satisfied: tree.satisfied,
      languages: ["es"],
    });
    const results = await engine.validateTree(tree.nodes);
    return { tree, model, results, report: computeFormReport(model, mapResults(results)) };
  };
  return { engine, shapes, session, focus, rebuild };
}

describe("conditional rendering as a SHACL Core implication — real rudof wasm", () => {
  it("reveals the then field only when the condition holds; satisfied flag flips live", async () => {
    const { session, focus, rebuild } = await open(evidenzeShapes, evidenzeRootShape);

    // No accessRights yet → condition false → justification hidden.
    const before = await rebuild();
    expect(allFields(before.model).map((f) => f.path.value)).not.toContain(JUSTIFICATION);
    expect(before.tree.satisfied.get(focus.value)?.size ?? 0).toBe(0);

    // Choose RESTRICTED → rudof reports the condition satisfied → field appears, required.
    session.backend.add(focus, namedNode(ACCESS), namedNode(RESTRICTED));
    const restricted = await rebuild();
    const justification = allFields(restricted.model).find((f) => f.path.value === JUSTIFICATION);
    expect(justification).toBeTruthy();
    expect(justification!.required).toBe(true);
    expect(justification!.guard).toMatchObject({ branch: "then" });
    expect(restricted.tree.satisfied.get(focus.value)?.size ?? 0).toBe(1);

    // Switch to PUBLIC → condition false again → field disappears, and the form is valid.
    session.backend.remove(focus, namedNode(ACCESS), namedNode(RESTRICTED));
    session.backend.add(focus, namedNode(ACCESS), namedNode(PUBLIC));
    const pub = await rebuild();
    expect(allFields(pub.model).map((f) => f.path.value)).not.toContain(JUSTIFICATION);
    expect(pub.results.filter((r) => r.pathKey === JUSTIFICATION || r.constraint === `${SH}OrConstraintComponent`)).toEqual([]);
  });

  it("RESTRICTED without a justification: one inline MinCount with the author's message, no sh:or rollup", async () => {
    const { session, focus, rebuild } = await open(evidenzeShapes, evidenzeRootShape);
    session.backend.add(focus, namedNode(ACCESS), namedNode(RESTRICTED));
    const { tree, results, report } = await rebuild();

    expect(tree.nodes.filter((n) => n.branchOf)).toHaveLength(1);
    const onJustification = results.filter((r) => r.pathKey === JUSTIFICATION);
    expect(onJustification).toHaveLength(1);
    expect(onJustification[0].constraint).toBe(`${SH}MinCountConstraintComponent`);
    expect(onJustification[0].messages.some((m) => m.language === "es")).toBe(true);
    expect(results.filter((r) => r.constraint === `${SH}OrConstraintComponent` && !r.pathKey)).toEqual([]);

    const rows = report.issues.rows.filter((r) => r.key === `${focus.value}|${JUSTIFICATION}`);
    expect(rows).toHaveLength(1);
    expect(rows[0].messages.find((m) => m.language === "es")?.value).toMatch(/motivo del acceso restringido/);
  });

  it("HealthDCAT-AP: structured data without a variable dictionary reports on the dictionary field only", async () => {
    const { session, focus, rebuild } = await open(evidenzeHealthShapes, evidenzeHealthRootShape);
    expect(allFields((await rebuild()).model).map((f) => f.path.value)).not.toContain(VARIABLES);

    session.backend.add(focus, namedNode(STRUCTURED), literal("true", namedNode(XSD_BOOLEAN)));
    const { model, results, report } = await rebuild();
    expect(allFields(model).map((f) => f.path.value)).toContain(VARIABLES);
    const onVariables = results.filter((r) => r.pathKey === VARIABLES);
    expect(onVariables).toHaveLength(1);
    expect(onVariables[0].constraint).toBe(`${SH}MinCountConstraintComponent`);
    expect(results.filter((r) => r.constraint === `${SH}OrConstraintComponent` && !r.pathKey)).toEqual([]);
    expect(report.issues.rows.find((r) => r.key === `${focus.value}|${VARIABLES}`)?.messages.find((m) => m.language === "es")?.value).toMatch(/diccionario de variables/i);
  });

  it("an anonymous-branch implication validates its branch through the blank-node thenId", async () => {
    const ttl = `
      @prefix sh: <${SH}> .
      @prefix ex: <http://example.org/> .
      ex:S a sh:NodeShape ; sh:targetClass ex:T ;
        sh:property [ sh:path ex:flag ; sh:name "Flag"@en ] ;
        sh:or ( [ sh:not [ sh:property [ sh:path ex:flag ; sh:hasValue true ] ] ]
                [ sh:property [ sh:path ex:extra ; sh:name "Extra"@en ; sh:minCount 1 ;
                                sh:message "Extra is required when flagged"@en ] ] ) .
    `;
    const engine = createRudofEngine();
    const shapes = await engine.loadShapes(ttl);
    const cond = shapes.nodeShapes.get("http://example.org/S")!.conditionals?.[0];
    expect(cond?.thenId).toMatch(/^_:/);
    await engine.loadData(`@prefix ex: <http://example.org/> . ex:x a ex:T ; ex:flag true .`);
    const x = namedNode("http://example.org/x");
    const tree = projectTree((f, s) => engine.projectFormSync(f, s), shapes, "http://example.org/S", x);
    expect(tree.nodes[1]).toMatchObject({ shapeId: cond!.thenId, branchOf: "http://example.org/S" });
    const results = await engine.validateTree(tree.nodes);
    expect(results.map((r) => r.pathKey)).toEqual(["http://example.org/extra"]);
  });

  it("the shapes state the conditional in SHACL Core, not as sh:if", () => {
    for (const ttl of [evidenzeShapes, evidenzeHealthShapes]) {
      expect(ttl).not.toMatch(/sh:(if|then|else)\b/);
      expect(ttl).toMatch(/sh:or\s*\(\s*\[\s*sh:not\b/);
    }
  });

  it("the whole shape is DASH-free (pure shui: + SHACL Core)", () => {
    expect(evidenzeShapes).not.toMatch(/datashapes\.org\/dash/);
    expect(evidenzeShapes).not.toMatch(/\bdash:/);
    expect(evidenzeShapes).toMatch(/shui:editor/);
  });
});
