import type {
  LangString,
  NodeShapeIR,
  ProjectedForm,
  PropertyGroupIR,
  TermValue,
} from "../form/ShapeIR.js";

/**
 * The ABI contract for the `rudof_wasm` crate (rudof fork) — exactly what the
 * `#[wasm_bindgen]` surface exposes to JavaScript. The TypeScript side
 * (`RudofEngine`) programs against this; the wasm module is wired in via the
 * loader.
 *
 * Marshalling: terms cross the boundary as {@link TermValue} JSON records;
 * shapes cross as {@link ShapeModelJson} (the IR with arrays instead of Maps);
 * the rest are plain strings/JSON. (Assumes serde-wasm-bindgen on the Rust side.)
 */

/** The IR's {@link ShapeModel} in a JSON-serializable (Map-free) form. */
export interface ShapeModelJson {
  nodeShapes: NodeShapeIR[];
  groups: PropertyGroupIR[];
  byTargetClass: [string, string][];
}

export interface RudofQuad {
  subject: TermValue;
  predicate: TermValue;
  object: TermValue;
}

export interface RudofResult {
  focusNode: TermValue;
  path?: TermValue;
  /** The path as its canonical key, for every path kind — `path` above carries
   *  a predicate only, so an inverse or alternative used to arrive with no path
   *  at all and its error was filed at node level. Produced by the same
   *  serialiser that keys the projected fields; see `shapes::path_key`. */
  pathKey?: string;
  value?: TermValue;
  /** Lang-tagged messages. The shape's own `sh:message` literals, copied exactly;
   *  when it has none, the engine's default wording, one message per language of its
   *  catalog. The TS side picks the best by locale. */
  message: LangString[];
  severity?: string;
  sourceConstraintComponent?: string;
}

export interface RudofReport {
  conforms: boolean;
  results: RudofResult[];
}

/**
 * One form session = one rudof instance holding the current shapes + the current
 * data graph. Mirrors rudof's stateful `Rudof` facade. All graph mutations and
 * queries are small boundary calls against the in-wasm store (no re-serialization
 * per edit).
 */
export interface RudofSession {
  /** Parse shapes (SHACL or ShEx) into the IR JSON and retain them. `base` is the
   *  document base relative IRIs resolve against, when the caller knows it. */
  loadShapes(text: string, mediaType: string, base?: string): ShapeModelJson;
  /** Parse a data document as the current graph. `base` as for {@link loadShapes}. */
  loadData(text: string, mediaType: string, base?: string): void;
  /** Replace the current graph with an empty one. */
  newData(): void;
  /** Add default validation messages: `sh:message` literals on constraint
   *  components (`sh:MinCountConstraintComponent sh:message "…"@fr`, with
   *  `{$minCount}`-style placeholders), used for a result whose shape has no
   *  `sh:message`. They extend the built-in English, Spanish and Catalan messages;
   *  per component and language the later document wins. `mediaType` defaults to
   *  Turtle. */
  loadMessages(text: string, mediaType?: string): void;

  add(subject: TermValue, predicate: TermValue, object: TermValue): void;
  remove(subject: TermValue, predicate: TermValue, object: TermValue): void;
  /** Quads matching the pattern; null positions are wildcards. */
  quads(
    subject: TermValue | null,
    predicate: TermValue | null,
    object: TermValue | null,
  ): RudofQuad[];
  serialize(mediaType: string): string;
  /** Serialize only the subgraph reachable from `focus` (the focus-scoped form
   *  output), vs whole-graph {@link serialize}. */
  serializeFocus(focus: TermValue, mediaType: string): string;

  /** Evaluate every property path of `shapeId` for `focus` against the graph. */
  projectForm(focus: TermValue, shapeId: string): ProjectedForm;
  /** Validate the current graph (optionally scoped) against the loaded shapes. */
  validate(shapeId: string | null): RudofReport;
  /** Validate a single focus node against one shape (the scoped path, via the
   *  validator's `validate_focus`). For per-field/per-node revalidation. */
  validateFocus(focus: TermValue, shapeId: string): RudofReport;
}

export interface RudofModule {
  /** Create a fresh, independent session (shapes + graph). */
  newSession(): RudofSession;
}

/** Async loader for the wasm module (instantiates + initializes it once). */
export type RudofLoader = () => Promise<RudofModule>;
