import type { Store } from "n3";
import type { Literal, NamedNode, Term } from "@rdfjs/types";
import { sh, dash, rdf, namedNode } from "../../rdf/factory.js";
import {
  booleanValue,
  literalValue,
  literals,
  namedNodeValue,
  numberValue,
  object,
  objects,
  rdfList,
} from "./graphReader.js";

export interface ShaclPropertyShape {
  /** Simple predicate path, or null when the path is complex/unsupported. */
  path: NamedNode | null;
  pathKind: "predicate" | "complex";
  /** Predicate of a `sh:inversePath`, when the path is the inverse of one. */
  inversePath: NamedNode | null;
  names: Literal[];
  descriptions: Literal[];
  order: number | undefined;
  group: NamedNode | null;
  minCount: number | undefined;
  maxCount: number | undefined;
  datatype: string | undefined;
  nodeKind: string | undefined;
  classIri: string | undefined;
  inList: Term[] | null;
  node: NamedNode | null;
  /** sh:or / sh:xone alternative shapes (heads of RDF lists). */
  alternatives: Term[];
  editor: string | undefined;
  viewer: string | undefined;
  singleLine: boolean | undefined;
  pattern: string | undefined;
  flags: string | undefined;
  minLength: number | undefined;
  maxLength: number | undefined;
  minInclusive: number | undefined;
  maxInclusive: number | undefined;
  minExclusive: number | undefined;
  maxExclusive: number | undefined;
  hasValue: Term | undefined;
  defaultValue: Term | undefined;
  uniqueLang: boolean | undefined;
}

export interface ShaclNodeShape {
  id: Term;
  targetClasses: NamedNode[];
  /** dash:rootClass — the class new instances of this shape get (DASH). */
  rootClass: NamedNode | null;
  properties: ShaclPropertyShape[];
}

/** The canonical class of a new instance of a shape: dash:rootClass ?? first sh:targetClass. */
export function instanceClass(shape: ShaclNodeShape): NamedNode | undefined {
  return shape.rootClass ?? shape.targetClasses[0];
}

export interface ShaclPropertyGroup {
  id: string;
  labels: Literal[];
  order: number | undefined;
}

export interface ShapesGraph {
  store: Store;
  nodeShapes: Map<string, ShaclNodeShape>;
  groups: Map<string, ShaclPropertyGroup>;
  /** target class IRI → node shape id. */
  byTargetClass: Map<string, string>;
}

const SH_PROPERTY = namedNode(sh("property").value);
const SH_PATH = namedNode(sh("path").value);
const SH_INVERSE_PATH = namedNode(sh("inversePath").value);
const SH_NAME = namedNode(sh("name").value);
const SH_DESCRIPTION = namedNode(sh("description").value);
const SH_ORDER = namedNode(sh("order").value);
const SH_GROUP = namedNode(sh("group").value);
const SH_MIN_COUNT = namedNode(sh("minCount").value);
const SH_MAX_COUNT = namedNode(sh("maxCount").value);
const SH_DATATYPE = namedNode(sh("datatype").value);
const SH_NODEKIND = namedNode(sh("nodeKind").value);
const SH_CLASS = namedNode(sh("class").value);
const SH_IN = namedNode(sh("in").value);
const SH_NODE = namedNode(sh("node").value);
const SH_OR = namedNode(sh("or").value);
const SH_XONE = namedNode(sh("xone").value);
const SH_PATTERN = namedNode(sh("pattern").value);
const SH_FLAGS = namedNode(sh("flags").value);
const SH_MIN_LENGTH = namedNode(sh("minLength").value);
const SH_MAX_LENGTH = namedNode(sh("maxLength").value);
const SH_MIN_INCLUSIVE = namedNode(sh("minInclusive").value);
const SH_MAX_INCLUSIVE = namedNode(sh("maxInclusive").value);
const SH_MIN_EXCLUSIVE = namedNode(sh("minExclusive").value);
const SH_MAX_EXCLUSIVE = namedNode(sh("maxExclusive").value);
const SH_HAS_VALUE = namedNode(sh("hasValue").value);
const SH_DEFAULT_VALUE = namedNode(sh("defaultValue").value);
const SH_UNIQUE_LANG = namedNode(sh("uniqueLang").value);
const SH_TARGET_CLASS = namedNode(sh("targetClass").value);
const SH_NODE_SHAPE = namedNode(sh("NodeShape").value);
const SH_PROPERTY_GROUP = namedNode(sh("PropertyGroup").value);
const DASH_EDITOR = namedNode(dash("editor").value);
const DASH_VIEWER = namedNode(dash("viewer").value);
const DASH_SINGLE_LINE = namedNode(dash("singleLine").value);
const DASH_ROOT_CLASS = namedNode(dash("rootClass").value);
const RDF_TYPE = namedNode(rdf("type").value);
const RDFS_LABEL = namedNode("http://www.w3.org/2000/01/rdf-schema#label");

