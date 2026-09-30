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

/** The literal of the most preferred language, or undefined when none of the
 *  ranges matches any item. `languages` is ordered, most preferred first. */
export function matchByLanguage<T extends LangTagged>(
  items: readonly T[],
  languages: readonly string[],
): T | undefined {
  for (const range of languages) {
    const hit = items.find((i) => matchesLanguage(i.language, range));
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Pick the literal to show, per SHACL-UI Editor's Draft §"Language Resolution"
 * (`#lang-resolution`): the ordered range list is searched with basic filtering
 * ({@link matchesLanguage}); when none matches, an untagged literal, else any (the
 * draft's "MAY fall back"). The caller builds the list in the draft's priority
 * order — the shape's `sh:languageIn`, then the application's languages, then the
 * browser's — so this is the one picker every localised string goes through.
 */
export function pickByLanguage<T extends LangTagged>(
  items: readonly T[],
  languages: readonly string[],
): T | undefined {
  return matchByLanguage(items, languages) ?? items.find((i) => i.language === "") ?? items[0];
}
