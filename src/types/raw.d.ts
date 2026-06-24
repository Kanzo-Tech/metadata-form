// Vite raw imports — bundles file contents as a string.
declare module "*?raw" {
  const content: string;
  export default content;
}
declare module "*.ttl?raw" {
  const content: string;
  export default content;
}

declare module "@rdfjs/dataset" {
  import type { DatasetCore, Quad } from "@rdfjs/types";
  const factory: { dataset(quads?: Quad[]): DatasetCore };
  export default factory;
}
