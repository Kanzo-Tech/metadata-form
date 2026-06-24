import type { Literal } from "@rdfjs/types";

/**
 * Pick the best literal for a requested locale from a set of language-tagged
 * literals, following a fallback chain: exact tag → base language → no tag →
 * first available. Used for sh:name / sh:description / sh:message.
 */
export function selectByLanguage(
  literals: Literal[],
  locale: string | undefined,
): Literal | undefined {
  if (literals.length === 0) return undefined;
  if (literals.length === 1) return literals[0];

  const want = (locale || "").toLowerCase();
  const wantBase = want.split("-")[0];

  let exact: Literal | undefined;
  let base: Literal | undefined;
  let untagged: Literal | undefined;

  for (const lit of literals) {
    const lang = lit.language.toLowerCase();
    if (want && lang === want) exact = exact ?? lit;
    else if (wantBase && lang.split("-")[0] === wantBase) base = base ?? lit;
    else if (lang === "") untagged = untagged ?? lit;
  }
  return exact ?? base ?? untagged ?? literals[0];
}
