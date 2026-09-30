import { describe, it, expect } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MetadataForm } from "@/react/form/MetadataForm.js";
import { useMetadataForm, type UseMetadataFormOptions } from "@/react/hooks/useMetadataForm.js";

const ex = "http://example.org/";
const options = Array.from({ length: 20 }, (_, i) => `"option-${i}"`).join(" ");
const shapes = `
  @prefix sh: <http://www.w3.org/ns/shacl#> . @prefix ex: <${ex}> . @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
  ex:S a sh:NodeShape ; sh:targetClass ex:Thing ;
    sh:property [ sh:path ex:link ; sh:name "Link" ; sh:class ex:Cls ; sh:nodeKind sh:IRI ; sh:maxCount 1 ] ;
    sh:property [ sh:path ex:links ; sh:name "Links" ; sh:class ex:Cls ; sh:nodeKind sh:IRI ] ;
    sh:property [ sh:path ex:kind ; sh:name "Kind" ; sh:in ( ${options} ) ; sh:maxCount 1 ] ;
    sh:property [ sh:path ex:kinds ; sh:name "Kinds" ; sh:in ( ${options} ) ] ;
    sh:property [ sh:path ex:title ; sh:name "Title" ; sh:datatype rdf:langString ; sh:maxCount 1 ; sh:languageIn ( "en" "es" ) ] .
`;

const found = [
  { value: `${ex}a`, label: "Alpha" },
  { value: `${ex}b`, label: "Beta" },
];

let form!: ReturnType<typeof useMetadataForm>;
function Form(props: Partial<UseMetadataFormOptions>) {
  form = useMetadataForm({ shapes, rootShape: `${ex}S`, validateOn: "off", ...props });
  return <MetadataForm form={form} />;
}

const objects = (predicate: string) =>
  form.quads.filter((q) => q.predicate.value === `${ex}${predicate}`).map((q) => q.object.value).sort();

const fieldOf = (predicate: string) => document.querySelector<HTMLElement>(`[data-field$="|${ex}${predicate}"]`)!;
const inputOf = (predicate: string) => fieldOf(predicate).querySelector<HTMLInputElement>("input")!;
// Ark's Combobox drops characters under `userEvent.type` in jsdom; a change event carries the text whole.
const type = (input: HTMLInputElement, text: string) => {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: text } });
};

describe("the reference combobox (assist.search)", () => {
  const search = async ({ query }: { query: string }) =>
    found.filter((f) => f.label.toLowerCase().includes(query.toLowerCase()));

  it("commits an IRI nobody suggested once typing pauses, not per keystroke", async () => {
    render(<Form assist={{ search }} />);
    await waitFor(() => expect(screen.getByText("Link")).toBeInTheDocument());

    type(inputOf("link"), `${ex}typed`);
    expect(objects("link")).toEqual([]);
    await waitFor(() => expect(objects("link")).toEqual([`${ex}typed`]));
  });

  it("commits at once on blur, so the last characters survive the control going away", async () => {
    render(<Form assist={{ search }} />);
    await waitFor(() => expect(screen.getByText("Link")).toBeInTheDocument());

    const input = inputOf("link");
    type(input, `${ex}blur`);
    // The machine takes the typed text a microtask later.
    await act(() => Promise.resolve());
    fireEvent.blur(input);
    // Well inside the pause a keystroke would have waited.
    await waitFor(() => expect(objects("link")).toEqual([`${ex}blur`]), { timeout: 150 });
  });

  it("lists what the search returned and commits a pick", async () => {
    render(<Form assist={{ search }} />);
    await waitFor(() => expect(screen.getByText("Link")).toBeInTheDocument());

    const input = inputOf("link");
    fireEvent.focus(input);
    fireEvent.click(input);
    const beta = await screen.findByRole("option", { name: "Beta" }, { timeout: 3000 });
    fireEvent.click(beta);
    await waitFor(() => expect(objects("link")).toEqual([`${ex}b`]));
  });

  it("holds a repeatable reference as one control, with a chip per value that removes it", async () => {
    render(<Form assist={{ search }} />);
    await waitFor(() => expect(screen.getByText("Links")).toBeInTheDocument());

    const input = inputOf("links");
    fireEvent.focus(input);
    fireEvent.click(input);
    fireEvent.click(await screen.findByRole("option", { name: "Alpha" }, { timeout: 3000 }));
    await waitFor(() => expect(objects("links")).toEqual([`${ex}a`]));

    const chip = await waitFor(() => {
      const c = fieldOf("links").querySelector<HTMLButtonElement>('button[title]');
      expect(c).not.toBeNull();
      return c!;
    });
    expect(chip).toHaveTextContent("Alpha");
    fireEvent.click(chip);
    await waitFor(() => expect(objects("links")).toEqual([]));
  });
});

describe("an enumeration too long for a select", () => {
  it("is a combobox that filters the values the shape lists, and commits a pick", async () => {
    render(<Form />);
    await waitFor(() => expect(screen.getByText("Kind")).toBeInTheDocument());
    expect(fieldOf("kind").querySelector("select")).toBeNull();

    const input = inputOf("kind");
    type(input, "option-1");
    // option-1, option-10 … option-19
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(11));
    fireEvent.click(screen.getByRole("option", { name: "option-17" }));
    await waitFor(() => expect(objects("kind")).toEqual(["option-17"]));
  });

  it("says so when nothing matches", async () => {
    render(<Form />);
    await waitFor(() => expect(screen.getByText("Kinds")).toBeInTheDocument());
    const input = inputOf("kinds");
    type(input, "zzz");
    await waitFor(() => expect(screen.getByText("No matches")).toBeInTheDocument());
  });
});

describe("the language tag of a langString", () => {
  it("offers exactly sh:languageIn, and tags the text when one is picked", async () => {
    render(<Form />);
    await waitFor(() => expect(screen.getByText("Title")).toBeInTheDocument());

    const [text, tag] = fieldOf("title").querySelectorAll<HTMLInputElement>("input");
    expect(tag).toBeDisabled(); // nothing to tag yet
    type(text, "Hola");
    await act(() => new Promise((r) => setTimeout(r, 400)));
    await waitFor(() => expect(tag).not.toBeDisabled());

    fireEvent.focus(tag);
    fireEvent.click(tag);
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["English · en", "Español · es"]);
    fireEvent.click(screen.getByRole("option", { name: "Español · es" }));
    await waitFor(() => expect(form.quads.some((q) => q.predicate.value === `${ex}title` && (q.object as { language?: string }).language === "es")).toBe(true));
  });
});
