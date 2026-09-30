import { describe, expect, it } from "vitest";
import { buildFormModel } from "@/form/buildFormModel.js";
import { createRudofEngine } from "@/engine/index.js";
import { namedNode } from "@/form/factory.js";

/**
 * SHACL 1.2 UI, "Grouping, Ordering, and Layout Hints" (#grouping-and-ordering):
 * property groups and ungrouped property shapes form one sequence ordered by
 * `sh:order`; members with no order come last; ties break by label, then id.
 */
const PREFIXES = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.org/> .
`;

const prop = (name: string, o: { order?: number; group?: string; label?: string } = {}) =>
  `[ sh:path ex:${name} ; sh:name "${o.label ?? name}" ; sh:datatype xsd:string` +
  `${o.order === undefined ? "" : ` ; sh:order ${o.order}`}${o.group ? ` ; sh:group ex:${o.group}` : ""} ]`;

const group = (id: string, label: string, order?: number) =>
  `ex:${id} a sh:PropertyGroup ; rdfs:label "${label}"${order === undefined ? "" : ` ; sh:order ${order}`} .`;

async function build(properties: string[], groups: string[] = []) {
  const ttl = `${PREFIXES}
ex:S a sh:NodeShape ; sh:property ${properties.join(", ")} .
${groups.join("\n")}`;
  const shapes = await createRudofEngine().loadShapes(ttl);
  const shape = shapes.nodeShapes.get("http://example.org/S")!;
  return buildFormModel({ shapes, focusNode: namedNode("http://example.org/x"), shape, languages: ["en"] });
}

/** Each section as its title (or "-" when untitled) and its field labels in order. */
async function layout(properties: string[], groups: string[] = []) {
  const model = await build(properties, groups);
  return model.groups.map((g) => `${g.label ?? "-"}: ${g.fields.map((f) => f.label).join(",")}`);
}

describe("property groups and ungrouped fields form one ordered sequence", () => {
  it("interleaves ungrouped fields with groups by sh:order", async () => {
    expect(
      await layout(
        [
          prop("late", { order: 30 }),
          prop("inG", { group: "G", order: 1 }),
          prop("early", { order: 5 }),
          prop("alsoInG", { group: "G", order: 0 }),
        ],
        [group("G", "Group", 10)],
      ),
    ).toEqual(["-: early", "Group: alsoInG,inG", "-: late"]);
  });

  it("orders a grouped field only within its group, never by its own order in the sequence", async () => {
    // inG's own order (99) would put it last if it counted at the top level.
    expect(
      await layout([prop("inG", { group: "G", order: 99 }), prop("free", { order: 5 })], [group("G", "Group", 1)]),
    ).toEqual(["Group: inG", "-: free"]);
  });

  it("merges consecutive ungrouped fields into one untitled section and splits it around a group", async () => {
    expect(
      await layout(
        [prop("a", { order: 1 }), prop("b", { order: 2 }), prop("c", { order: 4 }), prop("d", { order: 5 }), prop("inG", { group: "G" })],
        [group("G", "Group", 3)],
      ),
    ).toEqual(["-: a,b", "Group: inG", "-: c,d"]);
  });

  it("puts members with no order after every member that has one, groups included", async () => {
    expect(
      await layout(
        [prop("none", {}), prop("inNoOrder", { group: "N" }), prop("inLate", { group: "L", order: 1 }), prop("ordered", { order: 100 })],
        [group("N", "Unordered group"), group("L", "Late group", 1000)],
      ),
    ).toEqual(["-: ordered", "Late group: inLate", "-: none", "Unordered group: inNoOrder"]);
  });

  it("breaks ties by resolved label", async () => {
    expect(await layout([prop("p2", { order: 1, label: "B" }), prop("p1", { order: 1, label: "A" }), prop("n", { label: "C" })])).toEqual([
      "-: A,B,C",
    ]);
  });

  it("breaks a tie on the label by identifier", async () => {
    const model = await build([prop("q2", { label: "Same" }), prop("q1", { label: "Same" })]);
    expect(model.groups[0].fields.map((f) => f.path.value)).toEqual(["http://example.org/q1", "http://example.org/q2"]);
  });

  it("breaks a tie between a group and an ungrouped field by label", async () => {
    expect(
      await layout([prop("z", { order: 1, label: "Zeta" }), prop("inG", { group: "G" })], [group("G", "Alpha", 1)]),
    ).toEqual(["Alpha: inG", "-: Zeta"]);
  });
});
