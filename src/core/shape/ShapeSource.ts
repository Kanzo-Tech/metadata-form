import type { ShapeModel } from "./ShapeIR.js";

/**
 * A shapes document, either as serialized text or an already-parsed store.
 * `store` is a transition affordance for the n3-based reader; the rudof reader
 * consumes `text`.
 */
export type ShapeInput =
  | { text: string; mediaType?: "text/turtle" | "application/ld+json" }
  | { store: import("n3").Store };

/**
 * The parsing seam: shapes document → vocabulary-agnostic {@link ShapeModel}.
 * `readShapes` may be sync (n3 reader) or async (WASM/AST reader); callers await.
 */
export interface ShapeSource {
  readShapes(input: ShapeInput): ShapeModel | Promise<ShapeModel>;
}
