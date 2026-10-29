/**
 * The messages between an app and the form shown in an iframe: the page this
 * package ships in `dist/frame/`, and {@link createMetadataFormFrame} on the
 * app's side.
 *
 * The frame says `mf:waiting` when it loads and renders nothing until the app
 * answers with `mf:init`, which carries an {@link EmbedConfig}. From then on it
 * reports `mf:ready` once the form is up, `mf:change` on every edit and
 * `mf:resize` when its height changes. The app may send `mf:reveal-errors`,
 * `mf:reset` (start again, empty) and `mf:sync` (repeat your state).
 *
 * Each side only reads messages from the other window and its origin, and only
 * writes to that origin: the frame's is the origin of its URL; the app's is the
 * frame's own unless the frame's URL says otherwise (`?origin=`).
 */

/** One shapes graph the frame can show. With more than one, a selector picks it. */
export interface EmbedVariant {
  /** Stable key, e.g. `"public"`. */
  id: string;
  /** What the selector shows. */
  label: string;
  /** The shapes, as text (Turtle, JSON-LD or N-Triples)… */
  shapes?: string;
  /** …or a URL to fetch them from, resolved against the frame's page. */
  shapesUrl?: string;
  /** The root node shape. When absent, the form picks it from the shapes. */
  rootShape?: string;
}

/** The frame's own texts (the form's come from its shapes and string tables).
 *  `{n}` and `{error}` are filled in. */
export interface EmbedTexts {
  variantLabel: string;
  changeVariant: string;
  waiting: string;
  notEmbedded: string;
  loadingShapes: string;
  loadingEngine: string;
  loadFailed: string;
  formFailed: string;
  noIssues: string;
  errorsTitle: string;
  warningsTitle: string;
  errorsHint: string;
  warningsHint: string;
  errorOne: string;
  errorOther: string;
  warningOne: string;
  warningOther: string;
  errorSeverity: string;
  warningSeverity: string;
  goToField: string;
  languageLabel: string;
}

const EN: EmbedTexts = {
  variantLabel: "Profile",
  changeVariant: "Changing the profile clears what you have typed. Continue?",
  waiting: "Waiting for the form's configuration…",
  notEmbedded:
    "This page shows a metadata form inside an iframe. Open it from an app that sends its configuration.",
  loadingShapes: "Loading shapes…",
  loadingEngine: "Loading the form engine…",
  loadFailed: "Could not load the shapes: {error}",
  formFailed: "The form failed: {error}",
  noIssues: "No issues",
  errorsTitle: "Errors",
  warningsTitle: "Warnings",
  errorsHint: "The record does not conform until these are fixed.",
  warningsHint: "Recommended values left empty. The record still conforms.",
  errorOne: "{n} error",
  errorOther: "{n} errors",
  warningOne: "{n} warning",
  warningOther: "{n} warnings",
  errorSeverity: "Error",
  warningSeverity: "Warning",
  goToField: "Go to field",
  languageLabel: "Language",
};

const ES: EmbedTexts = {
  variantLabel: "Perfil",
  changeVariant: "Cambiar de perfil borra lo que has escrito. ¿Continuar?",
  waiting: "Esperando la configuración del formulario…",
  notEmbedded:
    "Esta página muestra un formulario de metadatos dentro de un iframe. Ábrela desde una aplicación que le mande su configuración.",
  loadingShapes: "Cargando las shapes…",
  loadingEngine: "Cargando el motor del formulario…",
  loadFailed: "No se han podido cargar las shapes: {error}",
  formFailed: "El formulario ha fallado: {error}",
  noIssues: "Sin incidencias",
  errorsTitle: "Errores",
  warningsTitle: "Avisos",
  errorsHint: "La ficha no es válida hasta corregirlos.",
  warningsHint: "Valores recomendados sin rellenar. La ficha sigue siendo válida.",
  errorOne: "{n} error",
  errorOther: "{n} errores",
  warningOne: "{n} aviso",
  warningOther: "{n} avisos",
  errorSeverity: "Error",
  warningSeverity: "Aviso",
  goToField: "Ir al campo",
  languageLabel: "Idioma",
};

