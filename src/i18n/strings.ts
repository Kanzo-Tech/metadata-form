/**
 * Built-in UI string catalog (en / es / ca), selected by the same `locale` that
 * drives shape labels/descriptions, and overridable per-consumer. Deliberately
 * dependency-free and NOT under `src/react/`: the core validation layer
 * (`src/form/validation.ts`) imports it for localized fallback messages, so it
 * must sit below the React layer. Locale resolution mirrors `pickByLanguage`'s
 * base-language chain (`es-ES` → `es` → `en`).
 */

/** SHACL constraint-component IRIs used as keys of `validationDefaults`. */
const SH = "http://www.w3.org/ns/shacl#";

export interface Strings {
  /** UI chrome of the `rdf:langString` language-tag picker. */
  languagePicker: {
    /** Accessible name + empty-value placeholder of the trigger. */
    label: string;
    /** Search box when free BCP-47 entry is allowed. */
    searchPlaceholder: string;
    /** Search box when the shape pins `sh:languageIn` (filter-only). */
    filterPlaceholder: string;
    /** Shown when a constrained filter matches nothing. */
    noMatches: string;
    /** Hint shown when a typed free tag can be committed with Enter. */
    enterToUse: string;
  };
  /**
   * Default validation wording keyed by constraint-component IRI, used when the
   * shape author did not provide a locale-matching `sh:message`. `_fallback` is
   * the last resort for any other/unknown constraint.
   */
  validationDefaults: Record<string, string>;
}

/** A recursive partial for consumer overrides. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown> ? DeepPartial<T[K]> : T[K];
};

const EN: Strings = {
  languagePicker: {
    label: "Language",
    searchPlaceholder: "Search or type a tag…",
    filterPlaceholder: "Filter…",
    noMatches: "No matches",
    enterToUse: "Press Enter to use this tag",
  },
  validationDefaults: {
    // Verbatim from the previous English-only FRIENDLY map (test-asserted).
    [`${SH}MinCountConstraintComponent`]: "This field is required",
    [`${SH}MaxCountConstraintComponent`]: "Too many values",
    [`${SH}DatatypeConstraintComponent`]: "Invalid value type",
    [`${SH}NodeKindConstraintComponent`]: "Invalid value kind",
    [`${SH}PatternConstraintComponent`]: "Value does not match the required pattern",
    [`${SH}MinLengthConstraintComponent`]: "Value is too short",
    [`${SH}MaxLengthConstraintComponent`]: "Value is too long",
    [`${SH}ClassConstraintComponent`]: "Value is not of the expected type",
    [`${SH}InConstraintComponent`]: "Value is not an allowed option",
    _fallback: "Invalid value",
  },
};

const ES: Strings = {
  languagePicker: {
    label: "Idioma",
    searchPlaceholder: "Buscar o escribir tag…",
    filterPlaceholder: "Filtrar…",
    noMatches: "Sin coincidencias",
    enterToUse: "Pulsa Enter para usar este tag",
  },
  validationDefaults: {
    [`${SH}MinCountConstraintComponent`]: "Este campo es obligatorio",
    [`${SH}MaxCountConstraintComponent`]: "Demasiados valores",
    [`${SH}DatatypeConstraintComponent`]: "Tipo de valor no válido",
    [`${SH}NodeKindConstraintComponent`]: "Clase de valor no válida",
    [`${SH}PatternConstraintComponent`]: "El valor no coincide con el patrón requerido",
    [`${SH}MinLengthConstraintComponent`]: "El valor es demasiado corto",
    [`${SH}MaxLengthConstraintComponent`]: "El valor es demasiado largo",
    [`${SH}ClassConstraintComponent`]: "El valor no es del tipo esperado",
    [`${SH}InConstraintComponent`]: "El valor no es una opción permitida",
    _fallback: "Valor no válido",
  },
};

const CA: Strings = {
  languagePicker: {
    label: "Idioma",
    searchPlaceholder: "Cerca o escriu un tag…",
    filterPlaceholder: "Filtra…",
    noMatches: "Sense coincidències",
    enterToUse: "Prem Enter per usar aquest tag",
  },
  validationDefaults: {
    [`${SH}MinCountConstraintComponent`]: "Aquest camp és obligatori",
    [`${SH}MaxCountConstraintComponent`]: "Massa valors",
    [`${SH}DatatypeConstraintComponent`]: "Tipus de valor no vàlid",
    [`${SH}NodeKindConstraintComponent`]: "Classe de valor no vàlida",
    [`${SH}PatternConstraintComponent`]: "El valor no coincideix amb el patró requerit",
    [`${SH}MinLengthConstraintComponent`]: "El valor és massa curt",
    [`${SH}MaxLengthConstraintComponent`]: "El valor és massa llarg",
    [`${SH}ClassConstraintComponent`]: "El valor no és del tipus esperat",
    [`${SH}InConstraintComponent`]: "El valor no és una opció permesa",
    _fallback: "Valor no vàlid",
  },
};

/** Built-in tables. English is the ultimate fallback for any missing key. */
export const DEFAULTS: Record<"en" | "es" | "ca", Strings> = { en: EN, es: ES, ca: CA };

/**
 * Resolve the string catalog for `locale`, layering (English base → locale table
 * → consumer `override`). Base-language fold matches `pickByLanguage`
 * (`es-ES` → `es`); unknown locales fall back to English.
 */
export function resolveStrings(locale: string | undefined, override?: DeepPartial<Strings>): Strings {
  const base = (locale || "en").toLowerCase().split("-")[0];
  const table = DEFAULTS[base as "en" | "es" | "ca"] ?? DEFAULTS.en;
  const validationDefaults: Record<string, string> = { ...EN.validationDefaults, ...table.validationDefaults };
  // Copy only defined overrides (the partial's index signature is `string | undefined`).
  for (const [k, v] of Object.entries(override?.validationDefaults ?? {})) {
    if (v != null) validationDefaults[k] = v;
  }
  return {
    languagePicker: {
      ...EN.languagePicker,
      ...table.languagePicker,
      ...override?.languagePicker,
    },
    validationDefaults,
  };
}
