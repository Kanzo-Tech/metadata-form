import type { Term } from "@rdfjs/types";
import type { FieldModel, FormModel } from "../../form/FormModel.js";
import type { FieldError, Severity } from "../../form/validation.js";

/**
 * The single derived model of a form's state. Everything the validation and
 * assistant surfaces show is a projection of this — computed in ONE traversal,
 * so there's no duplicated walking of the model. Exposed as `form.report` by the
 * controller; `<ValidationSummary>`, the per-group badges and `<FormAssistant>`
 * all read from it.
 */

export type FormMood = "idle" | "guiding" | "celebrating" | "warning";

export interface IssueRow {
  /** Field id (error-map key); also the `data-field` anchor for jumping. */
  key: string;
  label: string;
  message: string;
  severity: Severity;
  /** Constraint-component IRI, for a surface that wants to name the rule. */
  constraint?: string;
  /** The offending value (`sh:value`), unformatted — a literal and an IRI are
   *  worth showing differently, so the term is kept rather than a string. */
  value?: Term;
}

export interface GroupIssues {
  count: number;
  hasViolation: boolean;
  /** First field id under the group with an error — for click-to-jump. */
  firstFieldId?: string;
}

export interface FormProgress {
  filled: number;
  total: number;
  requiredFilled: number;
  requiredTotal: number;
}

export interface FormReport {
  progress: FormProgress;
  issues: {
    total: number;
    hasViolations: boolean;
    rows: IssueRow[];
    byField: Map<string, { label: string; errors: FieldError[] }>;
    /** Keyed by root `GroupModel.id`; nested descendants roll up to their root group. */
    byGroup: Map<string, GroupIssues>;
  };
  /** Required-but-empty fields, depth-first, in render order. */
  pending: { id: string; label: string }[];
  nextField?: { id: string; label: string };
  health: { mood: FormMood; message: string };
}

interface FieldInfo {
  /** Hierarchical label (parent › field). */
  label: string;
  /** Id of the root group this field rolls up to. */
  rootGroupId: string;
}

/** Visit every field once (depth-first into nested sub-forms), carrying the root
 * group id and a hierarchical label. The one traversal the whole report builds on. */
export function traverseFields(
  model: FormModel,
  visit: (field: FieldModel, info: FieldInfo) => void,
  ctx: { rootGroupId: string | null; prefix: string } = { rootGroupId: null, prefix: "" },
): void {
  for (const group of model.groups) {
    const rootGroupId = ctx.rootGroupId ?? group.id;
    for (const field of group.fields) {
      const label = ctx.prefix ? `${ctx.prefix} › ${field.label}` : field.label;
      visit(field, { label, rootGroupId });
      for (const slot of field.values) {
        if (slot.nested) traverseFields(slot.nested, visit, { rootGroupId, prefix: label });
      }
    }
  }
}

const EMPTY: FormReport = {
  progress: { filled: 0, total: 0, requiredFilled: 0, requiredTotal: 0 },
  issues: { total: 0, hasViolations: false, rows: [], byField: new Map(), byGroup: new Map() },
  pending: [],
  health: { mood: "idle", message: "" },
};

const SH_NODE = "http://www.w3.org/ns/shacl#NodeConstraintComponent";

/**
 * D7. Once every node of the tree is validated, a `sh:node` violation reports
 * TWICE: the outer rollup on the containing property ("some details in this
 * section are incomplete") and the inner cause on the nested field ("this field
 * is required"). Drop the rollup whenever its value term — the nested focus —
 * reported something of its own; keep it when nothing nested did, because then
 * the rollup is the only thing standing between the reader and silence.
 */
function withoutNodeRollups(errors: Map<string, FieldError[]>): Map<string, FieldError[]> {
  const reported = new Set<string>();
  for (const [key, errs] of errors) {
    if (errs.length > 0) reported.add(key.split("|")[0]);
  }
  const out = new Map<string, FieldError[]>();
  for (const [key, errs] of errors) {
    const kept = errs.filter((e) => !(e.constraint === SH_NODE && e.value && reported.has(e.value.value)));
    if (kept.length > 0) out.set(key, kept);
  }
  return out;
}

/** Pure selector: derive the full report from a form model + its error map. */
export function computeFormReport(
  model: FormModel | undefined,
  allErrors: Map<string, FieldError[]>,
): FormReport {
  if (!model) return EMPTY;
  const errors = withoutNodeRollups(allErrors);

  const labels = new Map<string, string>();
  const groupFieldIds = new Map<string, string[]>();
  const pending: { id: string; label: string }[] = [];
  let filled = 0;
  let total = 0;
  let requiredFilled = 0;
  let requiredTotal = 0;

  traverseFields(model, (field, { label, rootGroupId }) => {
    labels.set(field.id, label);
    let ids = groupFieldIds.get(rootGroupId);
    if (!ids) groupFieldIds.set(rootGroupId, (ids = []));
    ids.push(field.id);
    if (field.readOnly) return; // read-only (e.g. inverse path) isn't editable → not "completion"
    const isFilled = field.values.length > 0;
    total++;
    if (isFilled) filled++;
    if (field.required) {
      requiredTotal++;
      if (isFilled) requiredFilled++;
      else pending.push({ id: field.id, label: field.label });
    }
  });

  const rows: IssueRow[] = [];
  const byField = new Map<string, { label: string; errors: FieldError[] }>();
  for (const [key, errs] of errors) {
    if (errs.length === 0) continue;
    // `??` is not enough: a node-level key ends in "|", so `.pop()` is "" — a row
    // with a blank label whose click jumps nowhere. Fall through empties to the key.
    const label = labels.get(key) || key.split("|").filter(Boolean).pop() || key;
    byField.set(key, { label, errors: errs });
    for (const err of errs) {
      rows.push({
        key,
        label,
        message: err.message,
        severity: err.severity,
        constraint: err.constraint,
        value: err.value,
      });
    }
  }

  const byGroup = new Map<string, GroupIssues>();
  for (const [gid, ids] of groupFieldIds) {
    let count = 0;
    let hasViolation = false;
    let firstFieldId: string | undefined;
    for (const id of ids) {
      const errs = errors.get(id);
      if (!errs || errs.length === 0) continue;
      count += errs.length;
      firstFieldId ??= id;
      if (errs.some((e) => e.severity === "violation")) hasViolation = true;
    }
    byGroup.set(gid, { count, hasViolation, firstFieldId });
  }

  const violations = rows.filter((r) => r.severity === "violation").length;
  let mood: FormMood;
  let message: string;
  if (violations > 0) {
    mood = "warning";
    message = `${violations} thing${violations === 1 ? "" : "s"} to fix`;
  } else if (pending.length === 0) {
    mood = total > 0 ? "celebrating" : "idle";
    message = total > 0 ? "All set — looks complete!" : "Let's fill this in";
  } else {
    mood = "guiding";
    message = `${pending.length} required field${pending.length === 1 ? "" : "s"} left`;
  }

  return {
    progress: { filled, total, requiredFilled, requiredTotal },
    issues: { total: rows.length, hasViolations: violations > 0, rows, byField, byGroup },
    pending,
    nextField: pending[0],
    health: { mood, message },
  };
}
