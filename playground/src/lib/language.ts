import { pickByLanguage } from "metadata-form";

/** A language range and what it falls back to, most specific first: `ca-ES` is `ca-ES`,
 *  then `ca` (RFC 4647 §3.4, lookup). */
const truncations = (range: string): string[] =>
  range.split("-").map((_, i, parts) => parts.slice(0, parts.length - i).join("-"));

/**
 * The language to open a form in: the first of the browser's preferences that one
 * of the shapes' languages answers, by the library's own picker, and otherwise the
 * shapes' most written one. A preference `ca-ES` is asked as `ca-ES`, then `ca`,
 * since basic filtering alone would not let it reach a shape written in plain `ca`.
 * `undefined` when the shapes are written in no language.
 */
export function initialLanguage(available: readonly string[], preferred: readonly string[]): string | undefined {
  // The picker falls to the first item when nothing matches: the most written one.
  return pickByLanguage(available.map((language) => ({ value: language, language })), preferred.flatMap(truncations))?.value;
}
