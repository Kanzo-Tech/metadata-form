/** The last segment of an IRI — what a term is called when nothing named it.
 *  Returns the IRI unchanged when it has no `#` or `/` to cut at. */
export function localName(iri: string): string {
  const m = iri.match(/[#/]([^#/]+)$/);
  return m ? m[1] : iri;
}

/** Split a local name into words the way a person would say it: camelCase and
 *  snake/kebab boundaries become spaces, acronyms are kept. SHACL-UI's "Local Name
 *  Resolution" (Editor's Draft, §Label and Language Resolution) asks for this. */
export function humanise(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .split(" ")
    .map((w, i) => (i > 0 && w !== w.toUpperCase() ? w.toLowerCase() : w))
    .join(" ");
}

/** Anything carrying a value + language tag (rdfjs Literal or an IR LangString). */
interface LangTagged {
  value: string;
  language: string;
}

/**
 * Does language tag `tag` match language range `range`? The basic filtering
 * scheme of RFC 4647 §3.3.1: case-insensitively, the range equals the tag or is a
 * prefix of it ending at a `-` boundary, so the tag `en-US` matches the range `en`
 * but `en` does not match `en-US`. `*` matches any tagged literal. The empty
 * range is SHACL-UI's spelling of "no language": it matches only an untagged one.
 */
export function matchesLanguage(tag: string, range: string): boolean {
  const t = tag.toLowerCase();
  const r = range.toLowerCase();
  if (r === "") return t === "";
  if (t === "") return false;
  return r === "*" || t === r || t.startsWith(`${r}-`);
}

/** Code-point order, which `localeCompare` is not: a fallback that depended on the
 *  reader's own collation would be a different text for different readers. */
const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Items in a stable order: BCP-47 tag (lower-cased, code-point order), then text. */
function stable<T extends LangTagged>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) => byCodePoint(a.language.toLowerCase(), b.language.toLowerCase()) || byCodePoint(a.value, b.value),
  );
}

/** The literal of the most preferred language, or undefined when none of the
 *  ranges matches any item. `languages` is ordered, most preferred first; among
 *  the items one range matches, the first in {@link stable} order. */
export function matchByLanguage<T extends LangTagged>(
  items: readonly T[],
  languages: readonly string[],
): T | undefined {
  const ordered = stable(items);
  for (const range of languages) {
    const hit = ordered.find((i) => matchesLanguage(i.language, range));
    if (hit) return hit;
  }
  return undefined;
}

/** What {@link resolveLanguage} chose: the literal (its `language` says which
 *  tag), and whether it was a fallback — no range asked for it. */
export interface Resolved<T> {
  item: T;
  fallback: boolean;
}

/**
 * Choose the literal to show, per SHACL-UI Editor's Draft §"Language Resolution"
 * (`#lang-resolution`): the ordered range list is searched with basic filtering
 * ({@link matchesLanguage}); when none matches, the draft's "MAY fall back" is made
 * deterministic — an untagged literal, else the tagged ones in BCP-47 tag order
 * (code points), never the order the literals happened to be read in. The caller
 * builds the list in the draft's priority order — the shape's `sh:languageIn`, then
 * the application's languages, then the browser's.
 *
 * `fallback` says the text is one nobody asked for, so a caller can mark its
 * language (`lang` on the element) and a profile author can be told it is missing.
 */
export function resolveLanguage<T extends LangTagged>(
  items: readonly T[],
  languages: readonly string[],
): Resolved<T> | undefined {
  const hit = matchByLanguage(items, languages);
  if (hit) return { item: hit, fallback: false };
  const item = stable(items).find((i) => i.language === "") ?? stable(items)[0];
  return item && { item, fallback: true };
}

/** {@link resolveLanguage}, when only the literal matters. This is the one picker
 *  every localised string goes through. */
export function pickByLanguage<T extends LangTagged>(
  items: readonly T[],
  languages: readonly string[],
): T | undefined {
  return resolveLanguage(items, languages)?.item;
}

/** The value for an HTML `lang` attribute: the tag of a fallback text nobody asked
 *  for, so assistive technology pronounces it in its own language. Absent for a
 *  direct hit (the page's language is right) and for an untagged literal (there is
 *  no language to declare). */
export function langOf<T extends LangTagged>(picked: Resolved<T> | undefined): string | undefined {
  return picked?.fallback && picked.item.language ? picked.item.language : undefined;
}
