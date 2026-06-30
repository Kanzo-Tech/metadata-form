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

/** Logical combinators kept as real structure (not flattened to "first option"). */
export interface LogicalConstraints {
  or?: PropertyShapeIR[];
  xone?: PropertyShapeIR[];
  and?: PropertyShapeIR[];
  not?: PropertyShapeIR;
}

/** Presentation hints — vocabulary-agnostic; populated from SHACL-UI (or legacy). */
export interface PresentationHints {
  names: LangString[];
  descriptions: LangString[];
  order?: number;
  groupId?: string;
  /** Canonical (alias-folded) SHACL-UI editor IRI, if the shape stated one. */
  editor?: string;
  viewer?: string;
  singleLine?: boolean;
}

/**
 * An open record of a constraint component, keyed by its component IRI. Carries
 * every component — including those normalized above — so a rule or widget can
 * react to terms the typed core does not model (custom vocab, new SHACL 1.2
 * components) without changing this IR. This is the Open/Closed extension point.
 */
export interface ComponentIR {
  iri: string;
  params: Record<string, TermValue[]>;
}

export interface PropertyShapeIR {
  /** Shape id (IRI or blank-node id), when addressable. */
  id?: string;
  path: PathExpr;
  cardinality: Cardinality;
  value: ValueConstraints;
  logical: LogicalConstraints;
  /** sh:node — nested node-shape id. */
  node?: string;
  presentation: PresentationHints;
  /** Open list of all constraint components (typed-core superset). */
  components: ComponentIR[];
}

export interface NodeShapeIR {
  id: string;
  targetClasses: string[];
  /** Canonical class for a new instance (the first sh:targetClass). */
  instanceClass?: string;
  properties: PropertyShapeIR[];
  closed?: boolean;
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
}

export interface ProjectedForm {
  focus: TermValue;
  properties: ProjectedProperty[];
}
