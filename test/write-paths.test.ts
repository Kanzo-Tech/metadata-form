import { describe, it, expect } from "vitest";
import type { Term } from "@rdfjs/types";
import { buildFormModel } from "@/form/buildFormModel.js";
import { createRudofEngine } from "@/engine/index.js";
import { GraphState } from "@/engine/GraphState.js";
import { allFields, type FieldModel } from "@/form/FormModel.js";
import { chooseBranch, planWrite, type FieldWrite, type StepReader } from "@/form/writePath.js";
import { Editors } from "@/form/vocab/shacl-ui.js";
import { SH_IRI } from "@/form/vocab/shacl.js";
import { literal, namedNode } from "@/form/factory.js";
import type { PathExpr } from "@/form/ShapeIR.js";
import { EN, resolveStrings } from "@/i18n/strings.js";
import { es, ca } from "@kanzo-tech/metadata-form/i18n";

/**
 * Writing through a property path.
 *
 * SHACL says what a path *reads* (§3.7 value nodes) and nothing about what it
 * writes, so every assertion here is against the one test that is derivable:
 * after the write, the value is among the value nodes the SAME path yields — and
 * rudof, not this test, is what evaluates the path. That is why these run against
 * a real engine session rather than a stub graph: a write that only satisfies our
 * idea of the path would pass a mock and fail a validator.
 *
 * Each still-read-only kind is pinned WITH its reason, because "read-only" alone
 * is the state the whole exercise was about not shipping.
 */

const EX = "http://example.org/";
const SHAPE = `${EX}S`;
const FOCUS = `${EX}d1`;

