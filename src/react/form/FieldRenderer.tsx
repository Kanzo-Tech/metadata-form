import { useState } from "react";
import {
  Field,
  FieldArray,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRequiredIndicator,
} from "@kanzo-tech/ui";
import type { Term } from "@rdfjs/types";
import type { FieldModel, FormModel, ValueSlot } from "../../form/FormModel.js";
import { Editors } from "../../form/vocab/shacl-ui.js";
import { defaultWidgets } from "../widgets/defaultWidgets.js";
import {
  languageOf,
  optionsFor,
  primitiveToTerm,
  resolveWidget,
  stepFor,
  termToPrimitive,
  widgetAssist,
  widgetMulti,
  widgetRender,
} from "../widgets/widgets.js";
import { useFormContext } from "./context.js";
import { useField } from "../hooks/useField.js";
import { NodeForm } from "./NodeForm.js";
import { SuggestList, SuggestMark, SuggestRoot } from "@kanzo-tech/ai";
import { fieldGap, ink, labelRow } from "../styles.js";

/** Renders a single field: label, help, value rows (multi-value), errors. */
export function FieldRenderer({ field }: { field: FieldModel }) {
  const { widgets, assist, graph, locale } = useFormContext();
  const ops = useField(field);

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
  // key (field.id) is stable.
  const [touched, setTouched] = useState(false);
  const errs = touched ? ops.errors : [];

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

  const entry = resolveWidget(field, widgets, defaultWidgets);
  if (!entry) {
    throw new Error(
      `No widget for editor ${field.editorId} on ${field.id}, and none for the ` +
        `fallback either — the registry is missing ${Editors.TextField}.`,
    );
  }
  const Widget = widgetRender(entry);
  const Multi = widgetMulti(entry); // the same editor as ONE control, if it has one
  const caps = widgetAssist(entry); // assistance this widget declares it supports
  const c = field.constraints;
  const options = optionsFor(field);
  const step = stepFor(field);
  const classIri = c.classIri;
  const loadOptions =
    assist?.search && classIri
      ? (query: string, signal?: AbortSignal) => assist.search!({ classIri, query, signal })
      : undefined;
  const complete =
    assist?.complete && !field.readOnly && caps.complete
      ? (value: string, signal?: AbortSignal) => assist.complete!({ field, value, graph, locale, signal })
      : undefined;

  const applySuggestion = (raw: string) => {
    setTouched(true);
    const term = primitiveToTerm(field, raw);
    if (!term) return;
    const current = singleValue ? (real[0]?.value ?? null) : null;
    if (current) ops.setValue(current, term);
    else ops.addValue(term);
  };

  const row = (i: number) => {
    const slot: ValueSlot = real[i] ?? { id: rowKey(i), value: null };
    return (
      <Widget
        value={termToPrimitive(slot.value)}
        language={languageOf(slot.value)}
        languageIn={c.languageIn}
        onChange={(v, language) => setTerm(i, primitiveToTerm(field, v, language))}
        options={options}
        loadOptions={loadOptions}
        complete={complete}
        classIri={classIri}
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
      />
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
      options={options}
      loadOptions={loadOptions}
      classIri={classIri}
      minCount={field.minCount}
      maxCount={field.maxCount}
    />
  ) : null;

  const rows = asOne ?? (singleValue ? (
    row(0)
  ) : (
    <FieldArray
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

  const suggests = assist?.suggest && !field.readOnly && caps.suggest;
  if (!suggests) return <FieldShell field={field} errors={errs}>{rows}</FieldShell>;

  // The ✨ and its candidates are one compound around the field's own rows: the
  // mark is bound to the stream by context, so it reads correctly in the label
  // row and the strip lands under the values it is offering to fill.
  return (
    <SuggestRoot
      suggest={(signal) => assist.suggest!({ field, graph, locale, signal })}
      existing={real.map((s) => s.value?.value ?? "").filter(Boolean)}
      onPick={applySuggestion}
    >
      <FieldShell field={field} errors={errs} action={<SuggestMark />}>
        {rows}
        <SuggestList />
      </FieldShell>
    </SuggestRoot>
  );
}

/**
 * The field frame. `Field` owns `invalid`/`disabled`/`required` and Ark hands
 * them to every input beneath by context, so no widget threads them itself.
 *
 * Only **violations** set `invalid`: they are what the library models as a
 * boolean. Warnings and info are real to SHACL but not to `Field`, so they are
 * rendered as our own nodes rather than pushed through an error channel that
 * would also paint the input red.
 */
function FieldShell({
  field,
  errors,
  action,
  children,
}: {
  field: FieldModel;
  errors: ReturnType<typeof useField>["errors"];
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const violations = errors.filter((e) => e.severity === "violation");
  const rest = errors.filter((e) => e.severity !== "violation");
  return (
    <Field
      style={{ gap: fieldGap }}
      data-field={field.id}
      required={field.required}
      disabled={field.readOnly ?? false}
      invalid={violations.length > 0}
    >
      <div style={{ ...labelRow, justifyContent: "space-between" }}>
        <FieldLabel>
          {field.label}
          {field.required && <FieldRequiredIndicator />}
        </FieldLabel>
        {action}
      </div>
      {field.description && <FieldDescription>{field.description}</FieldDescription>}
      {children}
      {violations.map((e, i) => (
        <FieldError key={i}>{e.message}</FieldError>
      ))}
      {rest.map((e, i) => (
        <p key={i} style={{ color: ink.warning, fontSize: "0.75rem" }} data-severity={e.severity}>
          {e.message}
        </p>
      ))}
    </Field>
  );
}
