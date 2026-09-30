/** The last segment of an IRI — what a term is called when nothing named it.
 *  Returns the IRI unchanged when it has no `#` or `/` to cut at. */
export function localName(iri: string): string {
  const m = iri.match(/[#/]([^#/]+)$/);
  return m ? m[1] : iri;
}

/** Anything carrying a value + language tag (rdfjs Literal or an IR LangString). */
interface LangTagged {
  value: string;
  language: string;
}

/**
 * Pick the best language-tagged item for a requested locale, following a
 * fallback chain: exact tag → base language → no tag → first available.
 * Generic over rdfjs Literals and IR LangStrings.
 */
export function pickByLanguage<T extends LangTagged>(
  items: T[],
  locale: string | undefined,
): T | undefined {
  if (items.length === 0) return undefined;
  if (items.length === 1) return items[0];

  const want = (locale || "").toLowerCase();
  const wantBase = want.split("-")[0];

  let exact: T | undefined;
  let base: T | undefined;
  let untagged: T | undefined;

  for (const item of items) {
    const lang = item.language.toLowerCase();
    if (want && lang === want) exact = exact ?? item;
    else if (wantBase && lang.split("-")[0] === wantBase) base = base ?? item;
    else if (lang === "") untagged = untagged ?? item;
  }
  return exact ?? base ?? untagged ?? items[0];
}
