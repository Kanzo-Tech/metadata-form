import {
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  LanguagePicker,
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
  useDebouncedCommit,
  type DebouncedCommit,
} from "@kanzo-tech/ui";
import { type ReactElement, useState } from "react";
import { Editors } from "../../form/vocab/shacl-ui.js";
import type {
  MultiWidget,
  Widget,
  WidgetProps,
  WidgetRegistry,
} from "./widgets.js";
import { makeDateField } from "./DateField.js";
import {
  EnumCombobox,
  EnumMultiCombobox,
  ReferenceCombobox,
  ReferenceMultiCombobox,
} from "../fieldassist/Comboboxes.js";
import { useStrings } from "../form/context.js";

/**
 * Default widgets — dumb presentational inputs over @kanzo-tech/ui, keyed by the
 * SHACL-UI editor IRI the shape states (or rudof infers). They carry no RDF logic;
 * term ⇄ primitive conversion is the binding layer's job.
 *
 * Requires the Tailwind entries in README (`@kanzo-tech/metadata-form/tailwind.css`) and the theme attributes on `<html>` (see
 * `KanzoThemeProvider`) — Ark's overlays portal to `document.body`, so a wrapper
 * element cannot theme them.
 *
 * **Nothing here passes `invalid`, `disabled` or `readOnly`.** Every control under
 * a `Field` — `Input`, `Textarea`, `NativeSelect`, `NumberInput`, `Combobox`,
 * `TagsInput`, `Switch`, `DatePicker`, `SegmentGroup`, `LanguagePicker` — reads
 * them from the `Field` context `FieldRenderer` puts them in, so the accessible
 * state and the painted one cannot drift.
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
 * Free-text fields keep a draft and commit to the graph once typing pauses (and on
 * blur), so fast typing doesn't rebuild the form model / revalidate on every
 * keystroke. Discrete inputs (date, select, boolean) commit immediately. An
 * emptied field is no value at all, not the empty string.
 */
const useText = (value: string | null, onChange: (v: string | null) => void) =>
  useDebouncedCommit(value, (v) => onChange(v || null));

/** What {@link useText} hands a control. */
type Text = DebouncedCommit<string | null>;

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
    const { draft, change, flush } = useText(p.value, p.onChange);
    const control = (
      <Input
        type={type}
        step={p.step}
        min={p.min}
        max={p.max}
        minLength={p.minLength}
        maxLength={p.maxLength}
        placeholder={p.placeholder}
        value={draft ?? ""}
        onChange={(e) => change(e.target.value)}
        onBlur={flush}
      />
    );
    return <Assisted assist={p.assist} control={control} text={{ draft, change }} />;
  };
}

/**
 * A control under the field's model assistance, when it has any. A proposal is
 * taken through the draft, so it commits as typing does — after the pause, or on
 * the blur that follows.
 */
