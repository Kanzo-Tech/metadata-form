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
}

export const DEFAULT_EMBED_TEXTS: EmbedTexts = {
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
};

/** What the app sends in `mf:init`. Plain data: it crosses windows by
 *  structured clone, so no functions. */
export interface EmbedConfig {
  variants: EmbedVariant[];
  /** The variant shown first. The first one by default. */
  variant?: string;
  /** The reader's languages, most preferred first. Defaults to the browser's. */
  locale?: string | readonly string[];
  texts?: Partial<EmbedTexts>;
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
