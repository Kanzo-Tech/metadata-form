import type { Term } from "@rdfjs/types";
import { toTerm } from "../engine/termValue.js";
import { localName, pickByLanguage } from "../engine/terms.js";
import { editorForConstraints } from "./editors.js";
import { SH_BLANK_NODE, SH_IRI } from "./vocab/shacl.js";
import type { FieldAlternative, FieldConstraints, FieldOption } from "./FormModel.js";
import type { ShapeIR, ValueConstraints } from "./ShapeIR.js";

/**
 * What a disjunction of shapes means for one field.
 *
 * SHACL §4.6.1: `sh:or` holds a list of shapes, and the constraint is satisfied
 * when **each value node conforms to at least one** of them. Three things follow,
 * and between them they decide everything below.
 *
 * **It constrains values, not the property.** So it cannot change the field's
 * path, its cardinality, or whether the field exists. In particular a
 * `sh:minCount` *inside* a branch counts the values of that branch's own path
 * from the value node — it is not this field's cardinality, and adding it to this
 * field's would be reading a sentence about one subject as a sentence about
 * another. `planWrite` is untouched by any of this: where a statement goes is the
 * path's business, and `sh:or` never speaks about the path.
 *
 * **It is per value.** Two values of the same field may take different branches.
 * A field renders one editor for all of its values, so a disjunction whose
 * branches disagree about what a value *is* cannot be one editor — unless the
 * user is given the choice the shape gives them, per value. That is
 * {@link FieldAlternative}.
 *
 * **It only narrows.** The property's own constraints still apply, conjunctively;
 * the disjunction never widens them. This is what makes it safe to render fewer
 * branches than the profile lists: anything the user can then enter still
 * conforms to some branch, and so to the `sh:or`. It is not safe in the other
 * direction, which is why nothing here is ever merged into a single looser
 * control.
 *
 * ## The line this module draws
 *
 * A branch is renderable when it constrains the value node *itself*, through
 * facets a field already binds to a term: a datatype, a node kind, a class, an
 * enumeration, and the bounds that decorate them. That is a description of a
 * value, and a value is what an editor collects.
 *
 * A branch is not renderable when it is a shape about the value's own
 * **structure** — it has a path of its own, or an `sh:node`, or a combinator
 * nested inside it. "Be a resource that has a `skos:inScheme` of X" is not a kind
 * of value; it is a form. Offering one would mean a shape-picker over N sub-forms,
 * and nothing in the field model expresses that. So such a branch is dropped, and
 * a field left with **no** renderable branch is refused outright — read-only,
 * with `disjunction-of-shapes` as the reason. That refusal is the point: today
 * such a field renders as a bare text box, and a text box under a shape that
 * accepts no literal at all is a box whose every entry will be rejected. Not
 * offering it is more use than offering it.
 *
 * ## Measured
 *
 * Across the nine published profiles in E1, every `sh:or` on a property shape
 * (201 of 213 occurrences) is a pathless value-kind disjunction: 196 SPHN
 * properties listing the SNOMED/UCUM classes a coded value may come from, 3
 * listing `xsd:double | xsd:string`, and 2 DCAT-AP.de properties offering an IRI
 * or an inline `dct:Location`. The remaining 12 sit on node shapes, and 5 of
 * those are reached by `sh:node` from 16 property shapes — see `nodeDisjunction`.
 */

/** A branch the field will not render, and the reason, for `onDiagnostic`. */
export interface DroppedBranch {
  /** Position in the disjunction, as the profile listed it. */
  index: number;
  /** Branch shape id when it has one. */
  id?: string;
  /**
   * `structure` — the branch described a resource with a shape of its own, so it
   * ruled values out that this field can no longer offer. A disjunction of
   * nothing but these is a refusal.
   *
   * `no-kind` — the branch stated no kind of value, so every value conforms to
   * it and the whole disjunction is satisfied by anything. Nothing was ruled out,
   * and nothing is lost by ignoring it.
   */
  code: "structure" | "no-kind";
  why: string;
}

/** What to do with a property's disjunction. */
export type Disjunction =
  /** The control stays as the property's own facts made it — because the
   *  disjunction rules nothing out, or because every arm it does rule out was one
   *  this field could not have offered anyway. Either way `sh:or` only narrows, so
   *  leaving the control alone can never let through something it forbids. */
  | { kind: "vacuous"; dropped: DroppedBranch[] }
  /** One alternative folds into the field; two or more need a picker. */
  | { kind: "renderable"; alternatives: FieldAlternative[]; dropped: DroppedBranch[] }
  /** Every branch described a structure. The field takes no input. */
  | { kind: "refused"; dropped: DroppedBranch[] };

