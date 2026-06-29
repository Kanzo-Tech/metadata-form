import { RudofEngine } from "./RudofEngine.js";
import { loadRudof } from "./loader.js";

/**
 * `metadata-form/rudof` — direct access to the rudof-over-WASM engine (the
 * default engine behind `useMetadataForm`), for power-user wiring: a shared
 * engine, custom projection, rehydration, or a hand-built adapter. These are the
 * engine internals demoted off the main entry.
 */
export { loadRudof };
export { RudofEngine, RudofGraphBackend } from "./RudofEngine.js";
export { projectTree, projectTreeSync, type SyncProjector } from "./projectTree.js";
export { shapeModelFromJson } from "./rehydrate.js";
export type {
  RudofModule,
  RudofSession,
  RudofLoader,
  RudofQuad,
  RudofReport,
  RudofResult,
  ShapeModelJson,
} from "./abi.js";
export { createRudofShaclAdapter } from "../shacl/adapter.js";

/** A ready-to-use {@link RudofEngine} backed by the wasm loader. */
export function createRudofEngine(): RudofEngine {
  return new RudofEngine(loadRudof);
}
