import type { Term } from "@rdfjs/types";
import { namedNode } from "./factory.js";
import { humanise, langOf, localName, resolveLanguage, type Resolved } from "./terms.js";
import { toTerm } from "./termValue.js";
import { SH_IRI } from "./vocab/shacl.js";
import { Editors } from "./vocab/shacl-ui.js";
import { conjoinByPath } from "./conjunction.js";
import { nodeDisjunction, planDisjunction, type Disjunction } from "./disjunction.js";
import { planWrite, resolveCarrier, writesSubjects } from "./writePath.js";
import type { FieldWrite, StepReader, WriteStep } from "./writePath.js";
import type {
  FieldAlternative,
  FieldConstraints,
  FieldModel,
  FieldOption,
  FormModel,
  GroupModel,
  ReadOnlyCode,
  ReadOnlyReason,
  ValueSlot,
} from "./FormModel.js";
import type {
  LangString,
  NodeShapeIR,
  PropertyShapeIR,
  ShapeIR,
  ShapeModel,
} from "./ShapeIR.js";

/** A non-fatal issue surfaced while building the form (instead of failing
 * silently) — e.g. a property dropped for an unsupported path, or a `sh:node`
 * pointing at a missing shape. Opt-in via `onDiagnostic`. */
export interface Diagnostic {
  level: "warning" | "info";
  /** Stable code for filtering/i18n. */
  code:
    | "unsupported-path"
    | "missing-shape"
    | "deactivated-shape"
    /** One arm of an `sh:or` the field cannot offer, so the control accepts less
     *  than the profile allows. Never a silent narrowing. */
    | "unrenderable-alternative"
    /** Several property shapes on one path became one field, as SHACL's
     *  conjunction says they are. `detail` is the path, the message the count. */
    | "conjoined-property"
    /** A demand of one of those shapes that the merged control cannot carry
     *  (two `sh:class`es, two `sh:pattern`s), though a value still satisfies it.
     *  The validator still checks it; only the widget hint is partial. */
    | "conflicting-constraint"
    /** The conjunction admits no value at all — the field is read-only, and the
     *  contradiction is a defect in the profile. */
    | "unsatisfiable-property"
    /** A name, description or message the profile wrote only in languages the
     *  reader did not ask for, so what is shown is another language's text (see
     *  `resolveLanguage`). Once per shape and kind, never per render. */
    | "missing-language"
    | string;
  message: string;
  /** The shape/path/node the diagnostic concerns, if any. */
  detail?: string;
}

/** One projected value occurrence: the value term, plus the sub-focus to recurse
 *  into for nested (sh:node) properties. */
export interface ProjectedSlot {
  value: Term;
  nestedFocus?: Term;
}

/** Pre-projected values keyed by `${focusNode}|${pathKey}` — the sole value source
 *  for `buildFormModel`, projected recursively up front so the build stays sync. */
export type ProjectedValues = Map<string, ProjectedSlot[]>;

export type DiagnosticSink = (diagnostic: Diagnostic) => void;

export interface BuildArgs {
  shapes: ShapeModel;
  focusNode: Term;
  shape: NodeShapeIR;
  /** The ordered language ranges labels and descriptions are picked by (see
   *  `pickByLanguage`). The application's languages; a property shape's own
   *  `sh:languageIn` is put in front of them. */
  languages?: readonly string[];
  onDiagnostic?: DiagnosticSink;
  /** Pre-projected field values, keyed by `${focusNode}|${pathKey}` (the
   *  single-graph projection). The sole value source; defaults to empty (so
   *  structure-only callers get empty slots). */
  values?: ProjectedValues;
  /** The `rdfs:label`s the data graph holds for each predicate, keyed like
   *  {@link values}. Label-only: a field's name is the second thing tried after
   *  its `sh:name` (see `labelOf`). Defaults to none. */
  labels?: Map<string, LangString[]>;
  /** Per-focus set of satisfied conditional `conditionId`s (keyed by
   *  `focus.value`), from the projection. Gates which conditional branch's fields
   *  are built. Defaults to empty (no conditional is active). */
  satisfied?: Map<string, Set<string>>;
  /**
   * Reads one step of a property path from a node (see {@link StepReader}) —
   * `GraphState.readStep` in the running form.
   *
   * Only a **sequence** path needs it, and only to answer a question about the
   * data rather than the shape: does the intermediate node this value hangs off
   * exist, and is it unique? Without a reader the honest answer is "no
   * intermediate" — which is exactly right for a structure-only build over no
   * data graph — so those fields come out read-only with that reason.
   */
  readStep?: StepReader;
}

