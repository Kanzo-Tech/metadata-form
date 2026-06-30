/**
 * Ambient typing for the `@kanzo-tech/rudof-wasm` package — the `wasm-bindgen --target web`
 * output of the generic `rudof_wasm` crate in the rudof fork (built via
 * `npm run build:wasm`). Declared here so the loader type-checks without the
 * generated package present; the real import is externalized at build and
 * resolved by the consumer.
 */
declare module "@kanzo-tech/rudof-wasm" {
  /** Async init: instantiates the wasm module (default export of the web build). */
  export default function init(input?: unknown): Promise<unknown>;

  /**
   * Opaque session handle. The typed contract is `RudofSession` in
   * `./abi.ts` (the single source of truth), which the loader casts to at the
   * one boundary — so the method surface is deliberately NOT mirrored here
   * (mirroring it just lets it drift, as it did with `validateFocus`).
   */
  export class Session {
    constructor();
  }
}