export interface DisjunctionArgs {
  /** The `sh:or` members, in the order the profile listed them. */
  branches: readonly ShapeIR[];
  /** The property's own value constraints. They win on any facet both state:
   *  the two are conjoined, and where a branch contradicts the property nothing
   *  satisfies both, so the property's — which holds for every value — is the
   *  one worth rendering. */
  own: FieldConstraints;
  /** Field id, for alternative ids the profile left anonymous. */
  fieldId: string;
  locale?: string;
  /**
   * Whether the property already offers a usable control without the disjunction
   * — that is, whether its own facts (or a stated `shui:editor`) resolved to
   * something other than the bare text default.
   *
   * It decides whether an unrenderable disjunction is a refusal or is simply left
   * alone, and the difference matters. DCAT-AP writes `dct:spatial` as
   * `sh:nodeKind sh:IRI` *plus* an `sh:or` of four controlled-vocabulary
   * restrictions: the disjunction narrows which IRIs are acceptable, and the IRI
   * box is right either way. Refusing there would take away a working control to
   * report a narrowing the validator reports anyway. Refusing is right only when
   * the disjunction was the ONLY thing saying what the value is, and what is left
   * without it is a text box under a shape that accepts no text.
   */
  ownControl: boolean;
}

/**
 * The facets an alternative may carry.
 *
 * A closed list rather than an open one, because the question is not "did we
 * copy this across" but "can an editor enforce it". Anything outside it — a path,
 * an `sh:node`, a nested combinator, a cardinality, an `sh:hasValue` — is a
 * statement about a resource's structure or its identity, not about the kind of
 * value being collected, and is what makes a branch unrenderable.
 */
const FACETS = [
  "datatype", "nodeKind", "classIri", "in", "pattern", "flags",
  "minLength", "maxLength", "minInclusive", "maxInclusive",
  "minExclusive", "maxExclusive", "languageIn", "uniqueLang",
] as const satisfies readonly (keyof ValueConstraints)[];

const FACET_SET: ReadonlySet<string> = new Set(FACETS);

/** The facets that say what *kind* of value this is. A branch stating none of
 *  them describes no kind, so it adds nothing an editor could act on. */
const KINDS = ["datatype", "nodeKind", "classIri", "in"] as const;

/**
 * The SHACL terms a branch may carry and still be a description of a value: the
 * parameters of the facets above, and the annotations that name and explain a
 * shape without constraining anything.
 *
 * Checked against the branch's open component bag rather than only against its
 * typed constraints, because the typed core does not model every SHACL term, and
 * a branch whose whole content the core cannot see arrives looking empty. That is
 * exactly the `sh:property` branch — "be a resource that has *this* property" —
 * which is the shape of every structural disjunction in the corpus. Reading it as
 * an unconstrained branch would turn a refusal into a shrug.
 *
 * An unrecognised `sh:` term is therefore treated as a demand we have not
 * modelled, not as noise. Terms outside the SHACL namespace are left alone: a
 * profile's own vocabulary on a shape is documentation until someone says
 * otherwise, and it is not this module's claim to make.
 */
const BRANCH_TERMS: ReadonlySet<string> = new Set([
  // the facets, by their SHACL parameter names
  "datatype", "nodeKind", "class", "in", "pattern", "flags",
  "minLength", "maxLength", "minInclusive", "maxInclusive",
  "minExclusive", "maxExclusive", "languageIn", "uniqueLang",
  // annotation, not constraint
  "name", "description", "order", "group", "message", "severity",
  "defaultValue", "deactivated",
]);

const SH_NS = SH_IRI.slice(0, SH_IRI.length - "IRI".length);

type Rejection = Pick<DroppedBranch, "code" | "why">;

const structural = (why: string): Rejection => ({ code: "structure", why });

