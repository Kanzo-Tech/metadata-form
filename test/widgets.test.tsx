import { describe, it, expect } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MetadataForm } from "@/react/form/MetadataForm.js";
import { useMetadataForm, type UseMetadataFormOptions } from "@/react/hooks/useMetadataForm.js";
import { AssistProvider } from "@kanzo-tech/ai";
import { assistTranslations, assistUi } from "@/ai/index.js";
import { resolveStrings } from "@/i18n/strings.js";
import { mockModel } from "./support/model.js";
import type { AssistUi } from "@/react/assistUi.js";
import { es } from "metadata-form/i18n";
import { Editors } from "@/form/vocab/shacl-ui.js";
import { defaultWidgets } from "@/react/widgets/defaultWidgets.js";

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
    sh:property [ sh:path ex:dates ; sh:name "Dates" ; sh:datatype xsd:date ] ;
    sh:property [ sh:path ex:title ; sh:name "Title" ; sh:datatype rdf:langString ; sh:maxCount 1 ; sh:languageIn ( "en" "es" ) ] .
`;

const found = [
  { value: `${ex}a`, label: "Alpha" },
  { value: `${ex}b`, label: "Beta" },
];

let form!: ReturnType<typeof useMetadataForm>;
function Form({ assistUi, ...props }: Partial<UseMetadataFormOptions> & { assistUi?: AssistUi }) {
  form = useMetadataForm({ shapes, rootShape: `${ex}S`, validateOn: "off", ...props });
  return <MetadataForm form={form} assistUi={assistUi} />;
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
  const tagged = (language: string) =>
    form.quads.some((q) => q.predicate.value === `${ex}title` && (q.object as { language?: string }).language === language);

  it("offers exactly sh:languageIn, and tags the text when one is picked", async () => {
    render(<Form />);
    await waitFor(() => expect(screen.getByText("Title")).toBeInTheDocument());

    const [text, tag] = fieldOf("title").querySelectorAll<HTMLInputElement>("input");
    type(text, "Hola");
    await act(() => new Promise((r) => setTimeout(r, 400)));

    fireEvent.focus(tag);
    fireEvent.click(tag);
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["English · en", "Español · es"]);
    fireEvent.click(screen.getByRole("option", { name: "Español · es" }));
    await waitFor(() => expect(tagged("es")).toBe(true));
  });

  it("can be chosen before there is any text, and the text then carries it", async () => {
    render(<Form />);
    await waitFor(() => expect(screen.getByText("Title")).toBeInTheDocument());

    const [text, tag] = fieldOf("title").querySelectorAll<HTMLInputElement>("input");
    expect(tag).not.toBeDisabled();
    fireEvent.focus(tag);
    fireEvent.click(tag);
    fireEvent.click(await screen.findByRole("option", { name: "Español · es" }));
    expect(form.quads.some((q) => q.predicate.value === `${ex}title`)).toBe(false); // a tag alone is not a value

    type(text, "Hola");
    await waitFor(() => expect(tagged("es")).toBe(true), { timeout: 3000 });
  });
});

describe("the findings a value survives", () => {
  const advisory = `
    @prefix sh: <http://www.w3.org/ns/shacl#> . @prefix ex: <${ex}> .
    ex:S a sh:NodeShape ; sh:targetClass ex:Thing ;
      sh:property [ sh:path ex:note ; sh:name "Note" ; sh:maxCount 1 ; sh:minLength 5 ; sh:severity sh:Warning ] .
  `;

  it("are the field's helper, toned by severity, and do not invalidate the field", async () => {
    render(<Form shapes={advisory} validateOn="change" />);
    await waitFor(() => expect(screen.getByText("Note")).toBeInTheDocument());

    type(inputOf("note"), "hi");
    fireEvent.blur(inputOf("note"));
    const helper = await waitFor(() => {
      const h = fieldOf("note").querySelector('[data-slot="field-helper"]');
      expect(h).not.toBeNull();
      return h!;
    }, { timeout: 3000 });
    expect(helper).toHaveAttribute("data-tone", "warning");
    expect(helper.querySelector('[data-severity="warning"]')).not.toBeNull();
    expect(fieldOf("note")).not.toHaveAttribute("data-invalid");
  });
});

describe("the layouts", () => {
  it("labels the steps' Back and Next", async () => {
    function Steps() {
      form = useMetadataForm({ shapes, rootShape: `${ex}S`, validateOn: "off" });
      return <MetadataForm form={form} layout="steps" />;
    }
    render(<Steps />);
    await waitFor(() => expect(screen.getByText("Link")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("counts a step's issues without putting a button inside the step's own", async () => {
    const required = `
      @prefix sh: <http://www.w3.org/ns/shacl#> . @prefix ex: <${ex}> .
      ex:S a sh:NodeShape ; sh:targetClass ex:Thing ;
        sh:property [ sh:path ex:name ; sh:name "Name" ; sh:minCount 1 ] .`;
    function Steps() {
      form = useMetadataForm({ shapes: required, rootShape: `${ex}S`, validateOn: "change" });
      return <MetadataForm form={form} layout="steps" />;
    }
    render(<Steps />);
    await waitFor(() => expect(screen.getByLabelText("1 issue")).toBeInTheDocument(), { timeout: 3000 });
    expect(document.querySelectorAll("button button")).toHaveLength(0);
  });

  it("lays a group out in the design system's columns, a field spanning as many as it asks", async () => {
    function Grid() {
      form = useMetadataForm({ shapes, rootShape: `${ex}S`, validateOn: "off" });
      return <MetadataForm form={form} grid={{ columns: 3, spans: { [`${ex}title`]: 2 } }} />;
    }
    render(<Grid />);
    await waitFor(() => expect(screen.getByText("Link")).toBeInTheDocument());
    const group = document.querySelector('[data-slot="field-group"]')!;
    expect(group).toHaveClass("grid-cols-3");
    expect(fieldOf("title").parentElement).toHaveClass("col-span-2");
    expect(fieldOf("link").parentElement).not.toHaveClass("col-span-2");
  });
});

describe("the words of the parts the design system draws", () => {
  const spanish = { locale: "es", strings: { es: es.strings } };

  it("reach the row buttons of a repeatable field", async () => {
    render(<Form {...spanish} />);
    await waitFor(() => expect(screen.getByText("Dates")).toBeInTheDocument());
    fireEvent.click(within(fieldOf("dates")).getByRole("button", { name: es.strings.chrome.addRow }));
    expect(await within(fieldOf("dates")).findByRole("button", { name: es.strings.chrome.remove })).toBeInTheDocument();
    expect(within(fieldOf("dates")).queryByText("Add")).toBeNull();
  });

  it("reach the ✨, through assistUi", async () => {
    render(
      <AssistProvider model={mockModel(() => "")} translations={assistTranslations(resolveStrings(["es"], { es: es.strings }))}>
        <Form {...spanish} assistUi={assistUi} />
      </AssistProvider>,
    );
    await waitFor(() => expect(screen.getByText("Title")).toBeInTheDocument());
    expect(screen.getAllByRole("button", { name: es.strings.assist.assist }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "AI assist" })).toBeNull();
  });
});

describe("the default registry", () => {
  it("has a control for every editor the engine can emit", () => {
    // The sixteen editors of the SHACL-UI Editor's Draft. The two that stand for a
    // resource with a shape of its own are drawn as a nested form, not a widget.
    const nested: string[] = [Editors.Details, Editors.BlankNode];
    const widgets = Object.values(Editors).filter((e) => !nested.includes(e));
    expect(Object.values(Editors)).toHaveLength(16);
    expect(widgets.filter((e) => !(e in defaultWidgets))).toEqual([]);
  });
});
