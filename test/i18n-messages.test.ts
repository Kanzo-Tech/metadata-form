import { describe, it, expect } from "vitest";
import { mapResults, type ValidationResult } from "@/form/validation.js";
import { resolveStrings } from "@/i18n/strings.js";
import { namedNode } from "@/form/factory.js";

const SH = "http://www.w3.org/ns/shacl#";
const MIN_COUNT = `${SH}MinCountConstraintComponent`;

const focus = namedNode("http://example.org/subject");
const path = namedNode("http://purl.org/dc/terms/title");

/** Build a single-result report and read back the resolved field message. */
function messageFor(result: ValidationResult, locale?: string): string {
  const map = mapResults([result], locale);
  const key = `${focus.value}|${path.value}`;
  return map.get(key)![0].message;
}

describe("localized validation messages (sh:message + fallback catalog)", () => {
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

  it("prefers the author's sh:message matched to the locale", () => {
    expect(messageFor(authored, "es")).toBe("Este campo es obligatorio");
    expect(messageFor(authored, "ca")).toBe("Aquest camp és obligatori");
  });

  it("folds a regional locale to its base language (es-ES → es)", () => {
    expect(messageFor(authored, "es-ES")).toBe("Este campo es obligatorio");
  });

  it("falls to the localized catalog when the author has no tag for the locale", () => {
    // English is untagged (not an author tag) → step 1 misses → catalog by constraint.
    expect(messageFor(authored, "en")).toBe("This field is required");
    // A locale with no author message and no dedicated table → English catalog.
    expect(messageFor(authored, "fr")).toBe("This field is required");
  });

  it("localizes the fallback catalog itself for es/ca when the author is silent", () => {
    const noAuthor: ValidationResult = {
      focusNode: focus,
      pathKey: path.value,
      severity: "violation",
      constraint: MIN_COUNT,
      messages: [{ value: "min count violation", language: "" }],
    };
    expect(messageFor(noAuthor, "es")).toBe("Este campo es obligatorio");
    expect(messageFor(noAuthor, "ca")).toBe("Aquest camp és obligatori");
  });

  it("stays engine-neutral: an untagged message with an unknown constraint passes through", () => {
    // Models a ShEx (or unknown-SHACL) result: no known constraint, one plain message.
    const shex: ValidationResult = {
      focusNode: focus,
      pathKey: path.value,
      severity: "violation",
      constraint: undefined,
      messages: [{ value: "does not satisfy the shape", language: "" }],
    };
    expect(messageFor(shex, "es")).toBe("does not satisfy the shape");
  });

  it("never lets a sh: constraint fall through to the engine's own text", () => {
    // Verbatim shape of what rudof emits for sh:node: it renders the message by
    // Display-ing the internal IRShape, so the report used to hand a person an AST
    // dump. A sh: constraint must resolve to the catalog (or _fallback), never this.
    const astDump: ValidationResult = {
      focusNode: focus,
      pathKey: path.value,
      severity: "violation",
      constraint: `${SH}NodeConstraintComponent`,
      messages: [
        {
          value:
            "Shape _:db9dc3bc6e05eb3301a1c103c00c6311: Node(NodeShape\n Targets: - targetClass(ex:Dataset)\n Property Shapes: [22, 13, 23]\n) constraint not satisfied for _:mf1",
          language: "",
        },
      ],
    };
    for (const locale of ["en", "es", "ca"]) {
      const message = messageFor(astDump, locale);
      expect(message).not.toContain("NodeShape");
      expect(message).not.toContain("\n");
      expect(message).toBe(resolveStrings(locale).validationDefaults[`${SH}NodeConstraintComponent`]);
    }
    expect(messageFor(astDump, "en")).toBe("Some details in this section are incomplete");
    expect(messageFor(astDump, "es")).toBe("Faltan datos en esta sección");
    expect(messageFor(astDump, "ca")).toBe("Falten dades en aquesta secció");
  });

  it("falls back rather than echoing the engine for a sh: constraint with no catalog entry", () => {
    const unknownShacl: ValidationResult = {
      focusNode: focus,
      pathKey: path.value,
      severity: "violation",
      constraint: `${SH}SomeFutureConstraintComponent`,
      messages: [{ value: "IRShape { id: _:b0, … } not satisfied", language: "" }],
    };
    expect(messageFor(unknownShacl, "es")).toBe("Valor no válido");
  });

  it("uses the localized generic fallback when nothing else matches", () => {
    const empty: ValidationResult = {
      focusNode: focus,
      pathKey: path.value,
      severity: "violation",
      constraint: undefined,
      messages: [],
    };
    expect(messageFor(empty, "es")).toBe("Valor no válido");
    expect(messageFor(empty, "en")).toBe("Invalid value");
  });
});

describe("resolveStrings", () => {
  it("selects the locale table and folds regional tags to base", () => {
    expect(resolveStrings("es").languagePicker.filterPlaceholder).toBe("Filtrar…");
    expect(resolveStrings("ca-ES").languagePicker.noMatches).toBe("Sense coincidències");
  });

  it("falls back to English for unknown locales", () => {
    expect(resolveStrings("de").languagePicker.label).toBe("Language");
    expect(resolveStrings(undefined).languagePicker.label).toBe("Language");
  });

  it("layers a consumer override over the locale table, per key", () => {
    const s = resolveStrings("es", {
      languagePicker: { label: "Lengua" },
      validationDefaults: { [MIN_COUNT]: "Requerido" },
    });
    expect(s.languagePicker.label).toBe("Lengua"); // overridden
    expect(s.languagePicker.filterPlaceholder).toBe("Filtrar…"); // untouched es default
    expect(s.validationDefaults[MIN_COUNT]).toBe("Requerido"); // overridden
    expect(s.validationDefaults._fallback).toBe("Valor no válido"); // untouched es default
  });
});
