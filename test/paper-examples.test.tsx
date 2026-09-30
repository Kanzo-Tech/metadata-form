import { describe, it, expect } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { useMetadataForm, type UseMetadataFormOptions } from "@/react/hooks/useMetadataForm.js";
import { allFields, type FieldModel } from "@/form/FormModel.js";
import { literal, namedNode } from "@/form/factory.js";
import {
  paperConditionalShapes,
  paperConditionalSampleData,
  paperConditionalRootShape,
} from "@examples/paper-conditional/index.js";
import { paperMappingShapes, paperMappingSampleData, paperMappingRootShape } from "@examples/paper-mapping/index.js";
import { Editors } from "@/form/vocab/shacl-ui.js";

const HEALTH = "http://healthdataportal.eu/ns/health#";
const STRUCTURED = `${HEALTH}hasStructuredData`;
const VARIABLES = `${HEALTH}hasVariables`;
const XSD_BOOLEAN = "http://www.w3.org/2001/XMLSchema#boolean";
const MIN_COUNT = "http://www.w3.org/ns/shacl#MinCountConstraintComponent";

/**
 * The paper's Listing 1 is `shapes.ttl` behind a prefix block. The paper repository
 * is optional: point `PAPER_LISTINGS` at its `tex/listings` directory to check the
 * example has not drifted from the listing; without it the check is skipped.
 */
const listing = process.env.PAPER_LISTINGS ? join(process.env.PAPER_LISTINGS, "example.ttl") : undefined;

describe("the paper's Listing 1", () => {
  it.skipIf(!listing || !existsSync(listing))("is the body of the example's shapes, byte for byte", () => {
    expect(paperConditionalShapes.endsWith(readFileSync(listing!, "utf8"))).toBe(true);
    const prefixes = paperConditionalShapes.slice(0, paperConditionalShapes.length - readFileSync(listing!, "utf8").length);
    expect(prefixes.split("\n").filter((l) => l.trim() && !l.startsWith("@prefix"))).toEqual([]);
  });
});

function openForm(options: Pick<UseMetadataFormOptions, "locale">) {
  return renderHook(() =>
    useMetadataForm({
      shapes: paperConditionalShapes,
      data: paperConditionalSampleData,
      rootShape: paperConditionalRootShape,
      validateOn: "change",
      validationDebounceMs: 0,
      ...options,
    }),
  );
}

const fieldOf = (form: ReturnType<typeof useMetadataForm>, path: string): FieldModel | undefined =>
  form.model && allFields(form.model).find((f) => f.path.value === path);

describe.each([
  ["en", "en", "Describe the variables of a structured dataset."],
  ["es", ["es"], "Describe las variables de un dataset estructurado."],
] as const)("the running example, in %s", (_name, locale, message) => {
  it("shows the variables field, required, only while the dataset has structured data", async () => {
    const { result } = openForm({ locale });
    await waitFor(() => expect(result.current.ready).toBe(true));
    const focus = result.current.focusNode!;
    const structured = fieldOf(result.current, STRUCTURED)!;

    // No structured data: no variables field, and the title alone makes the form valid.
    expect(fieldOf(result.current, VARIABLES)).toBeUndefined();
    await waitFor(() => expect(result.current.isValid).toBe(true));
    expect(result.current.errors.size).toBe(0);

    // Structured data: the field appears, required, with exactly one error of the author's.
    const yes = literal("true", namedNode(XSD_BOOLEAN));
    const no = literal("false", namedNode(XSD_BOOLEAN));
    act(() => result.current.graph!.setValue(focus, structured.write!, no, yes));
    await waitFor(() => expect(fieldOf(result.current, VARIABLES)?.required).toBe(true));
    await waitFor(() => expect(result.current.isValid).toBe(false));
    const errors = [...result.current.errors.values()].flat();
    expect(errors).toHaveLength(1);
    expect(errors[0].constraint).toBe(MIN_COUNT);
    expect(result.current.messageOf(errors[0])).toBe(message);
    expect([...result.current.errors.keys()]).toEqual([fieldOf(result.current, VARIABLES)!.id]);

    // Back to no: the field and its error are gone.
    act(() => result.current.graph!.setValue(focus, structured.write!, yes, no));
    await waitFor(() => expect(fieldOf(result.current, VARIABLES)).toBeUndefined());
    await waitFor(() => expect(result.current.errors.size).toBe(0));
    expect(result.current.isValid).toBe(true);
  });
});

/** The sh:targetWhere variant needs an engine that reads it (rudof-wasm >= 0.3.10). */
it.todo("the same condition stated with sh:targetWhere behaves as the running example (rudof-wasm >= 0.3.10)");

describe("the mapping example", () => {
  it("resolves each property to the editor the paper's figure names", async () => {
    const { result } = renderHook(() =>
      useMetadataForm({
        shapes: paperMappingShapes,
        data: paperMappingSampleData,
        rootShape: paperMappingRootShape,
        validateOn: "off",
      }),
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    const editors = Object.fromEntries(
      allFields(result.current.model!).map((f) => [f.path.value.replace("http://example.org/", ""), f]),
    );
    const local = (id: string) => id.replace(/^.*[#/]/, "");
    const editorOf = (name: string) => local(editors[name].editorId);

    expect(editorOf("status")).toBe(local(Editors.EnumSelect));
    expect(editorOf("active")).toBe(local(Editors.Boolean));
    expect(editorOf("day")).toBe(local(Editors.DatePicker));
    expect(editorOf("moment")).toBe(local(Editors.DateTimePicker));
    expect(editorOf("count")).toBe(local(Editors.NumberField));
    expect(editorOf("note")).toBe(local(Editors.TextFieldWithLang));
    expect(editorOf("code")).toBe(local(Editors.TextField));
    expect(editorOf("keyword")).toBe(local(Editors.TextField));
    expect(editorOf("summary")).toBe(local(Editors.TextArea));
    expect(editorOf("owner")).toBe(local(Editors.AutoComplete));
    expect(editorOf("homepage")).toBe(local(Editors.IRI));
    expect(editorOf("part")).toBe(local(Editors.Details));

    expect(editors.code.required).toBe(true);
    expect(editors.keyword.repeatable).toBe(true);
    expect(editors.status.repeatable).toBe(false);
  });
});
