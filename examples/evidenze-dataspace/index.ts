import shapes from "./shapes.ttl?raw";
import sample from "./sample.ttl?raw";

/**
 * Evidenze Data Space — dataset onboarding, authored in pure SHACL Core + SHACL-UI
 * (`shui:`), no DASH. Shows conditional rendering: choosing "Restringido" for
 * access rights reveals (and requires) a justification field, stated as the implication `sh:or ( [ sh:not C ] T )`.
 * See `shapes.ttl`.
 */
export const evidenzeShapes: string = shapes;
export const evidenzeSampleData: string = sample;
export const evidenzeRootShape = "https://dataspace.evidenze.example/shapes#DatasetOnboardingShape";
