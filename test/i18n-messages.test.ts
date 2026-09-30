import { describe, it, expect, beforeAll } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createRudofEngine } from "@/engine/index.js";
import type { ValidationResult } from "@/form/validation.js";
import { mapResults } from "@/form/validation.js";
import { catalogFromTriples, englishMessages, mergeCatalogs, resolveMessage, type MessageCatalog } from "@/i18n/messages.js";
import { EN, count, resolveStrings } from "@/i18n/strings.js";
import { useMetadataForm } from "@/react/hooks/useMetadataForm.js";
import { namedNode } from "@/form/factory.js";
import { es, ca } from "metadata-form/i18n";

const SH = "http://www.w3.org/ns/shacl#";
const MIN_COUNT = `${SH}MinCountConstraintComponent`;

const focus = namedNode("http://example.org/subject");
const path = namedNode("http://purl.org/dc/terms/title");

const engine = createRudofEngine();
const parse = async (...documents: string[]): Promise<MessageCatalog> =>
  mergeCatalogs(await Promise.all(documents.map(async (d) => catalogFromTriples(await engine.parseQuads(d)))));

let catalog: MessageCatalog;
beforeAll(async () => {
  catalog = await parse(englishMessages, es.messages, ca.messages);
});

/** The text a reader of `languages` is shown for a one-result report. */
function messageFor(result: ValidationResult, ...languages: string[]): string {
  const error = mapResults([result]).get(`${focus.value}|${path.value}`)![0];
  return resolveMessage(error, catalog, languages);
}

describe("localized validation messages (sh:message + the message graph)", () => {
  const authored: ValidationResult = {
    focusNode: focus,
    pathKey: path.value,
    severity: "violation",
    constraint: MIN_COUNT,
    messages: [
      { value: "This field is required", language: "" }, // engine default (untagged)
      { value: "Este campo es obligatorio", language: "es" }, // sh:message @es
      { value: "Aquest camp és obligatori", language: "ca" }, // sh:message @ca
    ],
  };

  it("prefers the author's sh:message in the reader's language", () => {
    expect(messageFor(authored, "es")).toBe("Este campo es obligatorio");
    expect(messageFor(authored, "ca")).toBe("Aquest camp és obligatori");
  });

  it("matches by RFC 4647 basic filtering: a range `es` takes a tag `es-ES`, not the reverse", () => {
    const regional: ValidationResult = {
      ...authored,
      messages: [{ value: "Campo obligatorio (España)", language: "es-ES" }],
    };
    expect(messageFor(regional, "es")).toBe("Campo obligatorio (España)");
    // The range `es-ES` does not match the tag `es`: the author's message is not
    // chosen, and the catalog's Spanish wording (a tag `es`) is not either — the
    // reader gets the English fallback. Ask for `["es-ES", "es"]`, as a browser does.
    expect(messageFor(authored, "es-ES")).toBe("This field is required");
    expect(messageFor(authored, "es-ES", "es")).toBe("Este campo es obligatorio");
  });

  it("walks the reader's ordered list: the first language anyone wrote wins", () => {
    // `fr` is preferred but nobody wrote it; `ca` is next and the author did.
    expect(messageFor(authored, "fr", "ca", "es")).toBe("Aquest camp és obligatori");
  });

  it("falls to the message graph when the author has no tag for the language", () => {
    // English is untagged (the engine's default, not an author tag) → the graph.
    expect(messageFor(authored, "en")).toBe("This field is required");
    // A language nobody wrote → English.
    expect(messageFor(authored, "fr")).toBe("This field is required");
  });

  it("takes the fallback wording for es/ca from the graph when the author is silent", () => {
    const noAuthor: ValidationResult = { ...authored, messages: [{ value: "min count violation", language: "" }] };
    expect(messageFor(noAuthor, "es")).toBe("Este campo es obligatorio");
    expect(messageFor(noAuthor, "ca")).toBe("Aquest camp és obligatori");
  });

  it("stays engine-neutral: an untagged message with an unknown constraint passes through", () => {
    // Models a ShEx (or unknown-SHACL) result: no known constraint, one plain message.
    const shex: ValidationResult = { ...authored, constraint: undefined, messages: [{ value: "does not satisfy the shape", language: "" }] };
    expect(messageFor(shex, "es")).toBe("does not satisfy the shape");
  });

  it("never lets a sh: constraint fall through to the engine's own text", () => {
    // Verbatim shape of what rudof emits for sh:node: it renders the message by
    // Display-ing the internal IRShape, so the report used to hand a person an AST
    // dump. A sh: constraint must resolve to the graph (or its generic message).
    const astDump: ValidationResult = {
      ...authored,
      constraint: `${SH}NodeConstraintComponent`,
      messages: [
        {
          value:
            "Shape _:db9dc3bc6e05eb3301a1c103c00c6311: Node(NodeShape\n Targets: - targetClass(ex:Dataset)\n Property Shapes: [22, 13, 23]\n) constraint not satisfied for _:mf1",
          language: "",
        },
      ],
    };
    for (const language of ["en", "es", "ca"]) expect(messageFor(astDump, language)).not.toMatch(/NodeShape|\n/);
    expect(messageFor(astDump, "en")).toBe("Some details in this section are incomplete");
    expect(messageFor(astDump, "es")).toBe("Faltan datos en esta sección");
    expect(messageFor(astDump, "ca")).toBe("Falten dades en aquesta secció");
  });

  it("falls back rather than echoing the engine for a sh: constraint the graph does not name", () => {
    const unknownShacl: ValidationResult = {
      ...authored,
      constraint: `${SH}SomeFutureConstraintComponent`,
      messages: [{ value: "IRShape { id: _:b0, … } not satisfied", language: "" }],
    };
    expect(messageFor(unknownShacl, "es")).toBe("Valor no válido");
  });

  it("uses the generic message when nothing else matches", () => {
    const empty: ValidationResult = { ...authored, constraint: undefined, messages: [] };
    expect(messageFor(empty, "es")).toBe("Valor no válido");
    expect(messageFor(empty, "en")).toBe("Invalid value");
  });
});