/** Inner build args: projected values are always resolved (defaulted) before recursion. */
type InnerArgs = Omit<BuildArgs, "values" | "labels" | "satisfied" | "languages"> & {
  values: ProjectedValues;
  labels: Map<string, LangString[]>;
  satisfied: Map<string, Set<string>>;
  languages: readonly string[];
  /** What this build has already reported once (see {@link reportMissingLanguage}). */
  reported: Set<string>;
};

const DEFAULT_GROUP = "__default__";

/** Build a FormModel for a focus node against a node shape (recursive). */
export function buildFormModel(args: BuildArgs): FormModel {
  return buildInner(
    {
      ...args,
      values: args.values ?? new Map(),
      labels: args.labels ?? new Map(),
      satisfied: args.satisfied ?? new Map(),
      languages: args.languages ?? [],
      reported: new Set(),
    },
    new Set(),
  );
}

interface FieldCtx {
  shapes: ShapeModel;
  focusNode: Term;
  languages: readonly string[];
  reported: Set<string>;
  onDiagnostic?: DiagnosticSink;
  values: ProjectedValues;
  labels: Map<string, LangString[]>;
  satisfied: Map<string, Set<string>>;
  readStep?: StepReader;
}

function buildInner(args: InnerArgs, visited: Set<string>): FormModel {
  const { shapes, focusNode, shape, languages, reported, onDiagnostic, values, labels, satisfied, readStep } = args;
  const guardKey = `${shape.id}::${focusNode.value}`;
  const cyclic = visited.has(guardKey);
  const nextVisited = new Set(visited).add(guardKey);
  const ctx: FieldCtx = { shapes, focusNode, languages, reported, onDiagnostic, values, labels, satisfied, readStep };

  // A deactivated shape constrains nothing (SHACL §2.1.6: every term conforms to
  // it, and the validator reports nothing for it), so it renders nothing — down to
  // its conditionals. Rendering its fields would collect input nobody validates.
  if (shape.deactivated) {
    onDiagnostic?.({
      level: "info",
      code: "deactivated-shape",
      message: "Node shape is sh:deactivated; no fields are built for it.",
      detail: shape.id,
    });
    return { focusNode, shape: namedNode(shape.id), groups: [] };
  }

  // Every property shape that applies to this focus right now: the node shape's
  // own, plus the active branch of each conditional (then when the focus
  // conforms to its condition, else when it doesn't — rudof evaluated conformance
  // canonically, we only read `satisfied`). They are gathered before any field is
  // built because they are conjoined by path, and a branch that is active applies
  // exactly as the node shape's own do.
  const active = satisfied.get(focusNode.value) ?? EMPTY_SET;
  const applicable: Applicable[] = shape.properties.map((ps) => ({ ps }));
  for (const cond of shape.conditionals ?? []) {
    const branch: "then" | "else" = active.has(cond.conditionId) ? "then" : "else";
    for (const ps of cond[branch]) {
      applicable.push({ ps, guard: { conditionId: cond.conditionId, branch } });
    }
  }

  const fields = buildFields(applicable, ctx, nextVisited, cyclic);
  return { focusNode, shape: namedNode(shape.id), groups: groupFields(fields, ctx) };
}

const EMPTY_SET: ReadonlySet<string> = new Set();

