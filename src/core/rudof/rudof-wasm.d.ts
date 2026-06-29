/**
 * Ambient typing for the `rudof-wasm` package — the `wasm-bindgen --target web`
 * output of the generic `rudof_wasm` crate in the rudof fork (built via
 * `npm run build:wasm`). Declared here so the loader type-checks without the
 * generated package present; the real import is externalized at build and
 * resolved by the consumer.
 */
declare module "rudof-wasm" {
  /** Async init: instantiates the wasm module (default export of the web build). */
  export default function init(input?: unknown): Promise<unknown>;

  /** One form session — see `src/core/rudof/abi.ts` (`RudofSession`). */
  export class Session {
    constructor();
    loadShapes(text: string, mediaType: string): unknown;
    loadData(text: string, mediaType: string): void;
    newData(): void;
    add(subject: unknown, predicate: unknown, object: unknown): void;
    remove(subject: unknown, predicate: unknown, object: unknown): void;
    quads(subject: unknown, predicate: unknown, object: unknown): unknown;
    serialize(mediaType: string): string;
    projectForm(focus: unknown, shapeId: string): unknown;
    validate(shapeId?: string | null): unknown;
  }
}
