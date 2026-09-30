/**
 * The words of the interface itself — everything the library prints that no shape
 * and no message graph says. English is built in; every other language is data a
 * consumer imports (`metadata-form/i18n`) or writes, and passes as `strings`.
 *
 * What is NOT here: field labels, descriptions and group names (the profile's
 * `sh:name`/`sh:description`/`rdfs:label`, picked by language) and the wording of
 * a validation failure (the profile's `sh:message`, else the message graph in
 * `messages.ts`). This file is the third and last source, the chrome around them.
 */

import type { ReadOnlyCode } from "../form/FormModel.js";
import { matchesLanguage } from "../form/terms.js";

/** A message that depends on a count: one template per CLDR plural category the
 *  language uses (`Intl.PluralRules`), `other` mandatory. `{n}` is the count. */
export type Plural = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

export interface Strings {
  /** The words of the `rdf:langString` language-tag picker (`LanguagePicker`'s `translations`, plus its accessible name). */
  languagePicker: {
    /** Accessible name of the picker. */
    label: string;
    /** Search box when free BCP-47 entry is allowed. */
    placeholder: string;
    /** Search box when the shape pins `sh:languageIn` (filter-only). */
    filterPlaceholder: string;
    /** Shown when a constrained filter matches nothing. */
    noMatches: string;
  };
  /** Chrome of the findings panel — the words AROUND a message, not the message.
   *  A form whose fields and errors are Spanish and whose severity badge says
   *  "Violation" is a form that is half translated. */
  validationPanel: {
    /** Shown when the report is clean. */
    empty: string;
    /** The severity, as the badge word. Keyed by `Severity`. */
    violation: string;
    warning: string;
    info: string;
    /** What each severity means for the data, shown when a finding is opened. */
    violationDetail: string;
    warningDetail: string;
    infoDetail: string;
    /** Precedes the offending term. */
    reportedValue: string;
    /** Accessible name of the disclosure that opens one finding. `{field}` is the
     *  field's hierarchical label, substituted verbatim. */
    detailsOf: string;
  };
  /**
   * Why a field shows its values but does not take input, keyed by
   * {@link ReadOnlyCode}. A disabled field with no account of itself reads as a
   * bug; these are the sentence that turns it into a statement about the profile.
   * Written for the person filling the form, so they name the consequence rather
   * than the SHACL construct.
   */
  readOnly: Record<ReadOnlyCode, string>;
  /** Every other word the form prints: placeholders, boolean and empty options,
   *  counts, progress, loading. `{name}` marks a substituted value. */
  chrome: {
    /** Placeholder of a reference field that takes an IRI or a search. */
    iriOrSearch: string;
    search: string;
    addIri: string;
    add: string;
    choose: string;
    /** The empty option of an optional select. */
    notSet: string;
    yes: string;
    no: string;
    /** Accessible name of the time input of a date-time field. */
    time: string;
    noMatches: string;
    remove: string;
    /** Accessible name of the value-kind selector. `{field}` is the field label. */
    kindOfValue: string;
    loading: string;
    /** `{error}` is the failure's own message. */
    loadFailed: string;
    /** Label of an unnamed group in a tabbed layout; `{n}` is its 1-based position. */
    group: string;
    /** Same, in a stepped layout. */
    step: string;
    /** The stepped layout's buttons. */
    back: string;
    next: string;
    /** "n issues". */
    issues: Plural;
    /** The summary pill of a clean form. */
    valid: string;
  };
}

/** A recursive partial for consumer overrides. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown> ? DeepPartial<T[K]> : T[K];
};

/** Strings keyed by BCP 47 language tag — the shape of the `strings` option. */
export type StringTables = Record<string, DeepPartial<Strings>>;

/** The strings for one language, plus the language they are in (which the plural
 *  rules need). */
export interface ResolvedStrings extends Strings {
  language: string;
}

export const EN: Strings = {
  languagePicker: {
    label: "Language",
    placeholder: "Search or type a tag…",
    filterPlaceholder: "Filter…",
    noMatches: "No matches",
  },
  validationPanel: {
    empty: "Nothing to fix. Every shape this form covers is satisfied.",
    violation: "Violation",
    warning: "Warning",
    info: "Info",
    violationDetail: "The data does not satisfy the shape until this is resolved.",
    warningDetail: "The data is still valid; this is worth a look.",
    infoDetail: "Reported for information only.",
    reportedValue: "Reported value",
    detailsOf: "Details of the issue on {field}",
  },
  readOnly: {
    "variable-length-path":
      "Shown for reference. The profile reaches these values through a repeating path, which does not say where a new one would be stored.",
    "compound-path":
      "Shown for reference. The profile reaches these values through a combination of properties that cannot be edited one statement at a time.",
    "intermediate-missing":
      "Shown for reference. This value belongs to a related resource that does not exist yet — fill that section in first and this field becomes editable.",
    "intermediate-ambiguous":
      "Shown for reference. This value could belong to more than one related resource, so there is no single place to store a change.",
    "disjunction-of-shapes":
      "Shown for reference. The profile accepts several alternatives here, and every one of them describes a related resource with a structure of its own rather than a value that can be typed in.",
    "unsatisfiable-conjunction":
      "Shown for reference. Several rules in the profile apply to this field and contradict one another, so no value could satisfy all of them.",
  },
  chrome: {
    iriOrSearch: "IRI or search…",
    search: "Search…",
    addIri: "Add an IRI…",
    add: "Add…",
    choose: "Choose…",
    notSet: "Not set",
    yes: "Yes",
    no: "No",
    time: "Time",
    noMatches: "No matches",
    remove: "Remove",
    kindOfValue: "{field} — kind of value",
    loading: "Loading…",
    loadFailed: "Failed to load form: {error}",
    group: "Group {n}",
    step: "Step {n}",
    back: "Back",
    next: "Next",
    issues: { one: "{n} issue", other: "{n} issues" },
    valid: "Valid",
  },
};

/** Substitute `{name}` placeholders. Values go in verbatim: they are names and
 *  numbers, never text that would itself need translating. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}

/** The template of `forms` for `n` in the strings' language, filled with `n`. */
export function count(s: ResolvedStrings, forms: Plural, n: number): string {
  const category = new Intl.PluralRules(s.language).select(n);
  return fill(forms[category] ?? forms.other, { n });
}

function merge<T>(base: T, over: DeepPartial<T> | undefined): T {
  if (!over) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over)) {
    if (v == null) continue;
    const b = out[k];
    out[k] =
      typeof v === "object" && typeof b === "object" && !Array.isArray(v) ? merge(b, v as DeepPartial<typeof b>) : v;
  }
  return out as T;
}

/**
 * The strings for the reader: English, overlaid with the table of the most
 * preferred language that has one. `languages` is ordered and matched by basic
 * filtering, like every other language choice here; `tables` holds whatever the
 * consumer supplied (`es`/`ca` from `metadata-form/i18n`, their own, or a partial
 * override of `en`). A string missing from the chosen table stays English.
 */
export function resolveStrings(languages: readonly string[], tables: StringTables = {}): ResolvedStrings {
  const tags = Object.keys(tables);
  let language = "en";
  for (const range of languages) {
    const tag = tags.find((t) => matchesLanguage(t, range));
    if (tag) {
      language = tag;
      break;
    }
  }
  const en = merge(EN, tables.en);
  return { ...(language.toLowerCase() === "en" ? en : merge(en, tables[language])), language };
}