/** A property shape that applies to the focus, with the conditional branch it
 *  came from when it came from one. */
interface Applicable {
  ps: PropertyShapeIR;
  guard?: FieldModel["guard"];
}

/**
 * Build one field per (focus, path) — the identity the model already declares,
 * since `FieldModel.id` is `fieldKey(focusNode, path)` and that key is what the
 * projection files values under and what validation results are matched by.
 *
 * A profile may state the same path over several property shapes, and generated
 * ones do; SHACL requires the focus to conform to all of them, so they are one
 * field whose constraints are their conjunction. See {@link conjoinByPath}.
 */
function buildFields(
  applicable: Applicable[],
  ctx: FieldCtx,
  visited: Set<string>,
  cyclic: boolean,
): FieldModel[] {
  // sh:deactivated (SHACL §2.1.6): the profile switched this property shape off,
  // so the validator ignores it. A field here would be filled in and never
  // checked — silently producing unvalidated data, and its constraints would
  // narrow the conjunction its path's live shapes make. Drop it before merging.
  const live = applicable.filter(({ ps }) => {
    if (!ps.deactivated) return true;
    ctx.onDiagnostic?.({
      level: "info",
      code: "deactivated-shape",
      message: "Property shape is sh:deactivated; no field is built for it.",
      detail: ps.id ?? ps.pathKey,
    });
    return false;
  });

  const fields: FieldModel[] = [];
  for (const conjoined of conjoinByPath(live.map((a) => a.ps))) {
    const { shape: ps, sources } = conjoined;
    if (sources > 1) {
      ctx.onDiagnostic?.({
        level: "info",
        code: "conjoined-property",
        message: `${sources} property shapes state this path; the field is their conjunction.`,
        detail: ps.pathKey,
      });
    }
    for (const n of conjoined.notes) {
      ctx.onDiagnostic?.({
        level: n.kind === "constraint" ? "warning" : "info",
        code: "conflicting-constraint",
        message:
          `Property shapes on this path disagree on ${n.facet}: kept ${n.kept}, ` +
          `not carried ${n.dropped.join(", ")}.` +
          (n.kind === "constraint" ? " The validator still checks all of them." : ""),
        detail: ps.pathKey,
      });
    }
    if (conjoined.unsatisfiable) {
      ctx.onDiagnostic?.({
        level: "warning",
        code: "unsatisfiable-property",
        message: `No value can satisfy every property shape on this path: ${conjoined.unsatisfiable}.`,
        detail: ps.pathKey,
      });
    }
    const field = buildField(ps, ctx, visited, cyclic, conjoined.unsatisfiable);
    // A field is conditional only when *every* shape behind it is, and on the
    // same branch: a constraint the condition adds to a property the node shape
    // already has does not make the property conditional.
    const guards = live.filter((a) => a.ps.pathKey === ps.pathKey).map((a) => a.guard);
    const [first] = guards;
    if (first && guards.every((g) => g?.conditionId === first.conditionId && g.branch === first.branch)) {
      field.guard = first;
    }
    fields.push(field);
  }
  return fields;
}

/**
 * Decide whether this property is editable, and how.
 *
 * Two gates, in this order, because they answer different questions. The first
 * is about the *shape*: {@link planWrite} asks whether the path is one a value
 * can be asserted through at all. The second is about the *data*: a sequence's
 * intermediate node has to exist and be unique, which the shape cannot say and
 * only the graph can. A field can therefore pass the shape gate and still be
 * read-only right now — and become editable when the intermediate is filled in,
 * which is the correct behaviour and not a glitch.
 */
