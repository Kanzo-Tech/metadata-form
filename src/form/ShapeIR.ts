/**
 * Vocabulary-agnostic intermediate representation (IR) of a shapes graph.
 *
 * This is the single input to form-building. The rudof engine maps its native
 * SHACL AST into this IR; nothing downstream depends on the shape language.
 *
 * Terms are plain JSON-ish records (NOT @rdfjs/types) so a WASM/JSON AST can
 * produce the exact same IR with zero RDF/JS coupling.
 */

export type LangString = { value: string; language: string };

export type TermValue =
  | { termType: "NamedNode"; value: string }
  | { termType: "BlankNode"; value: string }
  | { termType: "Literal"; value: string; datatype?: string; language?: string };

/** A SHACL property path — a full discriminated union (no dropped complex paths). */
export type PathExpr =
  | { kind: "predicate"; iri: string }
  | { kind: "inverse"; of: PathExpr }
  | { kind: "sequence"; steps: PathExpr[] }
  | { kind: "alternative"; options: PathExpr[] }
  | { kind: "zeroOrMore"; path: PathExpr }
  | { kind: "oneOrMore"; path: PathExpr }
  | { kind: "zeroOrOne"; path: PathExpr };

export interface Cardinality {
  min?: number;
  max?: number;
}

/** Normalized value constraints, named after SHACL Core constraint components. */
export interface ValueConstraints {
  datatype?: string;
  /** sh:nodeKind individual IRI (sh:IRI, sh:Literal, …). */
  nodeKind?: string;
  classIri?: string;
  pattern?: string;
  flags?: string;
  minLength?: number;
  maxLength?: number;
  minInclusive?: number;
  maxInclusive?: number;
  minExclusive?: number;
  maxExclusive?: number;
  /** sh:in, fully resolved. */
  in?: TermValue[];
  hasValue?: TermValue;
  defaultValue?: TermValue;
  uniqueLang?: boolean;
  languageIn?: string[];
}

/**
 * Logical combinators kept as real structure (not flattened to "first option").
 *
 * The members are {@link ShapeIR}, not {@link PropertyShapeIR}, because a
 * combinator takes *shapes* and a shape need not have a path. SHACL says so
 * outright — §4.6.1 defines `sh:or` over "the provided shapes", and the shapes
 * that appear there in practice are pathless ones stating a datatype or a class.
 * Typing these as property shapes is not a simplification but a filter: it makes
 * the common member unrepresentable, and a producer that honours the type has no
 * choice but to drop it.
 */
export interface LogicalConstraints {
  or?: ShapeIR[];
  xone?: ShapeIR[];
  and?: ShapeIR[];
  not?: ShapeIR;
}

/**
 * A conditional requirement stated in SHACL Core as a material implication on a
 * node shape, `sh:or ( [ sh:not C ] T )` (§4.6.1, §4.6.3): the focus conforms when
 * it does not conform to the condition `C`, or conforms to the requirements `T`.
 * The condition itself is not rendered; rudof evaluates it canonically and reports
 * whether the focus conforms to it via {@link ProjectedForm.satisfied}. When it
 * does, the `then` property shapes become visible/required. The branch shapes are
 * flattened to their property shapes so they build into fields with `buildField`.
 */
export interface ConditionalIR {
  /** Stable id of the condition shape `C` (an IRI, or `_:b…` for a blank node) —
   *  matches an entry in {@link ProjectedForm.satisfied} when the focus conforms
   *  to it. */
  conditionId: string;
  /** Id (IRI, or `_:b…` for an anonymous shape) of the shape `T` the `then`
   *  branch comes from. `validateFocus`/`projectForm` accept it, and validating
   *  it reports the branch's own path-level results. */
  thenId?: string;
  /** Property shapes to show/require when the condition holds (`T`). */
  then: PropertyShapeIR[];
  /** Property shapes to show/require when it does not; empty for an implication. */
  else: PropertyShapeIR[];
}

/** Where a shape's editor comes from. `declared` and `scored` are SHACL-UI's;
 *  `branch` and `fallback` are the engine's own, for a shape the score function
 *  returned nothing for. */
export type EditorSource = "declared" | "scored" | "branch" | "fallback";

/** One result of SHACL-UI's score function: an editor and the score of the
 *  `shui:WidgetScore` that matched. */
export interface EditorScore {
  editor: string;
  score: number;
}

/** Presentation hints — vocabulary-agnostic; emitted by rudof from the SHACL-UI
 *  (`shui`) annotations. */
export interface PresentationHints {
  names: LangString[];
  descriptions: LangString[];
  order?: number;
  groupId?: string;
  /** The SHACL-UI editor IRI rudof chose for this shape: the best result of the
   *  score function over the specification's own scoring data, which an explicit
   *  `shui:editor` wins. The UI maps this IRI to a widget. Always present on what
   *  the engine emits. */
  editor: string;
  /** Where {@link editor} comes from. */
  editorSource: EditorSource;
  /** Every result of the score function, best first — the score-function results
   *  only, so absent when {@link editorSource} is `branch` or `fallback`. */
  editors?: EditorScore[];
  /** The `rdfs:label`s the shapes graph holds for the predicate, when the path is
   *  a predicate IRI (SHACL-UI, "Property Labels", step 3). */
  pathLabels?: LangString[];
  /** The SHACL-UI viewer IRI, when stated (read-only display hint). */
  viewer?: string;
  /** `sh:singleLine`: whether a text editor should be one line or several. The
   *  score function has already read it; carried for a widget that wants to. */
  singleLine?: boolean;
}