describe("a language the library does not ship is data, not code", () => {
  const fr = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    sh:MinCountConstraintComponent sh:message "Ce champ est obligatoire"@fr .
    sh:ConstraintComponent sh:message "Valeur invalide"@fr .
  `;

  it("shows the French message once French triples are supplied, and English before", async () => {
    const withFrench = await parse(englishMessages, fr);
    const minCount: ValidationResult = { focusNode: focus, severity: "violation", constraint: MIN_COUNT, messages: [] };
    expect(resolveMessage(minCount, catalog, ["fr"])).toBe("This field is required");
    expect(resolveMessage(minCount, withFrench, ["fr"])).toBe("Ce champ est obligatoire");
    // A component the French triples do not name still gets its English wording.
    expect(resolveMessage({ ...minCount, constraint: `${SH}NotConstraintComponent` }, withFrench, ["fr"])).toBe("This value is not allowed here");
  });

  it("re-words a built-in message when a consumer states it again", async () => {
    const custom = await parse(englishMessages, `@prefix sh: <${SH}> . sh:MinCountConstraintComponent sh:message "Required"@en .`);
    const minCount: ValidationResult = { focusNode: focus, severity: "violation", constraint: MIN_COUNT, messages: [] };
    expect(resolveMessage(minCount, custom, ["en"])).toBe("Required");
  });

  const shapes = `
    @prefix sh: <${SH}> .
    @prefix ex: <http://example.org/> .
    ex:S a sh:NodeShape ; sh:targetClass ex:Thing ;
      sh:property [ sh:path ex:title ; sh:name "Title" ; sh:minCount 1 ] .
  `;

  it("reaches useMetadataForm through the `messages` option, with no code change", async () => {
    const { result } = renderHook(() =>
      useMetadataForm({ shapes, rootShape: "http://example.org/S", locale: ["fr"], messages: fr, validateOn: "manual" }),
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    let errors: Awaited<ReturnType<typeof result.current.validate>> = [];
    await act(async () => {
      errors = await result.current.validate();
    });
    expect(errors.map((e) => result.current.messageOf(e))).toEqual(["Ce champ est obligatoire"]);
  });

  it("re-words the errors already reported when the language changes, with no new validation", async () => {
    const options = { shapes, rootShape: "http://example.org/S", validateOn: "manual" as const, messages: [es.messages] };
    const { result, rerender } = renderHook((locale: string[]) => useMetadataForm({ ...options, locale }), {
      initialProps: ["en"],
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => {
      await result.current.validate();
    });
    const before = result.current.errors;
    const [error] = [...before.values()].flat();
    expect(result.current.messageOf(error)).toBe("This field is required");

    rerender(["es"]);
    await waitFor(() => expect(result.current.locale).toBe("es"));
    expect(result.current.errors).toBe(before); // the same results, not a new pass
    expect(result.current.messageOf(error)).toBe("Este campo es obligatorio");
  });
});

describe("resolveStrings", () => {
  const tables = { es: es.strings, ca: ca.strings };

  it("selects the table of the most preferred language that has one", () => {
    expect(resolveStrings(["es"], tables).languagePicker.filterPlaceholder).toBe("Filtrar…");
    expect(resolveStrings(["fr", "ca", "es"], tables).languagePicker.noMatches).toBe("Sense coincidències");
    // Basic filtering again: the range `ca-ES` does not take the table `ca`; `["ca-ES", "ca"]` does.
    expect(resolveStrings(["ca-ES"], tables).languagePicker.noMatches).toBe("No matches");
    expect(resolveStrings(["ca-ES", "ca"], tables).languagePicker.noMatches).toBe("Sense coincidències");
  });

  it("is English when no table matches", () => {
    expect(resolveStrings(["de"], tables).languagePicker.label).toBe("Language");
    expect(resolveStrings([], tables).languagePicker.label).toBe("Language");
  });

  it("carries English only in the core: another language is not there until it is supplied", () => {
    expect(resolveStrings(["es"]).languagePicker.label).toBe("Language");
    expect(EN.languagePicker.label).toBe("Language");
  });

  it("layers a consumer override over the table, per key", () => {
    const s = resolveStrings(["es"], { es: { ...es.strings, languagePicker: { ...es.strings.languagePicker, label: "Lengua" } } });
    expect(s.languagePicker.label).toBe("Lengua"); // overridden
    expect(s.languagePicker.filterPlaceholder).toBe("Filtrar…"); // untouched
  });

  it("takes a partial table: what it leaves out stays English", () => {
    const s = resolveStrings(["de"], { de: { chrome: { yes: "Ja", no: "Nein" } } });
    expect(s.chrome.yes).toBe("Ja");
    expect(s.chrome.notSet).toBe("Not set");
  });

  it("overrides the built-in English too", () => {
    expect(resolveStrings(["en"], { en: { chrome: { loading: "One moment…" } } }).chrome.loading).toBe("One moment…");
  });
});

describe("counts follow the language's plural rules, not an English `(s)`", () => {
  const t = resolveStrings(["es"], { es: es.strings });
  it("uses the category Intl.PluralRules gives", () => {
    expect(count(resolveStrings(["en"]), EN.chrome.issues, 1)).toBe("1 issue");
    expect(count(resolveStrings(["en"]), EN.chrome.issues, 0)).toBe("0 issues");
    expect(count(t, es.strings.chrome.issues, 1)).toBe("1 incidencia");
    expect(count(t, es.strings.chrome.issues, 3)).toBe("3 incidencias");
    expect(count(t, es.strings.chrome.health.guiding, 1)).toBe("Falta 1 campo obligatorio");
    expect(count(t, es.strings.chrome.health.guiding, 2)).toBe("Faltan 2 campos obligatorios");
  });

  it("gives a language with more categories its own forms", () => {
    const pl = { ...resolveStrings(["pl"]), language: "pl" };
    const forms = { one: "{n} plik", few: "{n} pliki", many: "{n} plików", other: "{n} pliku" };
    expect([1, 2, 5, 1.5].map((n) => count(pl, forms, n))).toEqual(["1 plik", "2 pliki", "5 plików", "1.5 pliku"]);
  });
});