function readPropertyShape(store: Store, ps: Term): ShaclPropertyShape {
  const pathTerm = object(store, ps, SH_PATH);
  const isPredicate = pathTerm?.termType === "NamedNode";
  // sh:inversePath is the one complex path we surface (read-only): [ sh:inversePath ex:p ].
  const inverseTerm = !isPredicate && pathTerm ? object(store, pathTerm, SH_INVERSE_PATH) : undefined;
  const inversePath = inverseTerm?.termType === "NamedNode" ? (inverseTerm as NamedNode) : null;
  const alternatives = readAlternatives(store, ps);
  // When a property uses sh:or/sh:xone, fall back to the first alternative for
  // editor-relevant facts (datatype / nodeKind / class / node) it doesn't state.
  const alt = alternatives[0];
  const altOf = (pred: NamedNode) => (alt ? namedNodeValue(store, alt, pred) : undefined);

  return {
    path: isPredicate ? (pathTerm as NamedNode) : null,
    pathKind: isPredicate ? "predicate" : "complex",
    inversePath,
    names: literals(store, ps, SH_NAME),
    descriptions: literals(store, ps, SH_DESCRIPTION),
    order: numberValue(store, ps, SH_ORDER),
    group: namedNodeValue(store, ps, SH_GROUP) ?? null,
    minCount: numberValue(store, ps, SH_MIN_COUNT),
    maxCount: numberValue(store, ps, SH_MAX_COUNT),
    datatype: (namedNodeValue(store, ps, SH_DATATYPE) ?? altOf(SH_DATATYPE))?.value,
    nodeKind: (namedNodeValue(store, ps, SH_NODEKIND) ?? altOf(SH_NODEKIND))?.value,
    classIri: (namedNodeValue(store, ps, SH_CLASS) ?? altOf(SH_CLASS))?.value,
    inList: readIn(store, ps),
    node: namedNodeValue(store, ps, SH_NODE) ?? altOf(SH_NODE) ?? null,
    alternatives,
    editor: namedNodeValue(store, ps, DASH_EDITOR)?.value,
    viewer: namedNodeValue(store, ps, DASH_VIEWER)?.value,
    singleLine: booleanValue(store, ps, DASH_SINGLE_LINE),
    pattern: literalValue(store, ps, SH_PATTERN),
    flags: literalValue(store, ps, SH_FLAGS),
    minLength: numberValue(store, ps, SH_MIN_LENGTH),
    maxLength: numberValue(store, ps, SH_MAX_LENGTH),
    minInclusive: numberValue(store, ps, SH_MIN_INCLUSIVE),
    maxInclusive: numberValue(store, ps, SH_MAX_INCLUSIVE),
    minExclusive: numberValue(store, ps, SH_MIN_EXCLUSIVE),
    maxExclusive: numberValue(store, ps, SH_MAX_EXCLUSIVE),
    hasValue: object(store, ps, SH_HAS_VALUE),
    defaultValue: object(store, ps, SH_DEFAULT_VALUE),
    uniqueLang: booleanValue(store, ps, SH_UNIQUE_LANG),
  };
}

function readIn(store: Store, ps: Term): Term[] | null {
  const head = object(store, ps, SH_IN);
  return head ? rdfList(store, head) : null;
}

function readAlternatives(store: Store, ps: Term): Term[] {
  const out: Term[] = [];
  for (const pred of [SH_OR, SH_XONE]) {
    const head = object(store, ps, pred);
    if (head) out.push(...rdfList(store, head));
  }
  return out;
}

function readNodeShape(store: Store, id: Term): ShaclNodeShape {
  const properties = objects(store, id, SH_PROPERTY).map((ps) => readPropertyShape(store, ps));
  const targetClasses = objects(store, id, SH_TARGET_CLASS).filter(
    (t): t is NamedNode => t.termType === "NamedNode",
  );
  return { id, targetClasses, rootClass: namedNodeValue(store, id, DASH_ROOT_CLASS) ?? null, properties };
}

/** Parse a shapes graph into structured node shapes and property groups. */
export function readShapesGraph(store: Store): ShapesGraph {
  const nodeShapes = new Map<string, ShaclNodeShape>();
  const byTargetClass = new Map<string, string>();
  const groups = new Map<string, ShaclPropertyGroup>();

  // Node shapes: explicitly typed, plus any subject carrying sh:property.
  const candidates = new Set<string>();
  const candidateTerms = new Map<string, Term>();
  for (const q of store.getQuads(null, RDF_TYPE, SH_NODE_SHAPE, null)) {
    candidates.add(q.subject.value);
    candidateTerms.set(q.subject.value, q.subject);
  }
  for (const q of store.getQuads(null, SH_PROPERTY, null, null)) {
    candidates.add(q.subject.value);
    candidateTerms.set(q.subject.value, q.subject);
  }

  for (const id of candidates) {
    const term = candidateTerms.get(id)!;
    const shape = readNodeShape(store, term);
    nodeShapes.set(id, shape);
    for (const tc of shape.targetClasses) byTargetClass.set(tc.value, id);
  }

  for (const q of store.getQuads(null, RDF_TYPE, SH_PROPERTY_GROUP, null)) {
    groups.set(q.subject.value, {
      id: q.subject.value,
      labels: literals(store, q.subject, RDFS_LABEL),
      order: numberValue(store, q.subject, SH_ORDER),
    });
  }

  return { store, nodeShapes, groups, byTargetClass };
}
