import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, render, waitFor } from "@testing-library/react";
import { buildFormModel } from "@/form/buildFormModel.js";
import { createRudofEngine } from "@/engine/index.js";
import { allFields } from "@/form/FormModel.js";
import { namedNode } from "@/form/factory.js";
import { humanise, matchesLanguage, pickByLanguage } from "@/form/terms.js";
import { resolveLanguages } from "@/i18n/languages.js";
import { EN, type DeepPartial, type Strings } from "@/i18n/strings.js";
import { MetadataForm } from "@/react/form/MetadataForm.js";
import { ValidationSummary } from "@/react/validation/ValidationSummary.js";
import { ValidationPanel } from "@/react/validation/ValidationPanel.js";
import { useMetadataForm } from "@/react/hooks/useMetadataForm.js";

describe("language tags and ranges (RFC 4647 §3.3.1, basic filtering)", () => {
  it("matches a tag that equals the range or extends it at a `-` boundary, case-insensitively", () => {
    expect(matchesLanguage("en", "en")).toBe(true);
    expect(matchesLanguage("en-US", "en")).toBe(true);
    expect(matchesLanguage("EN-us", "en")).toBe(true);
    expect(matchesLanguage("en-Latn-US", "en-Latn")).toBe(true);
  });

  it("does not match a shorter tag, a longer range, or a mere string prefix", () => {
    expect(matchesLanguage("en", "en-US")).toBe(false);
    expect(matchesLanguage("eng", "en")).toBe(false);
    expect(matchesLanguage("de", "en")).toBe(false);
  });

  it("takes `*` for any tagged literal and the empty range for the untagged one", () => {
    expect(matchesLanguage("fr", "*")).toBe(true);
    expect(matchesLanguage("", "*")).toBe(false);
    expect(matchesLanguage("", "")).toBe(true);
    expect(matchesLanguage("en", "")).toBe(false);
  });
});

describe("pickByLanguage: one ordered list, one function", () => {
  const items = [
    { value: "Name", language: "en" },
    { value: "Nom", language: "fr-CA" },
    { value: "Nombre", language: "es" },
    { value: "plain", language: "" },
  ];

  it("prefers the earlier language of the list, not the earlier literal", () => {
    expect(pickByLanguage(items, ["es", "en"])?.value).toBe("Nombre");
    expect(pickByLanguage(items, ["en", "es"])?.value).toBe("Name");
  });

  it("takes a regional literal for its base-language range", () => {
    expect(pickByLanguage(items, ["fr"])?.value).toBe("Nom");
  });

  it("falls back to the untagged literal, then to any", () => {
    expect(pickByLanguage(items, ["de"])?.value).toBe("plain");
    expect(pickByLanguage(items.slice(0, 3), ["de"])?.value).toBe("Name");
    expect(pickByLanguage([], ["en"])).toBeUndefined();
  });
});

describe("the application's language list", () => {
  it("is used as given, a string being a list of one", () => {
    expect(resolveLanguages("es")).toEqual(["es"]);
    expect(resolveLanguages(["ca", "es"])).toEqual(["ca", "es"]);
  });

  it("defaults to the browser's languages, in its order", () => {
    expect(resolveLanguages(undefined)).toEqual([...navigator.languages]);
    expect(resolveLanguages([])).toEqual([...navigator.languages]);
  });
});

describe("label resolution (SHACL-UI Editor's Draft, Label and Language Resolution)", () => {
  const ex = "http://example.org/";
  const label = async (body: string, languages: string[]) => {
    const engine = createRudofEngine();
    const shapes = await engine.loadShapes(`
      @prefix sh: <http://www.w3.org/ns/shacl#> . @prefix ex: <${ex}> .
      ex:S a sh:NodeShape ; sh:targetClass ex:Thing ; sh:property [ ${body} ] .
    `);
    const model = buildFormModel({
      shapes,
      focusNode: namedNode(`${ex}d1`),
      shape: shapes.nodeShapes.get(`${ex}S`)!,
      languages,
    });
    return allFields(model)[0].label;
  };

  it("follows the application's languages when the shape states no order", async () => {
    const body = `sh:path ex:p ; sh:name "Name"@en , "Nom"@fr`;
    expect(await label(body, ["fr", "en"])).toBe("Nom");
    expect(await label(body, ["en", "fr"])).toBe("Name");
  });

  it("puts the order of sh:languageIn before the application's languages", async () => {
    // The draft's own example: `sh:languageIn ("fr" "en")` prefers the French label
    // "unless the application has been configured to use a different language" —
    // and here the application's list is only what comes after the shape's.
    const body = `sh:path ex:p ; sh:name "Name"@en , "Nom"@fr ; sh:languageIn ( "fr" "en" )`;
    expect(await label(body, ["en"])).toBe("Nom");
  });

  it("names an unnamed property by its humanised local name", async () => {
    expect(await label(`sh:path ex:dateIssued`, ["en"])).toBe("date issued");
    expect(humanise("accessURL")).toBe("access URL");
    expect(humanise("HTTPServer")).toBe("HTTP server");
    expect(humanise("title")).toBe("title");
  });
});

/** Every source file under `dir`, as `[path, text]`. */
function sources(dir: string, ext: RegExp): [string, string][] {
  return (readdirSync(dir, { recursive: true }) as string[])
    .filter((f) => ext.test(f))
    .map((f) => [join(dir, f), readFileSync(join(dir, f), "utf8")]);
}

