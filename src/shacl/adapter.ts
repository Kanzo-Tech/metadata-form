import { Store } from "n3";
import type { NamedNode, Quad, Term } from "@rdfjs/types";
import { namedNode, rdf } from "../rdf/factory.js";
import { toTurtle } from "../rdf/serialize.js";
import { toTerm } from "../rdf/termValue.js";
import {
  buildFormModel as buildForm,
  freshFocusNode,
  resolveRootShape,
  resolveRootShapeFromTypes,
} from "./buildFormModel.js";
import type {
  BuildFormModelArgs,
  GraphSession,
  ParsedSchema,
  ProjectedValues,
  SchemaAdapter,
} from "../model/SchemaAdapter.js";
import type { FormModel } from "../model/FormModel.js";
import type { Validator } from "../model/validation.js";
import type { GraphBackend } from "../engine/ports/GraphBackend.js";
import type { NodeShapeIR, ShapeModel } from "../model/ShapeIR.js";
import type { RdfEngine } from "../engine/ports/RdfEngine.js";
import { projectTreeSync } from "../engine/projectTree.js";
import { createRudofEngine } from "../engine/index.js";

const RDF_TYPE = namedNode(rdf("type").value);

const EMPTY_DATA = new Store();

export interface RudofParsedSchema extends ParsedSchema {
  language: "shacl";
  shapes: ShapeModel;
}

function isRudof(schema: ParsedSchema): schema is RudofParsedSchema {
  return schema.language === "shacl";
}

/** The focus node's rdf:type values, read from the live session backend. */
function typesOf(backend: GraphBackend, focus: Term): string[] {
  return backend.match(focus, RDF_TYPE, null).map((q) => q.object.value);
}

/** Infer the subject to edit from the session graph: the first instance of the
 *  root shape's target class. Returns undefined when none is found. */
function inferFocusFromBackend(
  shapes: ShapeModel,
  backend: GraphBackend,
  rootShape?: NamedNode,
): Term | undefined {
  const shape = rootShape ? shapes.nodeShapes.get(rootShape.value) : undefined;
  const targetClasses = shape ? shape.targetClasses : [...shapes.byTargetClass.keys()];
  for (const cls of targetClasses) {
    const q = backend.match(null, RDF_TYPE, namedNode(cls))[0];
    if (q) return q.subject as Term;
  }
  return undefined;
}

/** Stamp the focus node with the root shape's target class plus any sh:hasValue /
 *  sh:defaultValue seeds, directly into the session graph, so a new instance is
 *  complete and validation targets it. */
function seedIntoBackend(backend: GraphBackend, focus: Term, shape: NodeShapeIR): void {
  if (shape.instanceClass) {
    const cls = namedNode(shape.instanceClass);
    if (backend.match(focus, RDF_TYPE, cls).length === 0) backend.add(focus, RDF_TYPE, cls);
  }
  for (const ps of shape.properties) {
    if (ps.path.kind !== "predicate" || !ps.path.iri) continue;
    const seed = ps.value.hasValue ?? ps.value.defaultValue;
    if (!seed) continue;
    const predicate = namedNode(ps.path.iri);
    if (backend.match(focus, predicate, null).length === 0) backend.add(focus, predicate, toTerm(seed));
  }
}

/**
 * The default {@link SchemaAdapter}: parsing, projection AND validation all run in
 * rudof-over-WASM (the spec-aligned SHACL-1.2 engine), via a single {@link RdfEngine}
 * session that owns the shapes AND the live data graph. n3 is gone from the runtime
 * graph — the session is the single source of truth: `createGraph` loads the initial
 * data once, `projectValues` re-derives field values from it on every edit, and the
 * validator runs against it in place (no per-validate reload).
 *
 * `parseSchema`/`createGraph` are async (they await the wasm); the hook already does.
 */
export function createRudofShaclAdapter(engine: RdfEngine = createRudofEngine()): SchemaAdapter {
  return {
    language: "shacl",

    async parseSchema(input: string | Store): Promise<RudofParsedSchema> {
      const text =
        typeof input === "string"
          ? input
          : await toTurtle(input.getQuads(null, null, null, null) as never);
      await engine.ready();
      const shapes = await engine.loadShapes(text);
      return { language: "shacl", shapes };
    },

    async createGraph(
      schema: ParsedSchema,
      initialData: Quad[],
      focusNode?: Term,
      rootShape?: NamedNode,
    ): Promise<GraphSession> {
      if (!isRudof(schema)) throw new Error("rudof adapter received a non-SHACL schema");
      const shapes = schema.shapes;
      const backend = await engine.newGraph();
      // Add quads directly (not loadData(turtle)) so blank-node labels — including
      // a blank focus node — survive into the session unchanged.
      for (const q of initialData) backend.add(q.subject as Term, q.predicate as Term, q.object as Term);

      const focus = focusNode ?? inferFocusFromBackend(shapes, backend, rootShape) ?? freshFocusNode();
      const shape = resolveRootShapeFromTypes(shapes, typesOf(backend, focus), rootShape);
      if (!shape) {
        throw new Error("Could not resolve a root node shape. Pass `rootShape` explicitly.");
      }
      seedIntoBackend(backend, focus, shape);
      return { backend, focusNode: focus, rootShapeId: shape.id };
    },

    buildFormModel(args: BuildFormModelArgs): FormModel {
      if (!isRudof(args.schema)) throw new Error("rudof adapter received a non-SHACL schema");
      const focusNode = args.focusNode ?? freshFocusNode();
      const shape = resolveRootShape(args.schema.shapes, args.data, focusNode, args.rootShape);
      if (!shape) {
        throw new Error("Could not resolve a root node shape. Pass `rootShape` explicitly.");
      }
      return buildForm({
        shapes: args.schema.shapes,
        data: args.data,
        focusNode,
        shape,
        locale: args.locale,
        onDiagnostic: args.onDiagnostic,
        values: args.values,
      });
    },

    projectValues(schema: ParsedSchema, focusNode: Term, rootShapeId: string): ProjectedValues {
      if (!isRudof(schema)) throw new Error("rudof adapter received a non-SHACL schema");
      return projectTreeSync((f, s) => engine.projectFormSync(f, s), schema.shapes, rootShapeId, focusNode);
    },

    createValidator(schema: ParsedSchema): Validator {
      if (!isRudof(schema)) throw new Error("rudof adapter received a non-SHACL schema");
      return {
        // The session already holds the live, current graph — validate it in place
        // (no loadData/serialize reload). Scope to the form's focus + its root shape
        // when known; fall back to whole-graph validation otherwise.
        async validate({ focusNode, rootShape }) {
          if (focusNode) {
            const shape = resolveRootShape(schema.shapes, EMPTY_DATA, focusNode, rootShape);
            if (shape) return engine.validateFocus(focusNode, shape.id);
          }
          return engine.validate();
        },
      };
    },
  };
}
