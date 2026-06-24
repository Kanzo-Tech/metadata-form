import { DataFactory } from "n3";
import namespace from "@rdfjs/namespace";

/**
 * Shared RDF/JS DataFactory. We re-export n3's factory so terms created here
 * are interoperable with n3 Stores, the SHACL validator and jsonld.
 */
export const factory = DataFactory;
export const { namedNode, literal, blankNode, quad, defaultGraph, variable } = DataFactory;

/** Base IRIs for the vocabularies used across the form engine. */
export const NS = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  sh: "http://www.w3.org/ns/shacl#",
  dash: "http://datashapes.org/dash#",
  owl: "http://www.w3.org/2002/07/owl#",
  skos: "http://www.w3.org/2004/02/skos/core#",
  dcat: "http://www.w3.org/ns/dcat#",
  dcterms: "http://purl.org/dc/terms/",
  foaf: "http://xmlns.com/foaf/0.1/",
} as const;

const ns = (base: string) => namespace(base, { factory });

export const rdf = ns(NS.rdf);
export const rdfs = ns(NS.rdfs);
export const xsd = ns(NS.xsd);
export const sh = ns(NS.sh);
export const dash = ns(NS.dash);
export const owl = ns(NS.owl);
export const skos = ns(NS.skos);
export const dcat = ns(NS.dcat);
export const dcterms = ns(NS.dcterms);
export const foaf = ns(NS.foaf);

/** Default prefix map used by the Turtle/JSON-LD serializers. */
export const DEFAULT_PREFIXES: Record<string, string> = { ...NS };
