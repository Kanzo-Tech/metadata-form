import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { literal, namedNode, NS } from "@/form/factory.js";
import { createRudofEngine } from "@/engine/index.js";
import { GraphState } from "@/engine/GraphState.js";
import { buildFormModel, type Diagnostic } from "@/form/buildFormModel.js";
import { allFields, type FieldModel } from "@/form/FormModel.js";
import { alternativeFor } from "@/form/disjunction.js";
import { branchValues } from "@/form/writePath.js";
import { primitiveToTerm } from "@/form/termBinding.js";
import { Editors } from "@/form/vocab/shacl-ui.js";
import { SH_IRI } from "@/form/vocab/shacl.js";
import { FieldRenderer } from "@/react/form/FieldRenderer.js";
import { FormContext, NodeContext, type FormContextValue } from "@/react/form/context.js";
import { defaultWidgets } from "@/react/widgets/defaultWidgets.js";
import { resolveStrings } from "@/i18n/strings.js";
import type { Term } from "@rdfjs/types";
import type { NodeShapeIR, PropertyShapeIR, ShapeIR, ShapeModel } from "@/form/ShapeIR.js";

/**
 * Rendering `sh:or`.
 *
 * SHACL §4.6.1 makes `sh:or` a constraint on **value nodes**: each one conforms to
 * at least one of the listed shapes. Every assertion here follows from that and
 * from nothing else — which arm a value is on is read off the value, the field's
 * path and cardinality are untouched by any of it, and a disjunction the field
 * cannot offer in full is narrowed (always sound: `sh:or` only narrows) or refused
 * outright, never guessed at.
 *
 * Built from hand-written IR rather than from Turtle, deliberately: what is under
 * test is what the form layer makes of a disjunction, and the shapes below are the
 * four shapes the E1 corpus actually contains, reproduced as the engine hands them
 * over. `test/rudof-wasm.integration.test.ts` is where the parse is pinned.
 */

const EX = "http://example.org/";
const XSD = NS.xsd;
const DCT = "http://purl.org/dc/terms/";
const SH_BLANK_NODE = `${NS.sh}BlankNode`;

/** A pathless `sh:or` member: a shape constraining the value node itself. */
function branch(value: ShapeIR["value"], extra: Partial<ShapeIR> = {}): ShapeIR {
  return {
    cardinality: {},
    value,
    logical: {},
    presentation: { names: [], descriptions: [] },
    components: [],
    ...extra,
  };
}

