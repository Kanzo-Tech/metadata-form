import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { Term } from "@rdfjs/types";
import { assistUi, fieldContext, siblingValues } from "@/ai/index.js";
import { MetadataForm } from "@/react/form/MetadataForm.js";
import { useMetadataForm } from "@/react/hooks/useMetadataForm.js";
import { Companion } from "@playground/components/Companion.js";
import { literal, namedNode, NS } from "@/form/factory.js";
import type { FieldModel } from "@/form/FormModel.js";
import type { GraphState } from "@/engine/GraphState.js";
import type { FormAssist } from "@/assist.js";
import type { FormReport } from "@/react/validation/formReport.js";

const SRC = resolve(__dirname, "../src");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "ai" && dir === SRC ? [] : sources(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
}

describe("the core carries no AI layer", () => {
  it("imports neither @kanzo-tech/ai, ai nor zod anywhere outside src/ai", () => {
    const AI_PACKAGE = /(?:from|import)\s*\(?\s*["'](?:@kanzo-tech\/ai(?:\/[^"']*)?|ai|zod)["']/;
    const importers = sources(SRC).filter((f) => AI_PACKAGE.test(readFileSync(f, "utf8")));
    expect(importers.map((f) => relative(SRC, f))).toEqual([]);
  });

  it("does not import the ai subpath either", () => {
    const TO_AI = /from\s+["'](?:\.\.?\/)+ai\//;
    const importers = sources(SRC).filter((f) => TO_AI.test(readFileSync(f, "utf8")));
    expect(importers.map((f) => relative(SRC, f))).toEqual([]);
  });
});

const SHAPES = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix shui: <http://www.w3.org/ns/shacl-ui/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix ex: <http://example.org/> .

ex:Shape a sh:NodeShape ; sh:targetClass ex:Thing ;
  sh:property [ sh:path ex:title ; sh:name "Title"@en ; sh:datatype xsd:string ; sh:maxCount 1 ] ;
  sh:property [ sh:path ex:summary ; sh:name "Summary"@en ; sh:datatype rdf:langString ;
                sh:maxCount 1 ; shui:editor shui:TextAreaWithLangEditor ] ;
  sh:property [ sh:path ex:notes ; sh:name "Notes"@en ; sh:datatype xsd:string ;
                sh:maxCount 1 ; shui:editor shui:TextAreaEditor ] .
`;
const DATA = `
@prefix ex: <http://example.org/> .
ex:t1 a ex:Thing ; ex:summary "Hello world"@en ; ex:notes "Some notes" .`;

/** A fake seam: async generators, so the streaming path is the real one. */
const calls: string[] = [];
const fake: FormAssist = {
  suggest: async function* ({ field }) {
    calls.push(`suggest:${field.label}`);
    yield { value: `Suggested ${field.label}` };
  },
  complete: async function* ({ field }) {
    calls.push(`complete:${field.label}`);
    yield "the";
    yield " rest";
  },
};

function Form({ withUi }: { withUi: boolean }) {
  const form = useMetadataForm({
    shapes: SHAPES,
    data: DATA,
    focusNode: "http://example.org/t1",
    rootShape: "http://example.org/Shape",
    validateOn: "off",
    assist: fake,
  });
  return <MetadataForm form={form} assistUi={withUi ? assistUi : undefined} />;
}

const areas = () => Array.from(document.querySelectorAll("textarea"));

describe("assistance UI is opt-in", () => {
  it("without assistUi the textareas are plain, no ✨ is drawn and the seam is never asked", async () => {
    calls.length = 0;
    render(<Form withUi={false} />);
    await waitFor(() => expect(areas()).toHaveLength(2));

    expect(document.querySelector('[data-slot="complete"]')).toBeNull();
    expect(screen.queryAllByRole("button", { name: "Suggest" })).toHaveLength(0);

    fireEvent.change(areas()[1], { target: { value: "Some notes." } });
    await new Promise((r) => setTimeout(r, 900));
    expect(document.body.textContent).not.toContain("the rest");
    expect(calls).toEqual([]);
  });

  it("with assistUi a text field gets its ✨ and a pick commits", async () => {
    render(<Form withUi />);
    await waitFor(() => expect(screen.getByText("Title")).toBeInTheDocument());

    const title = document.querySelector('[data-field$="|http://example.org/title"]')!;
    const mark = within(title as HTMLElement).getByRole("button", { name: "Suggest" });
    mark.focus();
    fireEvent.focus(mark);
    fireEvent.click(mark);
    fireEvent.click(await screen.findByText("Suggested Title"));

    await waitFor(() => expect(title.querySelector("input")?.value).toBe("Suggested Title"));
  });

  it("with assistUi both TextArea and TextAreaWithLang stream ghost text", async () => {
    render(<Form withUi />);
    await waitFor(() => expect(areas()).toHaveLength(2));
    expect(document.querySelectorAll('[data-slot="complete"]')).toHaveLength(2);

    // TextAreaWithLang is the first of the two (declared first, same order).
    const lang = areas().find((a) => a.value === "Hello world")!;
    fireEvent.change(lang, { target: { value: "Hello world." } });
    await waitFor(() => expect(document.body.textContent).toContain("the rest"), { timeout: 3000 });
    expect(calls).toContain("complete:Summary");

    fireEvent.keyDown(lang, { key: "Tab" });
    await waitFor(() => expect(lang.value).toContain("the rest"));
  });
});

/** A field as the model hands it over — only what the test is about is set. */
function field(over: Partial<FieldModel> & { constraints?: FieldModel["constraints"] }): FieldModel {
  return {
    id: "urn:f|http://example.org/p",
    path: namedNode("http://example.org/p"),
    pathKind: "predicate",
    label: "Field",
    editorId: "http://www.w3.org/ns/shacl-ui/TextFieldEditor",
    required: false,
    repeatable: false,
    minCount: 0,
    order: 0,
    groupId: "g",
    constraints: {},
    values: [],
    ...over,
  };
}

describe("fieldContext", () => {
  it("says only what the field states", () => {
    expect(fieldContext(field({ label: "Note" }))).toBe("Field: Note\nCardinality: optional, one value");
  });

  it("reads a required, bounded, patterned string", () => {
    const text = fieldContext(
      field({
        label: "Title",
        description: "A name given to the dataset.",
        required: true,
        minCount: 1,
        maxCount: 1,
        constraints: { datatype: `${NS.xsd}string`, minLength: 3, maxLength: 80, pattern: "^[A-Z]", flags: "i" },
      }),
    );
    expect(text).toBe(
      [
        "Field: Title",
        "Description: A name given to the dataset.",
        "Value type: string",
        "Must match the regular expression: ^[A-Z] (flags i)",
        "Length: 3 to 80 characters",
        "Cardinality: exactly one value",
      ].join("\n"),
    );
  });

  it("reads numeric bounds, allowed languages and enumerations", () => {
    expect(
      fieldContext(field({ constraints: { datatype: `${NS.xsd}integer`, minInclusive: 0, maxExclusive: 100 } })),
    ).toContain("Range: at least 0, less than 100");
    expect(
      fieldContext(field({ constraints: { languageIn: ["en", "es"], uniqueLang: true } })),
    ).toContain("Language tags allowed: en, es\nAt most one value per language");
    const options = fieldContext(
      field({ constraints: { options: [{ value: namedNode("http://e/A"), label: "Alpha" }, { value: namedNode("http://e/B") }] } }),
    );
    expect(options).toContain("Allowed values: Alpha, http://e/B");
  });

  it("reads a repeatable reference with what is already there", () => {
    const text = fieldContext(
      field({
        repeatable: true,
        minCount: 1,
        maxCount: 5,
        constraints: { classIri: "http://www.w3.org/2004/02/skos/core#Concept" },
        values: [{ id: "a", value: namedNode("http://e/x") }, { id: "b", value: null }],
      }),
    );
    expect(text).toContain("Value type: Concept");
    expect(text).toContain("Cardinality: at least 1, at most 5 values");
    expect(text).toContain("Values already entered: http://e/x");
  });
});

describe("siblingValues", () => {
  const me = namedNode("http://example.org/d1");
  const q = (s: Term, p: string, o: Term) => ({ subject: s, predicate: namedNode(p), object: o });
  const graph = {
    allQuads: () => [
      q(me, "http://purl.org/dc/terms/title", literal("Cardiology Registry")),
      q(me, "http://purl.org/dc/terms/description", literal("x".repeat(300))),
      q(me, "http://example.org/p", literal("the field itself")),
      q(me, "http://www.w3.org/ns/dcat#theme", namedNode("http://e/theme")),
      q(namedNode("http://example.org/other"), "http://purl.org/dc/terms/title", literal("Someone else")),
    ],
  } as unknown as GraphState;

  it("lists the literals of the same node, bounded, without the field's own values", () => {
    const text = siblingValues({ graph, focus: me, field: field({}) });
    expect(text.split("\n")).toEqual(["title: Cardiology Registry", `description: ${"x".repeat(200)}…`]);
  });
});

describe("the playground companion", () => {
  it("names the next required field and reveals it on press", () => {
    const revealed: string[] = [];
    const report: FormReport = {
      progress: { filled: 0, total: 2, requiredFilled: 0, requiredTotal: 2 },
      issues: { total: 0, hasViolations: false, rows: [], byField: new Map(), byGroup: new Map() },
      pending: [{ id: "f1", label: "Title" }],
      nextField: { id: "f1", label: "Title" },
      health: { mood: "guiding", count: 2 },
    };
    render(<Companion report={report} onReveal={(id) => revealed.push(id)} onDismiss={() => {}} offset="1rem" />);
    expect(screen.getByText("Required fields left: 2")).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Next: Title/));
    expect(revealed).toEqual(["f1"]);
  });
});
