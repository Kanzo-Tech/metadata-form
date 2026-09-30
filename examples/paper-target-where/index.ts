import shapes from "./shapes.ttl?raw";
import sample from "./sample.ttl?raw";

/**
 * The paper's running example with the condition stated as `sh:targetWhere`
 * instead of `sh:or ( [ sh:not C ] T )`: `ex:DescribesVariables` targets the
 * nodes that satisfy `ex:HasStructuredData`. Needs an engine that reads
 * `sh:targetWhere` (`@kanzo-tech/rudof-wasm` >= 0.3.10).
 */
export const paperTargetWhereShapes: string = shapes;
export const paperTargetWhereSampleData: string = sample;
export const paperTargetWhereRootShape = "http://example.org/DatasetShape";
