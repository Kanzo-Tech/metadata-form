import { useId, useMemo, useState } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxControl,
  ComboboxEmpty,
  ComboboxFieldInput,
  ComboboxItem,
  createListCollection,
  useFilter,
} from "@kanzo-tech/ui";
import { DEFAULTS, type Strings } from "../../i18n/strings.js";

/** UI chrome, injectable for i18n; standalone (outside a <MetadataForm>, which
 *  otherwise supplies the catalog) it reads the built-in English one. */
type PickerStrings = Strings["languagePicker"];

/**
 * A compact, searchable language-tag picker for `rdf:langString` values, designed
 * to sit glued inside a text field's trailing slot. Better than a bare 2-letter
 * `<select>`:
 *  - each row shows the language's ENDONYM (its name in its own language) plus the
 *    tag, so you read "Español · es", not "es";
 *  - typeahead over both the name and the tag, so a long list stays usable;
 *  - honours `sh:languageIn` — when the shape constrains the languages the list is
 *    exactly those and free entry is off; otherwise a curated list plus free
 *    BCP-47 entry.
 *
 * That last line is the open/closed distinction the combobox makes with one prop,
 * and it is the same one `AsyncCombobox` draws for references: a constrained field
 * is a closed set and reverting an unmatched input is correct; an unconstrained one
 * is a suggestion list and a valid tag nobody listed must stand.
 *
 * The list navigation, the roving focus and the popover are the machine's. What is
 * ours is the vocabulary: the endonyms, the curated set, and the BCP-47 shape a
 * typed tag has to satisfy.
 *
 * It is composed from `ComboboxControl` + `ComboboxFieldInput` rather than
 * `ComboboxInput` because it is a **slot inside another field's control**, not a
 * control of its own: `ComboboxInput` brings an `InputGroup` and a trigger, which
 * drew a bordered box with a chevron inside the text field's bordered box, and the
 * `border: 0` overrides that hid it were treating the symptom. `ComboboxControl`
 * stays because the popover positions against it.
 */

/** A broad default set of language subtags (used when the shape does not pin
 *  `sh:languageIn`). The search filters it, so length is not an issue. */
const CURATED = [
  "en", "es", "fr", "de", "it", "pt", "nl", "ca", "gl", "eu", "ast", "oc",
  "ga", "cy", "sv", "da", "nb", "nn", "fi", "is", "pl", "cs", "sk", "sl",
  "hr", "sr", "bg", "ro", "hu", "el", "tr", "ru", "uk", "ar", "he", "fa",
  "hi", "bn", "ur", "zh", "ja", "ko", "th", "vi", "id", "ms", "sw", "af",
];

const BCP47 = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/** The language's name in its own language (endonym), e.g. `es` → "Español".
 *  Falls back to the tag when the runtime can't name it. */
function endonym(tag: string): string {
  try {
    const base = tag.split("-")[0];
    const name = new Intl.DisplayNames([tag], { type: "language" }).of(base);
    if (!name || name.toLowerCase() === base.toLowerCase()) return tag;
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return tag;
  }
}

interface LangItem {
  code: string;
  name: string;
}

export function LanguagePicker({
  value,
  onChange,
  allowed,
  disabled,
  strings = DEFAULTS.en.languagePicker,
}: {
  value: string;
  onChange: (tag: string) => void;
  /** `sh:languageIn` — when non-empty, constrains the list and disables free entry. */
  allowed?: string[];
  disabled?: boolean;
  /** Localized UI chrome; defaults to English when rendered standalone. */
  strings?: PickerStrings;
}) {
  const constrained = !!(allowed && allowed.length);
  const { contains } = useFilter({ sensitivity: "base" });
  const [query, setQuery] = useState("");
  // The combobox machine takes its input id from the surrounding `Field` when it
  // finds one — correct for a field's own control, wrong for a second control in
  // the same field: the text input has already claimed that id, and two elements
  // shared it. Ours is its own.
  const inputId = useId();

  const items = useMemo<LangItem[]>(() => {
    const codes = constrained ? allowed! : CURATED;
    return codes.map((code) => ({ code, name: endonym(code) }));
  }, [constrained, allowed]);

  // Filtering is ours to own by design — the machine never mutates a collection.
  // Both the tag and the endonym match, so "spa", "es" and "Español" all find it.
  const collection = useMemo(() => {
    const q = query.trim();
    const shown = q ? items.filter((i) => contains(i.code, q) || contains(i.name, q)) : items;
    return createListCollection({
      items: shown,
      itemToValue: (i) => i.code,
      itemToString: (i) => `${i.name} · ${i.code}`,
    });
  }, [items, query, contains]);

  return (
    <Combobox
      collection={collection}
      ids={{ input: inputId }}
      value={value ? [value] : []}
      disabled={disabled}
      // A tag the shape did not list is only admissible when the shape listed none.
      allowCustomValue={!constrained}
      onValueChange={(d) => d.value[0] && onChange(d.value[0])}
      onInputValueChange={(d) => {
        setQuery(d.inputValue);
        const t = d.inputValue.trim();
        if (!constrained && t && BCP47.test(t)) onChange(t.toLowerCase());
      }}
      aria-label={strings.label}
    >
      <ComboboxControl>
        <ComboboxFieldInput
          style={{
            width: "6rem",
            minWidth: 0,
            background: "transparent",
            border: 0,
            outline: "none",
            font: "inherit",
            color: "inherit",
          }}
          placeholder={constrained ? strings.filterPlaceholder : strings.searchPlaceholder}
        />
      </ComboboxControl>
      <ComboboxContent>
        <ComboboxEmpty>{strings.noMatches}</ComboboxEmpty>
        {collection.items.map((item) => (
          <ComboboxItem key={item.code} item={item}>
            {item.name} · {item.code}
          </ComboboxItem>
        ))}
      </ComboboxContent>
    </Combobox>
  );
}
