import { RudofEngine } from "./RudofEngine.js";
import { loadRudof } from "./loader.js";

/**
 * `metadata-form/rudof` — direct access to the rudof-over-WASM engine (the
 * default engine behind `useMetadataForm`), for custom wiring: a shared engine,
 * projection, or a hand-built adapter.
 */
export { loadRudof };
export { RudofEngine } from "./RudofEngine.js";
export { projectTree, projectTreeSync, type SyncProjector } from "./projectTree.js";
export { createRudofShaclAdapter } from "./adapter.js";

/** A ready-to-use {@link RudofEngine} backed by the wasm loader. */
export function createRudofEngine(): RudofEngine {
  return new RudofEngine(loadRudof);
}
