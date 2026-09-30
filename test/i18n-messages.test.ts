import { describe, it, expect } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { EN, count, resolveStrings } from "@/i18n/strings.js";
import { useMetadataForm, type UseMetadataFormOptions } from "@/react/hooks/useMetadataForm.js";
import { es, ca } from "metadata-form/i18n";

const SH = "http://www.w3.org/ns/shacl#";
const EX = "http://example.org/";

const shapes = `
  @prefix sh: <${SH}> .
  @prefix ex: <${EX}> .
  ex:S a sh:NodeShape ; sh:targetClass ex:Thing ;
    sh:property [ sh:path ex:title ; sh:name "Title" ; sh:minCount 1 ] ;
    sh:property [ sh:path ex:code ; sh:name "Code" ; sh:minCount 1 ;
      sh:message "Falta el código"@es, "Falta el codi"@ca, "The code is missing"@en ] .
`;

/** A form over the shapes above, ready, with a `validate` that has not run yet. */
async function open(options: Partial<UseMetadataFormOptions> = {}) {
  const hook = renderHook(
    (locale: string[]) => useMetadataForm({ shapes, rootShape: `${EX}S`, validateOn: "manual", ...options, locale }),
    { initialProps: [...(typeof options.locale === "string" ? [options.locale] : (options.locale ?? ["en"]))] },
  );
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  return hook;
}

/** What each failing field says, in the reader's current language. */
async function said(hook: Awaited<ReturnType<typeof open>>) {
  await act(async () => {
    await hook.result.current.validate();
  });
  const { errors, messageOf } = hook.result.current;
  return Object.fromEntries([...errors].map(([key, list]) => [key.split("|")[1].replace(EX, ""), list.map(messageOf)]));
}

describe("validation messages, as the engine reports them", () => {
  it("shows the author's sh:message in the reader's language, and the engine's wording where there is none", async () => {
    expect(await said(await open({ locale: ["en"] }))).toEqual({
      title: ["At least 1 value(s) required"],
      code: ["The code is missing"],
    });
    expect(await said(await open({ locale: ["es"] }))).toEqual({
      title: ["Se requieren al menos 1 valor(es)"],
      code: ["Falta el código"],
    });
    expect((await said(await open({ locale: ["ca"] }))).code).toEqual(["Falta el codi"]);
  });

  it("puts the constraint's parameters into the default wording", async () => {
    const hook = await open({
      shapes: `
        @prefix sh: <${SH}> . @prefix ex: <${EX}> .
        ex:S a sh:NodeShape ; sh:targetClass ex:Thing ; sh:property [ sh:path ex:title ; sh:minCount 2 ] .`,
    });
    expect(await said(hook)).toEqual({ title: ["At least 2 value(s) required"] });
  });

  it("matches by RFC 4647 basic filtering: a range `es` takes a tag `es-ES`, not the reverse", async () => {
    const regional = { messages: [{ value: "Campo obligatorio (España)", language: "es-ES" }, { value: "Required", language: "en" }] };
    expect((await open({ locale: ["es"] })).result.current.messageOf(regional)).toBe("Campo obligatorio (España)");
    // The range `es-ES` does not match the tag `es`; English is what is left. A
    // browser asks for `["es-ES", "es"]`, and so should a consumer.
    expect((await open({ locale: ["es-ES"] })).result.current.messageOf({ messages: [{ value: "Campo", language: "es" }, { value: "Required", language: "en" }] })).toBe("Required");
    expect((await open({ locale: ["es-ES", "es"] })).result.current.messageOf({ messages: [{ value: "Campo", language: "es" }, { value: "Required", language: "en" }] })).toBe("Campo");
  });

  it("walks the reader's ordered list: the first language anyone wrote wins", async () => {
    const written = { messages: [{ value: "Aquest camp", language: "ca" }, { value: "Este campo", language: "es" }, { value: "Required", language: "en" }] };
    // `fr` is preferred but nobody wrote it; `ca` is next and someone did.
    expect((await open({ locale: ["fr", "ca", "es"] })).result.current.messageOf(written)).toBe("Aquest camp");
  });

  it("gives a reader whose language nobody wrote the English wording", async () => {
    expect(await said(await open({ locale: ["fr"] }))).toEqual({
      title: ["At least 1 value(s) required"],
      code: ["The code is missing"],
    });
  });

  it("re-words the errors already reported when the language changes, with no new validation", async () => {
    const hook = await open({ locale: ["en"] });
    await said(hook);
    const before = hook.result.current.errors;
    const [error] = before.get(`${hook.result.current.focusNode!.value}|${EX}title`)!;
    expect(hook.result.current.messageOf(error)).toBe("At least 1 value(s) required");

    hook.rerender(["es"]);
    await waitFor(() => expect(hook.result.current.locale).toBe("es"));
    expect(hook.result.current.errors).toBe(before); // the same results, not a new pass
    expect(hook.result.current.messageOf(error)).toBe("Se requieren al menos 1 valor(es)");
  });
});

describe("a language the engine does not ship is data, not code", () => {
  const fr = `
    @prefix sh: <${SH}> .
    sh:MinCountConstraintComponent sh:message "Au moins {$minCount} valeur(s) requise(s)"@fr .
  `;

  it("shows the French message once French triples are supplied, and English before", async () => {
    expect((await said(await open({ locale: ["fr"] }))).title).toEqual(["At least 1 value(s) required"]);
    expect((await said(await open({ locale: ["fr"], messages: fr }))).title).toEqual(["Au moins 1 valeur(s) requise(s)"]);
  });

  it("re-words a built-in message when a consumer states it again", async () => {
    const custom = `@prefix sh: <${SH}> . sh:MinCountConstraintComponent sh:message "Required"@en .`;
    expect((await said(await open({ locale: ["en"], messages: custom }))).title).toEqual(["Required"]);
  });

  it("takes several documents, the later one winning", async () => {
    const first = `@prefix sh: <${SH}> . sh:MinCountConstraintComponent sh:message "One"@en .`;
    const second = `@prefix sh: <${SH}> . sh:MinCountConstraintComponent sh:message "Two"@en .`;
    expect((await said(await open({ locale: ["en"], messages: [first, second] }))).title).toEqual(["Two"]);
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
  });

  it("gives a language with more categories its own forms", () => {
    const pl = { ...resolveStrings(["pl"]), language: "pl" };
    const forms = { one: "{n} plik", few: "{n} pliki", many: "{n} plików", other: "{n} pliku" };
    expect([1, 2, 5, 1.5].map((n) => count(pl, forms, n))).toEqual(["1 plik", "2 pliki", "5 plików", "1.5 pliku"]);
  });
});
