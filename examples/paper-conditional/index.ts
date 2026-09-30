import shapes from "./shapes.ttl?raw";
import sample from "./sample.ttl?raw";

/**
 * The paper's running example (Listing 1): a dataset that says it has structured
 * data must describe its variables, stated as `sh:or ( [ sh:not C ] T )`. The body
 * of `shapes.ttl` is the listing verbatim; only the prefix block is added. See
 * `SOURCE.md`.
 */
export const paperConditionalShapes: string = shapes;
export const paperConditionalSampleData: string = sample;
export const paperConditionalRootShape = "http://example.org/DatasetShape";
