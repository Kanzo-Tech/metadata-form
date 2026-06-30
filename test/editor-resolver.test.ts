import { describe, expect, it } from "vitest";
import {
  createEditorResolver,
  deriveContext,
  type EditorRule,
} from "../src/form/editors.js";
import { Editors } from "../src/form/vocab/shacl-ui.js";
import { NS } from "../src/engine/factory.js";
import type { PropertyShapeIR, ValueConstraints } from "../src/form/ShapeIR.js";

const XSD = NS.xsd;

function prop(over: Partial<PropertyShapeIR> = {}): PropertyShapeIR {
  return {
    path: { kind: "predicate", iri: "http://ex/p" },
    cardinality: {},
    value: {},
    logical: {},
    presentation: { names: [], descriptions: [] },
    components: [],
    ...over,
  };
}

const value = (v: ValueConstraints): Partial<PropertyShapeIR> => ({ value: v });

function resolve(over: Partial<PropertyShapeIR>): string {
  return createEditorResolver().resolve(deriveContext(prop(over)));
}

describe("EditorResolver (default SHACL-UI rules)", () => {
  it("honors an explicit editor over everything else", () => {
    const r = prop({ ...value({ datatype: `${XSD}boolean` }), presentation: { names: [], descriptions: [], editor: Editors.RichText } });
    expect(createEditorResolver().resolve(deriveContext(r))).toBe(Editors.RichText);
  });

  it("maps nested node → Details, sh:in → EnumSelect", () => {
    expect(resolve({ node: "http://ex/Shape" })).toBe(Editors.Details);
    expect(resolve(value({ in: [{ termType: "NamedNode", value: "http://ex/a" }] }))).toBe(Editors.EnumSelect);
  });

  it("maps datatypes to their editors", () => {
    expect(resolve(value({ datatype: `${XSD}boolean` }))).toBe(Editors.Boolean);
    expect(resolve(value({ datatype: `${XSD}date` }))).toBe(Editors.DatePicker);
    expect(resolve(value({ datatype: `${XSD}dateTime` }))).toBe(Editors.DateTimePicker);
    expect(resolve(value({ datatype: `${XSD}integer` }))).toBe(Editors.NumberField);
    expect(resolve(value({ datatype: `${XSD}anyURI` }))).toBe(Editors.IRI);
    expect(resolve(value({ datatype: `${NS.rdf}HTML` }))).toBe(Editors.RichText);
  });

  it("respects singleLine for langString and plain text", () => {
    const lang = `${NS.rdf}langString`;
    expect(resolve({ ...value({ datatype: lang }) })).toBe(Editors.TextFieldWithLang);
    expect(resolve({ ...value({ datatype: lang }), presentation: { names: [], descriptions: [], singleLine: false } })).toBe(Editors.TextAreaWithLang);
    expect(resolve({ presentation: { names: [], descriptions: [], singleLine: false } })).toBe(Editors.TextArea);
  });

  it("maps class reference → AutoComplete, sh:IRI nodeKind → IRI", () => {
    expect(resolve(value({ classIri: "http://ex/Person" }))).toBe(Editors.AutoComplete);
    expect(resolve(value({ nodeKind: `${NS.sh}IRI` }))).toBe(Editors.IRI);
  });

  it("falls back to the first sh:or branch when the property states no own facts", () => {
    const branch = prop(value({ datatype: `${XSD}date` }));
    expect(resolve({ logical: { or: [branch] } })).toBe(Editors.DatePicker);
  });

  it("falls back to a plain text field", () => {
    expect(resolve({})).toBe(Editors.TextField);
  });

  it("is extensible: a custom rule inserted before text-fallback claims the field", () => {
    const rule: EditorRule = {
      name: "always-iri",
      resolve: () => Editors.IRI,
    };
    const resolver = createEditorResolver().use(rule, { before: "text-fallback" });
    expect(resolver.resolve(deriveContext(prop({})))).toBe(Editors.IRI);
  });

  it("is extensible: removing a rule changes the outcome", () => {
    const resolver = createEditorResolver().remove("xsd-boolean");
    expect(resolver.resolve(deriveContext(prop(value({ datatype: `${XSD}boolean` }))))).toBe(Editors.TextField);
  });
});
