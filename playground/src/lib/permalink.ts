import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

/** The form knobs a permalink carries — a subset of UseMetadataFormOptions (the
 *  shapes/data travel separately as their own fields). */
export interface PermalinkOptions {
  validateOn?: "change" | "manual" | "off";
  focusNode?: string;
  rootShape?: string;
  locale?: string;
}

/** Versioned, self-contained playground state encoded into the URL fragment. The
 *  `v` prefix lets `decodeState` reject payloads from an incompatible schema. */
export interface PermalinkState {
  v: 1;
  exampleId: string;
  shapesText: string;
  dataText: string;
  options: PermalinkOptions;
}

/** Serialize → lz-string compress → URL-safe string for `location.hash`. The
 *  fragment never reaches a server, so even large shapes/data stay self-contained. */
export function encodeState(state: PermalinkState): string {
  return compressToEncodedURIComponent(JSON.stringify(state));
}

/** Inverse of {@link encodeState}. Returns null for an empty, corrupt, or
 *  incompatible-version payload so the caller can fall back to the default example. */
export function decodeState(hash: string): PermalinkState | null {
  const raw = hash.replace(/^#/, "");
  if (!raw) return null;
  try {
    const json = decompressFromEncodedURIComponent(raw);
    if (!json) return null;
    const parsed = JSON.parse(json) as PermalinkState;
    if (parsed?.v !== 1 || typeof parsed.shapesText !== "string" || typeof parsed.dataText !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
