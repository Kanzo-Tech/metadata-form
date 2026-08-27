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
     *  field's hierarchical label — the only interpolation in this catalog, and it
     *  is a name substituted verbatim, not a quantity that would need a formatter. */
    detailsOf: string;
  };
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
    // Shape-based components. rudof renders these by Display-ing the internal
    // shape, so without an entry here the report shows an AST dump.
    [`${SH}NodeConstraintComponent`]: "Some details in this section are incomplete",
    [`${SH}PropertyConstraintComponent`]: "Some details of this property are not valid",
    [`${SH}QualifiedValueShapeConstraintComponent`]: "Some values are not what is expected here",
    [`${SH}QualifiedMinCountConstraintComponent`]: "Not enough matching values",
    [`${SH}QualifiedMaxCountConstraintComponent`]: "Too many matching values",
    [`${SH}ReifierShapeConstraintComponent`]: "Details about this statement are incomplete",
    // Logical components (SHACL 1.2 adds sh:if).
    [`${SH}AndConstraintComponent`]: "Value does not meet all the requirements",
    [`${SH}OrConstraintComponent`]: "Value does not meet any of the allowed alternatives",
    [`${SH}XoneConstraintComponent`]: "Value must meet exactly one of the alternatives",
    [`${SH}NotConstraintComponent`]: "This value is not allowed here",
    [`${SH}IfConstraintComponent`]: "Value does not meet the requirement that applies here",
    // Value range.
    [`${SH}MinInclusiveConstraintComponent`]: "Value is too small",
    [`${SH}MinExclusiveConstraintComponent`]: "Value is too small",
    [`${SH}MaxInclusiveConstraintComponent`]: "Value is too large",
    [`${SH}MaxExclusiveConstraintComponent`]: "Value is too large",
    // Language and property pairs.
    [`${SH}LanguageInConstraintComponent`]: "This language is not allowed",
    [`${SH}UniqueLangConstraintComponent`]: "Only one value per language is allowed",
    [`${SH}EqualsConstraintComponent`]: "Value must match the related field",
    [`${SH}DisjointConstraintComponent`]: "Value must differ from the related field",
    [`${SH}LessThanConstraintComponent`]: "Value must be less than the related field",
    [`${SH}LessThanOrEqualsConstraintComponent`]: "Value must be less than or equal to the related field",
    // Everything else the validator can raise.
    [`${SH}HasValueConstraintComponent`]: "A required value is missing",
    [`${SH}ClosedConstraintComponent`]: "This property is not allowed here",
    [`${SH}SPARQLConstraintComponent`]: "Value does not meet a custom requirement",
    _fallback: "Invalid value",
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
    [`${SH}NodeConstraintComponent`]: "Faltan datos en esta sección",
    [`${SH}PropertyConstraintComponent`]: "Hay datos no válidos en esta propiedad",
    [`${SH}QualifiedValueShapeConstraintComponent`]: "Algunos valores no son los esperados aquí",
    [`${SH}QualifiedMinCountConstraintComponent`]: "No hay suficientes valores que cumplan lo esperado",
    [`${SH}QualifiedMaxCountConstraintComponent`]: "Hay demasiados valores que cumplen lo esperado",
    [`${SH}ReifierShapeConstraintComponent`]: "Faltan datos sobre esta declaración",
    [`${SH}AndConstraintComponent`]: "El valor no cumple todos los requisitos",
    [`${SH}OrConstraintComponent`]: "El valor no cumple ninguna de las alternativas permitidas",
    [`${SH}XoneConstraintComponent`]: "El valor debe cumplir exactamente una de las alternativas",
    [`${SH}NotConstraintComponent`]: "Este valor no está permitido aquí",
    [`${SH}IfConstraintComponent`]: "El valor no cumple el requisito que se aplica aquí",
    [`${SH}MinInclusiveConstraintComponent`]: "El valor es demasiado pequeño",
    [`${SH}MinExclusiveConstraintComponent`]: "El valor es demasiado pequeño",
    [`${SH}MaxInclusiveConstraintComponent`]: "El valor es demasiado grande",
    [`${SH}MaxExclusiveConstraintComponent`]: "El valor es demasiado grande",
    [`${SH}LanguageInConstraintComponent`]: "Este idioma no está permitido",
    [`${SH}UniqueLangConstraintComponent`]: "Solo se permite un valor por idioma",
    [`${SH}EqualsConstraintComponent`]: "El valor debe coincidir con el del campo relacionado",
    [`${SH}DisjointConstraintComponent`]: "El valor debe ser distinto del campo relacionado",
    [`${SH}LessThanConstraintComponent`]: "El valor debe ser menor que el del campo relacionado",
    [`${SH}LessThanOrEqualsConstraintComponent`]: "El valor debe ser menor o igual que el del campo relacionado",
    [`${SH}HasValueConstraintComponent`]: "Falta un valor obligatorio",
    [`${SH}ClosedConstraintComponent`]: "Esta propiedad no está permitida aquí",
    [`${SH}SPARQLConstraintComponent`]: "El valor no cumple un requisito personalizado",
    _fallback: "Valor no válido",
  },
  validationPanel: {
    empty: "No hay nada que corregir. El formulario cumple todas las formas.",
    violation: "Infracción",
    warning: "Aviso",
    info: "Información",
    violationDetail: "Los datos no cumplen la forma mientras esto no se resuelva.",
    warningDetail: "Los datos siguen siendo válidos; conviene revisarlo.",
    infoDetail: "Solo a título informativo.",
    reportedValue: "Valor recibido",
    detailsOf: "Detalles de la incidencia en {field}",
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
    [`${SH}NodeConstraintComponent`]: "Falten dades en aquesta secció",
    [`${SH}PropertyConstraintComponent`]: "Hi ha dades no vàlides en aquesta propietat",
    [`${SH}QualifiedValueShapeConstraintComponent`]: "Alguns valors no són els esperats aquí",
    [`${SH}QualifiedMinCountConstraintComponent`]: "No hi ha prou valors que compleixin allò esperat",
    [`${SH}QualifiedMaxCountConstraintComponent`]: "Hi ha massa valors que compleixen allò esperat",
    [`${SH}ReifierShapeConstraintComponent`]: "Falten dades sobre aquesta declaració",
    [`${SH}AndConstraintComponent`]: "El valor no compleix tots els requisits",
    [`${SH}OrConstraintComponent`]: "El valor no compleix cap de les alternatives permeses",
    [`${SH}XoneConstraintComponent`]: "El valor ha de complir exactament una de les alternatives",
    [`${SH}NotConstraintComponent`]: "Aquest valor no està permès aquí",
    [`${SH}IfConstraintComponent`]: "El valor no compleix el requisit que s'aplica aquí",
    [`${SH}MinInclusiveConstraintComponent`]: "El valor és massa petit",
    [`${SH}MinExclusiveConstraintComponent`]: "El valor és massa petit",
    [`${SH}MaxInclusiveConstraintComponent`]: "El valor és massa gran",
    [`${SH}MaxExclusiveConstraintComponent`]: "El valor és massa gran",
    [`${SH}LanguageInConstraintComponent`]: "Aquest idioma no està permès",
    [`${SH}UniqueLangConstraintComponent`]: "Només es permet un valor per idioma",
    [`${SH}EqualsConstraintComponent`]: "El valor ha de coincidir amb el del camp relacionat",
    [`${SH}DisjointConstraintComponent`]: "El valor ha de ser diferent del camp relacionat",
    [`${SH}LessThanConstraintComponent`]: "El valor ha de ser menor que el del camp relacionat",
    [`${SH}LessThanOrEqualsConstraintComponent`]: "El valor ha de ser menor o igual que el del camp relacionat",
    [`${SH}HasValueConstraintComponent`]: "Falta un valor obligatori",
    [`${SH}ClosedConstraintComponent`]: "Aquesta propietat no està permesa aquí",
    [`${SH}SPARQLConstraintComponent`]: "El valor no compleix un requisit personalitzat",
    _fallback: "Valor no vàlid",
  },
  validationPanel: {
    empty: "No hi ha res a corregir. El formulari compleix totes les formes.",
    violation: "Infracció",
    warning: "Avís",
    info: "Informació",
    violationDetail: "Les dades no compleixen la forma mentre això no es resolgui.",
    warningDetail: "Les dades continuen sent vàlides; convé revisar-ho.",
    infoDetail: "Només a títol informatiu.",
    reportedValue: "Valor rebut",
    detailsOf: "Detalls de la incidència a {field}",
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
    validationPanel: {
      ...EN.validationPanel,
      ...table.validationPanel,
      ...override?.validationPanel,
    },
  };
}