function resolveWrite(
  ps: PropertyShapeIR,
  ctx: FieldCtx,
): { write: FieldWrite } | { reason: ReadOnlyReason } {
  const reason = (code: ReadOnlyCode): { reason: ReadOnlyReason } => ({
    reason: { code, detail: ps.pathKey },
  });

  const plan = planWrite(ps.path);
  if ("readOnly" in plan) return reason(plan.readOnly);

  for (const branch of plan.write.branches) {
    if (branch.via.length === 0) continue;
    const carrier = resolveCarrier(ctx.readStep, ctx.focusNode, branch);
    if ("readOnly" in carrier) return reason(carrier.readOnly);
  }
  return { write: plan.write };
}

function buildField(
  ps: PropertyShapeIR,
  ctx: FieldCtx,
  visited: Set<string>,
  cyclic: boolean,
  /** Set when the property shapes on this path contradict each other, so no term
   *  conforms to all of them (see {@link conjoinByPath}). */
  unsatisfiable?: string,
): FieldModel {
  // One key for the field, its projected values and its validation results: the
  // engine's canonical path key, which is the predicate IRI for a predicate path.
  const path = namedNode(ps.pathKey);
  const id = `${ctx.focusNode.value}|${ps.pathKey}`;
  const resolved = resolveWrite(ps, ctx);
  const write = "write" in resolved ? resolved.write : undefined;
  // SHACL-UI ED, "Language Resolution": the shape's own `sh:languageIn` order comes
  // before the application's languages.
  const languages = [...(ps.value.languageIn ?? []), ...ctx.languages];
  const named = labelOf(ps, ctx.labels.get(id), languages, write);
  const label = named.text;
  const described = resolveLanguage(ps.presentation.descriptions, languages);
  const description = described?.item.value;
  const subject = ps.id ?? ps.pathKey;
  reportMissingLanguage(ctx, subject, label, "name", named.picked);
  reportMissingLanguage(ctx, subject, label, "description", described);

  const v = ps.value;
  const constraints: FieldConstraints = {
    datatype: v.datatype,
    // An inverse path writes its value as the SUBJECT of a statement, so the value
    // is an IRI or a blank node by RDF's own grammar — a fact the shape rarely
    // bothers to restate. Filled in only where the author left it unstated, and
    // only where every branch is inverse (a mixed alternative can still take a
    // literal, through its forward branch).
    nodeKind: v.nodeKind ?? (write && writesSubjects(write) ? SH_IRI : undefined),
    classIri: v.classIri,
    pattern: v.pattern,
    flags: v.flags,
    minLength: v.minLength,
    maxLength: v.maxLength,
    minInclusive: v.minInclusive,
    maxInclusive: v.maxInclusive,
    minExclusive: v.minExclusive,
    maxExclusive: v.maxExclusive,
    options: optionsFrom(ps),
    defaultValue: v.defaultValue ? toTerm(v.defaultValue) : undefined,
    hasValue: v.hasValue ? toTerm(v.hasValue) : undefined,
    uniqueLang: v.uniqueLang,
    languageIn: v.languageIn,
  };

  const minCount = ps.cardinality.min ?? 0;
  const maxCount = ps.cardinality.max;
  const repeatable = maxCount === undefined || maxCount > 1;

  const referenced = ps.node ? ctx.shapes.nodeShapes.get(ps.node) : undefined;
  if (ps.node && !referenced) {
    ctx.onDiagnostic?.({
      level: "warning",
      code: "missing-shape",
      message: "sh:node references a shape that is not defined; the nested form will not render.",
      detail: ps.node,
    });
  }

  // A `sh:node` whose target is nothing but an `sh:or` is not a sub-form: it is a
  // value kind the profile named once so it could be reused. Treat its branches
  // as this property's own, and drop the reference — a nested form for it would
  // be an empty box, which is what 16 DCAT-AP / HealthDCAT-AP properties get today.
  const inlined = referenced ? nodeDisjunction(referenced) : undefined;
  const nestedShape = inlined ? undefined : referenced;
  const branches: ShapeIR[] = [...(ps.logical.or ?? []), ...(inlined ?? [])];

  // rudof chose the editor, and says where it came from. One it `declared` or
  // `scored` is a control the property really has. One it took from a branch, or
  // fell back to, is not: the property says nothing an editor is chosen by, so the
  // disjunction's alternative is the better answer, and a real sub-form (`sh:node`
  // that is not just a named disjunction) is a control worth protecting from a
  // refusal all the same.
  const { editorSource } = ps.presentation;
  const ownControl = editorSource === "declared" || editorSource === "scored" || nestedShape !== undefined;

  const disjunction = branches.length
    ? planDisjunction({
        branches,
        own: constraints,
        fieldId: id,
        languages: ctx.languages,
        ownControl,
      })
    : undefined;
  reportDropped(disjunction, ps, ctx);

  // The disjunction is not allowed to overrule a path we already refused: a value
  // we know where to put but not what to make of it, and a value we know what to
  // make of but not where to put, are both unwritable, and the path's reason is
  // the one the user can act on (fill in the intermediate resource).
  const refused = write !== undefined && disjunction?.kind === "refused";
  const alternatives = disjunction?.kind === "renderable" ? disjunction.alternatives : undefined;
  const chosen: FieldAlternative | undefined = refused ? undefined : alternatives?.[0];

  const effective = chosen?.constraints ?? constraints;
  // The alternative's editor is the engine's for that branch alone: not scored for
  // the field, so it is reported as a branch's.
  const fromBranch = chosen !== undefined && !ownControl;
  const effectiveEditor = fromBranch ? chosen.editorId : ps.presentation.editor;

  const values = projectValues(ps, id, ctx, effectiveEditor, nestedShape, visited, cyclic);
  const nestedTypeIri = nestedShape?.instanceClass;

  // Three ways a field can take no input, in the order of what they say. A
  // contradiction between the shapes on this path comes first: it is the only one
  // that no data and no user action can resolve, because no term at all conforms.
  // Then the path (a value we know what to make of but not where to put), then a
  // disjunction of structures (a value we know where to put but not what to make
  // of) — the path's reason wins there because filling in the intermediate is
  // something the user can actually do.
  const code: ReadOnlyCode | undefined = unsatisfiable
    ? "unsatisfiable-conjunction"
    : "reason" in resolved
      ? resolved.reason.code
      : refused
        ? "disjunction-of-shapes"
        : undefined;
  const readOnlyReason: ReadOnlyReason | undefined = code
    ? { code, detail: ps.pathKey }
    : undefined;

  return {
    id,
    path,
    pathKind: ps.path.kind === "predicate" ? "predicate" : "complex",
    label,
    labelLang: langOf(named.picked),
    description,
    descriptionLang: langOf(described),
    editorId: effectiveEditor,
    editorSource: fromBranch ? "branch" : editorSource,
    editors: fromBranch ? undefined : ps.presentation.editors,
    required: minCount >= 1,
    repeatable,
    minCount,
    maxCount,
    order: ps.presentation.order ?? Number.MAX_SAFE_INTEGER,
    groupId: ps.presentation.groupId ?? DEFAULT_GROUP,
    constraints: effective,
    // Only a disjunction that left more than one KIND of value open is a choice
    // the user has to make; one that resolved to a single editor is already folded
    // into `constraints` and would be a picker with one entry.
    alternatives: alternatives && alternatives.length > 1 ? alternatives : undefined,
    write: readOnlyReason ? undefined : write,
    readOnly: readOnlyReason ? true : undefined,
    readOnlyReason,
    nodeShape: nestedShape ? namedNode(nestedShape.id) : null,
    nestedTypeIri,
    values,
  };
}

