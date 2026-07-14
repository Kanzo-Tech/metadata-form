import shapes from "./shapes.ttl?raw";
import sample from "./sample.ttl?raw";
import logo from "./logo-white.webp";
import icon from "./icon.png";

/** Evidenze's wordmark (their official white wordmark) — a bundled asset URL, shown
 *  recoloured in the app title so it reads on the light or dark chrome. */
export const evidenzeLogo: string = logo;
/** Evidenze's brand mark (the tri-bar symbol) — used as the browser-tab favicon. */
export const evidenzeIcon: string = icon;

/**
 * Evidenze Data Space — dataset onboarding, authored in pure SHACL 1.2 + SHACL-UI
 * (`shui:`), no DASH. Shows conditional rendering: choosing "Restringido" for
 * access rights reveals (and requires) a justification field via `sh:if`/`sh:then`.
 * See `shapes.ttl`.
 */
export const evidenzeShapes: string = shapes;
export const evidenzeSampleData: string = sample;
export const evidenzeRootShape = "https://dataspace.evidenze.example/shapes#DatasetOnboardingShape";
