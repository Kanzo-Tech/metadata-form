import type { NamedNode, Term } from "@rdfjs/types";
import type { FieldWrite, PathReadOnlyCode } from "./writePath.js";
import type { EditorScore, EditorSource } from "./ShapeIR.js";

/**
 * Schema-agnostic representation of a form. Produced by `buildFormModel` from the
 * shape IR and consumed by the React layer, the validation-display layer and the
 * serializer — none of which know SHACL.
 */

/** Editor identifiers are plain strings (SHACL-UI editor IRIs). */
export type EditorId = string;

/**
 * Every reason a field shows its values and takes no input.
 *
 * A field needs two answers before it can accept a value: *where* the statement
 * goes, which is the path's business ({@link PathReadOnlyCode}), and *what term*
 * to write, which is the value constraints'. Either can be unanswerable, and the
 * codes stay one union because the field, and the person looking at it, do not
 * care which half failed — only that it did, and why.
 */
export type ReadOnlyCode =
  | PathReadOnlyCode
  /** A disjunction of shapes (`sh:or`) whose every alternative describes a
   *  resource with structure of its own rather than a value that can be typed:
   *  the field would have to offer a shape-picker and a sub-form per branch. */
  | "disjunction-of-shapes"
  /** Several property shapes state this path and contradict each other, so no
   *  term conforms to all of them — `sh:datatype` on one and `sh:nodeKind sh:IRI`
   *  on another, two disjoint enumerations, a `sh:minCount` above a
   *  `sh:maxCount`. The profile permits no value here, and a box whose every
   *  entry is invalid is worse than none. */
  | "unsatisfiable-conjunction";

/** A read-only field's explanation, carried on the field so the UI can show it
 *  instead of a dead input with no account of itself. */
export interface ReadOnlyReason {
  code: ReadOnlyCode;
  /** What the reason is about, as the engine writes it — the path (`(a/b)`, `^p`)
   *  for a path reason. For a surface that wants to name it. */
  detail?: string;
}

/**
 * One arm of a value disjunction (`sh:or`): a complete editor spec for a value
 * that takes this branch.
 *
 * It is deliberately the same two things a field carries — an editor IRI and the
 * constraints that bind a typed term — because that is exactly what a branch
 * changes and all it changes. Rendering the chosen alternative is substituting
 * these two into the field; nothing else about the field is per-alternative,
 * least of all its path, since `sh:or` constrains a property's *values* and never
 * how they are reached.
 */
export interface FieldAlternative {
  /** Stable within the field: the branch shape's id when it has one, else its
   *  position in the disjunction. For React keys and for pinning a choice. */
  id: string;
  /** What to call this alternative in a picker. */
  label: string;
  editorId: EditorId;
  constraints: FieldConstraints;
}

/** A choosable option for enum-like editors (sh:in, instances of a class). */
export interface FieldOption {
  value: Term;
  label?: string;
}

/** Validation-relevant facets surfaced from the schema for client hints. */
export interface FieldConstraints {
  datatype?: string;
  /** sh:nodeKind value IRI, when present. */
  nodeKind?: string;
  /** sh:class target, for IRI-valued reference fields. */
  classIri?: string;
  /**
   * Every class a value may belong to, when the shape allows more than one —
   * an `sh:or` whose branches differ only in `sh:class` (SPHN states this 196
   * times, listing the SNOMED classes a coded value may come from).
   *
   * A *set*, not a second alternative each, because the branches ask for the same
   * control: one reference field, searching all of them. Which class the value
   * turns out to belong to is a fact about the resource the user picks, not a
   * mode they should have to choose first. Present only alongside a `classIri`
   * (the first, so a consumer reading one class still gets a usable one) and only
   * when it holds more than one entry.
   */
  classIn?: string[];
  pattern?: string;
  flags?: string;
  minLength?: number;
  maxLength?: number;
  minInclusive?: number;
  maxInclusive?: number;
  minExclusive?: number;
  maxExclusive?: number;
  /** Fixed allowed values (sh:in) or instance choices. */
  options?: FieldOption[];
  /** Default value to seed an empty slot (sh:defaultValue). */
  defaultValue?: Term;
  /** sh:hasValue — value that must be present. */
  hasValue?: Term;
  /** Only one literal per language allowed (sh:uniqueLang). */
  uniqueLang?: boolean;
  /** Allowed language tags (sh:languageIn) — constrains a `lang` field's picker. */
  languageIn?: string[];
}

