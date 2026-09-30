import { describe, it, expect } from "vitest";
import { renderHook, render, waitFor } from "@testing-library/react";
import { useMetadataForm } from "@/react/hooks/useMetadataForm.js";
import { LocaleSelect } from "@playground/components/LocaleSelect.js";
import { initialLanguage } from "@playground/lib/language.js";
import { EXAMPLES } from "@playground/presets.js";

/** The languages the form reports for each example's shapes: detected, not listed. */
async function languagesOf(shapes: string, rootShape?: string) {
  const { result } = renderHook(() => useMetadataForm({ shapes, rootShape, validateOn: "off" }));
  await waitFor(() => expect(result.current.ready).toBe(true));
  return result.current.availableLanguages;
}

describe("the languages a shapes graph is written in", () => {
  const shapesOf = (id: string) => EXAMPLES.find((e) => e.id === id)!.presets[0].state;

  it("are English and Spanish for the paper's running example", async () => {
    const state = shapesOf("paper-conditional");
    expect(await languagesOf(state.shapesText, state.options.rootShape)).toEqual(["en", "es"]);
  });

  it.each(["evidenze-dataspace", "evidenze-health"])("are Spanish and Catalan for %s, the more written first", async (id) => {
    const state = shapesOf(id);
    expect(await languagesOf(state.shapesText, state.options.rootShape)).toEqual(["es", "ca"]);
  });

  it("are none when nothing is tagged, and then the selector is not there", async () => {
    const untagged = `
      @prefix sh: <http://www.w3.org/ns/shacl#> . @prefix ex: <http://example.org/> .
      ex:S a sh:NodeShape ; sh:targetClass ex:T ; sh:property [ sh:path ex:p ; sh:name "Plain" ] .`;
    expect(await languagesOf(untagged, "http://example.org/S")).toEqual([]);
    const { container, rerender } = render(<LocaleSelect value="en" locales={[]} onChange={() => {}} />);
    expect(container.querySelector("select")).toBeNull();
    rerender(<LocaleSelect value="es" locales={["es"]} onChange={() => {}} />);
    expect(container.querySelector("select")).toBeNull();
    rerender(<LocaleSelect value="es" locales={["es", "ca"]} onChange={() => {}} />);
    expect(container.querySelector("select")).not.toBeNull();
  });
});

describe("the language a form opens in", () => {
  it("is the browser's preference among the shapes' languages, `ca-ES` reaching a shape written in `ca`", () => {
    expect(initialLanguage(["es", "ca"], ["ca-ES", "es"])).toBe("ca");
    expect(initialLanguage(["es", "ca"], ["es-ES", "ca"])).toBe("es");
  });

  it("is the most written one when the browser prefers none of them, and none when there are none", () => {
    expect(initialLanguage(["es", "ca"], ["de", "fr"])).toBe("es");
    expect(initialLanguage([], ["en"])).toBeUndefined();
  });
});
