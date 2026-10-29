// The form in an iframe (`@kanzo-tech/metadata-form/embed`): the app's side of
// the page shipped in `dist/frame/`. See ./protocol.ts for the messages.
export { createMetadataFormFrame } from "./host.js";
export type { MetadataFormFrame as MetadataFormFrameController, MetadataFormFrameOptions } from "./host.js";
export { MetadataFormFrame } from "./react.js";
export type { MetadataFormFrameHandle, MetadataFormFrameProps } from "./react.js";
export { DEFAULT_EMBED_TEXTS, EMBED_TEXTS, isEmbedMessage, isHostMessage } from "./protocol.js";
export type {
  EmbedConfig,
  EmbedState,
  EmbedTexts,
  EmbedToHost,
  EmbedVariant,
  HostToEmbed,
} from "./protocol.js";