/**
 * An open record of a constraint component, keyed by its component IRI. Carries
 * every component — including those normalized above — so a rule or widget can
 * react to terms the typed core does not model (custom vocab, new SHACL
 * components) without changing this IR. This is the Open/Closed extension point.
 */
export interface ComponentIR {
  iri: string;
  /** Parameter terms, keyed by parameter name (`"value"` for a plain
   *  predicate/object pair). A `Map`, not a plain object: the engine marshals it
   *  through `serde-wasm-bindgen`, whose default representation of a Rust map is a
   *  JS `Map`. */
  params: Map<string, TermValue[]>;
}

/**
 * A shape: a set of constraints something must conform to.
 *
 * Two things can be under constraint, and `path` is what tells them apart. With a
 * path, the shape is about the *values reached by that path* from whatever is in
 * focus — a {@link PropertyShapeIR}, the thing a field is built from. Without one,
 * the shape is about the focused node **itself**: "be an IRI", "be an
 * `xsd:date`", "be a `dcat:Dataset`".
 *
 * The pathless form has no field of its own and never appears in a node shape's
 * `properties`. It appears inside {@link LogicalConstraints} — as a member of a
 * disjunction, where the node in focus is a *value* of the enclosing property and
 * the branch says what kind of value it may be.
 */
export interface ShapeIR {
  /** Shape id (IRI or blank-node id), when addressable. */
  id?: string;
  /** Absent on a shape that constrains the focused node itself (see above). */
  path?: PathExpr;
  /** Canonical SPARQL-ish path key (`(a/b)`, `^p`) emitted by rudof — matches the
   *  projected {@link ProjectedProperty.pathKey}, so values align without
   *  re-derivation. Absent exactly when {@link path} is. */
  pathKey?: string;
  cardinality: Cardinality;
  value: ValueConstraints;
  logical: LogicalConstraints;
  /** sh:node — nested node-shape id. */
  node?: string;
  presentation: PresentationHints;
  /** Open list of all constraint components (typed-core superset). */
  components: ComponentIR[];
  /** The shape is switched off (SHACL `sh:deactivated true`, §2.1.6): every RDF
   *  term conforms to it, so it constrains nothing and the validator reports
   *  nothing for it. A switched-off property shape therefore builds NO field —
   *  rendering one would collect input that is never validated. Absent/`false`
   *  means active. See {@link NodeShapeIR.deactivated}. */
  deactivated?: boolean;
}

/** A shape that constrains the values of a path — the shape a field is built
 *  from. {@link ShapeIR} with the path present rather than a separate record, so
 *  a disjunction can hold either kind without a second type to convert between. */
export interface PropertyShapeIR extends ShapeIR {
  path: PathExpr;
  pathKey: string;
}

export interface NodeShapeIR {
  id: string;
  targetClasses: string[];
  /** Canonical class for a new instance (the first sh:targetClass). */
  instanceClass?: string;
  properties: PropertyShapeIR[];
  /** Conditionals stated on this node shape as `sh:or ( [ sh:not C ] T )`. Empty/absent when the shape has none. */
  conditionals?: ConditionalIR[];
  /**
   * Combinators declared on the node shape itself, constraining the focused node
   * rather than any one of its properties.
   *
   * The same field as on a property shape, because it is the same construct: a
   * shape may be a disjunction whether or not it has a path. Published profiles
   * lean on this to name a value kind once and reuse it — DCAT-AP declares
   * `:DateOrDateTimeDataType_Shape` as nothing but an `sh:or` of four datatypes
   * and points a dozen properties at it with `sh:node`. Without this field those
   * properties reach the form as a reference to a shape that says nothing.
   */
  logical?: LogicalConstraints;
  /** `sh:closed true` (SHACL §4.8.1): the focus node may carry no property
   *  beyond those the shape declares. Absent when open. */
  closed?: boolean;
  /** `sh:ignoredProperties`: the predicates a closed shape permits anyway. Only
   *  meaningful together with {@link closed}. */
  ignoredProperties?: string[];
  /** The shape is switched off (SHACL `sh:deactivated true`, §2.1.6). Deactivation
   *  applies to shapes generally, node shapes included: a switched-off node shape
   *  builds no fields at all and is never chosen as a form's root shape. */
  deactivated?: boolean;
}

export interface PropertyGroupIR {
  id: string;
  labels: LangString[];
  order?: number;
}

export interface ShapeModel {
  nodeShapes: Map<string, NodeShapeIR>;
  groups: Map<string, PropertyGroupIR>;
  /** Target class IRI → node-shape id, for root-shape resolution. */
  byTargetClass: Map<string, string>;
}

/**
 * The values a focus node holds for each property of a node shape, obtained by
 * evaluating each property path against the data graph. Produced by the engine's
 * `projectForm` (rudof evaluates ALL paths, including complex ones); consumed by
 * form-building to fill {@link ValueSlot}s.
 */
export interface ProjectedValue {
  value: TermValue;
  /** For sh:node properties: the sub-focus node to recurse into. */
  nested?: TermValue;
}

export interface ProjectedProperty {
  /** Canonical path key (see `pathKey`) identifying the property shape. */
  pathKey: string;
  values: ProjectedValue[];
  /** The `rdfs:label`s the data graph holds for the predicate, when the path is a
   *  predicate IRI (SHACL-UI, "Property Labels", step 2). */
  pathLabels?: LangString[];
}

export interface ProjectedForm {
  focus: TermValue;
  properties: ProjectedProperty[];
  /** Conditional evaluation for this focus: the `conditionId`s (see
   *  {@link ConditionalIR}) whose condition the focus currently conforms to. rudof evaluates these canonically with the validator so the UI never
   *  re-implements SHACL conformance. Absent on hand-built IRs (treated as none). */
  satisfied?: string[];
}