/** Report every arm of a disjunction the field could not offer. A control that
 *  accepts less than the profile allows is sound — `sh:or` only narrows — but it
 *  is never something to do quietly. */
function reportDropped(
  disjunction: Disjunction | undefined,
  ps: PropertyShapeIR,
  ctx: FieldCtx,
): void {
  for (const d of disjunction?.dropped ?? []) {
    if (d.code === "no-kind") continue; // it ruled nothing out; nothing was lost
    ctx.onDiagnostic?.({
      level: "info",
      code: "unrenderable-alternative",
      message: `sh:or alternative ${d.index + 1} is not offered: ${d.why}.`,
      detail: d.id ?? ps.id ?? ps.pathKey,
    });
  }
}

/**
 * The label of a property, by the order of SHACL-UI's "Property Labels" (Editor's
 * Draft): its `sh:name`, then the `rdfs:label` of its predicate in the data graph,
 * then in the shapes graph, then the local name split into words. Each step is
 * picked by the same language resolution, and the first that has one wins.
 */
function labelOf(
  ps: PropertyShapeIR,
  dataLabels: readonly LangString[] | undefined,
  languages: readonly string[],
  write: FieldWrite | undefined,
): { text: string; picked?: Resolved<LangString> } {
  const picked =
    resolveLanguage(ps.presentation.names, languages) ??
    resolveLanguage(dataLabels ?? [], languages) ??
    resolveLanguage(ps.presentation.pathLabels ?? [], languages);
  return picked ? { text: picked.item.value, picked } : { text: fallbackLabel(ps, write) };
}

