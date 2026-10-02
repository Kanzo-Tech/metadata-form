import { createContext, useContext, useState } from "react";
import {
  Field,
  FieldArray,
  FieldDescription,
  FieldError,
  FieldHelper,
  FieldLabel,
  FieldRequiredIndicator,
  NativeSelect,
  NativeSelectOption,
} from "@kanzo-tech/ui";
import type { Term } from "@rdfjs/types";
import type { AssistUiProps } from "../assistUi.js";
import { alternativeFor } from "../../form/disjunction.js";
import type {
  FieldAlternative,
  FieldModel,
  FormModel,
  ValueSlot,
} from "../../form/FormModel.js";
import { Editors } from "../../form/vocab/shacl-ui.js";
import { languageOf, primitiveToTerm, termToPrimitive } from "../../form/termBinding.js";
import {
  type AssistWrap,
  optionsFor,
  resolveWidget,
  stepFor,
  widgetAssist,
  widgetMulti,
  widgetRender,
} from "../widgets/widgets.js";
import { useFocusNode, useFormContext } from "./context.js";
import { fill } from "../../i18n/strings.js";
import { useFieldBinding } from "../hooks/useFieldBinding.js";
import { NodeForm } from "./NodeForm.js";

/** Renders a single field: label, help, value rows (multi-value), errors. */
export function FieldRenderer({ field }: { field: FieldModel }) {
  const { widgets, assist, assistUi, graph, locale, strings, revealAll } = useFormContext();
  const focus = useFocusNode();
  const ops = useFieldBinding(field);
  const arrayLabels = { addLabel: strings.chrome.addRow, removeLabel: strings.chrome.remove };

  // `shui:BlankNodeEditor` is `DetailsEditor`'s twin: both say "this value is a
  // resource with a shape of its own", and the difference — whether it gets an IRI
  // — is the graph's business, not the form's.
  const isNested =
    field.editorId === Editors.Details ||
    field.editorId === Editors.BlankNode ||
    !!field.nodeShape;
  const real = field.values;

  // Empty UI-only rows for repeatable fields. Start at 0 so a repeatable field
  // shows just "+ Add" when empty — consistent with nested repeatables (which
  // can't pre-render an empty row). Single-value fields always show their one
  // input regardless (rowCount is fixed to 1 below).
  const [pending, setPending] = useState(0);

  // Inline errors stay hidden until the user has interacted with this field, so a
  // pristine form doesn't shout required-field violations on load. The
  // ValidationSummary still reflects the live totals (GOV.UK-style: summary now,
  // inline on touch). `touched` survives model rebuilds because the FieldRenderer
  // key (field.id) is stable. `revealAll` is the reader asking for all of them at
  // once, by pressing that summary.
  const [touched, setTouched] = useState(false);
  const errs = touched || revealAll ? ops.errors : [];

  // Which alternative an EMPTY row is offering (see `altAt` below, where the rule
  // is argued). Declared up here with the other row state because the nested
  // branch returns before reaching it, and a hook may not be reached conditionally.
  const [picked, setPicked] = useState<Record<string, string>>({});

  const singleValue = !field.repeatable;
  const rowCount = singleValue ? 1 : real.length + pending;

  const setTerm = (rowIndex: number, newValue: Term | null) => {
    setTouched(true);
    const current = rowIndex < real.length ? real[rowIndex].value : null;
    if (current && newValue) ops.setValue(current, newValue);
    else if (current && !newValue) ops.removeValue(current);
    else if (!current && newValue) {
      ops.addValue(newValue);
      if (!singleValue) setPending((n) => Math.max(0, n - 1));
    }
  };

  const removeRow = (rowIndex: number) => {
    setTouched(true);
    const current = rowIndex < real.length ? real[rowIndex].value : null;
    if (current) ops.removeValue(current);
    else setPending((n) => Math.max(0, n - 1));
  };

  const canAddMore =
    !field.readOnly && (field.maxCount === undefined || real.length + pending < field.maxCount);

  // The pending row must carry the SAME key it will get once committed
  // (`buildFormModel` keys real slots `${field.id}#${i}`). If it differed, the
  // first value commit would change the row's key → React remounts the input →
  // loses focus/hover/caret. Pending rows occupy indices >= real.length, so there
  // is no key collision with real slots. `FieldArray` asks for this key for
  // exactly this reason.
  const rowKey = (i: number) => real[i]?.id ?? `${field.id}#${i}`;

  if (isNested) {
    return (
      <FieldShell field={field} errors={errs}>
        <FieldArray
          {...arrayLabels}
          count={real.length}
          rowKey={rowKey}
          canAdd={canAddMore}
          canRemove={!field.readOnly}
          onAdd={() => { setTouched(true); ops.createNested(); }}
          onRemove={(i) => { setTouched(true); ops.removeValue(real[i].value as Term); }}
        >
          {(i) => {
            const slot = real[i];
            return slot?.nested ? <NodeForm model={slot.nested as FormModel} /> : null;
          }}
        </FieldArray>
      </FieldShell>
    );
  }

  // `sh:or` is a constraint on VALUES, so which alternative is in force is a
  // per-row question, not a per-field one — and for a row that already holds a
  // value the value itself answers it (`alternativeFor`), never this state. What is
  // kept here is only the choice for a row that has nothing in it yet, which
  // nothing else can answer.
  const alts = field.alternatives;
  const altAt = (i: number): FieldAlternative | undefined => {
    if (!alts) return undefined;
    const current = real[i]?.value ?? null;
    if (current) return alternativeFor(alts, current);
    return alts.find((a) => a.id === picked[rowKey(i)]) ?? alts[0];
  };
  /** The field as one row's alternative makes it: the editor to render and the
   *  constraints that bind the committed term. Substituting these two IS rendering
   *  the branch — see `FieldAlternative`. */
  const fieldAt = (i: number): FieldModel => {
    const alt = altAt(i);
    return alt ? { ...field, editorId: alt.editorId, constraints: alt.constraints } : field;
  };

  const entryFor = (f: FieldModel) => {
    const found = resolveWidget(f, widgets);
    if (!found) {
      throw new Error(
        `No widget for editor ${f.editorId} on ${f.id}, and none for the ` +
          `plain text field either — the registry is missing ${Editors.TextField}.`,
      );
    }
    return found;
  };

  const entry = entryFor(field);
  // One control for the whole list cannot hold a per-value alternative, so a field
  // that offers alternatives renders its rows one at a time.
  const Multi = alts ? undefined : widgetMulti(entry);
  // Model assistance, where the form has a UI for it and the widget declares it.
  const assisted = assistUi && !field.readOnly && widgetAssist(entry) ? BoundAssist : undefined;

  const searchFor = (f: FieldModel) => {
    const classIri = f.constraints.classIri;
    if (!assist?.search || !classIri) return undefined;
    const classIn = f.constraints.classIn;
    return (query: string, signal?: AbortSignal) => assist.search!({ classIri, classIn, query, signal });
  };
  const loadOptions = searchFor(field);

  /** Switch a row to another alternative. A row that already holds a value is
   *  re-committed under the new binding rather than left alone: the alternative a
   *  value is on is read back off the term, so a term that still says `xsd:double`
   *  would put the picker straight back where it was. */
  const pickAlternative = (i: number, altId: string) => {
    setPicked((p) => ({ ...p, [rowKey(i)]: altId }));
    const current = real[i]?.value ?? null;
    const alt = alts?.find((a) => a.id === altId);
    if (!current || !alt) return;
    setTouched(true);
    const rebound = primitiveToTerm(
      { ...field, editorId: alt.editorId, constraints: alt.constraints },
      termToPrimitive(current),
      languageOf(current),
    );
    if (rebound) ops.setValue(current, rebound);
  };

  const row = (i: number) => {
    const slot: ValueSlot = real[i] ?? { id: rowKey(i), value: null };
    const rowField = fieldAt(i);
    const Widget = widgetRender(entryFor(rowField));
    const c = rowField.constraints;
    const options = optionsFor(rowField);
    const step = stepFor(rowField);
    const classIri = c.classIri;
    const rowLoadOptions = searchFor(rowField);
    const control = (
      <Widget
        value={termToPrimitive(slot.value)}
        language={languageOf(slot.value)}
        languageIn={c.languageIn}
        onChange={(v, language) => setTerm(i, primitiveToTerm(rowField, v, language))}
        options={options}
        loadOptions={rowLoadOptions}
        assist={assisted}
        classIri={classIri}
        classIn={c.classIn}
        required={field.required}
        step={step}
        min={c.minInclusive}
        max={c.maxInclusive}
        minExclusive={c.minExclusive}
        maxExclusive={c.maxExclusive}
        minLength={c.minLength}
        maxLength={c.maxLength}
        // Carried as information, never as an HTML `pattern` attribute: `sh:pattern`
        // is an unanchored XPath regex and the attribute is implicitly anchored, so
        // the browser would reject values the shape accepts.
        pattern={c.pattern}
        flags={c.flags}
        minCount={field.minCount}
        maxCount={field.maxCount}
        repeatable={field.repeatable}
        defaultValue={termToPrimitive(c.defaultValue ?? null)}
        label={rowField.label}
      />
    );
    if (!alts) return control;
    // The picker sits above the editor, not beside it: it decides WHICH editor is
    // below, so reading it after the control would be reading the answer before the
    // question.
    return (
      <div className="flex flex-col gap-2">
        <NativeSelect
          className="w-full"
          aria-label={fill(strings.chrome.kindOfValue, { field: field.label })}
          data-alternatives={field.id}
          value={altAt(i)!.id}
          onChange={(e) => pickAlternative(i, e.target.value)}
        >
          {alts.map((a) => (
            <NativeSelectOption key={a.id} value={a.id}>
              {a.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {control}
      </div>
    );
  };

  // A repeatable field whose editor knows how to hold a whole list renders as ONE
  // control. The commit is a whole-list replace, which `GraphState.setValues`
  // diffs into one change — so a tags input does not bump the graph per tag.
  const asOne = !singleValue && Multi ? (
    <Multi
      values={real.map((s) => termToPrimitive(s.value)).filter((v): v is string => v !== null)}
      onChange={(vs) => {
        setTouched(true);
        ops.setValues(
          vs.map((v) => primitiveToTerm(field, v)).filter((t): t is Term => t !== null),
        );
      }}
      options={optionsFor(field)}
      loadOptions={loadOptions}
      classIri={field.constraints.classIri}
      classIn={field.constraints.classIn}
      minCount={field.minCount}
      maxCount={field.maxCount}
      assist={assisted}
    />
  ) : null;

  const rows = asOne ?? (singleValue ? (
    row(0)
  ) : (
    <FieldArray
      {...arrayLabels}
      count={rowCount}
      rowKey={rowKey}
      canAdd={canAddMore}
      canRemove={!field.readOnly}
      onAdd={() => setPending((n) => n + 1)}
      onRemove={removeRow}
    >
      {row}
    </FieldArray>
  ));

  const shell = <FieldShell field={field} errors={errs}>{rows}</FieldShell>;
  if (!assisted) return shell;
  return <FieldAssist.Provider value={{ field, focus, graph, locale }}>{shell}</FieldAssist.Provider>;
}

/**
 * The field frame. `Field` owns `invalid`/`disabled`/`required` and Ark hands
 * them to every input beneath by context, so no widget threads them itself.
 *
 * Only **violations** set `invalid`: they are what the library models as a
 * boolean. Warnings and info are real to SHACL but not to `Field`, so they are the
 * `FieldHelper` — the message a value survives, which takes a `tone` — rather than
 * an error that would also paint the input red. Ark gives every helper one id, so
 * a field has one: its non-violation findings share it, one line each.
 */
function FieldShell({
  field,
  errors,
  children,
}: {
  field: FieldModel;
  errors: ReturnType<typeof useFieldBinding>["errors"];
  children: React.ReactNode;
}) {
  const { strings, resolveMessage } = useFormContext();
  const violations = errors.filter((e) => e.severity === "violation");
  const rest = errors.filter((e) => e.severity !== "violation");
  return (
    <Field
      className="gap-1.5"
      data-field={field.id}
      required={field.required}
      disabled={field.readOnly ?? false}
      invalid={violations.length > 0}
    >
      <FieldLabel lang={field.labelLang}>
        {field.label}
        {field.required && <FieldRequiredIndicator />}
      </FieldLabel>
      {field.description && <FieldDescription lang={field.descriptionLang}>{field.description}</FieldDescription>}
      {/* A disabled control with no account of itself reads as a broken form; this
          is the account. A second line of description, since the helper is the
          findings' — see above. */}
      {field.readOnlyReason && (
        <FieldDescription data-readonly-reason={field.readOnlyReason.code}>
          {strings.readOnly[field.readOnlyReason.code]}
        </FieldDescription>
      )}
      {children}
      {violations.map((e, i) => {
        const message = resolveMessage(e);
        return (
          <FieldError key={i} lang={message.lang}>
            {message.text}
          </FieldError>
        );
      })}
      {rest.length > 0 && (
        <FieldHelper tone={rest.some((e) => e.severity === "warning") ? "warning" : "info"}>
          {rest.map((e, i) => {
            const message = resolveMessage(e);
            return (
              <span className="block" data-severity={e.severity} key={i} lang={message.lang}>
                {message.text}
              </span>
            );
          })}
        </FieldHelper>
      )}
    </Field>
  );
}

/** The field a control's assistance is about, for {@link BoundAssist}. */
const FieldAssist = createContext<Pick<AssistUiProps, "field" | "focus" | "graph" | "locale"> | null>(null);

/**
 * The form's `assistUi`, bound to the field it sits in. One component for every
 * field, with the field read from context: a wrapper made per render would be a
 * new component type each time, and React would remount the control under it —
 * losing the caret and the focus on every keystroke.
 */
const BoundAssist: AssistWrap = ({ value, onValueChange, children }) => {
  const { assistUi: Ui } = useFormContext();
  const at = useContext(FieldAssist);
  if (!Ui || !at) return children;
  return (
    <Ui {...at} onValueChange={onValueChange} value={value}>
      {children}
    </Ui>
  );
};
