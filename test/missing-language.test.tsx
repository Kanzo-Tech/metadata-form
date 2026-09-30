import { describe, expect, it } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { buildFormModel, type Diagnostic } from "@/form/buildFormModel.js";
import { createRudofEngine } from "@/engine/index.js";
import { namedNode } from "@/form/factory.js";
import { allFields } from "@/form/FormModel.js";
import { resolveLanguage } from "@/form/terms.js";
import { MetadataForm } from "@/react/form/MetadataForm.js";
import { useMetadataForm } from "@/react/hooks/useMetadataForm.js";
import { evidenzeHealthShapes, evidenzeHealthRootShape } from "@examples/evidenze-health/index.js";

const EX = "http://example.org/";
const PREFIXES = `@prefix sh: <http://www.w3.org/ns/shacl#> . @prefix ex: <${EX}> . @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .`;
const lit = (value: string, language = "") => ({ value, language });

describe("resolveLanguage: the fallback does not depend on the order the literals were read in", () => {
  const es = lit("Nombre", "es");
  const ca = lit("Nom", "ca");
  const fr = lit("Nom", "fr");
  const plain = lit("Name");

  it("prefers an untagged literal, then the tags in code-point order", () => {
    for (const items of [[es, ca, fr], [fr, ca, es], [ca, fr, es]]) {
      expect(resolveLanguage(items, ["en"])).toEqual({ item: ca, fallback: true });
    }
    for (const items of [[es, plain, ca], [ca, es, plain]]) {
      expect(resolveLanguage(items, ["en"])).toEqual({ item: plain, fallback: true });
    }
  });

  it("is not a fallback when a range asks for the literal, whatever the order", () => {
    expect(resolveLanguage([es, ca], ["es"])).toEqual({ item: es, fallback: false });
    expect(resolveLanguage([ca, es], ["es", "ca"])).toEqual({ item: es, fallback: false });
    expect(resolveLanguage([lit("b", "en-US"), lit("a", "en-GB")], ["en"])?.item.value).toBe("a");
  });

  it("has nothing to say about no literals", () => {
    expect(resolveLanguage([], ["en"])).toBeUndefined();
  });
});

const shapesOnly = (order: "es-first" | "ca-first") => {
  const es = `sh:name "Nombre"@es ; sh:description "Ayuda"@es`;
  const ca = `sh:name "Nom"@ca ; sh:description "Ajuda"@ca`;
  return `${PREFIXES}
ex:S a sh:NodeShape ; sh:targetClass ex:T ; sh:property [ sh:path ex:p ; ${order === "es-first" ? `${es} ; ${ca}` : `${ca} ; ${es}`} ; sh:datatype xsd:string ; sh:maxCount 1 ] .`;
};

async function build(ttl: string, languages: string[]) {
  const shapes = await createRudofEngine().loadShapes(ttl);
  const diagnostics: Diagnostic[] = [];
  const model = buildFormModel({
    shapes,
    focusNode: namedNode(`${EX}x`),
    shape: shapes.nodeShapes.get(`${EX}S`)!,
    languages,
    onDiagnostic: (d) => diagnostics.push(d),
  });
  return { field: allFields(model)[0], diagnostics: diagnostics.filter((d) => d.code === "missing-language") };
}

describe("a text the reader's languages do not cover", () => {
  it("is the same text whatever order the Turtle wrote it in, marked with its language", async () => {
    const a = await build(shapesOnly("es-first"), ["en"]);
    const b = await build(shapesOnly("ca-first"), ["en"]);
    for (const { field } of [a, b]) {
      expect([field.label, field.labelLang, field.description, field.descriptionLang]).toEqual(["Nom", "ca", "Ajuda", "ca"]);
    }
  });

  it("is reported once per kind, with the languages asked for and the one shown", async () => {
    const { diagnostics } = await build(shapesOnly("es-first"), ["en", "fr"]);
    expect(diagnostics.map((d) => [d.level, d.message])).toEqual([
      ["info", "No name in en, fr for Nom; showing ca."],
      ["info", "No description in en, fr for Nom; showing ca."],
    ]);
    expect(diagnostics[0].detail).toBeDefined();
  });

  it("is neither marked nor reported when a language the reader asked for has it", async () => {
    const { field, diagnostics } = await build(shapesOnly("es-first"), ["en", "es"]);
    expect([field.label, field.labelLang, field.description, field.descriptionLang]).toEqual(["Nombre", undefined, "Ayuda", undefined]);
    expect(diagnostics).toEqual([]);
  });
});

