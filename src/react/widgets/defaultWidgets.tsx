import { useEffect, useMemo, useRef, useState } from "react";
import {
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  NativeSelect,
  NativeSelectOption,
  NumberInput,
  NumberInputControl,
  NumberInputDecrementTrigger,
  NumberInputIncrementTrigger,
  NumberInputInput,
  SegmentGroup,
  Switch,
  TagsInput,
  TagsInputContext,
  TagsInputControl,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDeleteTrigger,
  TagsInputItemInput,
  TagsInputItemPreview,
  TagsInputItemText,
  Textarea,
  useField,
} from "@kanzo-tech/ui";
import { CompleteHint, CompleteRoot, CompleteTextarea } from "@kanzo-tech/ai";
import { Editors } from "../../form/vocab/shacl-ui.js";
import { column, grow } from "../styles.js";
import type {
  MultiWidget,
  MultiWidgetProps,
  Widget,
  WidgetOption,
  WidgetProps,
  WidgetRegistry,
} from "./widgets.js";
import { makeDateField } from "./DateField.js";
import { AsyncCombobox, AsyncMultiCombobox } from "../fieldassist/AsyncCombobox.js";
import { LanguagePicker } from "./LanguagePicker.js";
import { useFormContext } from "../form/context.js";

/**
 * Default widgets — dumb presentational inputs over @kanzo-tech/ui, keyed by the
 * SHACL-UI editor IRI the shape states (or rudof infers). They carry no RDF logic;
 * term ⇄ primitive conversion is the binding layer's job.
 *
 * Requires `@kanzo-tech/ui/styles.css` and the theme attributes on `<html>` (see
 * `KanzoThemeProvider`) — Ark's overlays portal to `document.body`, so a wrapper
 * element cannot theme them.
 *
 * **Almost nothing here passes `invalid` or `disabled`.** `Input`, `Textarea`,
 * `NativeSelect`, `NumberInput`, `Combobox`, `TagsInput` and `Switch` are all Ark
 * `Field` parts: they read both from the `Field` context `FieldRenderer` puts them
 * in. The two exceptions are named where they are — `DateField` and the segmented
 * controls, whose machines read no `Field` context at all — and they take the state
 * from that same context rather than from a prop, so it still cannot drift.
 *
 * An entry may also declare `multi`: the same editor rendered as ONE control for a
 * repeatable field. See {@link MultiWidgetProps} for why that is keyed on
 * cardinality and not on a new editor IRI.
 *
 * Override per editor via `<MetadataForm widgets={{ [Editors.TextArea]: … }} />`.
 */

const NONE = "__mf_none__";

/**
 * Above this many options a `<select>` stops being usable and becomes a wall.
 * It is not hypothetical: the EU authority vocabularies a real HealthDCAT-AP
 * profile points at run to ~227 file types and ~8200 languages.
 */
const SELECT_MAX_OPTIONS = 15;

/**
 * At or below this many options the choices are worth showing all at once, as a
 * segmented control: every answer visible, one click, no list to open. Above it
 * the row stops fitting a form column and a `<select>` is the honest control.
 */
const SEGMENT_MAX_OPTIONS = 4;

/**
 * Free-text fields keep local state and commit to the graph on a short debounce
 * (and on blur), so fast typing doesn't rebuild the form model / revalidate on
 * every keystroke. Discrete inputs (date, select, boolean) commit immediately.
 */
function useCommit(value: string | null, onChange: (v: string | null) => void, delay = 250) {
  const [local, setLocal] = useState(value ?? "");
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!dirty.current) setLocal(value ?? "");
  }, [value]);

  const commit = (v: string) => {
    dirty.current = false;
    onChange(v === "" ? null : v);
  };
  const change = (v: string) => {
    setLocal(v);
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(v), delay);
  };
  const flush = () => {
    if (!dirty.current) return;
    clearTimeout(timer.current);
    commit(local);
  };
  return { local, change, flush };
}

/**
 * A plain single-line input.
 *
 * `sh:pattern` deliberately does **not** reach the HTML `pattern` attribute: the
 * SHACL facet is an unanchored XPath regex and the attribute is implicitly
 * `^(?:…)$`, so `sh:pattern "[0-9]{4}"` would reject `AB1234` — which the shape
 * accepts. `sh:flags` has nowhere to go there either. The engine validates the
 * committed value against the real regex; the browser was enforcing a different
 * one.
 */
function textField(type: string): Widget {
  return (p: WidgetProps) => {
    const { local, change, flush } = useCommit(p.value, p.onChange);
    return (
      <Input
        style={grow}
        type={type}
        step={p.step}
        min={p.min}
        max={p.max}
        minLength={p.minLength}
        maxLength={p.maxLength}
        placeholder={p.placeholder}
        value={local}
        onChange={(e) => change(e.target.value)}
        onBlur={flush}
      />
    );
  };
}

