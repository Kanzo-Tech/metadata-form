import { Parser, Store } from "n3";
import jsonld from "jsonld";
import { factory } from "./factory.js";
import type { Quad } from "@rdfjs/types";

export type RdfInput = string | Store | Iterable<Quad>;

export type RdfFormat = "text/turtle" | "application/ld+json";

/** Heuristically detect whether a string is JSON-LD or Turtle. */
function detectFormat(input: string): RdfFormat {
  const trimmed = input.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[")
    ? "application/ld+json"
    : "text/turtle";
}

/** Parse a Turtle string into an array of quads (synchronous). */
export function parseTurtle(ttl: string, baseIRI?: string): Quad[] {
  const parser = new Parser({ factory, baseIRI });
  return parser.parse(ttl) as unknown as Quad[];
}

/** Parse Turtle and also capture its `@prefix` declarations. */
export function parseTurtleWithPrefixes(
  ttl: string,
  baseIRI?: string,
): { quads: Quad[]; prefixes: Record<string, string> } {
  const parser = new Parser({ factory, baseIRI });
  const quads: Quad[] = [];
  const prefixes: Record<string, string> = {};
  parser.parse(ttl, (error, quad, prefs) => {
    if (error) throw error;
    if (quad) {
      quads.push(quad as unknown as Quad);
    } else if (prefs) {
      for (const [k, v] of Object.entries(prefs)) {
        prefixes[k] = typeof v === "string" ? v : (v as { value: string }).value;
      }
    }
  });
  return { quads, prefixes };
}

/** Best-effort prefix extraction from any RDF input (only Turtle strings carry them). */
export function collectPrefixes(input: RdfInput): Record<string, string> {
  if (typeof input === "string") {
    const trimmed = input.trimStart();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      try {
        return parseTurtleWithPrefixes(input).prefixes;
      } catch {
        return {};
      }
    }
  }
  return {};
}

/** Parse a JSON-LD string/object into quads via jsonld.toRDF. */
export async function parseJsonLd(input: string | object): Promise<Quad[]> {
  const doc = typeof input === "string" ? JSON.parse(input) : input;
  const dataset = (await jsonld.toRDF(doc, { format: "application/n-quads" })) as string;
  return parseNQuads(dataset);
}

function parseNQuads(nq: string): Quad[] {
  const parser = new Parser({ factory, format: "application/n-quads" });
  return parser.parse(nq) as unknown as Quad[];
}

/**
 * Normalize any supported RDF input into an n3.Store. Strings are auto-detected
 * as Turtle or JSON-LD; an existing Store is returned as-is.
 */
export async function toStore(input: RdfInput, baseIRI?: string): Promise<Store> {
  if (input instanceof Store) return input;
  if (typeof input === "string") {
    const fmt = detectFormat(input);
    const quads =
      fmt === "application/ld+json" ? await parseJsonLd(input) : parseTurtle(input, baseIRI);
    const store = new Store();
    store.addQuads(quads as never[]);
    return store;
  }
  // Iterable<Quad>
  const store = new Store();
  store.addQuads([...input] as never[]);
  return store;
}

/** Synchronous variant that only accepts Turtle / Store (no async JSON-LD). */
export function toStoreSync(input: string | Store | Iterable<Quad>, baseIRI?: string): Store {
  if (input instanceof Store) return input;
  const store = new Store();
  if (typeof input === "string") {
    store.addQuads(parseTurtle(input, baseIRI) as never[]);
  } else {
    store.addQuads([...input] as never[]);
  }
  return store;
}
