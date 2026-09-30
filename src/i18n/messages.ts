import type { LangString } from "../form/ShapeIR.js";
import { matchByLanguage, pickByLanguage } from "../form/terms.js";
import type { FieldError } from "../form/validation.js";
import english from "./messages.en.ttl?raw";

/**
 * The default wording of a validation failure, as RDF. A message graph is a set of
 * `<constraint component> sh:message "…"@lang` triples; this module reads one into
 * a {@link MessageCatalog} and resolves the text of a failure against it. The
 * graph's header (`messages.en.ttl`) says why the property is `sh:message`.
 *
 * A language is added by handing `useMetadataForm` more triples — the picking is
 * the same function that picks a label, so nothing here knows which languages
 * exist.
 */

const SH = "http://www.w3.org/ns/shacl#";
const SH_MESSAGE = `${SH}message`;
/** The class of all constraint components: the message for one the graph does not
 *  name, and the last resort when nothing at all matches. */
const ANY_COMPONENT = `${SH}ConstraintComponent`;

/** The English message graph, the one the core carries. */
export const englishMessages: string = english;

/** Messages by constraint-component IRI. */
export type MessageCatalog = ReadonlyMap<string, readonly LangString[]>;

/** The parts of a parsed triple this reads — what the rudof engine hands back. */
interface Triple {
  subject: { value: string };
  predicate: { value: string };
  object: { value: string; language?: string };
}

/** Collect the `sh:message` literals of already-parsed triples, by subject. */
export function catalogFromTriples(triples: readonly Triple[]): MessageCatalog {
  const catalog = new Map<string, LangString[]>();
  for (const t of triples) {
    if (t.predicate.value !== SH_MESSAGE) continue;
    const list = catalog.get(t.subject.value) ?? [];
    list.push({ value: t.object.value, language: t.object.language ?? "" });
    catalog.set(t.subject.value, list);
  }
  return catalog;
}

/** Layer catalogs: literals accumulate (a consumer's `fr` next to the built-in `en`),
 *  and for the same component and language a later catalog is found first, so a
 *  consumer re-words a built-in message by stating it again. */
export function mergeCatalogs(catalogs: readonly MessageCatalog[]): MessageCatalog {
  const out = new Map<string, LangString[]>();
  for (const c of catalogs) {
    for (const [k, v] of c) out.set(k, [...v, ...(out.get(k) ?? [])]);
  }
  return out;
}

const SHACL_NS = SH;

/**
 * The one displayable string for a failure. Priority:
 *  1. the shape author's `sh:message` in a preferred language (multilingual SHACL);
 *  2. the message graph's wording for the constraint component, in a preferred
 *     language, else English, so a reader is never shown another language's text
 *     when English exists;
 *  3. for a constraint outside SHACL (the ShEx seam) or none, the engine's own
 *     message.
 *
 * A `sh:` constraint STOPS at step 2 — graph wording or the generic message, never
 * the engine's own text. rudof's shape-based components (`sh:node`, `sh:not`, …)
 * render their message by `Display`ing the internal shape, so falling through put
 * an AST dump ("Node(NodeShape Targets: …)") in front of a person.
 *
 * `languages` is the reader's ordered ranges. It is passed in, not closed over, so
 * a change of language re-words existing errors with no new validation pass.
 */
export function resolveMessage(
  error: Pick<FieldError, "messages" | "constraint">,
  catalog: MessageCatalog,
  languages: readonly string[],
): string {
  // Untagged messages are the engine's default; only tagged ones are the author's.
  const authored = matchByLanguage(
    error.messages.filter((m) => m.language),
    languages,
  );
  if (authored) return authored.value;

  const fallback = () => pickByLanguage(catalog.get(ANY_COMPONENT) ?? [], [...languages, "en"])?.value ?? "";
  if (error.constraint) {
    const known = catalog.get(error.constraint);
    if (known) return pickByLanguage(known, [...languages, "en"])!.value;
    if (error.constraint.startsWith(SHACL_NS)) return fallback();
  }
  const own = pickByLanguage(error.messages, languages)?.value?.trim();
  return own && own !== "Invalid value" ? own : fallback();
}
