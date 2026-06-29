import type { RudofModule, RudofSession } from "./abi.js";

/**
 * Loads the `rudof-wasm` module (instantiating the wasm once) and adapts it to
 * the {@link RudofModule} ABI. Pass {@link loadRudof} as the `RudofLoader` to
 * {@link RudofEngine}. The wasm is loaded lazily via dynamic import so importing
 * `metadata-form` never pulls it until a form actually mounts.
 *
 * The wasm is the generic `rudof_wasm` binding (rudof fork); its `validate()`
 * runs the real SHACL validator in wasm and is authoritative.
 */
let moduleOnce: Promise<typeof import("rudof-wasm")> | undefined;

export async function loadRudof(): Promise<RudofModule> {
  const wasm = await (moduleOnce ??= (async () => {
    const m = await import(/* @vite-ignore */ "rudof-wasm");
    await m.default();
    return m;
  })());

  return {
    newSession: () => new wasm.Session() as unknown as RudofSession,
  };
}
