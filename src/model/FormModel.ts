import type { NamedNode, Term } from "@rdfjs/types";

/**
 * Schema-agnostic representation of a form. Produced by a {@link SchemaAdapter}
 * (SHACL today, ShEx in the future) and consumed by the React layer, the
 * validation-display layer and the serializer — none of which know SHACL.
 */

/** Editor identifiers are plain strings (e.g. DASH editor IRIs). */
export type EditorId = string;

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
  /** Stable id unique within the form (focusNode + path based). */
  id: string;
  /** The predicate this field edits (sh:path, simple predicate paths in v1). */
  path: NamedNode;
  /** Whether the path is something other than a simple predicate (degraded). */
  pathKind: "predicate" | "complex";
  label: string;
  description?: string;
  editorId: EditorId;
  required: boolean;
  repeatable: boolean;
  minCount: number;
  maxCount?: number;
  order: number;
  groupId: string;
  constraints: FieldConstraints;
  /** Read-only field: shown disabled, no add/remove (e.g. complex sh:path). */
  readOnly?: boolean;
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
