import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// Initialize the rudof wasm once for the whole test run, from disk bytes: the
// default loader fetches the .wasm over HTTP (relative to the module URL), which
// jsdom can't do. wasm-bindgen's init short-circuits if already initialized, so
// the production `loadRudof()` reuses this instance instead of fetching.
// Resolved from the @kanzo-tech/rudof-wasm package (a declared dependency).
const require = createRequire(import.meta.url);
const wasmPath = join(dirname(require.resolve("@kanzo-tech/rudof-wasm")), "rudof_wasm_bg.wasm");
const rudofWasm = await import("@kanzo-tech/rudof-wasm");
await (rudofWasm as { default: (i: unknown) => Promise<unknown> }).default({
  module_or_path: readFileSync(wasmPath),
});

// jsdom polyfills required by Ark UI (the design system's primitives).
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