function Assisted({
  assist: Wrap,
  control,
  text,
}: {
  assist: WidgetProps["assist"];
  control: ReactElement;
  text: Pick<Text, "draft" | "change">;
}) {
  if (!Wrap) return control;
  return (
    <Wrap onValueChange={(v) => text.change(v as string)} value={text.draft ?? ""}>
      {control}
    </Wrap>
  );
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
  const { draft, change, flush } = useText(p.value, p.onChange);
  return (
    <NumberInput
      value={draft ?? ""}
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

/**
 * The language of a row, which the row has **before** it has a value.
 *
 * A tag exists in the graph only on a literal, so with no text there is nowhere
 * to write it — and the picker used to be disabled until something was typed,
 * which made "choose the language, then write" a control that did nothing. The
 * choice is held here instead and rides on the text's first commit; once there is
 * a literal, its own tag is the truth.
 */
function useLanguage(p: WidgetProps) {
  const [pending, setPending] = useState("");
  const language = p.language || pending;
  return {
    language,
    /** Pick a tag: remembered, and written at once when there is text to carry it. */
    pick: (tag: string, text: string) => {
      setPending(tag);
      if (text) p.onChange(text, tag);
    },
  };
}

/** The language picker, in the trailing slot of whatever it tags.
 *  `align="inline-end"` is logical — it follows the writing direction rather
 *  than assuming LTR. */
function LangSlot(p: WidgetProps & { text: string; lang: ReturnType<typeof useLanguage> }) {
  const { label, ...translations } = useStrings().languagePicker;
  return (
    <LanguagePicker
      inline
      aria-label={label}
      value={p.lang.language}
      onValueChange={(tag) => p.lang.pick(tag, p.text)}
      languages={p.languageIn}
      translations={translations}
    />
  );
}

/** rdf:langString on one line. */
const LangField: Widget = (p) => {
  const lang = useLanguage(p);
  const text = useText(p.value, (v) => p.onChange(v, lang.language));
  return (
    <InputGroup>
      <Assisted
        assist={p.assist}
        control={
          <InputGroupInput
            value={text.draft ?? ""}
            onChange={(e) => text.change(e.target.value)}
            onBlur={text.flush}
          />
        }
        text={text}
      />
      <InputGroupAddon align="inline-end">
        <LangSlot {...p} lang={lang} text={text.draft ?? ""} />
      </InputGroupAddon>
    </InputGroup>
  );
};

/** rdf:langString as a paragraph. Distinct from {@link LangField} by exactly the
 *  thing the author asked for when they wrote `shui:TextAreaWithLangEditor`. */
const LangArea: Widget = (p) => {
  const lang = useLanguage(p);
  const text = useText(p.value, (v) => p.onChange(v, lang.language));
  return (
    <div className="flex flex-col gap-1">
      <AreaControl assist={p.assist} placeholder={p.placeholder} text={text} />
      <div className="ms-auto w-fit">
        <LangSlot {...p} lang={lang} text={text.draft ?? ""} />
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
  const { chrome } = useStrings();
  // Hook first (stable order), then branch on whether search is wired.
  const inner = IriField(p);
  if (!p.loadOptions) return inner;
  return (
    <ReferenceCombobox
      value={p.value}
      onChange={p.onChange}
      load={p.loadOptions}
      placeholder={chrome.iriOrSearch}
    />
  );
};

/** The repeatable form of the same thing: one multi-select over the candidates,
 *  instead of N autocomplete rows each with its own add/remove button. Falls back
 *  to those rows when there is no source to search. */
const ReferenceMulti: MultiWidget = (p) => {
  const { chrome } = useStrings();
  return p.loadOptions ? (
    <ReferenceMultiCombobox
      values={p.values}
      onChange={p.onChange}
      load={p.loadOptions}
      placeholder={chrome.search}
      max={p.maxCount}
    />
  ) : (
    // Nothing to search: the values are IRIs somebody types, which is the tags
    // input's case exactly — and one control either way, so the field does not
    // change shape when a consumer wires `assist.search` later.
    <TagsMulti {...p} placeholder={chrome.addIri} />
  );
};

/** A textarea; under model assistance, ghost text continues it at the caret. */
function AreaControl({ text, assist, placeholder }: { text: Text; assist: WidgetProps["assist"]; placeholder: string | undefined }) {
  const control = (
    <Textarea
      value={text.draft ?? ""}
      placeholder={placeholder}
      onChange={(e) => text.change(e.target.value)}
      onBlur={text.flush}
    />
  );
  return <Assisted assist={assist} control={control} text={text} />;
}

/** Long free text. */
const Area: Widget = (p) => {
  const text = useText(p.value, p.onChange);
  return <AreaControl assist={p.assist} placeholder={p.placeholder} text={text} />;
};

/**
 * A repeatable free-text field as one tags input.
 *
 * The values arrive and leave as chips, so the field says what it holds at a
 * glance and adding the fourth keyword costs a keystroke rather than a click on
 * "+ Add" followed by a click into a fresh empty row. `sh:maxCount` is the
 * machine's `max`, so it stops accepting rather than accepting-then-failing.
 */
const TagsMulti: MultiWidget = (p) => {
  const { chrome } = useStrings();
  const control = (
    <TagsInput value={p.values} max={p.maxCount} onValueChange={(d) => p.onChange(d.value)}>
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
        <TagsInputInput placeholder={p.placeholder ?? chrome.add} />
      </TagsInputControl>
    </TagsInput>
  );
  if (!p.assist) return control;
  // A list proposal is added to the list, so it commits at once: a tag has no draft.
  return (
    <p.assist onValueChange={(vs) => p.onChange(vs as string[])} value={p.values}>
      {control}
    </p.assist>
  );
};

/**
 * The segmented form of a small closed set: every option visible, one click, no
 * list to open.
 *
 * There is no `invalid` state on the machine at all — a segmented control has
 * nothing to paint red that would not also read as "this option is wrong" — so the
 * field's error text below carries it alone.
 */
function SegmentField(p: WidgetProps & { items: { value: string; label: string }[] }) {
  const { chrome } = useStrings();
  // An optional field has one more answer than the shape lists: "not answered".
  // Leaving it off would make the first click unrepeatable — there would be no way
  // back to empty.
  const options = p.required ? p.items : [...p.items, { value: NONE, label: chrome.notSet }];
  return (
    <SegmentGroup
      variant="solid"
      options={options}
      value={p.value ?? NONE}
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
    const { chrome } = useStrings();
    const items = choices(p);
    if (items.length > 0 && items.length <= SEGMENT_MAX_OPTIONS) {
      return <SegmentField {...p} items={items} />;
    }
    if (items.length > SELECT_MAX_OPTIONS) {
      // Closed set: the enumeration IS the permitted values, so an unmatched
      // input reverting on blur is correct rather than lossy.
      return <EnumCombobox value={p.value} onChange={p.onChange} items={items} placeholder={chrome.search} />;
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

/** A repeatable `sh:in`: the enumeration as one multi-select. */
const EnumMulti: MultiWidget = (p) => {
  const { chrome } = useStrings();
  return (
    <EnumMultiCombobox
      values={p.values}
      onChange={p.onChange}
      items={p.options ?? []}
      placeholder={chrome.choose}
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
  const { chrome } = useStrings();
  const settled = !!p.required || p.defaultValue != null;
  const items = [
    { value: "true", label: chrome.yes },
    { value: "false", label: chrome.no },
  ];
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
  [Editors.TextField]: { render: textField("text"), multi: TagsMulti, assist: true },
  [Editors.NumberField]: NumberField,
  [Editors.IRI]: IriField,
  [Editors.DatePicker]: makeDateField(false),
  [Editors.DateTimePicker]: makeDateField(true),

  // Long free text: under assistance a textarea is continued at the caret, where a
  // one-line input gets whole values. No `multi`: several paragraphs are several
  // rows, and chips would hide the text that is the point of the field.
  [Editors.TextArea]: { render: Area, assist: true },
  // No rich-text editor in the design system, so rich text is edited as plain
  // text. Stated here rather than silently folded into the entry above: the
  // profile asked for something we do not provide, and that is worth seeing.
  [Editors.RichText]: { render: Area, assist: true },

  [Editors.TextFieldWithLang]: { render: LangField, assist: true },
  [Editors.TextAreaWithLang]: { render: LangArea, assist: true },

  [Editors.Boolean]: BooleanField,
  // Categorical (sh:in): the control already lists exactly the allowed values, so
  // an LLM ✨ suggestion is redundant and could propose an out-of-enum value.
  [Editors.EnumSelect]: { render: makeSelect((p) => p.options ?? []), multi: EnumMulti },

  [Editors.AutoComplete]: { render: ReferenceField, multi: ReferenceMulti },
  [Editors.InstancesSelect]: { render: ReferenceField, multi: ReferenceMulti },
  [Editors.SubClass]: { render: ReferenceField, multi: ReferenceMulti },
};
