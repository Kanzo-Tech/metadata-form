// Vite raw imports — bundles file contents as a string.
declare module "*?raw" {
  const content: string;
  export default content;
}
// Vite asset imports — resolves to the bundled URL string.
declare module "*.webp" {
  const src: string;
  export default src;
}
declare module "*.png" {
  const src: string;
  export default src;
}
declare module "*.ttl?raw" {
  const content: string;
  export default content;
}
