import { Editors } from "../vocab/shacl-ui.js";
import { SH_IRI } from "../vocab/shacl.js";
import { NUMERIC } from "./widgetMap.js";
import { NS } from "../../rdf/factory.js";
import type { EditorId } from "../../model/FormModel.js";
import type { PropertyShapeIR } from "../../model/ShapeIR.js";

const XSD = NS.xsd;
const RDF_LANGSTRING = `${NS.rdf}langString`;
const RDF_HTML = `${NS.rdf}HTML`;

/**
 * Neutral facts a rule sees, derived from a {@link PropertyShapeIR} by
 * {@link deriveContext}. Rules never touch RDF/n3.
 */
export interface ResolutionContext {
  property: PropertyShapeIR;
  /** Canonical (alias-folded) explicit editor IRI, if the shape stated one. */
  explicitEditor?: string;
  datatype?: string;
  nodeKind?: string;
  classIri?: string;
  hasIn: boolean;
  hasNode: boolean;
  singleLine?: boolean;
  /** sh:or / sh:xone branches, for the explicit branch-fallback rule. */
  branches: PropertyShapeIR[];
}

export interface EditorRule {
  /** Stable name for ordering, overriding and debugging. */
  name: string;
  /** Return an editor IRI to claim the property, or undefined to defer. */
  resolve(ctx: ResolutionContext): EditorId | undefined;
}

export interface EditorResolver {
  /** Resolve an editor; never fails (falls back to a text field). */
  resolve(ctx: ResolutionContext): EditorId;
  use(rule: EditorRule, opts?: { before?: string; after?: string }): EditorResolver;
  remove(name: string): EditorResolver;
}

/** Build a {@link ResolutionContext} from a property's IR. Shared by
 *  form-building and the branch-fallback rule, so the derivation lives once. */
export function deriveContext(property: PropertyShapeIR): ResolutionContext {
  const v = property.value;
  return {
    property,
    explicitEditor: property.presentation.editor,
    datatype: v.datatype,
    nodeKind: v.nodeKind,
    classIri: v.classIri,
    hasIn: !!v.in && v.in.length > 0,
    hasNode: !!property.node,
    singleLine: property.presentation.singleLine,
    branches: property.logical.or ?? property.logical.xone ?? [],
  };
}

function firstMatch(rules: EditorRule[], ctx: ResolutionContext): EditorId | undefined {
  for (const rule of rules) {
    const editor = rule.resolve(ctx);
    if (editor) return editor;
  }
  return undefined;
}

/** Typed rules, in order. Excludes the branch fallback and the final text
 *  fallback so the branch rule can reuse them without recursing. */
const coreEditorRules: EditorRule[] = [
  { name: "explicit-editor", resolve: (c) => c.explicitEditor },
  { name: "nested-node", resolve: (c) => (c.hasNode ? Editors.Details : undefined) },
  { name: "enumeration", resolve: (c) => (c.hasIn ? Editors.EnumSelect : undefined) },
  { name: "xsd-boolean", resolve: (c) => (c.datatype === `${XSD}boolean` ? Editors.Boolean : undefined) },
  { name: "xsd-date", resolve: (c) => (c.datatype === `${XSD}date` ? Editors.DatePicker : undefined) },
  { name: "xsd-datetime", resolve: (c) => (c.datatype === `${XSD}dateTime` ? Editors.DateTimePicker : undefined) },
  { name: "rdf-html", resolve: (c) => (c.datatype === RDF_HTML ? Editors.RichText : undefined) },
  {
    name: "rdf-langstring",
    resolve: (c) =>
      c.datatype === RDF_LANGSTRING
        ? c.singleLine === false
          ? Editors.TextAreaWithLang
          : Editors.TextFieldWithLang
        : undefined,
  },
  { name: "numeric", resolve: (c) => (c.datatype && NUMERIC.has(c.datatype) ? Editors.NumberField : undefined) },
  { name: "class-reference", resolve: (c) => (c.classIri ? Editors.AutoComplete : undefined) },
  {
    name: "iri-node",
    resolve: (c) => (c.nodeKind === SH_IRI || c.datatype === `${XSD}anyURI` ? Editors.IRI : undefined),
  },
];

/**
 * Default editor-resolution rules, in order (first match wins). A faithful,
 * named decomposition of the legacy DASH switch, emitting canonical SHACL-UI
 * editor IRIs. Every rule is individually overridable / removable.
 */
export const defaultEditorRules: EditorRule[] = [
  ...coreEditorRules,
  {
    // When a property states no own type facts, derive the editor from its first
    // sh:or / sh:xone branch. The legacy "first alternative" scavenge, now an
    // explicit, removable rule operating on real branches.
    name: "or-branch-fallback",
    resolve: (c) => {
      if (c.datatype || c.nodeKind || c.classIri || c.hasNode) return undefined;
      const first = c.branches[0];
      return first ? firstMatch(coreEditorRules, deriveContext(first)) : undefined;
    },
  },
  { name: "multiline-fallback", resolve: (c) => (c.singleLine === false ? Editors.TextArea : undefined) },
  { name: "text-fallback", resolve: () => Editors.TextField },
];

/**
 * Create an editor resolver from an ordered rule list (defaults to
 * {@link defaultEditorRules}). Rules can be inserted (before/after a named
 * rule), appended or removed without touching the engine.
 */
export function createEditorResolver(rules: EditorRule[] = defaultEditorRules): EditorResolver {
  const list = [...rules];

  const resolver: EditorResolver = {
    resolve(ctx) {
      return firstMatch(list, ctx) ?? Editors.TextField;
    },
    use(rule, opts) {
      const anchor = opts?.before ?? opts?.after;
      if (anchor) {
        const idx = list.findIndex((r) => r.name === anchor);
        if (idx !== -1) {
          list.splice(opts?.before ? idx : idx + 1, 0, rule);
          return resolver;
        }
      }
      list.push(rule);
      return resolver;
    },
    remove(name) {
      const idx = list.findIndex((r) => r.name === name);
      if (idx !== -1) list.splice(idx, 1);
      return resolver;
    },
  };

  return resolver;
}