/** Why this branch cannot be an alternative, or undefined if it can. */
function unrenderable(b: ShapeIR): Rejection | undefined {
  if (b.path) {
    return structural("it constrains a property of the value rather than the value itself");
  }
  if (b.node) return structural("it requires the value to conform to another node shape");
  const { or, and, xone, not } = b.logical;
  if (or?.length || and?.length || xone?.length || not) {
    return structural("it is itself a combination of shapes");
  }
  if (b.cardinality.min !== undefined || b.cardinality.max !== undefined) {
    return structural("it counts the values of a path it does not have");
  }
  for (const key of Object.keys(b.value)) {
    if (b.value[key as keyof ValueConstraints] === undefined) continue;
    if (!FACET_SET.has(key)) {
      return structural(`it states sh:${key}, which describes a value's identity rather than its kind`);
    }
  }
  // A blank node has no lexical form: there is nothing a user could type that
  // would produce one, and with no `sh:node` there is no sub-form to build for it
  // either. `sh:BlankNodeOrIRI` is not this case — an IRI satisfies it.
  if (b.value.nodeKind === SH_BLANK_NODE) {
    return structural("it asks for a blank node, which has no form a user can enter");
  }
  for (const c of b.components) {
    if (!c.iri.startsWith(SH_NS)) continue;
    const term = c.iri.slice(SH_NS.length);
    if (!BRANCH_TERMS.has(term)) {
      return structural(`it states sh:${term}, which describes a resource rather than a value`);
    }
  }
  // A deactivated shape constrains nothing (SHACL 2.1.6), so a disjunction with
  // one in it is satisfied by everything.
  if (b.deactivated) {
    return { code: "no-kind", why: "it is sh:deactivated, so every value conforms to it" };
  }
  if (!KINDS.some((k) => b.value[k] !== undefined)) {
    return { code: "no-kind", why: "it states no kind of value, so every value conforms to it" };
  }
  return undefined;
}

/** A branch's facets as field constraints, with the property's own winning. */
function constraintsOf(b: ShapeIR, own: FieldConstraints): FieldConstraints {
  const v = b.value;
  const merged: FieldConstraints = { ...own };
  const put = <K extends keyof FieldConstraints>(key: K, value: FieldConstraints[K]) => {
    if (merged[key] === undefined && value !== undefined) merged[key] = value;
  };
  put("datatype", v.datatype);
  put("nodeKind", v.nodeKind);
  put("classIri", v.classIri);
  put("pattern", v.pattern);
  put("flags", v.flags);
  put("minLength", v.minLength);
  put("maxLength", v.maxLength);
  put("minInclusive", v.minInclusive);
  put("maxInclusive", v.maxInclusive);
  put("minExclusive", v.minExclusive);
  put("maxExclusive", v.maxExclusive);
  put("languageIn", v.languageIn);
  put("uniqueLang", v.uniqueLang);
  if (merged.options === undefined && v.in?.length) {
    merged.options = v.in.map(optionOf);
  }
  return merged;
}

function optionOf(tv: NonNullable<ValueConstraints["in"]>[number]): FieldOption {
  return {
    value: toTerm(tv),
    label: tv.termType === "Literal" ? tv.value : localName(tv.value),
  };
}

/**
 * Which branches are the same question asked about different subjects.
 *
 * Two branches that agree on every facet except `sh:class` (or except `sh:in`)
 * are one control: a reference field searching both classes, an enumeration
 * offering both lists. Making them two alternatives would put a picker in front
 * of the user asking which class the resource they have not yet found belongs to
 * — a question about the answer, asked before the answer.
 *
 * Anything else is genuinely two controls. A literal has exactly one datatype and
 * a term exactly one node kind, so branches differing there cannot be merged
 * without the merged control committing terms that satisfy neither.
 */
