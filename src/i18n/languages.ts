/**
 * The application's ordered language list — the second source of SHACL-UI's
 * "Language Resolution" (Editor's Draft, `#lang-resolution`). What the consumer
 * passes as `locale` (a tag or an ordered list) is used as given; when they pass
 * nothing, the draft says the browser's list SHOULD be the default
 * (`navigator.languages`), and English is the last resort where there is no
 * browser. The list is not expanded: matching is RFC 4647 basic filtering, so
 * `["es-ES"]` does not prefer a plain `es` literal — a browser's `["es-ES", "es"]`
 * does, and so should a consumer's.
 */
export function resolveLanguages(locale: string | readonly string[] | undefined): readonly string[] {
  const given = typeof locale === "string" ? [locale] : locale;
  if (given && given.length > 0) return given;
  const browser = typeof navigator === "undefined" ? undefined : navigator.languages;
  return browser && browser.length > 0 ? [...browser] : ["en"];
}
