/**
 * SHACL Core term IRIs. The single home for SHACL constant IRIs used across the
 * shape reader, the editor resolver and the validation-message mapping.
 */

export const SH = "http://www.w3.org/ns/shacl#";

const t = (local: string) => `${SH}${local}` as const;

export const Sh = {
  // Shape types
  NodeShape: t("NodeShape"),
  PropertyShape: t("PropertyShape"),
  PropertyGroup: t("PropertyGroup"),

  // Structure
  property: t("property"),
  path: t("path"),
  node: t("node"),
  targetClass: t("targetClass"),
  closed: t("closed"),

  // Path expressions
  inversePath: t("inversePath"),
  alternativePath: t("alternativePath"),
  zeroOrMorePath: t("zeroOrMorePath"),
  oneOrMorePath: t("oneOrMorePath"),
  zeroOrOnePath: t("zeroOrOnePath"),

  // Cardinality
  minCount: t("minCount"),
  maxCount: t("maxCount"),

  // Value type / kind
  datatype: t("datatype"),
  nodeKind: t("nodeKind"),
  class: t("class"),

  // nodeKind individuals
  IRI: t("IRI"),
  Literal: t("Literal"),
  BlankNode: t("BlankNode"),
  BlankNodeOrIRI: t("BlankNodeOrIRI"),
  BlankNodeOrLiteral: t("BlankNodeOrLiteral"),
  IRIOrLiteral: t("IRIOrLiteral"),

  // Value range / string facets
  pattern: t("pattern"),
  flags: t("flags"),
  minLength: t("minLength"),
  maxLength: t("maxLength"),
  minInclusive: t("minInclusive"),
  maxInclusive: t("maxInclusive"),
  minExclusive: t("minExclusive"),
  maxExclusive: t("maxExclusive"),
  languageIn: t("languageIn"),
  uniqueLang: t("uniqueLang"),

  // Fixed / default values
  in: t("in"),
  hasValue: t("hasValue"),
  defaultValue: t("defaultValue"),

  // Logical combinators
  and: t("and"),
  or: t("or"),
  xone: t("xone"),
  not: t("not"),

  // Annotations / presentation
  name: t("name"),
  description: t("description"),
  order: t("order"),
  group: t("group"),
  severity: t("severity"),
  message: t("message"),
} as const;