function prop(pathIri: string, opts: Partial<PropertyShapeIR> = {}): PropertyShapeIR {
  return {
    path: { kind: "predicate", iri: pathIri },
    pathKey: pathIri,
    cardinality: {},
    value: {},
    logical: {},
    presentation: { names: [{ value: pathIri.split(/[#/]/).pop()!, language: "" }], descriptions: [] },
    components: [],
    ...opts,
  };
}

const focus = namedNode(`${EX}d1`);

/** A term as its N-Triples-ish surface form. RDF/JS terms carry an `equals`
 *  closure, so structural equality reports two identical terms as different; the
 *  written form is the thing under test anyway. */
function shows(term: Term | null): string {
  if (!term) return "";
  if (term.termType !== "Literal") return `<${term.value}>`;
  if (term.language) return `"${term.value}"@${term.language}`;
  return `"${term.value}"^^<${term.datatype.value}>`;
}
const XSD_STRING = `${XSD}string`;

/** Build one field from one property shape, optionally with helper node shapes. */
function build(
  ps: PropertyShapeIR,
  opts: { nodeShapes?: NodeShapeIR[]; locale?: string; onDiagnostic?: (d: Diagnostic) => void } = {},
): FieldModel {
  const shape: NodeShapeIR = {
    id: `${EX}Shape`,
    targetClasses: [`${EX}Thing`],
    instanceClass: `${EX}Thing`,
    properties: [ps],
  };
  const shapes: ShapeModel = {
    nodeShapes: new Map([[shape.id, shape], ...(opts.nodeShapes ?? []).map((n) => [n.id, n] as const)]),
    groups: new Map(),
    byTargetClass: new Map([[`${EX}Thing`, shape.id]]),
  };
  const model = buildFormModel({
    shapes,
    focusNode: focus,
    shape,
    locale: opts.locale ?? "en",
    onDiagnostic: opts.onDiagnostic,
  });
  const fields = allFields(model);
  expect(fields).toHaveLength(1);
  return fields[0];
}

describe("branches that differ only in class are ONE control, not a choice", () => {
  // SPHN, 196 times: `sh:or ([sh:class snomed:A] [sh:class snomed:B] …)`.
  const ps = prop(`${EX}code`, {
    logical: {
      or: [
        branch({ classIri: `${EX}Terminology` }),
        branch({ classIri: `${EX}Code` }),
      ],
    },
  });

  it("folds the classes into a set and offers no picker", () => {
    const field = build(ps);
    expect(field.alternatives).toBeUndefined();
    expect(field.editorId).toBe(Editors.AutoComplete);
    expect(field.constraints.classIri).toBe(`${EX}Terminology`);
    expect(field.constraints.classIn).toEqual([`${EX}Terminology`, `${EX}Code`]);
  });

  it("still writes an IRI, which is what every branch asked for", () => {
    const field = build(ps);
    expect(shows(primitiveToTerm(field, `${EX}c1`))).toBe(`<${EX}c1>`);
  });

  it("leaves a single-class disjunction with no classIn to widen", () => {
    const field = build(prop(`${EX}code`, { logical: { or: [branch({ classIri: `${EX}Code` })] } }));
    expect(field.constraints.classIri).toBe(`${EX}Code`);
    expect(field.constraints.classIn).toBeUndefined();
    expect(field.alternatives).toBeUndefined();
  });
});

describe("branches that differ in KIND become alternatives the user picks", () => {
  // SPHN, 3 times: a quantity that may be a number or a free-text string.
  const ps = prop(`${EX}quantity`, {
    logical: {
      or: [branch({ datatype: `${XSD}double` }), branch({ datatype: `${XSD}string` })],
    },
  });

  it("offers one alternative per kind, in the profile's order", () => {
    const field = build(ps);
    expect(field.alternatives?.map((a) => a.label)).toEqual(["double", "string"]);
    expect(field.alternatives?.map((a) => a.editorId)).toEqual([
      Editors.NumberField,
      Editors.TextField,
    ]);
  });

  it("makes the first alternative the field's own editor and constraints", () => {
    const field = build(ps);
    expect(field.editorId).toBe(Editors.NumberField);
    expect(field.constraints.datatype).toBe(`${XSD}double`);
  });

  it("binds a committed value to the alternative it was entered under", () => {
    const field = build(ps);
    const [asDouble, asString] = field.alternatives!;
    const under = (a: typeof asDouble, raw: string) =>
      primitiveToTerm({ ...field, editorId: a.editorId, constraints: a.constraints }, raw);
    expect(shows(under(asDouble, "3.5"))).toBe(`"3.5"^^<${XSD}double>`);
    expect(shows(under(asString, "3.5"))).toBe(`"3.5"^^<${XSD_STRING}>`);
  });

  it("reads the alternative back off the term, never off remembered state", () => {
    const alts = build(ps).alternatives!;
    expect(alternativeFor(alts, literal("3.5", namedNode(`${XSD}double`))).label).toBe("double");
    expect(alternativeFor(alts, literal("about three")).label).toBe("string");
    // An empty row has no term to read, so it falls to the profile's own order.
    expect(alternativeFor(alts, null).label).toBe("double");
  });

  it("names an alternative with the profile's own sh:name when it gave one", () => {
    const named = prop(`${EX}quantity`, {
      logical: {
        or: [
          branch({ datatype: `${XSD}double` }, {
            presentation: { names: [{ value: "Medida", language: "es" }], descriptions: [] },
          }),
          branch({ datatype: `${XSD}string` }),
        ],
      },
    });
    expect(build(named, { locale: "es" }).alternatives?.[0].label).toBe("Medida");
  });
});

describe("a disjunction reached through sh:node is a value kind, not a sub-form", () => {
  // DCAT-AP declares :DateOrDateTimeDataType_Shape as nothing but an sh:or and
  // points 16 property shapes at it. Each of those builds an empty nested form
  // until the disjunction is read.
  const dateOrDateTime: NodeShapeIR = {
    id: `${EX}DateOrDateTimeDataType_Shape`,
    targetClasses: [],
    properties: [],
    logical: {
      or: [
        branch({ datatype: `${XSD}date` }),
        branch({ datatype: `${XSD}dateTime` }),
        branch({ datatype: `${XSD}gYear` }),
      ],
    },
  };
  const ps = prop(`${DCT}issued`, {
    node: dateOrDateTime.id,
    // What rudof emits for any property carrying sh:node.
    presentation: { names: [], descriptions: [], editor: Editors.Details },
  });

  it("renders the kinds instead of a nested form with no fields", () => {
    const field = build(ps, { nodeShapes: [dateOrDateTime] });
    expect(field.nodeShape).toBeNull();
    expect(field.alternatives?.map((a) => a.label)).toEqual(["date", "dateTime", "gYear"]);
    expect(field.editorId).toBe(Editors.DatePicker);
  });

  it("leaves a sh:node with real fields alone", () => {
    const publisher: NodeShapeIR = {
      id: `${EX}AgentShape`,
      targetClasses: [`${EX}Agent`],
      instanceClass: `${EX}Agent`,
      properties: [prop(`${EX}name`)],
    };
    const field = build(
      prop(`${DCT}publisher`, {
        node: publisher.id,
        presentation: { names: [], descriptions: [], editor: Editors.Details },
      }),
      { nodeShapes: [publisher] },
    );
    expect(field.nodeShape?.value).toBe(publisher.id);
    expect(field.editorId).toBe(Editors.Details);
    expect(field.alternatives).toBeUndefined();
  });
});

describe("branches the form cannot offer are dropped, and said so", () => {
  // DCAT-AP.de, twice: an IRI, or an inline blank node of class dct:Location.
  const ps = prop(`${DCT}spatial`, {
    logical: {
      or: [
        branch({ nodeKind: SH_IRI }),
        branch({ classIri: `${DCT}Location`, nodeKind: SH_BLANK_NODE }),
      ],
    },
  });

  it("keeps the arm a user can type and drops the blank node", () => {
    const field = build(ps);
    expect(field.alternatives).toBeUndefined();
    expect(field.editorId).toBe(Editors.IRI);
    expect(field.constraints.nodeKind).toBe(SH_IRI);
    expect(field.readOnly).toBeFalsy();
  });

  it("reports the narrowing rather than performing it quietly", () => {
    const diagnostics: Diagnostic[] = [];
    build(ps, { onDiagnostic: (d) => diagnostics.push(d) });
    const dropped = diagnostics.filter((d) => d.code === "unrenderable-alternative");
    expect(dropped).toHaveLength(1);
    expect(dropped[0].message).toContain("blank node");
  });
});

describe("a disjunction of structures is refused, with a reason", () => {
  // DCAT-AP's :CountryRestriction and HealthDCAT-AP's siblings: every branch is a
  // shape over the value's own properties.
  const ps = prop(`${DCT}spatial`, {
    logical: {
      or: [
        branch({}, { path: { kind: "predicate", iri: `${EX}inScheme` }, pathKey: `${EX}inScheme`, cardinality: { min: 1 } }),
        branch({}, { node: `${EX}CountryShape` }),
      ],
    },
  });

  it("sees a branch whose only content the typed core does not model", () => {
    // `sh:property` has no slot in the IR, so this branch arrives looking empty.
    // The open component bag is what keeps it from reading as unconstrained.
    const viaComponents = prop(`${DCT}spatial`, {
      logical: {
        or: [
          branch({}, {
            components: [{ iri: `${NS.sh}property`, params: new Map([["value", [{ termType: "BlankNode", value: "b1" }]]]) }],
          }),
        ],
      },
    });
    expect(build(viaComponents).readOnlyReason?.code).toBe("disjunction-of-shapes");
  });

  it("takes no input and carries the code a surface can act on", () => {
    const field = build(ps);
    expect(field.readOnly).toBe(true);
    expect(field.write).toBeUndefined();
    expect(field.readOnlyReason?.code).toBe("disjunction-of-shapes");
    expect(field.readOnlyReason?.detail).toBe(`${DCT}spatial`);
  });

  it("says why, in the form's locale", () => {
    expect(build(ps, { locale: "en" }).readOnlyReason?.message).toBe(
      "Shown for reference. The profile accepts several alternatives here, and every one of " +
        "them describes a related resource with a structure of its own rather than a value that " +
        "can be typed in.",
    );
    expect(build(ps, { locale: "es" }).readOnlyReason?.message).toContain("estructura propia");
    expect(build(ps, { locale: "ca" }).readOnlyReason?.message).toContain("estructura pròpia");
  });

  it("leaves a control the property already had rather than refusing over it", () => {
    // DCAT-AP writes dct:spatial as `sh:nodeKind sh:IRI` PLUS an sh:or of four
    // vocabulary restrictions. The disjunction narrows which IRIs are acceptable;
    // the IRI box is right either way, and taking it away would report a narrowing
    // the validator reports anyway.
    const field = build(
      prop(`${DCT}spatial`, {
        value: { nodeKind: SH_IRI },
        presentation: { names: [], descriptions: [], editor: Editors.IRI },
        logical: ps.logical,
      }),
    );
    expect(field.readOnly).toBeFalsy();
    expect(field.editorId).toBe(Editors.IRI);
  });

  it("yields to a path reason, which is the one the user can act on", () => {
    const sequence = prop(`(${EX}a/${EX}b)`, {
      path: { kind: "sequence", steps: [{ kind: "predicate", iri: `${EX}a` }, { kind: "predicate", iri: `${EX}b` }] },
      pathKey: `(${EX}a/${EX}b)`,
      logical: ps.logical,
    });
    // No reader and no data graph: the intermediate does not exist, which is a
    // fact about the record and can change. The disjunction cannot.
    expect(build(sequence).readOnlyReason?.code).toBe("intermediate-missing");
  });
});

describe("what a disjunction may not do to a field", () => {
  it("does not take its cardinality from a branch (§4.6.1 is about values)", () => {
    const field = build(
      prop(`${EX}code`, {
        cardinality: { max: 1 },
        logical: { or: [branch({ classIri: `${EX}Code` }, { cardinality: { min: 3 } })] },
      }),
    );
    expect(field.minCount).toBe(0);
    expect(field.maxCount).toBe(1);
    expect(field.required).toBe(false);
  });

  it("does not overrule a facet the property stated itself", () => {
    const field = build(
      prop(`${EX}when`, {
        value: { datatype: `${XSD}date` },
        logical: { or: [branch({ datatype: `${XSD}string` })] },
      }),
    );
    expect(field.constraints.datatype).toBe(`${XSD}date`);
  });

  it("changes nothing when a branch constrains nothing at all", () => {
    // A branch stating no kind is satisfied by every value, so the whole
    // disjunction is — it rules nothing out and takes nothing away.
    const field = build(
      prop(`${EX}note`, { logical: { or: [branch({ datatype: `${XSD}string` }), branch({})] } }),
    );
    expect(field.readOnly).toBeFalsy();
    expect(field.alternatives).toBeUndefined();
    expect(field.constraints.datatype).toBeUndefined();
    expect(field.editorId).toBe(Editors.TextField);
  });
});

describe("the round trip through the graph", () => {
  /** A real rudof session graph, edited exactly as the renderer edits it. */
  async function editable() {
    const engine = createRudofEngine();
    const backend = await engine.newGraph();
    return new GraphState(backend);
  }

  const ps = prop(`${EX}quantity`, {
    logical: {
      or: [branch({ datatype: `${XSD}double` }), branch({ datatype: `${XSD}string` })],
    },
  });

  it("commits the term the chosen alternative demands, and reads it back", async () => {
    const graph = await editable();
    const field = build(ps);
    const [asDouble, asString] = field.alternatives!;
    const write = field.write!;

    const commit = (alt: typeof asDouble, raw: string) => {
      const term = primitiveToTerm({ ...field, editorId: alt.editorId, constraints: alt.constraints }, raw)!;
      graph.addValue(focus, write, term);
      return term;
    };
    const asDoubleTerm = commit(asDouble, "3.5");
    const asStringTerm = commit(asString, "about three");

    // The write is the inverse of the read: both values come back through the
    // same one path, because `sh:or` never spoke about the path.
    const readBack = branchValues(graph.readStep, focus, write.branches[0]);
    expect(readBack.map(shows).sort()).toEqual([shows(asDoubleTerm), shows(asStringTerm)].sort());

    // And each reads back onto the alternative it was written under.
    expect(alternativeFor(field.alternatives!, readBack.find((t) => t.value === "3.5")!).id)
      .toBe(asDouble.id);
    expect(alternativeFor(field.alternatives!, readBack.find((t) => t.value === "about three")!).id)
      .toBe(asString.id);
  });

  it("re-binds the value when the user switches alternative", async () => {
    const graph = await editable();
    const field = build(ps);
    const [asDouble, asString] = field.alternatives!;
    const write = field.write!;
    const rebind = (alt: typeof asDouble, raw: string) =>
      primitiveToTerm({ ...field, editorId: alt.editorId, constraints: alt.constraints }, raw)!;

    const first = rebind(asDouble, "12");
    graph.addValue(focus, write, first);
    graph.setValue(focus, write, first, rebind(asString, "12"));

    const readBack = branchValues(graph.readStep, focus, write.branches[0]);
    expect(readBack).toHaveLength(1);
    expect(shows(readBack[0])).toBe(`"12"^^<${XSD_STRING}>`);
    expect(alternativeFor(field.alternatives!, readBack[0]).id).toBe(asString.id);
  });
});

describe("the picker a user sees", () => {
  // sh:maxCount 1, as SPHN writes it, so the one row renders without an add step.
  const ps = prop(`${EX}quantity`, {
    cardinality: { max: 1 },
    logical: {
      or: [branch({ datatype: `${XSD}double` }), branch({ datatype: `${XSD}string` })],
    },
  });

  /** `<FieldRenderer>` on its own over a real editable graph — the form chrome
   *  around it has nothing to do with which alternative is in force. */
  async function renderField(field: FieldModel) {
    const engine = createRudofEngine();
    const graph = new GraphState(await engine.newGraph());
    const model = { focusNode: focus, shape: namedNode(`${EX}Shape`), groups: [] };
    const ctx = {
      graph,
      model,
      widgets: defaultWidgets,
      locale: "en",
      strings: resolveStrings("en"),
      errors: new Map(),
      report: {
        progress: { filled: 0, total: 0, ratio: 0 },
        issues: { total: 0, hasViolations: false, rows: [], byField: new Map(), byGroup: new Map() },
        pending: [],
        health: { mood: "ok", message: "" },
      },
    } as unknown as FormContextValue;
    render(
      <FormContext.Provider value={ctx}>
        <NodeContext.Provider value={focus}>
          <FieldRenderer field={field} />
        </NodeContext.Provider>
      </FormContext.Provider>,
    );
    return { graph, field };
  }

  it("offers the kinds, and commits under the one chosen", async () => {
    const field = build(ps);
    const { graph } = await renderField(field);

    const picker = screen.getByLabelText("quantity — kind of value") as HTMLSelectElement;
    expect([...picker.options].map((o) => o.text)).toEqual(["double", "string"]);

    // The first alternative is in force, so a number input is what is rendered.
    fireEvent.change(picker, { target: { value: field.alternatives![1].id } });
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "about three" } });
    fireEvent.blur(input);

    const written = branchValues(graph.readStep, focus, field.write!.branches[0]);
    expect(written.map(shows)).toEqual([`"about three"^^<${XSD_STRING}>`]);
  });

  it("shows no picker where the disjunction folded to one control", async () => {
    await renderField(
      build(prop(`${EX}code`, { cardinality: { max: 1 }, logical: { or: [branch({ classIri: `${EX}Code` })] } })),
    );
    expect(screen.queryByLabelText(/kind of value/)).toBeNull();
  });
});