describe("the Evidenze example read in a language it is not written in", () => {
  const read = async (language: string) => {
    const shapes = await createRudofEngine().loadShapes(evidenzeHealthShapes);
    const found: Diagnostic[] = [];
    buildFormModel({
      shapes,
      focusNode: namedNode("http://example.org/x"),
      shape: shapes.nodeShapes.get(evidenzeHealthRootShape)!,
      languages: [language],
      onDiagnostic: (d) => d.code === "missing-language" && found.push(d),
    });
    return found;
  };

  it("names every text lacking English, once, and none in Spanish", async () => {
    const en = await read("en");
    expect(en.length).toBeGreaterThan(0);
    expect(new Set(en.map((d) => `${d.detail}|${d.message}`)).size).toBe(en.length);
    expect(en.every((d) => /^No (name|description) in en for .+; showing (ca|es)\.$/.test(d.message))).toBe(true);
    expect(await read("es")).toEqual([]);
  });
});

let form!: ReturnType<typeof useMetadataForm>;
function Form({ locale }: { locale: string }) {
  form = useMetadataForm({
    shapes: `${PREFIXES} ex:S a sh:NodeShape ; sh:targetClass ex:T ; sh:property [ sh:path ex:p ; sh:name "Nombre"@es ; sh:description "Ayuda"@es ; sh:datatype xsd:string ; sh:minCount 1 ; sh:message "Obligatorio"@es ] .`,
    data: `${PREFIXES} ex:t a ex:T .`,
    rootShape: `${EX}S`,
    locale,
    validateOn: "manual",
  });
  return <MetadataForm form={form} />;
}

describe("the element that shows another language's text says which language it is", () => {
  it("sets lang on the label and the description, and says so once", async () => {
    render(<Form locale="en" />);
    await waitFor(() => expect(document.querySelector("[data-field]")).not.toBeNull());
    expect(document.querySelector("label")?.getAttribute("lang")).toBe("es");
    expect(document.querySelector('[data-slot="field-description"]')).toMatchObject({ lang: "es", textContent: "Ayuda" });
    expect(form.diagnostics.filter((d) => d.code === "missing-language").map((d) => d.message)).toEqual([
      "No name in en for Nombre; showing es.",
      "No description in en for Nombre; showing es.",
    ]);
  });

  it("hands over the language of a message nobody asked for, and reports it once however often it validates", async () => {
    render(<Form locale="en" />);
    await waitFor(() => expect(form.ready).toBe(true));
    let errors: Awaited<ReturnType<typeof form.validate>> = [];
    await act(async () => {
      errors = await form.validate();
    });
    await act(async () => {
      await form.validate();
    });
    expect(form.resolveMessage(errors[0])).toEqual({ text: "Obligatorio", lang: "es" });
    const found = form.diagnostics.filter((d) => d.message.startsWith("No message"));
    expect(found.map((d) => d.message)).toEqual(["No message in en for Nombre; showing es."]);
    expect(found[0]).toMatchObject({ level: "info", code: "missing-language" });
  });

  it("leaves lang off when the reader's language has the text", async () => {
    render(<Form locale="es" />);
    await waitFor(() => expect(form.ready).toBe(true));
    expect(document.querySelector("[lang]")).toBeNull();
    let errors: Awaited<ReturnType<typeof form.validate>> = [];
    await act(async () => {
      errors = await form.validate();
    });
    expect(form.resolveMessage(errors[0])).toEqual({ text: "Obligatorio", lang: undefined });
    expect(form.diagnostics.filter((d) => d.code === "missing-language")).toEqual([]);
  });
});