/**
 * A numeric field over the design system's `NumberInput` — steppers, a scrub
 * target and `tabular-nums`, which `<input type="number">` gives none of.
 *
 * It **does** read `Field` context (`use-number-input.js` takes `disabled`,
 * `invalid`, `readOnly`, `required` and the label/control ids from it), so this is
 * the same no-threading deal as `Input`. A note that used to sit here claiming
 * otherwise was simply wrong, and it cost this field its steppers for a release.
 *
 * `sh:minExclusive` / `sh:maxExclusive` still have nowhere to go: the machine's
 * bounds are inclusive and there is no epsilon that is right for both
 * `xsd:integer` and `xsd:double`. The engine rejects those on commit.
 */
const NumberField: Widget = (p) => {
  const { local, change, flush } = useCommit(p.value, p.onChange);
  return (
    <NumberInput
      value={local}
      min={p.min}
      max={p.max}
      // "any" is the absence of a step, not a step of any size.
      step={p.step && p.step !== "any" ? Number(p.step) : undefined}
      onValueChange={(d) => change(d.value)}
      onBlur={flush}
    >
      <NumberInputControl>
        <NumberInputInput placeholder={p.placeholder} />
        <NumberInputIncrementTrigger />
        <NumberInputDecrementTrigger />
      </NumberInputControl>
    </NumberInput>
  );
};

/** The language picker, glued to the trailing edge of whatever it tags.
 *  `align="inline-end"` is logical — it follows the writing direction rather
 *  than assuming LTR. */
function LangSlot(p: WidgetProps & { text: string }) {
  const { strings } = useFormContext();
  return (
    <LanguagePicker
      value={p.language ?? ""}
      onChange={(tag) => p.onChange(p.text || null, tag)}
      allowed={p.languageIn}
      // A language tags a value — meaningless with no text, so disable it until
      // something is typed.
      disabled={!p.text}
      strings={strings.languagePicker}
    />
  );
}

/** rdf:langString on one line. */
const LangField: Widget = (p) => {
  const text = useCommit(p.value, (v) => p.onChange(v, p.language || ""));
  return (
    <InputGroup style={grow}>
      <InputGroupInput
        value={text.local}
        onChange={(e) => text.change(e.target.value)}
        onBlur={text.flush}
      />
      <InputGroupAddon align="inline-end">
        <LangSlot {...p} text={text.local} />
      </InputGroupAddon>
    </InputGroup>
  );
};

/** rdf:langString as a paragraph. Distinct from {@link LangField} by exactly the
 *  thing the author asked for when they wrote `shui:TextAreaWithLangEditor`. */
const LangArea: Widget = (p) => {
  const text = useCommit(p.value, (v) => p.onChange(v, p.language || ""));
  return (
    <div style={{ ...column, ...grow, gap: "0.25rem" }}>
      <Textarea
        value={text.local}
        onChange={(e) => text.change(e.target.value)}
        onBlur={text.flush}
      />
      <div style={{ marginInlineStart: "auto", width: "fit-content" }}>
        <LangSlot {...p} text={text.local} />
      </div>
    </div>
  );
};

/** A free IRI field, used wherever a reference has no source to pick from. */
const IriField = textField("url");

/**
 * Reference editors. All three need somewhere to get candidates from
 * (`assist.search`); without one there is nothing to pick and the honest control
 * is free IRI entry.
 *
 * They are separate registry entries even though they share this body today: a
 * consumer can now override `SubClassEditor` alone — a class hierarchy wants a
 * tree, and `shui:` says which properties asked for one — without touching plain
 * autocomplete. Collapsing them is what made that impossible before.
 */
const ReferenceField: Widget = (p) => {
  // Hook first (stable order), then branch on whether search is wired.
  const inner = IriField(p);
  if (!p.loadOptions) return inner;
  return (
    <AsyncCombobox
      value={p.value}
      onChange={p.onChange}
      loadItems={p.loadOptions}
      placeholder="IRI or search…"
      // The suggestions are candidates, not the permitted values: an IRI nobody
      // suggested must survive being typed.
      allowCustomValue
    />
  );
};

/** The repeatable form of the same thing: one multi-select over the candidates,
 *  instead of N autocomplete rows each with its own add/remove button. Falls back
 *  to those rows when there is no source to search. */
