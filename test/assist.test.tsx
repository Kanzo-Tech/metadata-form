import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Term } from "@rdfjs/types";
import { AssistProvider } from "@kanzo-tech/ai";
import { assistTranslations, assistUi, fieldContext, siblingValues } from "@/ai/index.js";
import { mockModel, promptOf } from "./support/model.js";
import { MetadataForm } from "@/react/form/MetadataForm.js";
import { useMetadataForm } from "@/react/hooks/useMetadataForm.js";
import { Companion } from "@playground/components/Companion.js";
import { literal, namedNode, NS } from "@/form/factory.js";
import { es } from "@/i18n/index.js";
import type { FieldModel } from "@/form/FormModel.js";
import type { GraphState } from "@/engine/GraphState.js";
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
  it("imports neither @kanzo-tech/ai, @kanzo-tech/llm, ai nor @ai-sdk anywhere outside src/ai", () => {
    const AI_PACKAGE = /(?:from|import)\s*\(?\s*["'](?:@kanzo-tech\/(?:ai|llm)(?:\/[^"']*)?|ai|@ai-sdk\/[^"']*)["']/;
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

function Form({ withUi, locale, model }: { withUi: boolean; locale?: string; model: ReturnType<typeof mockModel> }) {
  const form = useMetadataForm({
    shapes: SHAPES,
    data: DATA,
    focusNode: "http://example.org/t1",
    rootShape: "http://example.org/Shape",
    validateOn: "off",
    locale,
    strings: { es: es.strings },
  });
  return (
    <AssistProvider model={model} translations={assistTranslations(form.strings)}>
      <MetadataForm form={form} assistUi={withUi ? assistUi : undefined} />
    </AssistProvider>
  );
}

const areas = () => Array.from(document.querySelectorAll("textarea"));

describe("assistance UI is opt-in", () => {
  it("without assistUi the controls are plain, no ✨ is drawn and the model is never asked", async () => {
    const model = mockModel(() => " the rest");
    render(<Form model={model} withUi={false} />);
    await waitFor(() => expect(areas()).toHaveLength(2));

    expect(document.querySelector('[data-slot="assist"]')).toBeNull();
    fireEvent.change(areas()[1], { target: { value: "Some notes." } });
    await new Promise((r) => setTimeout(r, 900));
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it("with assistUi every free-text control is assisted, and a textarea is continued at the caret", async () => {
    const model = mockModel(() => " the rest");
    render(<Form model={model} withUi />);
    await waitFor(() => expect(areas()).toHaveLength(2));
    // Title (an input), Summary (a textarea with a language) and Notes (a textarea).
    expect(document.querySelectorAll('[data-slot="assist"]')).toHaveLength(3);

    const summary = areas().find((a) => a.value === "Hello world")!;
    fireEvent.change(summary, { target: { value: "Hello world.", selectionStart: 12 } });
    await waitFor(() => expect(model.doStreamCalls).toHaveLength(1), { timeout: 3000 });

    fireEvent.keyDown(summary, { key: "Tab" });
    await waitFor(() => expect(summary.value).toContain("the rest"));
  });

  it("tells the model what the shape says about the field, and the record around it", async () => {
    const model = mockModel(() => " the rest");
    render(<Form model={model} withUi />);
    await waitFor(() => expect(areas()).toHaveLength(2));
    const summary = areas().find((a) => a.value === "Hello world")!;
    fireEvent.change(summary, { target: { value: "Hello world.", selectionStart: 12 } });
    await waitFor(() => expect(model.doStreamCalls).toHaveLength(1), { timeout: 3000 });

    const prompt = promptOf(model.doStreamCalls[0]!);
    expect(prompt).toContain("Field context:");
    expect(prompt).toContain("Value type: langString");
    expect(prompt).toContain("notes: Some notes");
    expect(prompt).toMatch(/Write in the language tagged "en(-[A-Z]+)?"\./);
  });

  it("words the ✨ in the reader's language", async () => {
    render(<Form locale="es" model={mockModel(() => "")} withUi />);
    await waitFor(() => expect(areas()).toHaveLength(2));
    expect(screen.getAllByRole("button", { name: es.strings.assist.assist }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "AI assist" })).toBeNull();
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
    editorSource: "fallback",
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
    expect(fieldContext(field({ label: "Note" }))).toBe("Cardinality: optional, one value");
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

describe("the bounds of a prompt are options", () => {
  const many = field({
    values: [{ id: "a", value: literal("y".repeat(30)) }],
    repeatable: true,
    constraints: { options: ["A", "B", "C", "D"].map((l) => ({ value: namedNode(`http://e/${l}`), label: l })) },
  });

  it("lists as many options and characters as asked, and says how many were left out", () => {
    const text = fieldContext(many, { maxOptions: 2, maxValue: 10 });
    expect(text).toContain("Allowed values: A, B, … (2 more)");
    expect(text).toContain(`Values already entered: ${"y".repeat(10)}…`);
    expect(fieldContext(many)).toContain("Allowed values: A, B, C, D");
  });

  it("stops at maxSiblings", () => {
    const me = namedNode("http://example.org/d1");
    const graph = {
      allQuads: () => ["a", "b", "c"].map((n) => ({ subject: me, predicate: namedNode(`http://e/${n}`), object: literal(n) })),
    } as unknown as GraphState;
    expect(siblingValues({ graph, focus: me, field: field({}) }, { maxSiblings: 2 }).split("\n")).toEqual(["a: a", "b: b"]);
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
