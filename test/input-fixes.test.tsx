import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MetadataForm } from "@/react/form/MetadataForm.js";
import { useMetadataForm } from "@/react/hooks/useMetadataForm.js";
import { createRudofEngine } from "@/engine/index.js";
import { namedNode } from "@/form/factory.js";
import { primitiveToTerm } from "@/form/termBinding.js";
import { allFields } from "@/form/FormModel.js";
import { buildFormModel } from "@/form/buildFormModel.js";

const EX = "http://example.org/";
const prefixes = `@prefix sh: <http://www.w3.org/ns/shacl#> . @prefix ex: <${EX}> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> . @prefix shui: <http://www.w3.org/ns/shacl-ui/> .`;
const shapeWith = (property: string) =>
  `${prefixes} ex:S a sh:NodeShape ; sh:targetClass ex:T ; sh:property [ ${property} ] .`;

async function fieldOf(property: string) {
  const engine = createRudofEngine();
  const shapes = await engine.loadShapes(shapeWith(property));
  const model = buildFormModel({ shapes, focusNode: namedNode(`${EX}t`), shape: shapes.nodeShapes.get(`${EX}S`)!, languages: ["en"] });
  return allFields(model)[0];
}

let form!: ReturnType<typeof useMetadataForm>;
function Form({ shapes }: { shapes: string }) {
  form = useMetadataForm({ shapes, rootShape: `${EX}S`, validateOn: "off" });
  return <MetadataForm form={form} />;
}
const inputOf = (local: string) =>
  document.querySelector(`[data-field$="|${EX}${local}"]`)!.querySelector("input")!;
const objects = (local: string) =>
  form.quads.filter((q) => q.predicate.value === `${EX}${local}`).map((q) => q.object.value).sort();

describe("a language picked for a text the shape does not type as rdf:langString (A20)", () => {
  const title = `sh:path ex:title ; sh:nodeKind sh:Literal ; shui:editor shui:TextFieldWithLangEditor`;

  it("is the text's tag", async () => {
    const field = await fieldOf(title);
    expect(primitiveToTerm(field, "Registro de diabetes", "es")).toMatchObject({ termType: "Literal", value: "Registro de diabetes", language: "es" });
  });

  it("is no tag at all while none is picked", async () => {
    const field = await fieldOf(title);
    expect(primitiveToTerm(field, "Registro de diabetes", "")).toMatchObject({ termType: "Literal", language: "" });
  });
});

describe("a value typed where the shape takes a blank node or an IRI and builds no block (A15)", () => {
  const source = `sh:path ex:source ; sh:nodeKind sh:BlankNodeOrIRI`;

  it("is an address when it is one, without the spaces around it", async () => {
    const field = await fieldOf(source);
    expect(primitiveToTerm(field, " https://example.org/s ")).toMatchObject({ termType: "NamedNode", value: "https://example.org/s" });
  });

  it("stays the text it is otherwise", async () => {
    const field = await fieldOf(source);
    expect(primitiveToTerm(field, "registro")).toMatchObject({ termType: "Literal", value: "registro" });
  });
});

describe("a box that asks for an address, once left", () => {
  it("shows the address as it was saved, even when the spaces changed nothing", async () => {
    render(<Form shapes={shapeWith(`sh:path ex:page ; sh:name "Page" ; sh:nodeKind sh:IRI ; sh:maxCount 1`)} />);
    await waitFor(() => expect(screen.getByText("Page")).toBeInTheDocument());

    fireEvent.change(inputOf("page"), { target: { value: "https://example.org/a" } });
    fireEvent.blur(inputOf("page"));
    await waitFor(() => expect(objects("page")).toEqual(["https://example.org/a"]));

    fireEvent.change(inputOf("page"), { target: { value: "https://example.org/a   " } });
    fireEvent.blur(inputOf("page"));
    await waitFor(() => expect(inputOf("page").value).toBe("https://example.org/a"));
    expect(objects("page")).toEqual(["https://example.org/a"]);
  });
});

describe("a list pasted into a box of tags (A14)", () => {
  it("is a tag per item, as when it is typed", async () => {
    render(<Form shapes={shapeWith(`sh:path ex:keyword ; sh:name "Keywords" ; sh:datatype xsd:string`)} />);
    await waitFor(() => expect(screen.getByText("Keywords")).toBeInTheDocument());

    const input = inputOf("keyword");
    fireEvent.focus(input);
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.input(input, { target: { value: "diabetes, registry, HbA1c" }, inputType: "insertFromPaste" });
    await waitFor(() => expect(objects("keyword")).toEqual(["HbA1c", "diabetes", "registry"]));
  });
});


describe("a row added with + Add", () => {
  const alt = `sh:path ex:alt ; sh:name "Alt" ; sh:nodeKind sh:Literal ; shui:editor shui:TextFieldWithLangEditor`;

  it("has the caret in it, so it is written in without a second click", async () => {
    render(<Form shapes={shapeWith(alt)} />);
    await waitFor(() => expect(screen.getByText("Alt")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    await waitFor(() => expect(document.activeElement).toBe(inputOf("alt")));
  });

  it("shows the language picked at the first pick", async () => {
    render(<Form shapes={shapeWith(alt)} />);
    await waitFor(() => expect(screen.getByText("Alt")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    const tagOf = () => document.querySelector(`[data-field$="|${EX}alt"]`)!.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    await waitFor(() => expect(tagOf()).not.toBeNull());
    fireEvent.focus(tagOf());
    fireEvent.click(tagOf());
    fireEvent.click(await screen.findByRole("option", { name: "Español · es" }));
    await waitFor(() => expect(tagOf()).toHaveValue("Español · es"));
  });
});