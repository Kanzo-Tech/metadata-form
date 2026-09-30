import { paperConditionalShapes, paperConditionalSampleData, paperConditionalRootShape } from "@examples/paper-conditional/index.js";
import { paperTargetWhereShapes, paperTargetWhereSampleData, paperTargetWhereRootShape } from "@examples/paper-target-where/index.js";
import { paperMappingShapes, paperMappingSampleData, paperMappingRootShape } from "@examples/paper-mapping/index.js";
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

// Each example declares its root shape explicitly, so focus/root resolution is
// exact regardless of how many typed resources the data graph carries.
const PAPER_CONDITIONAL_OPTIONS: PermalinkOptions = { validateOn: "change", rootShape: paperConditionalRootShape };
const PAPER_TARGET_WHERE_OPTIONS: PermalinkOptions = { validateOn: "change", rootShape: paperTargetWhereRootShape };
const PAPER_MAPPING_OPTIONS: PermalinkOptions = { validateOn: "change", rootShape: paperMappingRootShape };

/** Bundled examples as permalink presets: picking one applies its state and syncs
 *  the URL — the exact same path as opening a shared link. The content is authored
 *  as the Turtle files under `examples/` and embedded into the presets
 *  here, so there is one runtime representation (a `PermalinkState`) for both. */
const PAPER_TARGET_WHERE: ShapeExample = {
  id: "paper-target-where",
  label: "The same condition with sh:targetWhere",
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
    label: "A conditional field",
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
  PAPER_TARGET_WHERE,
  {
    id: "paper-mapping",
    label: "From shapes to fields",
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
];

/** The state the playground opens on: the first example's first preset. */
export const defaultState = (): PermalinkState => {
  const [example] = EXAMPLES;
  return { ...example.presets[0].state, presetId: example.presets[0].id };
};

/**
 * Resolve a by-reference permalink against the examples this build ships.
 *
 * Returns null when the link names one we do not have: an id-only link resolves only
 * where that example lives, and the caller says so instead of silently opening
 * something else.
 */
export const resolveReference = (exampleId: string, presetId: string): PermalinkState | null => {
  const example = EXAMPLES.find((e) => e.id === exampleId);
  const preset = example?.presets.find((p) => p.id === presetId);
  return preset ? { ...preset.state, presetId: preset.id } : null;
};