function signatureOf(c: FieldConstraints): string {
  const { classIri: _c, classIn: _ci, options: _o, ...rest } = c;
  return JSON.stringify(
    Object.entries(rest)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

function mergeGroup(group: FieldConstraints[]): FieldConstraints {
  const merged: FieldConstraints = { ...group[0] };
  const classes: string[] = [];
  const options: FieldOption[] = [];
  for (const c of group) {
    if (c.classIri && !classes.includes(c.classIri)) classes.push(c.classIri);
    for (const o of c.options ?? []) {
      if (!options.some((x) => x.value.equals(o.value))) options.push(o);
    }
  }
  merged.classIri = classes[0];
  merged.classIn = classes.length > 1 ? classes : undefined;
  merged.options = options.length ? options : undefined;
  return merged;
}

/**
 * The label of an alternative in the picker.
 *
 * The profile's own `sh:name` when it gave the branch one; otherwise the local
 * name of the term the branch is about — `dateTime`, `double`, `Location`, `IRI`.
 * The same policy `fallbackLabel` uses for an unnamed property, and for the same
 * reason: the vocabulary term is what the author wrote, and an invented English
 * gloss for it would be a second taxonomy to keep in step with the first.
 */
function labelOf(b: ShapeIR, c: FieldConstraints, locale: string | undefined, index: number): string {
  const stated = pickByLanguage(b.presentation.names, locale)?.value;
  if (stated) return stated;
  if (c.datatype) return localName(c.datatype);
  const classes = c.classIn ?? (c.classIri ? [c.classIri] : []);
  if (classes.length) {
    const names = classes.map(localName);
    return names.length > 3 ? `${names.slice(0, 3).join(" / ")}…` : names.join(" / ");
  }
  if (c.nodeKind) return localName(c.nodeKind);
  if (c.options?.length) return c.options.map((o) => o.label ?? o.value.value).join(" / ");
  return `${index + 1}`;
}

/** Decide what a property's `sh:or` does to its field. */
export function planDisjunction(args: DisjunctionArgs): Disjunction {
  const { branches, own, fieldId, locale, ownControl } = args;
  const dropped: DroppedBranch[] = [];
  const kept: { shape: ShapeIR; index: number; constraints: FieldConstraints }[] = [];

  for (const [index, b] of branches.entries()) {
    const rejected = unrenderable(b);
    if (rejected) dropped.push({ index, id: b.id, ...rejected });
    else kept.push({ shape: b, index, constraints: constraintsOf(b, own) });
  }

  // A branch that constrains nothing is satisfied by every value, and a
  // disjunction with such a branch in it is satisfied by every value too. It rules
  // nothing out, so it takes nothing away — whatever else is in the list.
  if (dropped.some((d) => d.code === "no-kind")) return { kind: "vacuous", dropped };

  if (kept.length === 0) {
    // Every branch described a structure. Refusing is the finding — but only where
    // there was nothing else to render from; see `ownControl`.
    return branches.length > 0 && !ownControl ? { kind: "refused", dropped } : { kind: "vacuous", dropped };
  }

  // Group by signature, preserving the profile's order of first appearance.
  const groups = new Map<string, { members: typeof kept }>();
  for (const k of kept) {
    const sig = signatureOf(k.constraints);
    const g = groups.get(sig) ?? { members: [] as typeof kept };
    g.members.push(k);
    groups.set(sig, g);
  }

  const alternatives: FieldAlternative[] = [];
  for (const { members } of groups.values()) {
    const constraints = mergeGroup(members.map((m) => m.constraints));
    const head = members[0];
    alternatives.push({
      id: head.shape.id ?? `${fieldId}#or${head.index}`,
      label: labelOf(head.shape, constraints, locale, head.index),
      editorId: editorForConstraints(constraints),
      constraints,
    });
  }

  return { kind: "renderable", alternatives, dropped };
}

/**
 * Which alternative a value already on the graph is on.
 *
 * Derived from the term, never remembered: the datatype of a literal and the type
 * of a node are the record, and a UI that kept its own idea of "which branch the
 * user picked" would disagree with the data the moment the form is reopened.
 *
 * Falls back to the first alternative — the profile's own order, the one
 * preference it expressed, and the same tie-break `chooseBranch` states for an
 * alternative path.
 */
export function alternativeFor(
  alternatives: readonly FieldAlternative[],
  value: Term | null,
): FieldAlternative {
  if (!value) return alternatives[0];
  const match = alternatives.find((a) => accepts(a.constraints, value));
  return match ?? alternatives[0];
}

/** Whether this alternative's binding would have produced that term. The test a
 *  UI can run locally: class membership is a fact about the data graph, not about
 *  the term, so it is deliberately not part of it. */
function accepts(c: FieldConstraints, value: Term): boolean {
  if (value.termType === "Literal") {
    if (c.nodeKind === SH_IRI) return false;
    if (c.classIri) return false;
    if (c.datatype) return value.datatype.value === c.datatype;
    return true;
  }
  // A NamedNode or BlankNode: any branch demanding a datatype is not this one.
  return c.datatype === undefined;
}

/**
 * The disjunction a property reaches through `sh:node`.
 *
 * A node shape whose whole content is an `sh:or` is not a sub-form — it has no
 * fields to render — it is a value kind named once and reused. DCAT-AP declares
 * `:DateOrDateTimeDataType_Shape` and `:DcatResource_Shape` exactly this way and
 * points 16 property shapes at them; each of those properties builds a nested
 * sub-form with zero fields today, which is an empty box where the profile said
 * "a date or a dateTime".
 *
 * Returns the branches to treat as the property's own, or undefined when the
 * referenced shape has fields and really is a sub-form.
 */
export function nodeDisjunction(shape: {
  properties: readonly unknown[];
  conditionals?: readonly unknown[];
  logical?: { or?: ShapeIR[] };
}): ShapeIR[] | undefined {
  if (shape.properties.length > 0 || (shape.conditionals?.length ?? 0) > 0) return undefined;
  const or = shape.logical?.or;
  return or && or.length > 0 ? or : undefined;
}
