/**
 * E1 — the construct ledger.
 *
 * Two tables, both hand-checked against the SHACL 1.2 Core spec and against what
 * `buildFormModel` / the widget layer actually read. They are the machinery
 * behind the "constructs we cannot render, with the reason" list, which §8 needs
 * and which is worth more than the coverage percentage.
 *
 * The rule for `CONSUMED`: a term is consumed only if some code path downstream
 * of the IR *changes what the user sees or can do*. Carrying a value into
 * `FieldConstraints` and never reading it again is NOT consumption, and is
 * recorded as `carried` so the difference stays visible.
 */

const SH = "http://www.w3.org/ns/shacl#";
const SHUI = "http://www.w3.org/ns/shacl-ui/";
const DASH = "http://datashapes.org/dash#";
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";

/** SHACL parameter → the constraint component it is a parameter of.
 *  This is what a validation report would cite as `sh:sourceConstraintComponent`;
 *  E1 measures it statically, from the profile, since it has no data to validate.
 *  Terms absent from this map are annotations or shape structure, not components. */
export const PARAM_TO_COMPONENT: Record<string, string> = {
  [`${SH}class`]: "ClassConstraintComponent",
  [`${SH}datatype`]: "DatatypeConstraintComponent",
  [`${SH}nodeKind`]: "NodeKindConstraintComponent",
  [`${SH}minCount`]: "MinCountConstraintComponent",
  [`${SH}maxCount`]: "MaxCountConstraintComponent",
  [`${SH}minExclusive`]: "MinExclusiveConstraintComponent",
  [`${SH}minInclusive`]: "MinInclusiveConstraintComponent",
  [`${SH}maxExclusive`]: "MaxExclusiveConstraintComponent",
  [`${SH}maxInclusive`]: "MaxInclusiveConstraintComponent",
  [`${SH}minLength`]: "MinLengthConstraintComponent",
  [`${SH}maxLength`]: "MaxLengthConstraintComponent",
  [`${SH}pattern`]: "PatternConstraintComponent",
  [`${SH}flags`]: "PatternConstraintComponent",
  [`${SH}languageIn`]: "LanguageInConstraintComponent",
  [`${SH}uniqueLang`]: "UniqueLangConstraintComponent",
  [`${SH}equals`]: "EqualsConstraintComponent",
  [`${SH}disjoint`]: "DisjointConstraintComponent",
  [`${SH}lessThan`]: "LessThanConstraintComponent",
  [`${SH}lessThanOrEquals`]: "LessThanOrEqualsConstraintComponent",
  [`${SH}not`]: "NotConstraintComponent",
  [`${SH}and`]: "AndConstraintComponent",
  [`${SH}or`]: "OrConstraintComponent",
  [`${SH}xone`]: "XoneConstraintComponent",
  [`${SH}node`]: "NodeConstraintComponent",
  [`${SH}property`]: "PropertyConstraintComponent",
  [`${SH}qualifiedValueShape`]: "QualifiedValueShapeConstraintComponent",
  [`${SH}qualifiedMinCount`]: "QualifiedMinCountConstraintComponent",
  [`${SH}qualifiedMaxCount`]: "QualifiedMaxCountConstraintComponent",
  [`${SH}closed`]: "ClosedConstraintComponent",
  [`${SH}ignoredProperties`]: "ClosedConstraintComponent",
  [`${SH}hasValue`]: "HasValueConstraintComponent",
  [`${SH}in`]: "InConstraintComponent",
  [`${SH}sparql`]: "SPARQLConstraintComponent",
};

export type Consumption = "consumed" | "carried" | "unrendered";

