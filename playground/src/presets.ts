import { healthDcatApShapes, healthDcatApSampleData, healthDcatApRootShape } from "@examples/health-dcat-ap/index.js";
import { evidenzeShapes, evidenzeSampleData, evidenzeLogo, evidenzeIcon, evidenzeRootShape } from "@examples/evidenze-dataspace/index.js";
import { evidenzeHealthShapes, evidenzeHealthSampleData, evidenzeHealthRootShape } from "@examples/evidenze-health/index.js";
import { paperConditionalShapes, paperConditionalSampleData, paperConditionalRootShape } from "@examples/paper-conditional/index.js";
import { paperTargetWhereShapes, paperTargetWhereSampleData, paperTargetWhereRootShape } from "@examples/paper-target-where/index.js";
import { paperMappingShapes, paperMappingSampleData, paperMappingRootShape } from "@examples/paper-mapping/index.js";
import type { PermalinkOptions, PermalinkState } from "./lib/permalink.js";

/** Optional per-example branding — lets a bundled example wear its own identity
 *  (logo + theme), so the playground doubles as a client-branded demo. `instance.ts`
 *  is what reads this: an instance and a branded example are the same declaration
 *  seen from two distances. Layout and density stay owned by the user's Preferences. */
export interface ExampleBranding {
  /** Bundled asset URL of the (white) wordmark shown in the app title. */
  logoUrl?: string;
  /** Intrinsic width/height ratio of the wordmark, for crisp sizing. */
  logoRatio?: number;
  /**
   * The published `@kanzo-tech/theme` names this brand wears — **one per side**.
   *
   * A pair, not a name, and that is the whole answer to the question this docblock
   * used to ask. A theme carries its own light or dark palette, so `"night"` is not
   * "the Evidenze theme": it is Evidenze *after dark*, and naming it alone painted
   * the daylight side dark with `.dark` off. `KanzoThemeProvider.defaultTheme` now
   * takes `{ light, dark }` for exactly this (widened upstream in `a73c29e`).
   *
   * **It applies, and it does not overwrite anybody.** The open question was whose
   * choice wins; the resolution chain already answers it — pinned → stored → policy
   * → the tenant's default — so a `defaultTheme` is a *deferral target*, the value
   * that applies while nobody has chosen. A reader who picks a theme in Preferences
   * outranks it, on that side, for good. That is why this can be wired without the
   * "opening an example rewrote my saved theme" hazard: it never writes a preference.
   */
  theme?: { light: string; dark: string };
  /** Browser-tab title while this example is active. */
  docTitle?: string;
  /** Bundled asset URL for the browser-tab favicon (the brand mark). */
  faviconUrl?: string;
  /** Tint the app chrome (top edge) with the theme's primary — it comes from the
   *  theme, so it follows whichever side is being worn. */
  tint?: boolean;
}

/** A bundled example data preset — a ready-to-load {@link PermalinkState}, i.e. the
 *  same thing a shared link decodes to. */
export interface Preset {
  id: string;
  label: string;
  state: PermalinkState;
}

/** A shape and its data presets. */
export interface ShapeExample {
  id: string;
  label: string;
  presets: Preset[];
  /** Optional identity the playground wears while this example is active. */
  branding?: ExampleBranding;
  /** Label languages the shape provides — drives the UI-language selector. The
   *  first is the default. Omit (or ≤1) to hide the selector. */
  uiLocales?: string[];
}

// Each example declares its root shape explicitly, so focus/root resolution is
// exact regardless of how many typed resources the data graph carries.
const HEALTH_OPTIONS: PermalinkOptions = { validateOn: "change", rootShape: healthDcatApRootShape };
const EVIDENZE_OPTIONS: PermalinkOptions = { validateOn: "change", rootShape: evidenzeRootShape };
const EVIDENZE_HEALTH_OPTIONS: PermalinkOptions = { validateOn: "change", rootShape: evidenzeHealthRootShape };

const PAPER_CONDITIONAL_OPTIONS: PermalinkOptions = { validateOn: "change", rootShape: paperConditionalRootShape };
const PAPER_TARGET_WHERE_OPTIONS: PermalinkOptions = { validateOn: "change", rootShape: paperTargetWhereRootShape };
const PAPER_MAPPING_OPTIONS: PermalinkOptions = { validateOn: "change", rootShape: paperMappingRootShape };

/** The paper's examples speak English and Spanish; English first, the library's own. */
const PAPER_LOCALES = ["en", "es"];

/** Whether the installed engine reads `sh:targetWhere` (`@kanzo-tech/rudof-wasm`
 *  0.3.9 does not; 0.3.10 does). While it is false the example is registered but
 *  not offered: a reader would open a form that silently lacks its conditional. */
