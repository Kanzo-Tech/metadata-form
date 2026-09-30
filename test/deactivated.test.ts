import { describe, it, expect } from "vitest";
import { namedNode } from "@/form/factory.js";
import { buildFormModel } from "@/form/buildFormModel.js";
import { resolveRootShapeFromTypes } from "@/engine/rootShape.js";
import type { Diagnostic } from "@/form/buildFormModel.js";
import { projectTree } from "@/engine/projectTree.js";
import { allFields } from "@/form/FormModel.js";
import { Editors } from "@/form/vocab/shacl-ui.js";
import type { NodeShapeIR, ProjectedForm, PropertyShapeIR, ShapeModel } from "@/form/ShapeIR.js";

/**
 * Pure (no-wasm) test of `sh:deactivated` rendering, mirroring
 * `test/conditionals.test.ts`: it locks the TS gate independently of the engine
 * that fills the IR slot.
 *
 * SHACL §2.1.6: "A shape that has the value true for the property sh:deactivated
 * is called deactivated. All RDF terms conform to a deactivated shape." So a
 * deactivated shape constrains nothing and the validator reports nothing for it —
 * a field built from one would be filled in and never checked. It must produce no
 * field at all. Deactivation applies to shapes generally, so a deactivated NODE
 * shape must render nothing either.
 *
 * Real occurrences (DCAT-AP.de 2.0, E1's corpus): `dcatap:Category_Shape` and
 * `dcatap:CategoryScheme_Shape` (node shapes) and
 * `dcatap:Checksum_Property_spdx_algorithm` (a property shape).
 */

const EX = "http://example.org/";

function prop(pathIri: string, opts: Partial<PropertyShapeIR> = {}): PropertyShapeIR {
  return {
    path: { kind: "predicate", iri: pathIri },
    pathKey: pathIri,
    cardinality: {},
    value: {},
    logical: {},
    presentation: { names: [{ value: pathIri.split(/[#/]/).pop()!, language: "" }], descriptions: [], editor: Editors.TextField, editorSource: "fallback" },
    components: [],
    ...opts,
  };
}

/** `spdx:Checksum` — one live property and one the profile switched off. */
const checksumShape: NodeShapeIR = {
  id: `${EX}ChecksumShape`,
  targetClasses: [`${EX}Checksum`],
  instanceClass: `${EX}Checksum`,
  properties: [
    prop(`${EX}checksumValue`, { cardinality: { min: 1 } }),
    prop(`${EX}algorithm`, { cardinality: { min: 1 }, deactivated: true }),
  ],
};

/** A whole node shape switched off, reached from the root through `sh:node`. */
const categoryShape: NodeShapeIR = {
  id: `${EX}CategoryShape`,
  targetClasses: [`${EX}Category`],
  instanceClass: `${EX}Category`,
  deactivated: true,
  properties: [prop(`${EX}prefLabel`, { cardinality: { min: 1 } })],
};

const datasetShape: NodeShapeIR = {
  id: `${EX}DatasetShape`,
  targetClasses: [`${EX}Dataset`],
  instanceClass: `${EX}Dataset`,
  properties: [
    prop(`${EX}title`, { cardinality: { min: 1 } }),
    prop(`${EX}theme`, { node: categoryShape.id }),
  ],
};

const shapes: ShapeModel = {
  nodeShapes: new Map([
    [datasetShape.id, datasetShape],
    [categoryShape.id, categoryShape],
    [checksumShape.id, checksumShape],
  ]),
  groups: new Map(),
  byTargetClass: new Map([
    [`${EX}Dataset`, datasetShape.id],
    [`${EX}Category`, categoryShape.id],
    [`${EX}Checksum`, checksumShape.id],
  ]),
};

const focus = namedNode(`${EX}d1`);

function pathsFor(shape: NodeShapeIR, onDiagnostic?: (d: Diagnostic) => void): string[] {
  const model = buildFormModel({ shapes, focusNode: focus, shape, onDiagnostic });
  return allFields(model).map((f) => f.path.value);
}

describe("sh:deactivated (buildFormModel)", () => {
  it("builds no field for a deactivated property shape", () => {
    const paths = pathsFor(checksumShape);
    expect(paths).not.toContain(`${EX}algorithm`);
    // The live sibling is untouched — deactivation is per shape, not per node shape.
    expect(paths).toContain(`${EX}checksumValue`);
  });

  it("reports the dropped property shape as a diagnostic rather than dropping it silently", () => {
    const diagnostics: Diagnostic[] = [];
    pathsFor(checksumShape, (d) => diagnostics.push(d));
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: "deactivated-shape", detail: `${EX}algorithm` }),
    );
  });

  it("builds no fields at all for a deactivated node shape", () => {
    const model = buildFormModel({ shapes, focusNode: focus, shape: categoryShape });
    expect(allFields(model)).toEqual([]);
    expect(model.groups).toEqual([]);
  });

  it("never resolves a deactivated node shape as the form's root", () => {
    // By rdf:type → sh:targetClass, the direct route to the switched-off shape.
    expect(resolveRootShapeFromTypes(shapes, [`${EX}Category`])).not.toBe(categoryShape);
    // And when nothing types the focus, the fallback scan skips it too.
    const onlyDeactivated: ShapeModel = {
      nodeShapes: new Map([[categoryShape.id, categoryShape]]),
      groups: new Map(),
      byTargetClass: new Map([[`${EX}Category`, categoryShape.id]]),
    };
    expect(resolveRootShapeFromTypes(onlyDeactivated, [])).toBeUndefined();
  });

  it("still honours an explicitly requested shape, deactivated or not", () => {
    // `rootShape` is the caller's explicit choice; it resolves, and then renders
    // nothing — the shape is off, not missing.
    const shape = resolveRootShapeFromTypes(shapes, [], namedNode(categoryShape.id));
    expect(shape).toBe(categoryShape);
  });
});

describe("sh:deactivated (projectTree)", () => {
  /** A projector that answers with one value per property path of the shape. */
  const project = (f: import("@rdfjs/types").Term, shapeId: string): ProjectedForm => {
    const node = shapes.nodeShapes.get(shapeId)!;
    return {
      focus: { termType: "NamedNode", value: f.value },
      properties: node.properties.map((p) => ({
        pathKey: p.pathKey,
        values: [
          {
            value: { termType: "NamedNode", value: `${f.value}/${p.pathKey.split(/[#/]/).pop()}` },
            nested: p.node ? { termType: "NamedNode", value: `${f.value}/sub` } : undefined,
          },
        ],
      })),
    };
  };

  it("does not descend into a deactivated node shape", () => {
    const tree = projectTree(project, shapes, datasetShape.id, focus);
    expect(tree.nodes.map((n) => n.shapeId)).toEqual([datasetShape.id]);
    // Nothing was projected — or later validated — for the switched-off subtree.
    expect([...tree.values.keys()].some((k) => k.includes("/sub"))).toBe(false);
  });

  it("projects nothing at all when the root shape itself is deactivated", () => {
    const tree = projectTree(project, shapes, categoryShape.id, focus);
    expect(tree.nodes).toEqual([]);
    expect(tree.values.size).toBe(0);
  });
});