/** What the form layer does with each term that reaches the IR. */
export const LEDGER: Record<string, { how: Consumption; why: string }> = {
  // --- structure and annotation the form layer reads ---
  [`${SH}path`]: { how: "consumed", why: "Becomes the field's path; simple predicates are editable." },
  [`${SH}name`]: { how: "consumed", why: "Field label, picked by locale." },
  [`${SH}description`]: { how: "consumed", why: "Field help text, picked by locale." },
  [`${SH}order`]: { how: "consumed", why: "Field order within a group." },
  [`${SH}group`]: { how: "consumed", why: "Section the field is laid out in." },
  [`${SH}targetClass`]: { how: "consumed", why: "Root-shape resolution and the rdf:type stamped on new nested resources." },
  [`${SHUI}editor`]: { how: "consumed", why: "Selects the widget directly." },
  [`${SHUI}viewer`]: { how: "carried", why: "Read-only display hint; no read-only mode is implemented, so it changes nothing." },
  [`${SH}message`]: { how: "consumed", why: "Validation message shown on the field (lang-tagged; see E3)." },
  [`${SH}severity`]: { how: "consumed", why: "Routes a violation to error vs warning display." },
  // --- value constraints that pick or configure a widget ---
  [`${SH}datatype`]: { how: "consumed", why: "Primary editor inference (date, dateTime, boolean, numeric, langString) and the term binding on commit." },
  [`${SH}nodeKind`]: { how: "consumed", why: "sh:IRI infers the IRI editor and makes the committed term a NamedNode." },
  [`${SH}class`]: { how: "consumed", why: "Infers the autocomplete/reference editor and is handed to `assist.search`." },
  [`${SH}in`]: { how: "consumed", why: "Infers the enum editor and supplies its options verbatim." },
  [`${SH}minCount`]: { how: "consumed", why: "Required marker and the minimum number of value rows." },
  [`${SH}maxCount`]: { how: "consumed", why: "Repeatability; also selects the one-control (multi) form of a widget." },
  [`${SH}node`]: { how: "consumed", why: "Renders a nested sub-form for the referenced node shape." },
  [`${SH}pattern`]: { how: "consumed", why: "Passed to the widget as a hint (unanchored XPath regex, so never as an HTML pattern attribute)." },
  [`${SH}flags`]: { how: "consumed", why: "Passed with sh:pattern." },
  [`${SH}minLength`]: { how: "consumed", why: "Widget bound." },
  [`${SH}maxLength`]: { how: "consumed", why: "Widget bound." },
  [`${SH}minInclusive`]: { how: "consumed", why: "Numeric input bound." },
  [`${SH}maxInclusive`]: { how: "consumed", why: "Numeric input bound." },
  [`${SH}defaultValue`]: { how: "consumed", why: "Seeds an empty slot." },
  [`${SH}uniqueLang`]: { how: "consumed", why: "Constrains a lang-tagged field to one literal per language." },
  [`${SH}languageIn`]: { how: "consumed", why: "Constrains the language picker." },
  // --- carried but never read ---
  [`${SH}minExclusive`]: {
    how: "carried",
    why: "No numeric control here takes an exclusive bound, and no epsilon is right for both xsd:integer and xsd:double. Enforced on commit by the validator, invisible in the UI.",
  },
  [`${SH}maxExclusive`]: { how: "carried", why: "Same as sh:minExclusive." },
  [`${SH}hasValue`]: {
    how: "carried",
    why: "Reaches FieldConstraints and no widget reads it. A property pinned to one value still renders as a free input the user can wrongly change.",
  },
  // --- reaches the IR, changes nothing ---
  [`${SH}or`]: {
    how: "unrendered",
    why: "Parsed into the IR's `logical.or` and never read by buildFormModel. The field renders from its own facts only, so the disjuncts — often the real datatype/class alternatives — are invisible and unenforced in the UI.",
  },
  [`${SH}xone`]: { how: "unrendered", why: "Same as sh:or. Exclusive choice has no control; the UI cannot offer the branch selector the construct describes." },
  [`${SH}and`]: { how: "unrendered", why: "Same as sh:or. Conjoined constraints are not merged into the field's own facts." },
  [`${SH}not`]: { how: "unrendered", why: "Negation has no form affordance; nothing narrows the input." },
  [`${SH}qualifiedValueShape`]: {
    how: "unrendered",
    why: "No slot in the typed IR. 'at least n of the values must match shape S' is a per-value constraint the field, which models one editor for all its values, cannot express.",
  },
  [`${SH}qualifiedMinCount`]: { how: "unrendered", why: "Parameter of sh:qualifiedValueShape." },
  [`${SH}qualifiedMaxCount`]: { how: "unrendered", why: "Parameter of sh:qualifiedValueShape." },
  [`${SH}deactivated`]: {
    how: "unrendered",
    why: "WRONGLY RENDERED, not merely ignored: the component is recorded but never honoured, so a property the profile switched off still gets a field. A correctness bug, not a missing feature.",
  },
  [`${SH}closed`]: {
    how: "unrendered",
    why: "Node-level closedness. A form offers exactly the fields the shape declares, so it cannot violate closedness — but it also cannot show the user that no other property is permitted.",
  },
  [`${SH}ignoredProperties`]: { how: "unrendered", why: "Parameter of sh:closed." },
  [`${SH}sparql`]: { how: "unrendered", why: "SPARQL-based constraint. Validation-only; there is no affordance a form can derive from a query." },
  [`${SH}select`]: { how: "unrendered", why: "Body of sh:sparql." },
  [`${SH}ask`]: { how: "unrendered", why: "Body of sh:sparql." },
  [`${SH}equals`]: { how: "unrendered", why: "Cross-property constraint; the field model is per-property and has no view of a sibling." },
  [`${SH}disjoint`]: { how: "unrendered", why: "Cross-property constraint; see sh:equals." },
  [`${SH}lessThan`]: { how: "unrendered", why: "Cross-property constraint; see sh:equals. A date-range pair is the common case and gets no linked control." },
  [`${SH}lessThanOrEquals`]: { how: "unrendered", why: "Cross-property constraint; see sh:equals." },
  [`${SH}property`]: {
    how: "unrendered",
    why: "A property shape nested INSIDE another property shape — reached as a constraint parameter (under sh:or, sh:qualifiedValueShape…) rather than from a node shape. Only node-shape properties are built into fields, so these are invisible. (The ordinary node-shape sh:property is the mechanism itself and is of course read; it is filtered out of this count.)",
  },
  [`${RDF}type`]: { how: "consumed", why: "`a sh:PropertyShape` — shape typing, not a constraint." },
  [`${SH}shape`]: {
    how: "unrendered",
    why: "Not a SHACL 1.2 term at all — a leftover from a pre-REC draft, still shipped by DCAT-AP 3.0.1. It is recorded and ignored.",
  },
  [`${SH}seeAlso`]: { how: "unrendered", why: "Documentation link; no place in a form." },
  [`${DASH}editor`]: {
    how: "unrendered",
    why: "The DASH editor vocabulary. The engine records the term and does not act on it: only `shui:editor` selects a widget. This is the measured baseline — see the note above the coverage table.",
  },
  [`${DASH}viewer`]: { how: "unrendered", why: "See dash:editor." },
};

