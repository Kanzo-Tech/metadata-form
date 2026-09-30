// Vite's `?raw` import of a Turtle file: its text, bundled as a string. The message
// graphs are data files (`messages.en.ttl`, `locales/*.ttl`), read as themselves
// rather than re-typed as string literals.
declare module "*.ttl?raw" {
  const content: string;
  export default content;
}