/** A single value occurrence of a field. */
export interface ValueSlot {
  /** Stable id for React keys and patch targeting. */
  id: string;
  /** Current value, or null for an empty (not yet filled) slot. */
  value: Term | null;
  /** Nested sub-form, present when this slot edits a node shape. */
  nested?: FormModel;
}

export interface FieldModel {
  /** Stable id unique within the form: `${focusNode}|${path}`. */
  id: string;
  /**
   * The property path this field is about, as a term carrying the engine's
   * canonical path key: the predicate IRI for a predicate path, and the SPARQL-ish
   * surface form for the rest (`^p`, `(a|b)`, `(a/b)`). It is an **identity**, not
   * necessarily a legal IRI — one key for the field, its projected values and its
   * validation results, so `id === fieldKey(focusNode, path)` always holds.
   * What a value is actually *written* as is {@link write}, not this.
   */
  path: NamedNode;
  /** Whether the path is a plain predicate or one of the six composed kinds. */
  pathKind: "predicate" | "complex";
  label: string;
  description?: string;
  editorId: EditorId;
  /** Where {@link editorId} comes from: an editor the profile `declared`, the best
   *  one the SHACL-UI score function `scored`, the editor of the first `sh:or`
   *  `branch`, or the engine's plain `fallback`. */
  editorSource: EditorSource;
  /** Every result of the score function for the field's shape, best first. Absent
   *  when the editor was not scored (`branch`, `fallback`). */
  editors?: EditorScore[];
  required: boolean;
  repeatable: boolean;
  minCount: number;
  maxCount?: number;
  order: number;
  groupId: string;
  constraints: FieldConstraints;
  /**
   * The arms of a value disjunction the user must choose between, in the order
   * the profile listed them. Present only when a `sh:or` on this property left
   * more than one *kind* of value open — a disjunction that resolved to a single
   * editor is folded into {@link constraints} instead, and leaves this absent.
   *
   * {@link editorId} and {@link constraints} are always the first alternative's,
   * so a surface that ignores this field renders a working control for one arm of
   * the disjunction rather than nothing. A surface that honours it renders the
   * picker and substitutes the chosen arm — see `alternativeFor`, which says
   * which arm an existing value is already on.
   */
  alternatives?: FieldAlternative[];
  /**
   * How a value of this field is asserted in the graph — the write half of the
   * path, which a shape language only defines for reading. Present exactly when
   * the field is editable; `readOnly` and {@link readOnlyReason} are its absence
   * seen from the other side.
   */
  write?: FieldWrite;
  /** Read-only field: shown disabled, no add/remove. Always accompanied by
   *  {@link readOnlyReason}, so no field is ever dead without an account. */
  readOnly?: boolean;
  /** Why the field takes no input — a stable code the UI turns into a sentence in
   *  the reader's language (`strings.readOnly`) next to the disabled control. */
  readOnlyReason?: ReadOnlyReason;
  /** Present when this field comes from a conditional's requirements (the `then`
   *  branch of an `sh:or ( [ sh:not C ] T )` implication). It is only in the model
   *  when its branch is active for the current focus, so it needs no per-render
   *  gate; carried for validation routing and inspection. */
  guard?: { conditionId: string; branch: "then" | "else" };
  /** Shape reference for nested node shapes (sh:node), if any. */
  nodeShape?: NamedNode | null;
  /** rdf:type to stamp on freshly created nested resources, if known. */
  nestedTypeIri?: string;
  /** Current value slots projected from the data graph. */
  values: ValueSlot[];
}

export interface GroupModel {
  id: string;
  label?: string;
  order: number;
  fields: FieldModel[];
}

export interface FormModel {
  /** Subject being edited. */
  focusNode: Term;
  /** The node shape that produced this (sub)form. */
  shape: Term;
  groups: GroupModel[];
}

/** Flatten all fields across groups, in render order. */
export function allFields(model: FormModel): FieldModel[] {
  return model.groups.flatMap((g) => g.fields);
}