/** SHACL/DASH/SHACL-UI terms that are shape *plumbing* rather than constructs a
 *  form could render, so their absence from the IR is not a finding. */
export const PLUMBING = new Set(
  [
    "NodeShape", "PropertyShape", "Shape", "IRI", "Literal", "BlankNode",
    "IRIOrLiteral", "BlankNodeOrIRI", "BlankNodeOrLiteral", "Violation",
    "Warning", "Info", "PropertyGroup", "ValidationResult", "ValidationReport",
    "prefixes", "declare", "prefix", "namespace", "parameter", "labelTemplate",
    "validator", "nodeValidator", "propertyValidator", "ConstraintComponent",
    "path", "alternativePath", "inversePath", "zeroOrMorePath", "oneOrMorePath",
    "zeroOrOnePath",
    // The mechanism itself: a node shape declaring its property shapes. Only the
    // *nested* occurrence — sh:property under another property shape — is a gap,
    // and that one is counted off the IR, not off this scan.
    "property",
  ].map((t) => `${SH}${t}`),
);

/** Terms whose absence from the IR IS a finding: a targeting or advanced-feature
 *  construct the engine drops before the form layer ever sees it. */
export const ENGINE_DROP_REASON: Record<string, string> = {
  [`${SH}targetNode`]: "Target selector. Only sh:targetClass is used for root-shape resolution, so a node-targeted shape has no way in.",
  [`${SH}targetSubjectsOf`]: "Target selector; not used for root-shape resolution.",
  [`${SH}targetObjectsOf`]: "Target selector; not used for root-shape resolution.",
  [`${SH}target`]: "SPARQL/custom target; not used for root-shape resolution.",
  [`${SH}rule`]: "SHACL-AF inference rule. Values a rule would derive never appear in the form.",
  [`${SH}condition`]: "SHACL-AF rule condition.",
  [`${SH}construct`]: "SHACL-AF rule body.",
  [`${SH}values`]: "SHACL-AF value expression.",
  [`${SH}expression`]: "SHACL-AF node expression.",
  [`${SH}entailment`]: "Entailment regime declaration; ignored.",
  [`${SH}suggestedShapesGraph`]: "Tooling hint; ignored.",
};

export const localName = (iri: string) => iri.split(/[#/]/).pop() || iri;
export const NAMESPACES = { SH, SHUI, DASH, RDF };
