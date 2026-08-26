import { healthDcatApShapes, healthDcatApSampleData, healthDcatApRootShape } from "@examples/health-dcat-ap/index.js";
import { evidenzeShapes, evidenzeSampleData, evidenzeLogo, evidenzeIcon, evidenzeRootShape } from "@examples/evidenze-dataspace/index.js";
import { evidenzeHealthShapes, evidenzeHealthSampleData, evidenzeHealthRootShape } from "@examples/evidenze-health/index.js";
import type { PermalinkOptions, PermalinkState } from "./lib/permalink.js";

/** Optional per-example branding — lets a bundled example wear its own identity
 *  (logo + brand accent), so the playground doubles as a client-branded demo. The
 *  accent is a Radix scale, so it adapts to light/dark automatically; `appearance`
 *  and layout stay owned by the user's Preferences. */
export interface ExampleBranding {
  /** Bundled asset URL of the (white) wordmark shown in the app title. */
  logoUrl?: string;
  /** Intrinsic width/height ratio of the wordmark, for crisp sizing. */
  logoRatio?: number;
  /**
   * A published theme name from `@kanzo-tech/theme` (e.g. `"night"`, `"nord"`,
   * `"kanzo-dark"`). The example wears it while active and it reverts when you
   * switch away.
   *
   * This replaced a Radix `accentColor` + `grayColor` + `appearance` triple. A
   * brand is not a hue plus a mode here: it is a theme, a flat block of CSS that
   * travels in the page under its own `[data-theme]`, so naming one is the whole
   * of it and the light/dark sides come with it.
   *
   * **Declared but not yet applied, deliberately.** `ThemePrefs.theme` is a map
   * per appearance side, not a string, and the only way to set it is through the
   * provider's preference store — which is what the user chose in the Preferences
   * panel, and is persisted. Wiring this naively means opening an example silently
   * rewrites somebody's saved theme, and reverting on switch cannot recover a
   * choice made *while* an example was active.
   *
   * The open question is whose choice wins, and it is a product decision rather
   * than a mechanical one: either a brand is a non-persisting overlay the provider
   * would have to support, or an example may not override a stated preference at
   * all. Left unwired until that is answered.
   */
  theme?: string;
  /** Browser-tab title while this example is active. */
  docTitle?: string;
  /** Bundled asset URL for the browser-tab favicon (the brand mark). */
  faviconUrl?: string;
  /** Tint the app chrome (top edge + header) with the brand accent — subtle, and
   *  adapts to light/dark since it uses Radix accent tokens. */
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

/** Evidenze branding, shared by both Evidenze examples. */
const EVIDENZE_BRANDING: ExampleBranding = {
  logoUrl: evidenzeLogo,
  logoRatio: 677 / 115,
  theme: "night",
  docTitle: "Evidenze · Dataset Onboarding",
  faviconUrl: evidenzeIcon,
  tint: true,
};

/** Bundled examples as permalink presets: picking one applies its state and syncs
 *  the URL — the exact same path as opening a shared link. The content is authored
 *  as the Turtle files under `playground/examples/` and embedded into the presets
 *  here, so there is one runtime representation (a `PermalinkState`) for both. */
export const EXAMPLES: ShapeExample[] = [
  {
    id: "health-dcat-ap",
    label: "HealthDCAT-AP",
    presets: [
      {
        id: "empty",
        label: "Empty (new dataset)",
        state: { v: 1, exampleId: "health-dcat-ap", shapesText: healthDcatApShapes, dataText: "", options: HEALTH_OPTIONS },
      },
      {
        id: "covid",
        label: "COVID-19 registry",
        state: {
          v: 1,
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
    label: "Evidenze Data Space (SHACL 1.2)",
    // Evidenze's own identity (colours from their site: navy #091a40, blue
    // #1d4ebd, green #27b564) — the app wears it while this example is active.
    branding: EVIDENZE_BRANDING,
    uiLocales: ["es", "ca"],
    presets: [
      {
        id: "empty",
        label: "Empty (new dataset)",
        state: { v: 1, exampleId: "evidenze-dataspace", shapesText: evidenzeShapes, dataText: "", options: EVIDENZE_OPTIONS },
      },
      {
        id: "restricted",
        label: "Registro oncológico (acceso restringido)",
        state: {
          v: 1,
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
        state: { v: 1, exampleId: "evidenze-health", shapesText: evidenzeHealthShapes, dataText: "", options: EVIDENZE_HEALTH_OPTIONS },
      },
      {
        id: "msk",
        label: "AIFOS · MSK Cancer Therapy",
        state: {
          v: 1,
          exampleId: "evidenze-health",
          shapesText: evidenzeHealthShapes,
          dataText: evidenzeHealthSampleData,
          options: EVIDENZE_HEALTH_OPTIONS,
        },
      },
    ],
  },
];