const ReferenceMulti: MultiWidget = (p) =>
  p.loadOptions ? (
    <AsyncMultiCombobox
      values={p.values}
      onChange={p.onChange}
      loadItems={p.loadOptions}
      placeholder="Search…"
      max={p.maxCount}
    />
  ) : (
    // Nothing to search: the values are IRIs somebody types, which is the tags
    // input's case exactly — and one control either way, so the field does not
    // change shape when a consumer wires `assist.search` later.
    <TagsMulti {...p} placeholder="Add an IRI…" />
  );

/**
 * Long free text, with streaming inline completion when the consumer wires
 * `assist.complete`.
 *
 * The ghost is `@kanzo-tech/ai`'s compound composed *over* a plain `Textarea`
 * rather than an editor with a completion prop — which is why this is six lines
 * and not a CodeMirror instance. `cleanGhost` inside it also handles the echo
 * still arriving, not merely a finished one, which is the case that used to paint
 * the sentence twice.
 *
 * `CompleteRoot` owns the field's value while it is mounted, so the debounce
 * feeds it and the graph commit stays on the same blur as everywhere else.
 */
const Area: Widget = (p) => {
  // Hook first (stable order), then branch on whether inline completion is wired.
  const { local, change, flush } = useCommit(p.value, p.onChange);
  const complete = p.complete;
  if (!complete) {
    return (
      <Textarea
        style={{ flex: 1 }}
        value={local}
        placeholder={p.placeholder}
        onChange={(e) => change(e.target.value)}
        onBlur={flush}
      />
    );
  }
  return (
    <CompleteRoot
      // `className`, not `style`: CompleteRoot takes no style prop. `flex-1` is a
      // class the design system's own sheet ships, which the guard test checks.
      className="flex-1"
      value={local}
      onValueChange={change}
      complete={(req) => complete(req.value, req.signal)}
    >
      <CompleteTextarea>
        <Textarea placeholder={p.placeholder} onBlur={flush} />
      </CompleteTextarea>
      <CompleteHint />
    </CompleteRoot>
  );
};

/**
 * A repeatable free-text field as one tags input.
 *
 * The values arrive and leave as chips, so the field says what it holds at a
 * glance and adding the fourth keyword costs a keystroke rather than a click on
 * "+ Add" followed by a click into a fresh empty row. `sh:maxCount` is the
 * machine's `max`, so it stops accepting rather than accepting-then-failing.
 */
const TagsMulti: MultiWidget = (p) => (
  <TagsInput
    value={p.values}
    max={p.maxCount}
    onValueChange={(d) => p.onChange(d.value)}
  >
    <TagsInputControl>
      <TagsInputContext>
        {(api) =>
          api.value.map((value, index) => (
            <TagsInputItem index={index} key={`${value}-${index}`} value={value}>
              <TagsInputItemPreview>
                <TagsInputItemText>{value}</TagsInputItemText>
                <TagsInputItemDeleteTrigger />
              </TagsInputItemPreview>
              <TagsInputItemInput />
            </TagsInputItem>
          ))
        }
      </TagsInputContext>
      <TagsInputInput placeholder={p.placeholder ?? "Add…"} />
    </TagsInputControl>
  </TagsInput>
);

/**
 * The segmented form of a small closed set: every option visible, one click, no
 * list to open.
 *
 * Ark's segment group is a radio group and reads no `Field` context, so
 * `disabled`/`readOnly` come from that context by hand. There is no `invalid`
 * state on the machine at all — a segmented control has nothing to paint red that
 * would not also read as "this option is wrong" — so the field's error text below
 * carries it alone.
 */
function segments(items: { value: string; label: string }[], required: boolean) {
  // An optional field has one more answer than the shape lists: "not answered".
  // Leaving it off would make the first click unrepeatable — there would be no way
  // back to empty.
  return required ? items : [...items, { value: NONE, label: "Not set" }];
}

function SegmentField(p: WidgetProps & { items: { value: string; label: string }[] }) {
  const field = useField();
  return (
    <SegmentGroup
      variant="solid"
      options={segments(p.items, !!p.required)}
      value={p.value ?? NONE}
      disabled={field?.disabled}
      readOnly={field?.readOnly}
      onValueChange={(d) => p.onChange(d.value === NONE ? null : d.value)}
    />
  );
}

/**
 * Discrete choice, sized to the enumeration.
 *
 * Three sizes, and the shape decides which: at or below {@link SEGMENT_MAX_OPTIONS}
 * a segmented control shows every answer at once; up to {@link SELECT_MAX_OPTIONS}
 * a `NativeSelect` buys the platform's own keyboard, type-ahead and mobile picker;
 * past that a native list is a wall to scroll and the same values become a
 * searchable combobox. The shape does not change; only what a person can do with it
 * does.
 *
 * `className="w-full"` on the select is load-bearing: the wrapper `NativeSelect`
 * renders is `w-fit`, and only `className` reaches it. Without it the control
 * shrinks to the width of its longest option and the form reads as a thin ragged
 * column.
 */
