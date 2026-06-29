import type { Store } from "n3";
import type { NamedNode, Term } from "@rdfjs/types";
import { toTurtle } from "../rdf/serialize.js";
import {
  buildFormModel as buildForm,
  freshFocusNode,
  resolveRootShape,
  inferFocusNode as inferFocus,
  seedFocusNode as seedFocus,
} from "../form/buildFormModel.js";
import type {
  BuildFormModelArgs,
  ParsedSchema,
  SchemaAdapter,
} from "../schema/SchemaAdapter.js";
import type { FormModel } from "../schema/FormModel.js";
import type { Validator } from "../schema/validation.js";
import type { ShapeModel } from "../shape/ShapeIR.js";
import type { RdfEngine } from "../ports/RdfEngine.js";
import { createRudofEngine } from "./index.js";

export interface RudofParsedSchema extends ParsedSchema {
  language: "shacl";
  shapes: ShapeModel;
}

function isRudof(schema: ParsedSchema): schema is RudofParsedSchema {
  return schema.language === "shacl";
}

/**
 * The default {@link SchemaAdapter}: parsing AND validation run in rudof-over-WASM
 * (the spec-aligned SHACL-1.2 engine), via the {@link RdfEngine} port. n3 stays
 * the live editing buffer and value source for `buildFormModel`; validation
 * serializes that buffer into the rudof session and runs the wasm validator.
 *
 * `parseSchema` is async (it awaits the wasm); the hook already awaits it.
 */
export function createRudofShaclAdapter(engine: RdfEngine = createRudofEngine()): SchemaAdapter {
  return {
    language: "shacl",

    async parseSchema(input: string | Store): Promise<RudofParsedSchema> {
      const text = typeof input === "string" ? input : await toTurtle(input.getQuads(null, null, null, null) as never);
      await engine.ready();
      const shapes = await engine.loadShapes(text);
      return { language: "shacl", shapes };
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
      });
    },

    createValidator(schema: ParsedSchema): Validator {
      if (!isRudof(schema)) throw new Error("rudof adapter received a non-SHACL schema");
      return {
        async validate({ data }) {
          await engine.loadData(await toTurtle(data as never));
          return engine.validate();
        },
      };
    },

    inferFocusNode(schema: ParsedSchema, data: Store, rootShape?: NamedNode): Term | undefined {
      if (!isRudof(schema)) return undefined;
      return inferFocus(schema.shapes, data, rootShape);
    },

    seedFocusNode(schema: ParsedSchema, store: Store, focusNode: Term, rootShape?: NamedNode): void {
      if (!isRudof(schema)) return;
      seedFocus(schema.shapes, store, focusNode, rootShape);
    },
  };
}
