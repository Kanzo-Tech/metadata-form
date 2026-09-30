import shapes from "./shapes.ttl?raw";
import sample from "./sample.ttl?raw";

/**
 * The paper's mapping figure as one node shape: a property per row (`sh:in`, the
 * XSD datatypes, `rdf:langString`, `sh:nodeKind sh:IRI` with and without
 * `sh:class`, a declared `shui:editor`, a nested `sh:node`, a required and a
 * repeatable field). Every field is named in English and Spanish.
 */
export const paperMappingShapes: string = shapes;
export const paperMappingSampleData: string = sample;
export const paperMappingRootShape = "http://example.org/ItemShape";
