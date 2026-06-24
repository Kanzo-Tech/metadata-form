import { Store } from "n3";
import type { NamedNode, Term } from "@rdfjs/types";
import { namedNode, quad, rdf } from "../../rdf/factory.js";
import { toStoreSync } from "../../rdf/parse.js";
import type { FormModel } from "../../schema/FormModel.js";
import type { Validator } from "../../schema/validation.js";
import type {
  BuildFormModelArgs,
  ParsedSchema,
  SchemaAdapter,
} from "../../schema/SchemaAdapter.js";
import {
  instanceClass,
  readShapesGraph,
  type ShapesGraph,
  type ShaclNodeShape,
} from "./readShapesGraph.js";
import { buildFormModel, freshFocusNode } from "./buildFormModel.js";
import { ShaclValidator } from "./validator.js";

const RDF_TYPE = namedNode(rdf("type").value);

export interface ShaclParsedSchema extends ParsedSchema {
  language: "shacl";
  store: Store;
  shapes: ShapesGraph;
}

function isShacl(schema: ParsedSchema): schema is ShaclParsedSchema {
  return schema.language === "shacl";
}

/** SHACL implementation of the SchemaAdapter seam. */
export const shaclAdapter = {
  language: "shacl" as const,

  parseSchema(input: string | Store): ShaclParsedSchema {
    const store = toStoreSync(input);
    return { language: "shacl", store, shapes: readShapesGraph(store) };
  },

  buildFormModel(args: BuildFormModelArgs): FormModel {
    if (!isShacl(args.schema)) {
      throw new Error("shaclAdapter received a non-SHACL schema");
    }
    const shapes = args.schema.shapes;
    const focusNode = args.focusNode ?? freshFocusNode();
    const shape = resolveRootShape(shapes, args.data, focusNode, args.rootShape);
    if (!shape) {
      throw new Error("Could not resolve a root node shape. Pass `rootShape` explicitly.");
    }
    return buildFormModel({
      shapes,
      data: args.data,
      focusNode,
      shape,
      locale: args.locale,
      onDiagnostic: args.onDiagnostic,
    });
  },

  createValidator(schema: ParsedSchema): Validator {
    if (!isShacl(schema)) throw new Error("shaclAdapter received a non-SHACL schema");
    return new ShaclValidator(schema.store);
  },

  inferFocusNode(schema: ParsedSchema, data: Store, rootShape?: NamedNode): Term | undefined {
    if (!isShacl(schema)) return undefined;
    const shape = rootShape ? schema.shapes.nodeShapes.get(rootShape.value) : undefined;
    const targetClasses = shape
      ? shape.targetClasses.map((t) => t.value)
      : [...schema.shapes.byTargetClass.keys()];
    for (const cls of targetClasses) {
      const q = data.getQuads(null, RDF_TYPE, namedNode(cls), null)[0];
      if (q) return q.subject as Term;
    }
    return undefined;
  },

  /**
   * Stamp the focus node with the root shape's target class so SHACL actually
   * targets it (otherwise an untyped/empty node validates vacuously, and the
   * output graph would omit its rdf:type).
   */
  seedFocusNode(schema: ParsedSchema, store: Store, focusNode: Term, rootShape?: NamedNode): void {
    if (!isShacl(schema)) return;
    const shape = resolveRootShape(schema.shapes, store, focusNode, rootShape);
    if (!shape) return;

    const cls = instanceClass(shape);
    if (cls && store.getQuads(focusNode, RDF_TYPE, cls, null).length === 0) {
      store.addQuad(quad(focusNode as never, RDF_TYPE as never, cls as never));
    }

    // Seed sh:hasValue (a required constant) and sh:defaultValue (a suggested
    // initial) into empty properties so the new instance is complete.
    for (const ps of shape.properties) {
      if (!ps.path) continue;
      const seed = ps.hasValue ?? ps.defaultValue;
      if (!seed) continue;
      if (store.getQuads(focusNode, ps.path, null, null).length === 0) {
        store.addQuad(quad(focusNode as never, ps.path as never, seed as never));
      }
    }
  },
} satisfies SchemaAdapter;

function resolveRootShape(
  shapes: ShapesGraph,
  data: Store,
  focusNode: Term,
  rootShape?: NamedNode,
): ShaclNodeShape | undefined {
  if (rootShape) return shapes.nodeShapes.get(rootShape.value);

  // Try to match by the focus node's rdf:type against sh:targetClass.
  const types = data.getQuads(focusNode, RDF_TYPE, null, null).map((q) => q.object.value);
  for (const t of types) {
    const id = shapes.byTargetClass.get(t);
    if (id) return shapes.nodeShapes.get(id);
  }

  // Prefer a shape with a target class; otherwise the first defined shape.
  const withTarget = [...shapes.nodeShapes.values()].find((s) => s.targetClasses.length > 0);
  if (withTarget) return withTarget;
  return [...shapes.nodeShapes.values()][0];
}
