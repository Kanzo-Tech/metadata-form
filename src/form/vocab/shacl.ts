import { NS } from "../../engine/factory.js";

/**
 * The single SHACL Core IRI constant the form layer still needs: the `sh:IRI`
 * nodeKind individual, used to map IRI-valued properties to an IRI editor.
 * (Everything else SHACL-specific now comes from rudof's projected IR.)
 */
export const SH_IRI = `${NS.sh}IRI` as const;
