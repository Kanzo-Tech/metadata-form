import { describe, it, expect } from "vitest";
import { createRudofEngine } from "@/engine/index.js";
import { projectTree } from "@/engine/projectTree.js";
import { buildFormModel } from "@/form/buildFormModel.js";
import { allFields } from "@/form/FormModel.js";
import { namedNode } from "@/form/factory.js";
import { evidenzeShapes, evidenzeRootShape } from "@examples/evidenze-dataspace/index.js";

/**
 * End-to-end conditional rendering through the REAL rudof wasm: the Evidenze shape's `sh:if`/`sh:then` reveals the
 * `evds:accessJustification` field only when the focus's `dct:accessRights` is
 * RESTRICTED. rudof evaluates the condition and reports it via `satisfied`; the
 * form gains/loses the field with no per-field logic on the JS side.
 */

const ACCESS = "http://purl.org/dc/terms/accessRights";
const RESTRICTED = "http://publications.europa.eu/resource/authority/access-right/RESTRICTED";
const PUBLIC = "http://publications.europa.eu/resource/authority/access-right/PUBLIC";
const JUSTIFICATION = "https://dataspace.evidenze.example/ns#accessJustification";

describe("SHACL 1.2 conditional rendering — real rudof wasm", () => {
  it("reveals sh:then field only when the condition holds; satisfied flag flips live", async () => {
    const engine = createRudofEngine();
    const shapes = await engine.loadShapes(evidenzeShapes);
    const session = await engine.createGraph(shapes, undefined, undefined, undefined, namedNode(evidenzeRootShape));
    const focus = session.focusNode;

    const rebuild = async () => {
      const { values, satisfied } = projectTree(
        (f, s) => engine.projectFormSync(f, s),
        shapes,
        session.rootShapeId,
        focus,
      );
      const model = buildFormModel({
        shapes,
        focusNode: focus,
        shape: shapes.nodeShapes.get(session.rootShapeId)!,
        values,
        satisfied,
        languages: ["es"],
      });
      return { model, satisfied };
    };

    // No accessRights yet → condition false → justification hidden.
    const before = await rebuild();
    expect(allFields(before.model).map((f) => f.path.value)).not.toContain(JUSTIFICATION);
    expect(before.satisfied.get(focus.value)?.size ?? 0).toBe(0);

    // Choose RESTRICTED → rudof reports the condition satisfied → field appears, required.
    session.backend.add(focus, namedNode(ACCESS), namedNode(RESTRICTED));
    const restricted = await rebuild();
    const justification = allFields(restricted.model).find((f) => f.path.value === JUSTIFICATION);
    expect(justification).toBeTruthy();
    expect(justification!.required).toBe(true);
    expect(justification!.guard).toMatchObject({ branch: "then" });
    expect(restricted.satisfied.get(focus.value)?.size ?? 0).toBe(1);

    // Switch to PUBLIC → condition false again → field disappears.
    session.backend.remove(focus, namedNode(ACCESS), namedNode(RESTRICTED));
    session.backend.add(focus, namedNode(ACCESS), namedNode(PUBLIC));
    const pub = await rebuild();
    expect(allFields(pub.model).map((f) => f.path.value)).not.toContain(JUSTIFICATION);
  });

  it("the whole shape is DASH-free (pure shui: + SHACL 1.2)", () => {
    expect(evidenzeShapes).not.toMatch(/datashapes\.org\/dash/);
    expect(evidenzeShapes).not.toMatch(/\bdash:/);
    expect(evidenzeShapes).toMatch(/shui:editor/);
    expect(evidenzeShapes).toMatch(/sh:if/);
  });
});