describe("where localisation lives", () => {
  it("the form layer imports nothing from i18n", () => {
    const offenders = sources("src/form", /\.tsx?$/).filter(([, text]) => /from\s+["'][^"']*i18n/.test(text));
    expect(offenders.map(([f]) => f)).toEqual([]);
  });

  it("the components carry none of the English literals they used to", () => {
    // The 27 literals of the audit, plus the sentences formReport built. A literal
    // here would bypass the catalog and never translate.
    const banned = [
      "IRI or search", "Search…", "Add an IRI", "Add…", "Not set", "Choose…", '"Yes"', '"No"',
      "No matches", "kind of value", "Failed to load form", "Loading…",
      "`Group ${", "`Step ${", "} issue{", "} issue${", ">Valid<", '"Valid"', "All set", "Let's fill", "Next:",
      "} filled", "Dismiss assistant", "to fix", "field left",
    ];
    const hits: string[] = [];
    for (const [file, raw] of sources("src/react", /\.tsx?$/)) {
      // Comments may quote them; code may not.
      const text = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      for (const b of banned) if (text.includes(b)) hits.push(`${file}: ${b.trim()}`);
      // "Remove" as bare JSX text (the word alone on its line).
      if (text.split("\n").some((l) => l.trim() === "Remove")) hits.push(`${file}: Remove`);
    }
    expect(hits).toEqual([]);
  });
});

/** A pseudo-locale: every English string rotated by 13 letters, placeholders kept.
 *  Whatever still reads as English on screen did not come through the catalog. */
const rot13 = (s: string) =>
  s.replace(/\{\w+\}|[A-Za-z]/g, (c) =>
    c.startsWith("{") ? c : String.fromCharCode(((c.charCodeAt(0) & 95) - 65 + 13) % 26 + 65 + (c.charCodeAt(0) & 32)),
  );
const pseudo = <T,>(v: T): T =>
  (typeof v === "string" ? rot13(v) : Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, pseudo(x)]))) as T;

const leaves = (v: unknown): string[] =>
  typeof v === "string" ? [v] : Object.values(v as object).flatMap(leaves);

describe("no user-visible English outside the catalog (pseudo-locale)", () => {
  const ex = "http://example.org/";
  const shapes = `
    @prefix sh: <http://www.w3.org/ns/shacl#> . @prefix ex: <${ex}> . @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
    ex:S a sh:NodeShape ; sh:targetClass ex:Thing ;
      sh:property [ sh:path ex:flag ; sh:name "Zeta" ; sh:datatype xsd:boolean ; sh:maxCount 1 ] ;
      sh:property [ sh:path ex:kind ; sh:name "Eta" ; sh:in ( "a" "b" ) ; sh:maxCount 1 ] ;
      sh:property [ sh:path ex:link ; sh:name "Theta" ; sh:nodeKind sh:IRI ] ;
      sh:property [ sh:path ex:title ; sh:name "Iota" ; sh:datatype rdf:langString ; sh:maxCount 1 ] ;
      sh:property [ sh:path ex:must ; sh:name "Kappa" ; sh:minCount 1 ; sh:maxCount 1 ] ;
      sh:property [ sh:path ex:keywords ; sh:name "Lambda" ; sh:datatype xsd:string ] .
  `;
  const table = { xx: pseudo<DeepPartial<Strings>>(EN) };

  function Screen({ layout }: { layout?: "tabs" | "steps" }) {
    const form = useMetadataForm({ shapes, rootShape: `${ex}S`, locale: "xx", strings: table, validateOn: "change", validationDebounceMs: 0 });
    return (
      <>
        <MetadataForm form={form} layout={layout} />
        <ValidationSummary form={form} />
        <ValidationPanel form={form} />
      </>
    );
  }

  /** Everything a person or a screen reader is given: text, plus the attributes that carry words. */
  const visible = () =>
    document.body.textContent +
    "\n" +
    [...document.querySelectorAll("[placeholder],[aria-label],[title]")]
      .flatMap((e) => [e.getAttribute("placeholder"), e.getAttribute("aria-label"), e.getAttribute("title")])
      .join("\n");

  it.each([undefined, "tabs", "steps"] as const)("shows none of the English strings (layout %s)", async (layout) => {
    render(<Screen layout={layout} />);
    // The form is up and the first validation pass has spoken.
    await waitFor(() => expect(document.body.textContent).toContain("Zeta"), { timeout: 5000 });
    await waitFor(() => expect(document.querySelector('[data-slot="diagnostic-trigger"]')).not.toBeNull(), { timeout: 5000 });
    await act(async () => {});

    const shown = visible();
    // What the pseudo-locale DID reach: chrome from three different components.
    expect(shown).toContain(rot13("Not set"));
    expect(shown).toContain(rot13("Language"));
    expect(shown).toContain(rot13("issue"));

    const english = leaves(EN)
      .flatMap((s) => s.split(/\{\w+\}/))
      .map((s) => s.trim())
      // Short function words would collide with the profile's own labels.
      .filter((s) => s.length >= 4);
    for (const s of english) expect(shown, `English chrome string "${s}"`).not.toContain(s);
    // The two words too short for that filter, as whole words.
    expect(shown).not.toMatch(/\b(Yes|No)\b/);
  });
});
