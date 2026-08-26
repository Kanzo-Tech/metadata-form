import { useEffect, useMemo, useRef, useState } from "react";
import {
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  NativeSelect,
  NativeSelectOption,
  Textarea,
} from "@kanzo-tech/ui";
import { CompleteHint, CompleteRoot, CompleteTextarea } from "@kanzo-tech/ai";
import { Editors } from "../../form/vocab/shacl-ui.js";
import type { Widget, WidgetProps, WidgetRegistry } from "./widgets.js";
import { makeDateField } from "./DateField.js";
import { Combobox } from "../fieldassist/SuggestionBox.js";
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
 * **Nothing here passes `invalid` or `disabled`.** `Input`, `Textarea` and
 * `NativeSelect` are Ark `Field` parts: they read both from the `Field` context
 * `FieldRenderer` puts them in. Threading them by hand is how the accessible
 * state and the painted one drift apart.
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
 * `type="number"` on the Ark field input rather than the richer `NumberInput`:
 * `NumberInput` has its own root and does not sit in the `Field` context, so it
 * would have to be handed `invalid`/`disabled` by hand — reintroducing exactly the
 * threading this registry removed. Revisit if it gains `Field` awareness.
 */
function textField(type: string): Widget {
  return (p: WidgetProps) => {
    const { local, change, flush } = useCommit(p.value, p.onChange);
    return (
      <Input
        className="w-full flex-1"
        type={type}
        step={p.step}
        min={p.min}
        max={p.max}
        maxLength={p.maxLength}
        pattern={p.pattern}
        placeholder={p.placeholder}
        value={local}
        onChange={(e) => change(e.target.value)}
        onBlur={flush}
      />
    );
  };
}

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
    <InputGroup className="w-full flex-1">
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
    <div className="flex w-full flex-1 flex-col gap-1">
      <Textarea
        value={text.local}
        onChange={(e) => text.change(e.target.value)}
        onBlur={text.flush}
      />
      <div className="self-end">
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
    <Combobox
      value={p.value}
      onChange={p.onChange}
      loadItems={p.loadOptions}
      placeholder="IRI or search…"
    />
  );
};

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
        className="flex-1"
        value={local}
        placeholder={p.placeholder}
        onChange={(e) => change(e.target.value)}
        onBlur={flush}
      />
    );
  }
  return (
    <CompleteRoot
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
 * Discrete choice, sized to the enumeration.
 *
 * Small lists get `NativeSelect` — the platform's own keyboard, type-ahead and
 * mobile picker, for free. Past {@link SELECT_MAX_OPTIONS} a native list is a
 * wall to scroll, so the same values become a searchable combobox instead. The
 * shape does not change; only what a person can do with it does.
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
    if (items.length > SELECT_MAX_OPTIONS) {
      return <Combobox value={p.value} onChange={p.onChange} loadItems={search} placeholder="Search…" />;
    }
    return (
      <NativeSelect
        className="w-full flex-1"
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

/** Booleans stay a select rather than a `Switch`: a switch has only two states and
 *  an optional boolean has three — a `sh:minCount 0` property that was never
 *  answered is not `false`. */
const BooleanField = makeSelect(() => [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
]);

export const defaultWidgets: WidgetRegistry = {
  // Free text declares the assistance it supports; discrete kinds opt out by
  // being bare widgets.
  [Editors.TextField]: { render: textField("text"), assist: { suggest: true } },
  [Editors.NumberField]: textField("number"),
  [Editors.IRI]: IriField,
  [Editors.DatePicker]: makeDateField(false),
  [Editors.DateTimePicker]: makeDateField(true),

  // Long free text → inline ghost-text completion (not the ✨ menu, which is clunky
  // for paragraphs). One affordance per field.
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
  [Editors.EnumSelect]: makeSelect((p) => p.options ?? []),

  [Editors.AutoComplete]: { render: ReferenceField, assist: { suggest: true } },
  [Editors.InstancesSelect]: { render: ReferenceField, assist: { suggest: true } },
  [Editors.SubClass]: { render: ReferenceField, assist: { suggest: true } },
};
