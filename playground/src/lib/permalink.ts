import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

/** The form knobs a permalink carries — a subset of UseMetadataFormOptions (the
 *  shapes/data travel separately as their own fields). */
export interface PermalinkOptions {
  validateOn?: "change" | "manual" | "off";
  focusNode?: string;
  rootShape?: string;
  locale?: string;
}

/**
 * The playground's whole state, resolved. Not the wire format — see {@link Wire}.
 *
 * A bundled preset and a decoded link produce the same object, which is why example
 * selection and URL hydration can be one code path (`useWorkspace.applyPreset`).
 */
export interface PermalinkState {
  exampleId: string;
  /** The bundled preset this state came from, when it came from one. Only a state
   *  that still *is* its preset can be shared by reference. */
  presetId?: string;
  shapesText: string;
  dataText: string;
  options: PermalinkOptions;
  /** The UI language the reader had chosen — a view knob, not a document one, but
   *  a link to a Spanish form that opens in English is the wrong document to them. */
  locale?: string;
}

/**
 * What actually travels in the fragment.
 *
 * **Two forms, one envelope.** A link to an unedited bundled example carries its id
 * and nothing else — 40-odd characters instead of the 15.5 KB the embedded form
 * measured on the Evidenze example, which is past what chat and mail carry intact.
 * The moment anything is edited the link embeds, because there is then nothing on
 * the other end to reference.
 *
 * The trade, said out loud: a by-reference link resolves only on a deployment that
 * ships that shape set. That is exactly what an instance is — see `instance.ts`.
 */
type Wire =
  | { v: 2; ex: string; preset: string }
  | { v: 2; ex: string; shapes: string; data: string; options: PermalinkOptions; locale?: string }
  /** v1: always embedded, `exampleId`/`shapesText`/`dataText` spelled in full. Links
   *  already shared are still links, so we read it; we never write it. */
  | { v: 1; exampleId: string; shapesText: string; dataText: string; options: PermalinkOptions };

/** Serialize → lz-string compress → URL-safe string for `location.hash`. The
 *  fragment never reaches a server, so even large shapes/data stay self-contained.
 *  `pristine` says the state is still, byte for byte, the bundled preset it names —
 *  only the caller that owns the baseline can know that. */
export function encodeState(state: PermalinkState, pristine: boolean): string {
  const wire: Wire =
    pristine && state.presetId
      ? { v: 2, ex: state.exampleId, preset: state.presetId }
      : {
          v: 2,
          ex: state.exampleId,
          shapes: state.shapesText,
          data: state.dataText,
          options: state.options,
          ...(state.locale ? { locale: state.locale } : {}),
        };
  return compressToEncodedURIComponent(JSON.stringify(wire));
}

/**
 * What a fragment turned out to be.
 *
 * **"Absent" and "unreadable" are different answers and were the same one.** Both
 * used to be `null`, so a fragment truncated by a chat client — the very failure
 * long links invite — opened the default example without a word, which from the
 * sharer's side is indistinguishable from Share doing nothing at all. `unreadable`
 * exists so somebody can be told.
 */
export type Decoded =
  | { status: "empty" }
  | { status: "ok"; state: PermalinkState }
  | { status: "unreadable" }
  /** Well-formed, and names a shape set this deployment does not ship — the cost of
   *  by-reference links, and the one case worth naming rather than lumping in. */
  | { status: "unknown"; exampleId: string };

/**
 * Inverse of {@link encodeState}. By-reference links need the catalogue to resolve
 * against, and this module must not import it — `presets.ts` imports these types —
 * so the caller passes the lookup in.
 */
export function decodeState(
  hash: string,
  resolve: (exampleId: string, presetId: string) => PermalinkState | null,
): Decoded {
  const raw = hash.replace(/^#/, "");
  if (!raw) return { status: "empty" };
  let wire: Wire;
  try {
    const json = decompressFromEncodedURIComponent(raw);
    if (!json) return { status: "unreadable" };
    wire = JSON.parse(json) as Wire;
  } catch {
    return { status: "unreadable" };
  }

  if (wire?.v === 1) {
    if (typeof wire.shapesText !== "string" || typeof wire.dataText !== "string") return { status: "unreadable" };
    return {
      status: "ok",
      state: {
        exampleId: wire.exampleId,
        shapesText: wire.shapesText,
        dataText: wire.dataText,
        options: wire.options ?? {},
      },
    };
  }
  if (wire?.v !== 2 || typeof wire.ex !== "string") return { status: "unreadable" };

  if ("preset" in wire) {
    const state = resolve(wire.ex, wire.preset);
    return state ? { status: "ok", state } : { status: "unknown", exampleId: wire.ex };
  }
  if (typeof wire.shapes !== "string" || typeof wire.data !== "string") return { status: "unreadable" };
  return {
    status: "ok",
    state: {
      exampleId: wire.ex,
      shapesText: wire.shapes,
      dataText: wire.data,
      options: wire.options ?? {},
      locale: wire.locale,
    },
  };
}
