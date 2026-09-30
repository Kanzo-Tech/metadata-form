import { describe, it, expect } from "vitest";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { MetadataForm } from "@/react/form/MetadataForm.js";
import { useMetadataForm } from "@/react/hooks/useMetadataForm.js";
import { createRudofEngine } from "@/engine/index.js";
import { literal, namedNode } from "@/form/factory.js";
import { primitiveToTerm } from "@/form/termBinding.js";
import { allFields } from "@/form/FormModel.js";
import { buildFormModel } from "@/form/buildFormModel.js";

const EX = "http://example.org/";
const XSD = "http://www.w3.org/2001/XMLSchema#";
const DATATYPE = "http://www.w3.org/ns/shacl#DatatypeConstraintComponent";
const prefixes = `
  @prefix sh: <http://www.w3.org/ns/shacl#> . @prefix ex: <${EX}> .
  @prefix xsd: <${XSD}> . @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .`;

let form!: ReturnType<typeof useMetadataForm>;
function Form(props: { datatype: string; data?: string }) {
  form = useMetadataForm({
    shapes: `${prefixes} ex:S a sh:NodeShape ; sh:targetClass ex:T ; sh:property [ sh:path ex:when ; sh:name "When" ; sh:datatype ${props.datatype} ; sh:maxCount 1 ] .`,
    data: props.data && `${prefixes} ex:t a ex:T ; ex:when ${props.data} .`,
    rootShape: `${EX}S`,
    validateOn: "manual",
  });
  return <MetadataForm form={form} />;
}

const whenLiteral = () => form.quads.find((q) => q.predicate.value === `${EX}when`)?.object;
const datatypeErrors = async () => {
  let errors: Awaited<ReturnType<typeof form.validate>> = [];
  await act(async () => {
    errors = await form.validate();
  });
  return errors.filter((e) => e.constraint === DATATYPE);
};

describe("the date and time control writes a valid xsd:dateTime", () => {
  it("keeps the zone of a stored value when only the time is edited, and completes the seconds", async () => {
    render(<Form datatype="xsd:dateTime" data={`"2026-03-14T18:30:00+02:00"^^xsd:dateTime`} />);
    await waitFor(() => expect(document.querySelector('input[type="time"]')).not.toBeNull());
    const time = document.querySelector<HTMLInputElement>('input[type="time"]')!;
    fireEvent.change(time, { target: { value: "19:45" } });
    await waitFor(() => expect(whenLiteral()?.value).toBe("2026-03-14T19:45:00+02:00"));
    expect(whenLiteral()).toMatchObject({ datatype: { value: `${XSD}dateTime` } });
    expect(await datatypeErrors()).toEqual([]);
  });

  it("corrects a value an earlier version truncated to hh:mm on the next edit", async () => {
    render(<Form datatype="xsd:dateTime" data={`"2026-09-30T14:30"^^xsd:dateTime`} />);
    await waitFor(() => expect(document.querySelector('input[type="time"]')).not.toBeNull());
    expect(await datatypeErrors()).toHaveLength(1); // the stored value itself is invalid
    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="time"]')!, { target: { value: "14:30:15" } });
    await waitFor(() => expect(whenLiteral()?.value).toBe("2026-09-30T14:30:15"));
    expect(await datatypeErrors()).toEqual([]);
  });

  it("keeps fractional seconds while the time is not changed", async () => {
    render(<Form datatype="xsd:dateTime" data={`"2026-03-14T18:30:00.125Z"^^xsd:dateTime`} />);
    await waitFor(() => expect(document.querySelector('input[type="time"]')).not.toBeNull());
    expect(await datatypeErrors()).toEqual([]);
    expect(document.querySelector<HTMLInputElement>('input[type="time"]')!.value).toBe("18:30:00.125");
  });

  it("does not throw on a stored xsd:date with a zone, and leaves it as it is", async () => {
    render(<Form datatype="xsd:date" data={`"2026-03-14+02:00"^^xsd:date`} />);
    await waitFor(() => expect(document.querySelector("[data-field]")).not.toBeNull());
    expect(whenLiteral()?.value).toBe("2026-03-14+02:00");
    expect(await datatypeErrors()).toEqual([]);
  });
});

/**
 * "A control writes the declared datatype": what each typed control hands over, run
 * through the same binding the form commits with, then judged by the engine. The
 * raw values are what the control produces — a `NumberInput` string, a picker's
 * ISO string, the `true`/`false` of a switch, a language picker's tag.
 */
describe("each control's committed value conforms to the datatype the shape declares", () => {
  const cases: [string, string, string | null, string?][] = [
    ["xsd:integer", "integer", "42"],
    ["xsd:nonNegativeInteger", "positive integer", "7"],
    ["xsd:decimal", "decimal", "3.25"],
    ["xsd:double", "double", "2.5"],
    ["xsd:boolean", "true", "true"],
    ["xsd:boolean", "false", "false"],
    ["xsd:anyURI", "uri", "http://example.org/a"],
    ["xsd:date", "date", "2026-09-30"],
    ["xsd:dateTime", "dateTime", "2026-09-30T14:30:00"],
    ["xsd:gYear", "gYear", "2026"],
    ["rdf:langString", "tagged", "Hola", "es"],
  ];

  it.each(cases)("%s: %s", async (datatype, _name, raw, language) => {
    const engine = createRudofEngine();
    const shapes = await engine.loadShapes(
      `${prefixes} ex:S a sh:NodeShape ; sh:targetClass ex:T ; sh:property [ sh:path ex:when ; sh:datatype ${datatype} ] .`,
    );
    const model = buildFormModel({ shapes, focusNode: namedNode(`${EX}t`), shape: shapes.nodeShapes.get(`${EX}S`)!, languages: ["en"] });
    const term = primitiveToTerm(allFields(model)[0], raw, language)!;
    const session = await engine.createGraph(shapes, `${prefixes} ex:t a ex:T .`, "text/turtle", namedNode(`${EX}t`), namedNode(`${EX}S`));
    session.backend.add(namedNode(`${EX}t`), namedNode(`${EX}when`), term);
    const results = await engine.validate();
    expect(results.filter((r) => r.constraint === DATATYPE)).toEqual([]);
  });

  it("rdf:langString with no language chosen yet is written with an empty tag (known)", async () => {
    // `LangField` commits the text with the language picker's value, empty until one
    // is chosen. The literal is a langString with no tag, which is not a valid RDF
    // literal; the control lets it through and nothing reports it.
    const term = literal("Hola", "");
    expect(term).toMatchObject({ language: "", datatype: { value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString" } });
  });
});
