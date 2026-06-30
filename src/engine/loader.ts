import type { RudofModule, RudofSession } from "./abi.js";

/**
 * Loads the `@kanzo/rudof-wasm` module (instantiating the wasm once) and adapts it to
 * the {@link RudofModule} ABI. Pass {@link loadRudof} as the `RudofLoader` to
 * {@link RudofEngine}. The wasm is loaded lazily via dynamic import so importing
 * `metadata-form` never pulls it until a form actually mounts.
 *
 * The wasm is the generic `rudof_wasm` binding (rudof fork); its `validate()`
 * runs the real SHACL validator in wasm and is authoritative.
 */
let moduleOnce: Promise<typeof import("@kanzo/rudof-wasm")> | undefined;

async function instantiate(): Promise<typeof import("@kanzo/rudof-wasm")> {
  const m = await import(/* @vite-ignore */ "@kanzo/rudof-wasm");
  await m.default();
  return m;
}

export async function loadRudof(): Promise<RudofModule> {
  // Memoize only on SUCCESS. A transient failure (wasm fetch/instantiate) must
  // not poison the loader forever: caching a rejected promise would leave every
  // future mount permanently broken with no way to recover but a full reload.
  if (!moduleOnce) {
    const attempt = instantiate();
    moduleOnce = attempt;
    attempt.catch(() => {
      if (moduleOnce === attempt) moduleOnce = undefined; // allow a retry next call
    });
  }

  const wasm = await moduleOnce;
  return {
    newSession: () => new wasm.Session() as unknown as RudofSession,
  };
}
