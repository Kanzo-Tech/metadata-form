import shapes from "./shapes.ttl?raw";
import sample from "./sample.ttl?raw";

/**
 * Evidenze Data Space — HealthDCAT-AP Release 7 dataset onboarding, in pure
 * SHACL 1.2 + SHACL-UI (`shui:`), no DASH. A single node shape (migrated from the
 * original 4 same-target shapes) with a visible access-level selector and a
 * SHACL 1.2 `sh:if`/`sh:then`: toggling "Datos estructurados" reveals and requires
 * the CSVW variable dictionary. See `shapes.ttl`.
 */
export const evidenzeHealthShapes: string = shapes;
export const evidenzeHealthSampleData: string = sample;
export const evidenzeHealthRootShape =
  "https://dataspace.evidenze.example/shapes#HealthDatasetOnboardingShape";
