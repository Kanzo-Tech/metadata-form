/// <reference types="vite/client" />

/** The build-time knobs this playground reads. There is exactly one, and it names
 *  which deployment this build is — see `instance.ts` for what that decides. */
interface ImportMetaEnv {
  /** A `tenant` of the examples in `presets.ts` (`evidenze`). Unset, or one no example names = the showcase. */
  readonly VITE_MF_INSTANCE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
