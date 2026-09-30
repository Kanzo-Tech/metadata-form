import { describe, it, expect } from "vitest";
import { EXAMPLES } from "@playground/presets.js";
import { fill, pickChrome } from "@playground/i18n.js";

/**
 * The regression this pins: `options` used to be `useState(seed.options)` with no
 * setter, so it froze at mount. Every example after the first kept the FIRST one's
 * `rootShape` — picking a second shape killed the form with "Could not resolve a
 * root node shape", and Share emitted a permalink pairing one example's shapes
 * with another's options, overwriting the correct URL the pick had just written.
 *
 * A unit test cannot mount the hook without the wasm engine, so this pins the
 * precondition that made the bug reachable and would make it reachable again:
 * the examples genuinely disagree about `rootShape`.
 */
describe("example presets", () => {
  it("do not share a rootShape, so a frozen options object would break them", () => {
    const roots = EXAMPLES.map((e) => e.presets[0]?.state.options?.rootShape);
    const distinct = new Set(roots.filter(Boolean));
    expect(EXAMPLES.length).toBeGreaterThan(1);
    expect(distinct.size).toBeGreaterThan(1);
  });

  it("give every example a preset whose state names that example", () => {
    for (const ex of EXAMPLES) {
      for (const preset of ex.presets) {
        expect(preset.state.exampleId, `${ex.id}/${preset.id}`).toBe(ex.id);
      }
    }
  });
});

describe("the paper's examples", () => {
  it("include the mapping example", () => {
    expect(EXAMPLES[0].label).toBe("A conditional field");
    expect(EXAMPLES.some((e) => e.id === "paper-mapping")).toBe(true);
  });

  it("offer the sh:targetWhere variant beside the running example", () => {
    expect(EXAMPLES.map((e) => e.id).slice(0, 2)).toEqual(["paper-conditional", "paper-target-where"]);
  });
});

/**
 * The playground carries its own chrome catalog rather than borrowing the
 * library's — see `playground/src/i18n.ts` for the line. What that costs is a
 * second table to keep in step, so the step is pinned: a string added in English
 * and forgotten in Catalan is the exact defect this whole pass was fixing.
 */
describe("the playground's chrome catalog", () => {
  const leaves = (o: unknown, at = ""): [string, string][] =>
    typeof o === "string"
      ? [[at, o]]
      : Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => leaves(v, at ? `${at}.${k}` : k));

  const english = leaves(pickChrome("en"));

  it.each(["es", "ca"])("says everything English says, in %s", (locale) => {
    const translated = new Map(leaves(pickChrome(locale)));
    for (const [key, value] of english) {
      expect(translated.get(key), key).toBeTruthy();
      // The `{name}` slots are the sentence's structure, not its words: a
      // translation that drops one silently renders "{total}" to a reader.
      const slots = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(slots(translated.get(key)!), key).toEqual(slots(value));
    }
  });

  it("falls back down the base-language chain, exactly as the library does", () => {
    expect(pickChrome("es-ES")).toBe(pickChrome("es"));
    expect(pickChrome("de")).toBe(pickChrome("en"));
    expect(pickChrome(undefined)).toBe(pickChrome("en"));
  });

  it("fills a slot by name and leaves an unknown one alone", () => {
    expect(fill("{blocking} of {total}", { blocking: 1, total: 3 })).toBe("1 of 3");
    expect(fill("{nope}", {})).toBe("{nope}");
  });
});
