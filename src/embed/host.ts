import {
  isEmbedMessage,
  type EmbedConfig,
  type EmbedState,
  type HostToEmbed,
} from "./protocol.js";

export interface MetadataFormFrameOptions {
  /** What the frame shows: the shapes (one or more variants), languages, texts. */
  config: EmbedConfig;
  /** Every edit: validity, error and warning counts, the record as JSON-LD. */
  onChange?: (state: EmbedState) => void;
  /** The form is up. */
  onReady?: () => void;
  /** The content height. By default the iframe takes it, so it never scrolls. */
  onResize?: (height: number) => void;
}

/** The app's handle on a framed form. */
export interface MetadataFormFrame {
  /** Mark every field with an error (e.g. a submit pressed too early). */
  revealErrors(): void;
  /** Start the form again, empty (e.g. after the record was saved). */
  reset(): void;
  /** Send another configuration. The form starts again only if the variants
   *  change; another language or other texts re-word it, keeping what was typed. */
  configure(config: EmbedConfig): void;
  /** Stop listening to the frame. */
  destroy(): void;
}

/**
 * Talk to the form inside `iframe` (the page from `dist/frame/`, served by the
 * app). Sends the configuration as soon as the frame asks for it and hands the
 * form's state to `onChange`. Only messages from that iframe's window and the
 * origin of its `src` are read, and messages are only written to that origin.
 *
 * When the frame is served from another origin than the app, its URL must say
 * the app's: `…/index.html?origin=https://app.example`.
 */
export function createMetadataFormFrame(
  iframe: HTMLIFrameElement,
  options: MetadataFormFrameOptions,
): MetadataFormFrame {
  let config = options.config;
  const frameOrigin = () =>
    new URL(iframe.getAttribute("src") ?? "", window.location.href).origin;
  const send = (message: HostToEmbed) =>
    iframe.contentWindow?.postMessage(message, frameOrigin());

  function onMessage(e: MessageEvent) {
    if (e.source !== iframe.contentWindow || e.origin !== frameOrigin()) return;
    if (!isEmbedMessage(e.data)) return;
    const m = e.data;
    if (m.type === "mf:waiting") send({ type: "mf:init", config });
    if (m.type === "mf:ready") options.onReady?.();
    if (m.type === "mf:resize") {
      if (options.onResize) options.onResize(m.height);
      else iframe.style.height = `${Math.ceil(m.height)}px`;
    }
    if (m.type === "mf:change") {
      options.onChange?.({ valid: m.valid, errors: m.errors, warnings: m.warnings, jsonLd: m.jsonLd });
    }
  }
  window.addEventListener("message", onMessage);

  // The frame may have loaded before we listened: send the configuration now
  // (the frame ignores it if it already has the same one) and ask it to
  // repeat its state. If it has not loaded yet, its `mf:waiting` will come.
  send({ type: "mf:init", config });
  send({ type: "mf:sync" });

  return {
    revealErrors: () => send({ type: "mf:reveal-errors" }),
    reset: () => send({ type: "mf:reset" }),
    configure(next) {
      config = next;
      send({ type: "mf:init", config });
    },
    destroy: () => window.removeEventListener("message", onMessage),
  };
}
