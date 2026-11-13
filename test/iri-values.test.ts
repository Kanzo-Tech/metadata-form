import { describe, it, expect } from "vitest";
import { createRudofEngine } from "@/engine/index.js";
import { namedNode } from "@/form/factory.js";
import { primitiveToTerm } from "@/form/termBinding.js";
import { allFields } from "@/form/FormModel.js";
import { buildFormModel } from "@/form/buildFormModel.js";
import { mapResults, oncePerProblem } from "@/form/validation.js";

// What is typed or pasted in a box the shape asks an address of (sh:nodeKind
// sh:IRI). Written as `<…>` whatever it was, a pasted " https://… " or a mail
// client's "Name <mail@…>" made a record no parser could read back.

const EX = "http://example.org/";
const prefixes = `@prefix sh: <http://www.w3.org/ns/shacl#> . @prefix ex: <${EX}> .`;
const shapesText = `${prefixes} ex:S a sh:NodeShape ; sh:targetClass ex:T ;
  sh:property [ sh:path ex:page ; sh:name "Page" ; sh:nodeKind sh:IRI ] .`;
const NODE_KIND = "http://www.w3.org/ns/shacl#NodeKindConstraintComponent";

async function setup() {
  const engine = createRudofEngine();
  const shapes = await engine.loadShapes(shapesText);
  const model = buildFormModel({ shapes, focusNode: namedNode(`${EX}t`), shape: shapes.nodeShapes.get(`${EX}S`)!, languages: ["en"] });
  return { engine, shapes, field: allFields(model)[0] };
}

describe("a value typed where the shape asks for an address", () => {
  it.each([
    ["  https://example.org/a \n", "https://example.org/a"],
    ["urn:doi:10.1000/182", "urn:doi:10.1000/182"],
    ["mailto:data@example.org ", "mailto:data@example.org"],
  ])("%j is the address %s, without the spaces around it", async (raw, iri) => {
    const { field } = await setup();
    expect(primitiveToTerm(field, raw)).toMatchObject({ termType: "NamedNode", value: iri });
  });

  it.each([
    "registro",
    "example.org/page",
    "Research Data <research-data@example.org>",
    "https://example.org/a b",
  ])("%j stays the text it is, never an address", async (raw) => {
    const { field } = await setup();
    const term = primitiveToTerm(field, raw)!;
    expect(term.termType).toBe("Literal");
    expect(term.value).toBe(raw);
  });

  it("never makes a record that cannot be read back, and the shape says what is wrong", async () => {
    const { engine, shapes, field } = await setup();
    const session = await engine.createGraph(shapes, `${prefixes} ex:t a ex:T .`, "text/turtle", namedNode(`${EX}t`), namedNode(`${EX}S`));
    session.backend.add(namedNode(`${EX}t`), namedNode(`${EX}page`), primitiveToTerm(field, "Research Data <research-data@example.org>")!);

    const results = await engine.validate();
    expect(results.some((r) => r.constraint === NODE_KIND)).toBe(true);

    const turtle = await engine.serialize("text/turtle");
    await expect(createRudofEngine().loadData(turtle)).resolves.toBeDefined();
  });
});

// A profile may put a field's rules in two shapes on its path: one says what the
// value is, the other how it is written and what to tell the reader. Validated, a
// text there broke three constraints and the reader got three lines for one mistake.
describe("the errors of a value two shapes on its path both reject", () => {
  const twoShapes = `${prefixes} ex:S a sh:NodeShape ; sh:targetClass ex:T ;
    sh:property [ sh:path ex:page ; sh:nodeKind sh:IRI ] , ex:page-address ;
    sh:property [ sh:path ex:other ; sh:nodeKind sh:IRI ] .
  ex:page-address a sh:PropertyShape ; sh:path ex:page ; sh:nodeKind sh:IRI ; sh:pattern "^https?://" ;
    sh:message "Write a full web address"@en, "Escribe una dirección web completa"@es .`;

  async function problems(data: string) {
    const engine = createRudofEngine();
    const shapes = await engine.loadShapes(twoShapes);
    await engine.createGraph(shapes, `${prefixes} ex:t a ex:T ; ${data} .`, "text/turtle", namedNode(`${EX}t`), namedNode(`${EX}S`));
    const raw = mapResults(await engine.validate());
    return { raw, shown: oncePerProblem(raw) };
  }
  const words = (list: { messages: { value: string; language: string }[] }[] = []) =>
    list.map((e) => e.messages.find((m) => m.language === "en")?.value);

  it("are said once, in the words the shape wrote", async () => {
    const { raw, shown } = await problems(`ex:page "Research Data <research-data@example.org>"`);
    expect(raw.get(`${EX}t|${EX}page`)!.length).toBeGreaterThan(1);
    const page = shown.get(`${EX}t|${EX}page`)!;
    expect(page).toHaveLength(1);
    expect(page[0].authored).toBe(true);
    expect(words(page)).toEqual(["Write a full web address"]);
  });

  it("are said once for each value that is wrong", async () => {
    const { shown } = await problems(`ex:page "registro", "a b"`);
    expect(words(shown.get(`${EX}t|${EX}page`))).toEqual(["Write a full web address", "Write a full web address"]);
  });

  it("keep the engine's wording where the shape wrote none", async () => {
    const { shown } = await problems(`ex:other "registro"`);
    const other = shown.get(`${EX}t|${EX}other`)!;
    expect(other).toHaveLength(1);
    expect(other[0].authored).toBe(false);
    expect(words(other)[0]).toMatch(/Iri/i);
  });
});