function makeSelect(choices: (p: WidgetProps) => { value: string; label: string }[]): Widget {
  return (p) => {
    const items = choices(p);
    const search = useMemo(
      () => async (query: string) => {
        const q = query.trim().toLowerCase();
        return q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;
      },
      [items],
    );
    if (items.length > 0 && items.length <= SEGMENT_MAX_OPTIONS) {
      return <SegmentField {...p} items={items} />;
    }
    if (items.length > SELECT_MAX_OPTIONS) {
      // Closed set: the enumeration IS the permitted values, so an unmatched
      // input reverting on blur is correct rather than lossy.
      return <AsyncCombobox value={p.value} onChange={p.onChange} loadItems={search} placeholder="Search…" />;
    }
    return (
      <NativeSelect
        className="w-full"
        value={p.value || NONE}
        onChange={(e) => p.onChange(e.target.value === NONE ? null : e.target.value)}
      >
        <NativeSelectOption value={NONE}>—</NativeSelectOption>
        {items.map((c) => (
          <NativeSelectOption key={c.value} value={c.value}>
            {c.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    );
  };
}

/** A repeatable `sh:in`: the enumeration as one multi-select over a local filter,
 *  which is the same `AsyncCombobox` body with a synchronous source. */
const EnumMulti: MultiWidget = (p) => {
  const items: WidgetOption[] = p.options ?? [];
  const search = useMemo(
    () => async (query: string) => {
      const q = query.trim().toLowerCase();
      return q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;
    },
    [items],
  );
  return (
    <AsyncMultiCombobox
      values={p.values}
      onChange={p.onChange}
      loadItems={search}
      placeholder="Choose…"
      max={p.maxCount}
    />
  );
};

/**
 * A boolean, and how many states it really has.
 *
 * A `Switch` has two, so it is only honest when the shape guarantees a value —
 * `sh:minCount ≥ 1`, or a `sh:defaultValue` that fills the slot. Otherwise the
 * property has **three** states and "off" is a lie: a `sh:minCount 0` boolean
 * nobody answered is not `false`, and writing `false` into the graph because a
 * control could not represent "unanswered" is data the user never entered.
 */
const BooleanField: Widget = (p) => {
  const settled = !!p.required || p.defaultValue != null;
  const items = [
    { value: "true", label: "Yes" },
    { value: "false", label: "No" },
  ];
  // The branch is safe because `SegmentField` is a component, not a call: its
  // `useField` belongs to its own render, not to this one.
  if (settled) {
    return (
      <Switch
        checked={p.value === "true"}
        onCheckedChange={(d) => p.onChange(String(d.checked))}
      />
    );
  }
  return <SegmentField {...p} items={items} />;
};

export const defaultWidgets: WidgetRegistry = {
  // Free text declares the assistance it supports; discrete kinds opt out by
  // being bare widgets. Repeatable free text becomes one tags input.
  [Editors.TextField]: { render: textField("text"), multi: TagsMulti, assist: { suggest: true } },
  [Editors.NumberField]: NumberField,
  [Editors.IRI]: IriField,
  [Editors.DatePicker]: makeDateField(false),
  [Editors.DateTimePicker]: makeDateField(true),

  // Long free text → inline ghost-text completion (not the ✨ menu, which is clunky
  // for paragraphs). One affordance per field. No `multi`: several paragraphs are
  // several rows, and chips would hide the text that is the point of the field.
  [Editors.TextArea]: { render: Area, assist: { complete: true } },
  // No rich-text editor in the design system, so rich text is edited as plain
  // text. Stated here rather than silently folded into the entry above: the
  // profile asked for something we do not provide, and that is worth seeing.
  [Editors.RichText]: { render: Area, assist: { complete: true } },

  [Editors.TextFieldWithLang]: { render: LangField, assist: { suggest: true } },
  [Editors.TextAreaWithLang]: { render: LangArea, assist: { complete: true } },

  [Editors.Boolean]: BooleanField,
  // Categorical (sh:in): the control already lists exactly the allowed values, so
  // an LLM ✨ suggestion is redundant and could propose an out-of-enum value.
  [Editors.EnumSelect]: { render: makeSelect((p) => p.options ?? []), multi: EnumMulti },

  [Editors.AutoComplete]: { render: ReferenceField, multi: ReferenceMulti, assist: { suggest: true } },
  [Editors.InstancesSelect]: { render: ReferenceField, multi: ReferenceMulti, assist: { suggest: true } },
  [Editors.SubClass]: { render: ReferenceField, multi: ReferenceMulti, assist: { suggest: true } },
};
