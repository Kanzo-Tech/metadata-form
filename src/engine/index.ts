import { RudofEngine } from "./RudofEngine.js";
import { loadRudof } from "./loader.js";

/**
 * `metadata-form/rudof` — direct access to the rudof-over-WASM engine (the
 * default engine behind `useMetadataForm`), for power-user wiring: a shared
 * engine or custom projection. These are the engine internals demoted off the
 * main entry.
 */
export { loadRudof };
export { RudofEngine, RudofGraphBackend, type GraphSession } from "./RudofEngine.js";
export {
  projectTree,
  projectTreeSync,
  type SyncProjector,
  type AsyncProjector,
  type ProjectedSlot,
  type ProjectedValues,
} from "./projectTree.js";
export type {
  RudofModule,
  RudofSession,
  RudofLoader,
  RudofQuad,
  RudofReport,
  RudofResult,
  ShapeModelJson,
} from "./abi.js";

/** A ready-to-use {@link RudofEngine} backed by the wasm loader. */
export function createRudofEngine(): RudofEngine {
  return new RudofEngine(loadRudof);
}
