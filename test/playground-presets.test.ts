import { describe, it, expect } from "vitest";
import { EXAMPLES } from "@playground/presets.js";

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