const prefix = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix ex: <${EX}> .
`;

/** One rudof session holding both the shapes and the data, with the live editable
 *  graph over it — the arrangement `useMetadataForm` runs, minus React. */
async function form(shapesBody: string, dataTtl = "") {
  const engine = createRudofEngine();
  const shapes = await engine.loadShapes(`${prefix}
    ex:S a sh:NodeShape ; sh:targetClass ex:Thing ;
      ${shapesBody}
  `);
  const session = await engine.createGraph(
    shapes,
    `${prefix}\n${dataTtl}`,
    "text/turtle",
    namedNode(FOCUS),
    namedNode(SHAPE),
  );
  const graph = new GraphState(session.backend);
  const build = () => {
    const { values, satisfied } = engine.projectValues(shapes, session.focusNode, session.rootShapeId);
    return buildFormModel({
      shapes,
      focusNode: session.focusNode,
      shape: shapes.nodeShapes.get(session.rootShapeId)!,
      values,
      satisfied,
      readStep: graph.readStep,
    });
  };
  return { engine, graph, focus: session.focusNode, build };
}

const only = (model: ReturnType<Awaited<ReturnType<typeof form>>["build"]>): FieldModel => {
  const fields = allFields(model);
  expect(fields).toHaveLength(1);
  return fields[0];
};

const valuesOf = (field: FieldModel) =>
  field.values.map((v) => v.value?.value ?? "").sort();

const writeOf = (field: FieldModel): FieldWrite => {
  expect(field.readOnly).toBeFalsy();
  expect(field.write).toBeDefined();
  return field.write!;
};

describe("inverse paths are writable (one statement, ends swapped)", () => {
  const shapes = `sh:property [ sh:path [ sh:inversePath ex:parent ] ; sh:name "Children" ] .`;

  it("plans (value, predicate, focus) and adds exactly that statement", async () => {
    const { graph, focus, build } = await form(shapes, `ex:c1 ex:parent ex:d1 .`);
    const field = only(build());
    expect(field.pathKind).toBe("complex");
    expect(valuesOf(field)).toEqual([`${EX}c1`]);

    graph.addValue(focus, writeOf(field), namedNode(`${EX}c2`));

    // The statement written is the inverse one, not a forward triple on the focus.
    expect(graph.readStep(namedNode(`${EX}c2`), field.write!.branches[0].step)).toHaveLength(0);
    expect(valuesOf(only(build()))).toEqual([`${EX}c1`, `${EX}c2`]);
  });

  it("removes the inverse statement and the value stops being read back", async () => {
    const { graph, focus, build } = await form(shapes, `ex:c1 ex:parent ex:d1 . ex:c2 ex:parent ex:d1 .`);
    graph.removeValue(focus, writeOf(only(build())), namedNode(`${EX}c1`));
    expect(valuesOf(only(build()))).toEqual([`${EX}c2`]);
  });

  it("replaces one value with another in place", async () => {
    const { graph, focus, build } = await form(shapes, `ex:c1 ex:parent ex:d1 .`);
    graph.setValue(focus, writeOf(only(build())), namedNode(`${EX}c1`), namedNode(`${EX}c9`));
    expect(valuesOf(only(build()))).toEqual([`${EX}c9`]);
  });

  it("round-trips: write, serialize to Turtle, re-read through the same path", async () => {
    const { engine, graph, focus, build } = await form(shapes);
    graph.addValue(focus, writeOf(only(build())), namedNode(`${EX}c7`));

    // The whole graph, not `serializeFocus`: an inverse value is a statement ABOUT
    // the focus made BY another subject, so it is outside the focus's subgraph.
    const turtle = await engine.serialize("text/turtle");
    expect(turtle).toContain("c7");

    const reloaded = createRudofEngine();
    await reloaded.loadShapes(`${prefix}
      ex:S a sh:NodeShape ; sh:targetClass ex:Thing ; ${shapes}
    `);
    await reloaded.loadData(turtle);
    const projected = await reloaded.projectForm(namedNode(FOCUS), SHAPE);
    const back = projected.properties.find((p) => p.pathKey === `^${EX}parent`);
    expect(back?.values.map((v) => v.value.value)).toEqual([`${EX}c7`]);
  });

  it("fills in the nodeKind RDF already implies, and leaves the editor to the engine", async () => {
    const { build } = await form(shapes);
    const field = only(build());
    // No sh:nodeKind in the shape — but an inverse value is a statement's subject,
    // so it cannot be a literal, and the widget must commit a NamedNode. The shape
    // states no type for the engine's score function, so its editor is the text
    // field it falls back to: the form does not second-guess it.
    expect(field.constraints.nodeKind).toBe(SH_IRI);
    expect(field.editorId).toBe(Editors.TextField);
    expect(field.editorSource).toBe("fallback");
  });

  it("refuses a literal, because a literal cannot be the subject of a statement", async () => {
    const { graph, focus, build } = await form(shapes);
    const write = writeOf(only(build()));
    expect(() => graph.addValue(focus, write, literal("not a resource"))).toThrow(/subject/);
  });
});

describe("alternative paths are writable (the union reads back whichever branch)", () => {
  // The Bioschemas shape, verbatim in structure: one property written in two
  // namespaces, listed http first.
  const HTTP = "http://schema.org/name";
  const HTTPS = "https://schema.org/name";
  const shapes = `sh:property [ sh:path [ sh:alternativePath ( <${HTTP}> <${HTTPS}> ) ] ] .`;

  it("names the field by the local name the branches agree on", async () => {
    const { build } = await form(shapes);
    // Not "(http://schema.org/name|https://schema.org/name)".
    expect(only(build()).label).toBe("name");
  });

  it("writes a new value through the first branch the author listed", async () => {
    const { graph, focus, build } = await form(shapes);
    graph.addValue(focus, writeOf(only(build())), literal("Alice"));

    expect(graph.readStep(focus, { predicate: namedNode(HTTP), direction: "forward" }).map((t) => t.value))
      .toEqual(["Alice"]);
    expect(graph.readStep(focus, { predicate: namedNode(HTTPS), direction: "forward" })).toHaveLength(0);
    // …and the path reads it back, which is the only thing SHACL actually says.
    expect(valuesOf(only(build()))).toEqual(["Alice"]);
  });

  it("joins the branch the record already uses instead of splitting it", async () => {
    const { graph, focus, build } = await form(shapes, `ex:d1 <${HTTPS}> "Existing" .`);
    graph.addValue(focus, writeOf(only(build())), literal("Second"));

    expect(graph.readStep(focus, { predicate: namedNode(HTTPS), direction: "forward" }).map((t) => t.value).sort())
      .toEqual(["Existing", "Second"]);
    expect(graph.readStep(focus, { predicate: namedNode(HTTP), direction: "forward" })).toHaveLength(0);
  });

  it("keeps an edited value on the branch it was already on", async () => {
    const { graph, focus, build } = await form(shapes, `ex:d1 <${HTTPS}> "Before" .`);
    const field = only(build());
    graph.setValue(focus, writeOf(field), field.values[0].value, literal("After"));

    // Editing a value is not a reason to move it: the branch is chosen before the
    // old statement is retracted, while the record still shows which one it uses.
    expect(graph.readStep(focus, { predicate: namedNode(HTTPS), direction: "forward" }).map((t) => t.value))
      .toEqual(["After"]);
    expect(graph.readStep(focus, { predicate: namedNode(HTTP), direction: "forward" })).toHaveLength(0);
  });

  it("retracts from EVERY branch, so a deleted value does not reappear from the other one", async () => {
    const { graph, focus, build } = await form(
      shapes,
      `ex:d1 <${HTTP}> "Dup" . ex:d1 <${HTTPS}> "Dup" .`,
    );
    const field = only(build());
    expect(valuesOf(field)).toEqual(["Dup", "Dup"]); // the union, as the path reads it
    graph.removeValue(focus, writeOf(field), literal("Dup"));
    expect(valuesOf(only(build()))).toEqual([]);
  });

  it("offers a literal only the forward branches of a mixed alternative", async () => {
    const { graph, focus, build } = await form(
      `sh:property [ sh:path [ sh:alternativePath ( [ sh:inversePath ex:of ] ex:label ) ] ] .`,
    );
    const write = writeOf(only(build()));
    expect(write.branches.map((b) => b.step.direction)).toEqual(["inverse", "forward"]);

    // An IRI can be either end, so it takes the first branch listed — the inverse one.
    graph.addValue(focus, write, namedNode(`${EX}n1`));
    expect(graph.readStep(focus, { predicate: namedNode(`${EX}of`), direction: "inverse" }).map((t) => t.value))
      .toEqual([`${EX}n1`]);

    // A literal cannot be a subject, so the inverse branch is not offered to it at
    // all — not even though the record is now using that branch.
    graph.addValue(focus, write, literal("Text"));
    expect(graph.readStep(focus, { predicate: namedNode(`${EX}label`), direction: "forward" }).map((t) => t.value))
      .toEqual(["Text"]);
    expect(valuesOf(only(build()))).toEqual(["Text", `${EX}n1`]);
  });
});

describe("sequence paths are writable exactly while their intermediate resolves", () => {
  const shapes = `sh:property [ sh:path ( ex:a ex:b ) ] .`;

  it("writes onto the intermediate node, not onto the focus", async () => {
    const { graph, focus, build } = await form(shapes, `ex:d1 ex:a ex:x . ex:x ex:b "deep" .`);
    const field = only(build());
    const write = writeOf(field);
    expect(write.branches[0].via.map((s) => s.predicate.value)).toEqual([`${EX}a`]);
    expect(write.branches[0].step.predicate.value).toBe(`${EX}b`);

    graph.setValue(focus, write, field.values[0].value, literal("deeper"));

    expect(graph.readStep(namedNode(`${EX}x`), write.branches[0].step).map((t) => t.value)).toEqual(["deeper"]);
    expect(valuesOf(only(build()))).toEqual(["deeper"]);
  });

  it("is read-only, with the reason, while the intermediate does not exist", async () => {
    const { build } = await form(shapes, `ex:d1 ex:unrelated "x" .`);
    const field = only(build());
    expect(field.readOnly).toBe(true);
    expect(field.readOnlyReason?.code).toBe("intermediate-missing");
    expect(field.readOnlyReason?.detail).toBe(`(${EX}a/${EX}b)`);
    expect(field.write).toBeUndefined();
  });

  it("becomes editable the moment the intermediate is filled in", async () => {
    const { graph, focus, build } = await form(shapes, `ex:d1 ex:unrelated "x" .`);
    expect(only(build()).readOnly).toBe(true);

    graph.addValue(focus, { branches: [{ via: [], step: { predicate: namedNode(`${EX}a`), direction: "forward" } }] }, namedNode(`${EX}x`));

    const field = only(build());
    expect(field.readOnly).toBeFalsy();
    expect(field.readOnlyReason).toBeUndefined();
  });

  it("is read-only, with the reason, when the intermediate is ambiguous", async () => {
    const { build } = await form(shapes, `ex:d1 ex:a ex:x, ex:y . ex:x ex:b "1" . ex:y ex:b "2" .`);
    const field = only(build());
    expect(field.readOnly).toBe(true);
    expect(field.readOnlyReason?.code).toBe("intermediate-ambiguous");
    // The values are still shown: reading was never the problem.
    expect(valuesOf(field)).toEqual(["1", "2"]);
  });
});

describe("the kinds that stay read-only, each pinned with its reason", () => {
  const cases: [string, string, string][] = [
    ["zeroOrMorePath", `[ sh:zeroOrMorePath ex:p ]`, "variable-length-path"],
    ["oneOrMorePath", `[ sh:oneOrMorePath ex:p ]`, "variable-length-path"],
    ["zeroOrOnePath", `[ sh:zeroOrOnePath ex:p ]`, "variable-length-path"],
    ["inverse of a sequence", `[ sh:inversePath ( ex:a ex:b ) ]`, "compound-path"],
    ["alternative with a sequence branch", `[ sh:alternativePath ( ex:a ( ex:b ex:c ) ) ]`, "compound-path"],
    ["sequence with a quantified step", `( ex:a [ sh:oneOrMorePath ex:b ] )`, "variable-length-path"],
  ];

  for (const [name, path, code] of cases) {
    it(`${name} → ${code}, with a sentence the UI can show`, async () => {
      const { build } = await form(`sh:property [ sh:path ${path} ] .`);
      const field = only(build());
      expect(field.readOnly).toBe(true);
      expect(field.write).toBeUndefined();
      expect(field.readOnlyReason?.code).toBe(code);
      expect(EN.readOnly[field.readOnlyReason!.code].length).toBeGreaterThan(20);
      expect(field.readOnlyReason?.detail).toBeTruthy();
    });
  }

  it("carries the reason as a code alone; each language's sentence is in its strings table", async () => {
    const { build } = await form(`sh:property [ sh:path [ sh:zeroOrMorePath ex:p ] ] .`);
    const reason = only(build()).readOnlyReason!;
    expect(Object.keys(reason).sort()).toEqual(["code", "detail"]);
    const tables = { es: es.strings, ca: ca.strings };
    expect(resolveStrings(["es"], tables).readOnly[reason.code]).toMatch(/camino repetitivo/);
    expect(resolveStrings(["ca"], tables).readOnly[reason.code]).toMatch(/camí repetitiu/);
    expect(resolveStrings(["en"], tables).readOnly[reason.code]).toMatch(/repeating path/);
  });
});

describe("planWrite over the seven path kinds (the shape gate, without a graph)", () => {
  const p = (iri: string): PathExpr => ({ kind: "predicate", iri });

  it("plans one statement for a predicate and for the inverse of a predicate", () => {
    expect(planWrite(p(`${EX}a`))).toEqual({
      write: { branches: [{ via: [], step: { predicate: expect.anything(), direction: "forward" } }] },
    });
    const inv = planWrite({ kind: "inverse", of: p(`${EX}a`) });
    expect("write" in inv && inv.write.branches[0].step.direction).toBe("inverse");
  });

  it("flattens nested alternatives, because the union is associative", () => {
    const plan = planWrite({
      kind: "alternative",
      options: [p(`${EX}a`), { kind: "alternative", options: [p(`${EX}b`), p(`${EX}c`)] }],
    });
    expect("write" in plan && plan.write.branches.map((b) => b.step.predicate.value)).toEqual([
      `${EX}a`,
      `${EX}b`,
      `${EX}c`,
    ]);
  });

  it("splits a sequence into a walk plus a final statement", () => {
    const plan = planWrite({ kind: "sequence", steps: [p(`${EX}a`), p(`${EX}b`), p(`${EX}c`)] });
    expect("write" in plan && plan.write.branches[0].via.map((s) => s.predicate.value)).toEqual([
      `${EX}a`,
      `${EX}b`,
    ]);
    expect("write" in plan && plan.write.branches[0].step.predicate.value).toBe(`${EX}c`);
  });

  it("refuses every quantified kind, naming the quantifier even when it is nested", () => {
    for (const kind of ["zeroOrMore", "oneOrMore", "zeroOrOne"] as const) {
      expect(planWrite({ kind, path: p(`${EX}a`) } as PathExpr)).toEqual({
        readOnly: "variable-length-path",
      });
    }
    expect(
      planWrite({ kind: "alternative", options: [p(`${EX}a`), { kind: "zeroOrMore", path: p(`${EX}b`) }] }),
    ).toEqual({ readOnly: "variable-length-path" });
  });
});

describe("chooseBranch — the rule the spec leaves open, stated in one place", () => {
  const branch = (iri: string, direction: "forward" | "inverse" = "forward") => ({
    via: [],
    step: { predicate: namedNode(iri), direction },
  });
  const focus = namedNode(FOCUS);
  const noValues: StepReader = () => [];

  it("takes the first listed branch when the record says nothing", () => {
    const write = { branches: [branch(`${EX}a`), branch(`${EX}b`)] };
    expect(chooseBranch(noValues, focus, write, literal("x")).step.predicate.value).toBe(`${EX}a`);
  });

  it("takes the branch already in use when exactly one is", () => {
    const write = { branches: [branch(`${EX}a`), branch(`${EX}b`)] };
    const usesB: StepReader = (_from, step) =>
      step.predicate.value === `${EX}b` ? [literal("already") as Term] : [];
    expect(chooseBranch(usesB, focus, write, literal("x")).step.predicate.value).toBe(`${EX}b`);
  });

  it("falls back to the first when more than one branch is in use (nothing to follow)", () => {
    const write = { branches: [branch(`${EX}a`), branch(`${EX}b`)] };
    const usesBoth: StepReader = () => [literal("already") as Term];
    expect(chooseBranch(usesBoth, focus, write, literal("x")).step.predicate.value).toBe(`${EX}a`);
  });

  it("throws rather than inventing a statement when a literal has only inverse branches", () => {
    const write = { branches: [branch(`${EX}a`, "inverse")] };
    expect(() => chooseBranch(noValues, focus, write, literal("x"))).toThrow(/subject/);
  });
});
