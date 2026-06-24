import shapes from "./shapes.ttl?raw";
import sample from "./sample.ttl?raw";

/**
 * HealthDCAT-AP — a bundled example, shipped as plain SHACL/Turtle files
 * (`shapes.ttl` + `sample.ttl`). Feed them to `useMetadataForm` like any shape;
 * output prefixes are derived from the Turtle automatically. See SOURCE.md.
 */
export const healthDcatApShapes: string = shapes;
export const healthDcatApSampleData: string = sample;
export const healthDcatApRootShape = "http://example.org/health-dcat-ap/shapes#DatasetShape";