export const SH_TARGET_WHERE_SUPPORTED = false;

/** Evidenze branding, shared by both Evidenze examples. */
const EVIDENZE_BRANDING: ExampleBranding = {
  logoUrl: evidenzeLogo,
  logoRatio: 677 / 115,
  theme: { light: "bank", dark: "night" },
  docTitle: "Evidenze · Dataset Onboarding",
  faviconUrl: evidenzeIcon,
  tint: true,
};

/** Bundled examples as permalink presets: picking one applies its state and syncs
 *  the URL — the exact same path as opening a shared link. The content is authored
 *  as the Turtle files under `examples/` and embedded into the presets
 *  here, so there is one runtime representation (a `PermalinkState`) for both. */
const PAPER_TARGET_WHERE: ShapeExample = {
  id: "paper-target-where",
  label: "Paper example: the same condition with sh:targetWhere",
  uiLocales: PAPER_LOCALES,
  presets: [
    {
      id: "listing",
      label: "Dataset with structured data",
      state: {
        exampleId: "paper-target-where",
        shapesText: paperTargetWhereShapes,
        dataText: paperTargetWhereSampleData,
        options: PAPER_TARGET_WHERE_OPTIONS,
      },
    },
  ],
};

export const EXAMPLES: ShapeExample[] = [
  {
    id: "paper-conditional",
    label: "Paper example: a conditional field",
    uiLocales: PAPER_LOCALES,
    presets: [
      {
        id: "listing-1",
        label: "Listing 1: a dataset with structured data",
        state: {
          exampleId: "paper-conditional",
          shapesText: paperConditionalShapes,
          dataText: paperConditionalSampleData,
          options: PAPER_CONDITIONAL_OPTIONS,
        },
      },
    ],
  },
  ...(SH_TARGET_WHERE_SUPPORTED ? [PAPER_TARGET_WHERE] : []),
  {
    id: "paper-mapping",
    label: "Paper example: from shapes to fields",
    uiLocales: PAPER_LOCALES,
    presets: [
      {
        id: "mapping",
        label: "One property per row of the mapping",
        state: {
          exampleId: "paper-mapping",
          shapesText: paperMappingShapes,
          dataText: paperMappingSampleData,
          options: PAPER_MAPPING_OPTIONS,
        },
      },
    ],
  },
  {
    id: "health-dcat-ap",
    label: "HealthDCAT-AP",
    presets: [
      {
        id: "empty",
        label: "Empty (new dataset)",
        state: { exampleId: "health-dcat-ap", shapesText: healthDcatApShapes, dataText: "", options: HEALTH_OPTIONS },
      },
      {
        id: "covid",
        label: "COVID-19 registry",
        state: {
          exampleId: "health-dcat-ap",
          shapesText: healthDcatApShapes,
          dataText: healthDcatApSampleData,
          options: HEALTH_OPTIONS,
        },
      },
    ],
  },
  {
    id: "evidenze-dataspace",
    label: "Evidenze Data Space (SHACL Core + SHACL-UI)",
    // Evidenze's own identity (colours from their site: navy #091a40, blue
    // #1d4ebd, green #27b564) — the app wears it while this example is active.
    branding: EVIDENZE_BRANDING,
    uiLocales: ["es", "ca"],
    presets: [
      {
        id: "empty",
        label: "Empty (new dataset)",
        state: { exampleId: "evidenze-dataspace", shapesText: evidenzeShapes, dataText: "", options: EVIDENZE_OPTIONS },
      },
      {
        id: "restricted",
        label: "Registro oncológico (acceso restringido)",
        state: {
          exampleId: "evidenze-dataspace",
          shapesText: evidenzeShapes,
          dataText: evidenzeSampleData,
          options: EVIDENZE_OPTIONS,
        },
      },
    ],
  },
  {
    id: "evidenze-health",
    label: "Evidenze · HealthDCAT-AP (R7)",
    branding: { ...EVIDENZE_BRANDING, docTitle: "Evidenze · HealthDCAT-AP" },
    uiLocales: ["es", "ca"],
    presets: [
      {
        id: "empty",
        label: "Empty (new dataset)",
        state: { exampleId: "evidenze-health", shapesText: evidenzeHealthShapes, dataText: "", options: EVIDENZE_HEALTH_OPTIONS },
      },
      {
        id: "msk",
        label: "AIFOS · MSK Cancer Therapy",
        state: {
          exampleId: "evidenze-health",
          shapesText: evidenzeHealthShapes,
          dataText: evidenzeHealthSampleData,
          options: EVIDENZE_HEALTH_OPTIONS,
        },
      },
    ],
  },
];