/**
 * Say, once per build, that the text shown for `subject` is another language's: the
 * profile wrote it, but not in any language the reader asked for. SHACL says the
 * author's text is what is shown, so it still is; this is how the author finds out
 * which texts lack which language. An untagged text is language-neutral (an
 * identifier, a name), so it is not a finding.
 */
function reportMissingLanguage(
  ctx: FieldCtx,
  subject: string,
  subjectLabel: string,
  kind: "name" | "description",
  picked: Resolved<LangString> | undefined,
): void {
  if (!langOf(picked) || ctx.languages.length === 0) return;
  const key = `${subject}|${kind}|${ctx.languages.join(",")}`;
  if (ctx.reported.has(key)) return;
  ctx.reported.add(key);
  ctx.onDiagnostic?.({
    level: "info",
    code: "missing-language",
    message: `No ${kind} in ${ctx.languages.join(", ")} for ${subjectLabel}; showing ${picked!.item.language}.`,
    detail: subject,
  });
}

/**
 * The label for a property nothing named.
 *
 * A single step reads as its own local name (an inverse one prefixed, because
 * "← parent" and "parent" are opposite questions and would otherwise share a
 * label). An alternative whose branches agree on their local name is the
 * interesting case: `(http://schema.org/name|https://schema.org/name)` is not two
 * properties, it is one property written in two namespaces to paper over a
 * vocabulary split — the whole of Bioschemas is built this way — and "name" is
 * what it is called. Where the branches genuinely differ, the path key is shown
 * rather than a name picked from one branch, since that would hide the other.
 */
function fallbackLabel(ps: PropertyShapeIR, write: FieldWrite | undefined): string {
  const steps: WriteStep[] | undefined = write?.branches.every((b) => b.via.length === 0)
    ? write.branches.map((b) => b.step)
    : undefined;
  if (!steps || steps.length === 0) return ps.pathKey;
  const names = new Set(steps.map((s) => localName(s.predicate.value)));
  const directions = new Set(steps.map((s) => s.direction));
  if (names.size !== 1 || directions.size !== 1) return ps.pathKey;
  const [name] = names;
  const words = humanise(name);
  return steps[0].direction === "inverse" ? `← ${words}` : words;
}

