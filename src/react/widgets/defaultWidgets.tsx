import { useEffect, useRef, useState } from "react";
import { Select, TextArea, TextField } from "@radix-ui/themes";
import type { Widget, WidgetProps, WidgetRegistry } from "./widgets.js";
import { makeDateField } from "./DateField.js";
import { Combobox } from "../fieldassist/SuggestionBox.js";
import { GhostEditor } from "./GhostEditor.js";

/**
 * Default widgets — dumb presentational inputs built on @radix-ui/themes. They
 * carry no RDF logic (all term ⇄ primitive conversion is in the binding layer).
 * Requires a `<Theme>` ancestor and `@radix-ui/themes/styles.css`.
 *
 * Override per kind via `<MetadataForm widgets={...} />`.
 */

const NONE = "__mf_none__";

/**
 * Free-text fields keep local state and commit to the graph on a short debounce
 * (and on blur), so fast typing doesn't rebuild the form model / revalidate on
 * every keystroke. Discrete inputs (date, select, boolean) commit immediately.
 */
function useCommit(value: string | null, onChange: (v: string | null) => void, delay = 250) {
  const [local, setLocal] = useState(value ?? "");
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

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

function textField(type: string): Widget {
  return (p: WidgetProps) => {
    const { local, change, flush } = useCommit(p.value, p.onChange);
    return (
      <TextField.Root
        style={{ flex: 1, width: "100%" }}
        type={type as never}
        step={p.step}
        min={p.min}
        max={p.max}
        maxLength={p.maxLength}
        pattern={p.pattern}
        value={local}
        disabled={p.disabled}
        color={p.invalid ? "red" : undefined}
        onChange={(e) => change(e.target.value)}
        onBlur={flush}
      />
    );
  };
}

const COMMON_LANGS = ["en", "es", "fr", "de", "it", "pt", "nl", "ca", "gl", "eu"];

/** rdf:langString: a single field — text with the language selector glued inside
 * its right edge (separated by a border), via Radix's TextField.Slot. */
const LangField: Widget = (p) => {
  const text = useCommit(p.value, (v) => p.onChange(v, p.language || ""));
  const lang = p.language ?? "";
  return (
    <TextField.Root
      style={{ flex: 1 }}
      value={text.local}
      disabled={p.disabled}
      color={p.invalid ? "red" : undefined}
      onChange={(e) => text.change(e.target.value)}
      onBlur={text.flush}
    >
      <TextField.Slot side="right" style={{ borderLeft: "1px solid var(--gray-a6)", paddingLeft: 0 }}>
        <Select.Root
          value={lang || NONE}
          disabled={p.disabled}
          onValueChange={(v) => p.onChange(text.local || null, v === NONE ? "" : v)}
        >
          <Select.Trigger variant="ghost" placeholder="lang" />
          <Select.Content position="popper">
            <Select.Item value={NONE}>—</Select.Item>
            {COMMON_LANGS.map((t) => (
              <Select.Item key={t} value={t}>
                {t}
              </Select.Item>
            ))}
            {lang && !COMMON_LANGS.includes(lang) && <Select.Item value={lang}>{lang}</Select.Item>}
          </Select.Content>
        </Select.Root>
      </TextField.Slot>
    </TextField.Root>
  );
};

/** sh:class reference: free IRI entry + async suggestions (from `assist.search`).
 * The autocomplete is the shared downshift combobox; without a provider it's a
 * plain free-IRI text field. */
const ReferenceField: Widget = (p) => {
  // Hook first (stable order), then branch on whether search is wired.
  const { local, change, flush } = useCommit(p.value, p.onChange);
  if (p.loadOptions) {
    return (
      <Combobox
        value={p.value}
        onChange={p.onChange}
        loadItems={p.loadOptions}
        placeholder="IRI or search…"
        invalid={p.invalid}
        disabled={p.disabled}
      />
    );
  }
  return (
    <TextField.Root
      style={{ flex: 1, width: "100%" }}
      placeholder="IRI"
      value={local}
      disabled={p.disabled}
      color={p.invalid ? "red" : undefined}
      onChange={(e) => change(e.target.value)}
      onBlur={flush}
    />
  );
};

const Area: Widget = (p) => {
  // Hook first (stable order), then branch on whether inline completion is wired.
  const { local, change, flush } = useCommit(p.value, p.onChange);
  if (p.complete) return <GhostEditor {...p} complete={p.complete} />;
  return (
    <TextArea
      style={{ flex: 1 }}
      value={local}
      disabled={p.disabled}
      color={p.invalid ? "red" : undefined}
      onChange={(e) => change(e.target.value)}
      onBlur={flush}
    />
  );
};

function makeSelect(choices: (p: WidgetProps) => { value: string; label: string }[]): Widget {
  return (p) => (
    <Select.Root
      value={p.value || NONE}
      disabled={p.disabled}
      onValueChange={(v) => p.onChange(v === NONE ? null : v)}
    >
      <Select.Trigger style={{ flex: 1 }} placeholder="—" color={p.invalid ? "red" : undefined} />
      <Select.Content position="popper">
        <Select.Item value={NONE}>—</Select.Item>
        {choices(p).map((c) => (
          <Select.Item key={c.value} value={c.value}>
            {c.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}

export const defaultWidgets: WidgetRegistry = {
  // Free text & categorical kinds declare which assistance they support; the
  // others (date/number/url/boolean) opt out by being bare widgets.
  text: { render: textField("text"), assist: { suggest: true } },
  number: textField("number"),
  url: textField("url"),
  date: makeDateField(false),
  datetime: makeDateField(true),
  // Long free text → inline ghost-text completion (not the ✨ menu, which is clunky
  // for paragraphs). One affordance per field.
  textarea: { render: Area, assist: { complete: true } },
  boolean: makeSelect(() => [
    { value: "true", label: "Yes" },
    { value: "false", label: "No" },
  ]),
  // Categorical (sh:in): the Select already lists exactly the allowed values, so
  // an LLM ✨ suggestion is redundant and could propose an out-of-enum value.
  select: makeSelect((p) => p.options ?? []),
  reference: { render: ReferenceField, assist: { suggest: true } },
  lang: { render: LangField, assist: { suggest: true } },
};
