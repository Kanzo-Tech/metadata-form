import { healthDcatApShapes, healthDcatApSampleData } from "@examples/health-dcat-ap/index.js";
import { evidenzeShapes, evidenzeSampleData, evidenzeLogo, evidenzeIcon, evidenzeRootShape } from "@examples/evidenze-dataspace/index.js";
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
  /** Radix accent color name closest to the brand (adapts to light/dark). */
  accentColor?: string;
  /** Radix gray color name. */
  grayColor?: string;
  /** Preferred appearance for this example (the brand's default look). The example
   *  wins while active and reverts when you switch away — same as the accent. */
  appearance?: "light" | "dark";
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

const OPTIONS: PermalinkOptions = { validateOn: "change" };
// Evidenze declares its root shape explicitly, so focus/root resolution is exact
// regardless of how many typed resources the data graph carries.
const EVIDENZE_OPTIONS: PermalinkOptions = { validateOn: "change", rootShape: evidenzeRootShape };

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
        state: { v: 1, exampleId: "health-dcat-ap", shapesText: healthDcatApShapes, dataText: "", options: OPTIONS },
      },
      {
        id: "covid",
        label: "COVID-19 registry",
        state: {
          v: 1,
          exampleId: "health-dcat-ap",
          shapesText: healthDcatApShapes,
          dataText: healthDcatApSampleData,
          options: OPTIONS,
        },
      },
    ],
  },
  {
    id: "evidenze-dataspace",
    label: "Evidenze Data Space (SHACL 1.2)",
    // Evidenze's own identity (colours from their site: navy #091a40, blue
    // #1d4ebd, green #27b564) — the app wears it while this example is active.
    branding: {
      logoUrl: evidenzeLogo,
      logoRatio: 677 / 115,
      accentColor: "indigo",
      grayColor: "slate",
      appearance: "dark",
      docTitle: "Evidenze · Dataset Onboarding",
      faviconUrl: evidenzeIcon,
      tint: true,
    },
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
];
