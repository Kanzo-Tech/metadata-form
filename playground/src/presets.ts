import { healthDcatApShapes, healthDcatApSampleData } from "@examples/health-dcat-ap/index.js";
import type { PermalinkOptions, PermalinkState } from "./lib/permalink.js";

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
}

const OPTIONS: PermalinkOptions = { validateOn: "change" };

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
];
