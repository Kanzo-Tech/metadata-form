// A host page for the frame, served by `npm run dev:frame` (not built): what an
// app does to show the form in an iframe, in plain TypeScript.
import { createMetadataFormFrame, type EmbedConfig } from "@kanzo-tech/metadata-form/embed";
import { paperConditionalRootShape, paperConditionalShapes } from "@examples/paper-conditional/index.js";
import { paperMappingRootShape, paperMappingShapes } from "@examples/paper-mapping/index.js";

const config: EmbedConfig = {
  variants: [
    { id: "conditional", label: "A conditional field", shapes: paperConditionalShapes, rootShape: paperConditionalRootShape },
    { id: "mapping", label: "From shapes to fields", shapes: paperMappingShapes, rootShape: paperMappingRootShape },
  ],
  locale: ["en"],
  languageSelector: true,
  textsByLanguage: { en: { variantLabel: "Example" }, es: { variantLabel: "Ejemplo" } },
};

const $ = (id: string) => document.getElementById(id)!;
const frame = createMetadataFormFrame($("frame") as HTMLIFrameElement, {
  config,
  onReady: () => ($("status").textContent = "Ready"),
  onChange: (state) => {
    $("status").textContent = state.valid
      ? `Valid (${state.warnings} warning(s))`
      : `${state.errors} error(s), ${state.warnings} warning(s)`;
    $("state").textContent = JSON.stringify(state.jsonLd, null, 2);
  },
});
$("reveal").onclick = () => frame.revealErrors();
$("reset").onclick = () => frame.reset();
$("spanish").onclick = () => frame.configure({ ...config, locale: ["es", "en"] });