function projectValues(
  ps: PropertyShapeIR,
  id: string,
  ctx: FieldCtx,
  editor: string,
  nestedShape: NodeShapeIR | undefined,
  visited: Set<string>,
  cyclic: boolean,
): ValueSlot[] {
  const isNested = (editor === Editors.Details || !!ps.node) && !cyclic;
  const slots = ctx.values.get(id) ?? [];

  return slots.map((s, i) => {
    const slot: ValueSlot = { id: `${id}#${i}`, value: s.value };
    const sub = s.nestedFocus;
    if (isNested && nestedShape && sub && (sub.termType === "NamedNode" || sub.termType === "BlankNode")) {
      slot.nested = buildInner(
        {
          shapes: ctx.shapes,
          focusNode: sub,
          shape: nestedShape,
          languages: ctx.languages,
          reported: ctx.reported,
          onDiagnostic: ctx.onDiagnostic,
          values: ctx.values,
          labels: ctx.labels,
          satisfied: ctx.satisfied,
          readStep: ctx.readStep,
        },
        visited,
      );
    }
    return slot;
  });
}

function optionsFrom(ps: PropertyShapeIR): FieldOption[] | undefined {
  const list = ps.value.in;
  if (!list || list.length === 0) return undefined;
  return list.map((tv) => ({
    value: toTerm(tv),
    label: tv.termType === "Literal" ? tv.value : localName(tv.value),
  }));
}

/**
 * SHACL 1.2 UI, "Grouping, Ordering, and Layout Hints" (#grouping-and-ordering):
 * at each level property groups and UNGROUPED property shapes are members of one
 * sequence. A group sits at the group's own `sh:order`; a grouped property's
 * `sh:order` only orders it inside its group. Members are sorted by ascending
 * order, those with none after all that have one, and ties (or a run of members
 * with no order) break by resolved label, then by identifier.
 *
 * A run of consecutive ungrouped fields is one untitled section. Two runs cut
 * apart by a group are two sections, so only the first keeps the id
 * {@link DEFAULT_GROUP}. The identifier tie-break uses the field id, which
 * carries the property shape's path, not the shape's own IRI (a field can merge
 * several shapes on one path).
 */
function groupFields(fields: FieldModel[], ctx: FieldCtx): GroupModel[] {
  const byGroup = new Map<string, FieldModel[]>();
  const members: SequenceMember[] = [];
  for (const f of fields) {
    if (f.groupId === DEFAULT_GROUP) {
      members.push({ order: f.order, label: f.label, id: f.id, fields: [f] });
      continue;
    }
    const arr = byGroup.get(f.groupId) ?? [];
    arr.push(f);
    byGroup.set(f.groupId, arr);
  }
  for (const [groupId, groupFieldsList] of byGroup) {
    const meta = ctx.shapes.groups.get(groupId);
    const picked = meta && resolveLanguage(meta.labels, ctx.languages);
    const label = picked?.item.value;
    reportMissingLanguage(ctx, groupId, label ?? groupId, "name", picked);
    groupFieldsList.sort(orderCompare);
    members.push({
      order: meta?.order ?? Number.MAX_SAFE_INTEGER,
      label: label ?? "",
      id: groupId,
      titled: { id: groupId, label, labelLang: langOf(picked) },
      fields: groupFieldsList,
    });
  }
  members.sort(orderCompare);

  const groups: GroupModel[] = [];
  let run: GroupModel | undefined; // the open run of ungrouped fields
  for (const m of members) {
    if (m.titled) {
      groups.push({ ...m.titled, order: m.order, fields: m.fields });
      run = undefined;
    } else if (run) {
      run.fields.push(...m.fields);
    } else {
      const id = groups.some((g) => g.id === DEFAULT_GROUP) ? `${DEFAULT_GROUP}#${groups.length}` : DEFAULT_GROUP;
      run = { id, order: m.order, fields: [...m.fields] };
      groups.push(run);
    }
  }
  return groups;
}

/** One member of the sequence {@link groupFields} orders: a property group with
 *  its fields (`titled`), or a single ungrouped field. */
interface SequenceMember {
  order: number;
  label: string;
  id: string;
  titled?: { id: string; label?: string; labelLang?: string };
  fields: FieldModel[];
}

function orderCompare(a: { order: number; label: string; id: string }, b: { order: number; label: string; id: string }): number {
  if (a.order !== b.order) return a.order - b.order;
  return a.label.localeCompare(b.label) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
