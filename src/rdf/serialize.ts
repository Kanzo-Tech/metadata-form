import { Store, Writer } from "n3";
import jsonld from "jsonld";
import type { Quad } from "@rdfjs/types";
import { DEFAULT_PREFIXES } from "./factory.js";

export interface SerializeOptions {
  /** Extra/override prefixes for Turtle output. */
  prefixes?: Record<string, string>;
}

export interface JsonLdOptions extends SerializeOptions {
  /** JSON-LD context used to compact the output. */
  context?: Record<string, unknown> | string;
}

function collect(input: Store | Iterable<Quad>): Quad[] {
  return input instanceof Store ? (input.getQuads(null, null, null, null) as Quad[]) : [...input];
}

function write(quads: Quad[], opts: { prefixes?: Record<string, string>; format?: string }): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new Writer(opts as never);
    writer.addQuads(quads as never[]);
    writer.end((err, result) => (err ? reject(err) : resolve(result)));
  });
}

/** Serialize quads to Turtle (n3 handles all prefix/escaping concerns). */
export function toTurtle(input: Store | Iterable<Quad>, opts: SerializeOptions = {}): Promise<string> {
  return write(collect(input), { prefixes: { ...DEFAULT_PREFIXES, ...opts.prefixes } });
}

/** Serialize quads to N-Quads. */
export function toNQuads(input: Store | Iterable<Quad>): Promise<string> {
  return write(collect(input), { format: "N-Quads" });
}

/**
 * Serialize quads to **compacted** JSON-LD — application-friendly, not the raw
 * expanded form. Compacts against the supplied context, or the default prefixes
 * when none is given, so reports stay clean by default.
 */
export async function toJsonLd(
  input: Store | Iterable<Quad>,
  opts: JsonLdOptions = {},
): Promise<object> {
  const nquads = await write(collect(input), { format: "N-Quads" });
  const doc = await jsonld.fromRDF(nquads, { format: "application/n-quads" });
  const context = (opts.context ?? DEFAULT_PREFIXES) as jsonld.ContextDefinition;
  return jsonld.compact(doc, context);
}