const CA: EmbedTexts = {
  variantLabel: "Perfil",
  changeVariant: "Canviar de perfil esborra el que has escrit. Vols continuar?",
  waiting: "S'espera la configuració del formulari…",
  notEmbedded:
    "Aquesta pàgina mostra un formulari de metadades dins d'un iframe. Obre-la des d'una aplicació que li enviï la configuració.",
  loadingShapes: "Carregant les shapes…",
  loadingEngine: "Carregant el motor del formulari…",
  loadFailed: "No s'han pogut carregar les shapes: {error}",
  formFailed: "El formulari ha fallat: {error}",
  noIssues: "Sense incidències",
  errorsTitle: "Errors",
  warningsTitle: "Avisos",
  errorsHint: "La fitxa no és vàlida fins que no es corregeixin.",
  warningsHint: "Valors recomanats sense omplir. La fitxa continua sent vàlida.",
  errorOne: "{n} error",
  errorOther: "{n} errors",
  warningOne: "{n} avís",
  warningOther: "{n} avisos",
  errorSeverity: "Error",
  warningSeverity: "Avís",
  goToField: "Ves al camp",
  languageLabel: "Llengua",
};

/** The page's texts in the languages the form itself ships (English, Spanish,
 *  Catalan), by primary language subtag. */
export const EMBED_TEXTS: Readonly<Record<string, EmbedTexts>> = { en: EN, es: ES, ca: CA };

export const DEFAULT_EMBED_TEXTS: EmbedTexts = EN;

/** What the app sends in `mf:init`. Plain data: it crosses windows by
 *  structured clone, so no functions. */
export interface EmbedConfig {
  variants: EmbedVariant[];
  /** The variant shown first. The first one by default. */
  variant?: string;
  /** The reader's languages, most preferred first. Defaults to the browser's. */
  locale?: string | readonly string[];
  /** Show a language selector, with the languages the shapes are written in
   *  (when there is more than one). Changing it re-words the form; what was
   *  typed stays. Off by default. */
  languageSelector?: boolean;
  /** The page's texts, whatever the language… */
  texts?: Partial<EmbedTexts>;
  /** …and per language (by primary subtag, e.g. `es`), over those. */
  textsByLanguage?: Record<string, Partial<EmbedTexts>>;
}

/** The form's state, as `mf:change` reports it. */
export interface EmbedState {
  /** No violations: the record conforms. */
  valid: boolean;
  /** Violations, which keep the record from conforming. */
  errors: number;
  /** Warnings and infos (recommended values left empty), which do not. */
  warnings: number;
  /** The record, as JSON-LD. */
  jsonLd: object;
}

export type EmbedToHost =
  | { type: "mf:waiting" }
  | { type: "mf:ready" }
  | ({ type: "mf:change" } & EmbedState)
  | { type: "mf:resize"; height: number };

export type HostToEmbed =
  | { type: "mf:init"; config: EmbedConfig }
  | { type: "mf:reveal-errors" }
  | { type: "mf:reset" }
  | { type: "mf:sync" };

const EMBED_TO_HOST = new Set(["mf:waiting", "mf:ready", "mf:change", "mf:resize"]);
const HOST_TO_EMBED = new Set(["mf:init", "mf:reveal-errors", "mf:reset", "mf:sync"]);

const typeOf = (data: unknown): unknown => (data as { type?: unknown } | null)?.type;

export function isEmbedMessage(data: unknown): data is EmbedToHost {
  return EMBED_TO_HOST.has(typeOf(data) as string);
}

export function isHostMessage(data: unknown): data is HostToEmbed {
  return HOST_TO_EMBED.has(typeOf(data) as string);
}
