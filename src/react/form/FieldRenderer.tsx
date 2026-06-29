import { useState } from "react";
import { Box, Button, Flex, Text } from "@radix-ui/themes";
import { PlusIcon } from "@radix-ui/react-icons";
import type { Term } from "@rdfjs/types";
import type { FieldModel, FormModel, ValueSlot } from "../../model/FormModel.js";
import { Editors } from "../../shacl/vocab/shacl-ui.js";
import { defaultWidgets } from "../widgets/defaultWidgets.js";
import { languageOf, optionsFor, primitiveToTerm, stepFor, termToPrimitive, widgetKind, widgetRender, widgetAssist } from "../widgets/widgets.js";
import { useFormContext } from "./context.js";
import { useField } from "../hooks/useField.js";
import { NodeForm } from "./NodeForm.js";
import { SuggestMenu } from "../fieldassist/SuggestionBox.js";
import { CloseButton } from "./CloseButton.js";

/** Renders a single field: label, help, value rows (multi-value), errors. */
export function FieldRenderer({ field }: { field: FieldModel }) {
  const { widgets, assist, graph, locale } = useFormContext();
  const ops = useField(field);

  const isNested = field.editorId === Editors.Details || !!field.nodeShape;
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

  if (isNested) {
    return (
      <FieldShell field={field} errors={errs}>
        <Flex direction="column" gap="3">
          {real.map((slot) => (
            <Flex gap="2" align="start" key={slot.id}>
              <Box style={{ flex: 1, minWidth: 0 }}>
                {slot.nested && <NodeForm model={slot.nested as FormModel} />}
              </Box>
              <CloseButton label="Remove" onClick={() => { setTouched(true); ops.removeValue(slot.value as Term); }} />
            </Flex>
          ))}
        </Flex>
        {canAddMore && <AddButton onClick={() => { setTouched(true); ops.createNested(); }} />}
      </FieldShell>
    );
  }

  const kind = widgetKind(field);
  const entry = widgets[kind] ?? defaultWidgets[kind]!;
  const Widget = widgetRender(entry);
  const caps = widgetAssist(entry); // assistance this widget declares it supports
  const options = kind === "select" ? optionsFor(field) : undefined;
  const step = stepFor(field);
  const c = field.constraints;
  const classIri = c.classIri;
  const loadOptions =
    kind === "reference" && assist?.search && classIri
      ? (query: string, signal?: AbortSignal) => assist.search!({ classIri, query, signal })
      : undefined;
  const complete =
    assist?.complete && !field.readOnly && caps.complete
      ? (value: string, signal?: AbortSignal) => assist.complete!({ field, value, graph, locale, signal })
      : undefined;

  const applySuggestion = (raw: string) => {
    setTouched(true);
    const term = primitiveToTerm(field, kind, raw);
    if (!term) return;
    const current = singleValue ? (real[0]?.value ?? null) : null;
    if (current) ops.setValue(current, term);
    else ops.addValue(term);
  };

  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    // The empty (pending) row must carry the SAME key it will get once committed
    // (`buildFormModel` keys real slots `${field.id}#${i}`). If it differed, the
    // first value commit would change the row's key → React remounts the input →
    // loses focus/hover/caret. Pending rows occupy indices >= real.length, so
    // there is no key collision with real slots.
    const slot: ValueSlot = real[i] ?? { id: `${field.id}#${i}`, value: null };
    rows.push(
      <Flex gap="2" align="center" key={slot.id}>
        <Widget
          kind={kind}
          value={termToPrimitive(slot.value)}
          language={languageOf(slot.value)}
          onChange={(v, language) => setTerm(i, primitiveToTerm(field, kind, v, language))}
          options={options}
          loadOptions={loadOptions}
          complete={complete}
          classIri={classIri}
          invalid={errs.length > 0}
          required={field.required}
          disabled={field.readOnly ?? false}
          step={step}
          min={c.minInclusive}
          max={c.maxInclusive}
          maxLength={c.maxLength}
          pattern={c.pattern}
        />
        {!singleValue && !field.readOnly && <CloseButton label="Remove" onClick={() => removeRow(i)} />}
      </Flex>,
    );
  }

  return (
    <FieldShell
      field={field}
      errors={errs}
      action={
        assist?.suggest && !field.readOnly && caps.suggest ? (
          <SuggestMenu
            fetch={(signal) => assist.suggest!({ field, graph, locale, signal })}
            existing={real.map((s) => s.value?.value ?? "").filter(Boolean)}
            onPick={applySuggestion}
          />
        ) : undefined
      }
    >
      <Flex direction="column" gap="2">
        {rows}
      </Flex>
      {!singleValue && canAddMore && <AddButton onClick={() => setPending((n) => n + 1)} />}
    </FieldShell>
  );
}


function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="soft" size="1" onClick={onClick} style={{ alignSelf: "flex-start" }}>
      <PlusIcon /> Add
    </Button>
  );
}

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
  return (
    <Flex direction="column" gap="1" data-field={field.id}>
      <Flex align="center" justify="between" gap="2">
        <Text as="label" size="2" weight="medium">
          {field.label}
          {field.required && <Text color="red"> *</Text>}
        </Text>
        {action}
      </Flex>
      {field.description && (
        <Text size="1" color="gray">
          {field.description}
        </Text>
      )}
      {children}
      {errors.map((e, i) => (
        <Text key={i} size="1" color={e.severity === "violation" ? "red" : "orange"}>
          {e.message}
        </Text>
      ))}
    </Flex>
  );
}
