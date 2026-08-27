import { themeIndex, type SectionPolicy } from "@kanzo-tech/theme";
import type { Appearance, ThemeOption } from "@kanzo-tech/ui";
import { EXAMPLES, type ExampleBranding, type ShapeExample } from "./presets.js";
import type { PermalinkState } from "./lib/permalink.js";

/**
 * **Who this deployment is.** One module, read once at boot.
 *
 * The playground and a client's standing metadata-form are the same build with a
 * different answer here: which shape sets it ships, which themes it publishes, whose
 * logo is in the header. Without this the client case grows as special cases inside
 * the permalink, which is the trap the plan named — a permalink is about a document,
 * an instance is about the deployment, and only the second one is allowed to know a
 * brand's name.
 *
 * **Build-time only, deliberately** (`VITE_MF_INSTANCE`, decision D3). The shapes
 * drive the entire form, so resolving them over the network would mean a form that
 * flashes, needs the network, and cannot run offline. The runtime layer is cut until
 * somebody actually needs to change a logo without a rebuild; this module is the one
 * place that knows the resolution order, so adding a step later is cheap.
 */
export interface Instance {
  id: string;
  /** The themes this tenant publishes, i.e. what the Preferences colour section may
   *  offer. Two is the floor: the section renders only with more than one entry, and
   *  it is also the page's only light/dark control. */
  themes: ThemeOption[];
  /** The theme each side defers to while nobody has chosen — never a preference, so
   *  it cannot overwrite one. A branded example's own pair overrides it. */
  defaultTheme: Partial<Record<Appearance, string>>;
  /** The identity worn when no branded example is active. */
  branding?: ExampleBranding;
  shapeSets: ShapeExample[];
  defaultShapeSet: string;
}

/** Every published theme, as the Preferences colour section wants them. Generated
 *  from the directory upstream, so this list cannot drift from what the sheet paints. */
const ALL_THEMES: ThemeOption[] = themeIndex.map((t) => ({ value: t.name, label: t.name }));

/** Exactly the named ones, in the order given. What a client publishes: two entries,
 *  so the section still renders and appearance still works.
 *  **Never `policy.pinned`** — pinning sets `offered: false`, the section filters to a
 *  single entry and returns null, and the deployment ends up with no appearance
 *  control at all. Publishing two is how you say "these are ours". */
const themesNamed = (...names: string[]): ThemeOption[] =>
  names.map((name) => ALL_THEMES.find((t) => t.value === name) ?? { value: name, label: name });

/** The default instance: the showcase. It ships every example and publishes all 29
 *  themes, because being a catalogue is what it is for. */
const PLAYGROUND: Instance = {
  id: "playground",
  themes: ALL_THEMES,
  defaultTheme: { light: "kanzo", dark: "kanzo-dark" },
  shapeSets: EXAMPLES,
  defaultShapeSet: EXAMPLES[0].id,
};

/** A client instance: their shapes, their two themes, their name on the tab. The
 *  branding is not repeated here — it is the example's, and this reads it. */
const EVIDENZE: Instance = {
  id: "evidenze",
  themes: themesNamed("bank", "night"),
  defaultTheme: { light: "bank", dark: "night" },
  branding: EXAMPLES.find((e) => e.id === "evidenze-dataspace")?.branding,
  shapeSets: EXAMPLES.filter((e) => e.id.startsWith("evidenze-")),
  defaultShapeSet: "evidenze-health",
};

const REGISTRY: Record<string, Instance> = { playground: PLAYGROUND, evidenze: EVIDENZE };

/** This deployment. `VITE_MF_INSTANCE` is read at build time, so an unknown name is a
 *  typo in a deploy config — fall back to the showcase rather than to a blank page. */
export const INSTANCE: Instance = REGISTRY[import.meta.env.VITE_MF_INSTANCE ?? ""] ?? PLAYGROUND;

/** The examples this deployment ships, and the state it opens on. */
export const shapeSets = INSTANCE.shapeSets;
export const defaultState = (): PermalinkState => {
  const example = shapeSets.find((e) => e.id === INSTANCE.defaultShapeSet) ?? shapeSets[0];
  return { ...example.presets[0].state, presetId: example.presets[0].id };
};

/**
 * Resolve a by-reference permalink against what this deployment ships.
 *
 * Returns null when the link names a shape set we do not have — which is the honest
 * outcome of decision D2 rather than a bug: an id-only link resolves only where that
 * shape set lives, and the caller says so instead of silently opening something else.
 */
export const resolveReference = (exampleId: string, presetId: string): PermalinkState | null => {
  const example = shapeSets.find((e) => e.id === exampleId);
  const preset = example?.presets.find((p) => p.id === presetId);
  return preset ? { ...preset.state, presetId: preset.id } : null;
};

/** The identity to wear: the active example's, or the instance's own. */
export const brandingFor = (example: ShapeExample | undefined): ExampleBranding | undefined =>
  example?.branding ?? INSTANCE.branding;

/** The theme pair to defer to. An example's brand overrides the instance's on both
 *  sides at once — half a brand is worse than none. */
export const defaultThemeFor = (example: ShapeExample | undefined): Partial<Record<Appearance, string>> =>
  brandingFor(example)?.theme ?? INSTANCE.defaultTheme;

/**
 * **The half of D1 that upstream does not do yet, and the interim it asked for.**
 *
 * `defaultTheme` names the theme the panel shows as selected; it does **not** reach
 * `<html>`. The provider writes `data-theme` from the resolution chain only — pinned →
 * stored → the tenant's starting point → the declaration's `""`, i.e. "whatever
 * `:root` paints" — and `defaultTheme` is not one of those links. Making it one was
 * tried and reverted: it breaks three upstream guards that exist to keep a host which
 * configured nothing with the `<html>` it had before ("never touches `<html>`",
 * "unsets every axis", "writes the other side without repainting the one being read").
 *
 * The link that *does* paint is a tenant's starting point, which is spelled `policy`.
 * So a brand travels as a policy **default** — never `pinned`, which would set
 * `offered: false`, filter the colour section to one entry and leave the deployment
 * with no appearance control at all (D4).
 *
 * The cost of the interim, said out loud: a policy default is ONE name for both sides,
 * so the appearance is defaulted to that theme's own side rather than the pair being
 * honoured. Also a default, so the reader can still move either. It stops being needed
 * the day `defaultTheme` joins the chain upstream.
 */
export const policyFor = (example: ShapeExample | undefined): Record<string, SectionPolicy> | undefined => {
  const pair = brandingFor(example)?.theme;
  if (!pair) return undefined;
  // Lead with the dark side: a brand that publishes a pair is usually known by it, and
  // Evidenze — the one we have — is navy.
  const lead = pair.dark;
  const side = themeIndex.find((t) => t.name === lead)?.dark ? "dark" : "light";
  return { theme: { themeByAppearance: { default: lead }, appearance: { default: side } } };
};
