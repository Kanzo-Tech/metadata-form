/**
 * The profile corpus.
 *
 * One entry per vendored SHACL profile. Kept apart from the harness so the
 * corpus can be read (and reviewed) without reading the measurement code.
 *
 * Every `sources` path is relative to the repo root. Every external profile has
 * a `data/<id>/PROVENANCE.md` recording source URL, retrieval date, licence and
 * commit/version — nothing is measured that is not traceable to a published
 * artefact.
 */

export interface ProfileSpec {
  id: string;
  label: string;
  /** Directories (recursive) and/or single files, relative to the repo root. */
  sources: string[];
  /** Substrings; any path containing one is skipped. */
  exclude?: string[];
  /** Who published it — `external` counts towards the generality claim. */
  origin: "external" | "ours";
  note?: string;
  /**
   * A re-serialisation or a redundant slice of another profile rather than an
   * independent one: measured and reported in full, but excluded from the
   * headline table so it cannot inflate n. Carries the evidence for that
   * judgement in its `note`.
   */
  variantOf?: string;
}

const DATA = "evaluation/coverage/data";
const HRI = `${DATA}/health-ri/src/Formalisation(shacl)`;
const DCATAP = `${DATA}/dcat-ap-3/src`;
const HDCAT = `${DATA}/healthdcat-ap/src`;
const DEDE = `${DATA}/dcat-ap-de/src`;
const FDP = `${DATA}/fair-data-point/src`;
const SPHN = `${DATA}/sphn/src`;
const BIO = `${DATA}/bioschemas/src`;
const SPDX = `${DATA}/spdx-3/src`;

export const PROFILES: ProfileSpec[] = [
  // ---------------------------------------------------------------- external
  {
    id: "dcat-ap-3",
    label: "DCAT-AP 3.0.1 (SEMIC)",
    origin: "external",
    sources: [`${DCATAP}/html-shacl`],
    exclude: ["imports.ttl", "mdr_imports.ttl"],
    note:
      "The upstream SEMIC release, not Health-RI's vendored copy. `shapes.ttl` " +
      "(core constraints) + `range.ttl` (class ranges) + `mdr-vocabularies.shape.ttl` " +
      "(controlled-vocabulary constraints) + `shapes_recommended.ttl` + " +
      "`deprecateduris.ttl`. The two `*imports*.ttl` files are owl:imports stubs " +
      "with no shapes in them and are excluded.",
  },
  {
    id: "healthdcat-ap",
    label: "HealthDCAT-AP Release 5 (European Commission)",
    origin: "external",
    sources: [
      `${HDCAT}/public-shapes.ttl`,
      `${HDCAT}/public-shapes_recommended.ttl`,
      `${HDCAT}/range.ttl`,
      `${HDCAT}/mdr-vocabularies.shape.ttl`,
    ],
    note:
      "The authoritative HealthDCAT-AP, migrated off GitHub to the Commission's " +
      "code.europa.eu in Sept 2025. Ships THREE sensitivity tiers of the same " +
      "shapes — public / restricted / non-public. The public tier is measured " +
      "here; the restricted tier is reported as a variant below.",
  },
  {
    id: "health-ri-core",
    label: "Health-RI Core (HealthDCAT-AP national implementation)",
    origin: "external",
    sources: [`${HRI}/Core/PiecesShape`],
    note: "Per-class shapes with cross-file sh:node references. DASH-annotated.",
  },
  {
    id: "dcat-ap-de",
    label: "DCAT-AP.de 2.0 (national extension, Germany)",
    origin: "external",
    sources: [
      `${DEDE}/dcat-ap-spec-german-additions.ttl`,
      `${DEDE}/dcat-ap-spec-german-messages.ttl`,
      `${DEDE}/dcat-ap-konventionen.ttl`,
      `${DEDE}/dcat-ap-de-deprecated.ttl`,
    ],
    note:
      "The national extension's OWN shapes. The release also ships a verbatim " +
      "copy of `dcat-ap_2.1.1_shacl_shapes.ttl`; it is excluded here because " +
      "DCAT-AP is already counted, and folding it in would double-count the core. " +
      "The richest profile in the corpus by construct variety.",
  },
  {
    id: "fair-data-point",
    label: "FAIR Data Point (FAIRDataTeam reference implementation)",
    origin: "external",
    sources: [`${FDP}`],
    note:
      "Not a specification document but the shapes a running FDP instance ships " +
      "and serves to its own metadata editor — the closest thing in the corpus to " +
      "a profile authored FOR a form. DASH-annotated throughout.",
  },
  {
    id: "sphn",
    label: "SPHN 2026.1 (Swiss Personalized Health Network)",
    origin: "external",
    sources: [`${SPHN}/shacl_2026-1.ttl`],
    note:
      "The corpus's non-DCAT health profile, and by two orders of magnitude its " +
      "largest single file (952 kB). Closed shapes throughout and ~480 SPARQL-based " +
      "constraints. Included precisely because it is the profile most likely to " +
      "break something.",
  },
  {
    id: "bioschemas",
    label: "Bioschemas profiles v20250219",
    origin: "external",
    sources: [`${BIO}/bioschemas_profiles_shacl.ttl`],
    note:
      "32 life-science profiles in one file, generated from the Bioschemas " +
      "specifications. Every single path is an sh:alternativePath over the " +
      "http/https forms of a schema.org term — a complex path used not for " +
      "expressiveness but to paper over a namespace split. Carries sh:severity " +
      "and sh:description and NOTHING else: no datatype, no class, no maxCount, " +
      "no name. The corpus's worst case for type-fact inference, by construction.",
  },
  {
    id: "spdx-3",
    label: "SPDX 3.0.1 model",
    origin: "external",
    sources: [`${SPDX}/spdx-model.ttl`],
    note:
      "Not health, and not a metadata catalogue: the software bill-of-materials " +
      "model, published by the Linux Foundation as generated SHACL interleaved " +
      "with OWL axioms in one file. In the corpus as the out-of-domain control — " +
      "if the coverage number holds here it is not a fact about DCAT.",
  },
  {
    id: "health-ri-modules",
    label: "Health-RI domain modules (health, imaging, omics)",
    origin: "external",
    sources: [`${HRI}/Modules(Leaves_Petals)`],
    note: "Small; mostly rules rather than form-bearing shapes. Kept for honesty about size.",
  },
  // -------------------------------------------------------------------- ours
  {
    id: "evidenze-health",
    label: "Evidenze HealthDCAT-AP onboarding (ours)",
    origin: "ours",
    sources: ["examples/evidenze-health/shapes.ttl"],
    note: "Pure SHACL 1.2 + SHACL-UI. The deployment.",
  },
  {
    id: "evidenze-dataspace",
    label: "Evidenze data space onboarding (ours)",
    origin: "ours",
    sources: ["examples/evidenze-dataspace/shapes.ttl"],
    note: "Pure SHACL 1.2 + SHACL-UI.",
  },
  // ---------------------------------------------------------------- variants
  {
    id: "dcat-ap-3-generated",
    label: "DCAT-AP 3.0.1 — generated encoding",
    origin: "external",
    variantOf: "dcat-ap-3",
    sources: [`${DCATAP}/dcat-ap-SHACL.ttl`, `${DCATAP}/ranges.ttl`],
    note:
      "The SAME release, second encoding: `releases/3.0.1/shacl/` is generated " +
      "from the UML model, uses the `shacl:` prefix rather than `sh:`, closes " +
      "every node shape, and carries sh:name + sh:description on every one of its " +
      "290 property shapes — which the hand-maintained `html/shacl/` encoding of " +
      "the same spec has none of. Excluded from the headline (it is not an " +
      "independent profile) but the pair is the cleanest natural experiment in " +
      "the corpus: one spec, two encodings, measurably different forms.",
  },
  {
    id: "healthdcat-ap-restricted",
    label: "HealthDCAT-AP Release 5 — restricted tier",
    origin: "external",
    variantOf: "healthdcat-ap",
    sources: [`${HDCAT}/restricted-shapes.ttl`, `${HDCAT}/restricted-shapes_recommended.ttl`, `${HDCAT}/range.ttl`],
    note:
      "Same shape IRIs as the public tier with different severities/cardinalities " +
      "for sensitive properties. Reported to show the tiering; not an independent n.",
  },
  {
    id: "dcat-ap-vendored",
    label: "DCAT-AP as vendored by Health-RI",
    origin: "external",
    variantOf: "dcat-ap-3",
    sources: [`${HRI}/Core/ReusedCommunityStandards/dcatap.shapes.ttl`],
    note:
      "Health-RI's in-tree copy of DCAT-AP. Was the coverage experiment's 'DCAT-AP' row until the " +
      "upstream SEMIC release was vendored; demoted to a variant so DCAT-AP is " +
      "counted once. Kept because the drift between a vendored copy and its " +
      "upstream is itself worth a sentence.",
  },
  {
    id: "health-ri-fdp",
    label: "Health-RI FAIR Data Point shapes",
    origin: "external",
    variantOf: "health-ri-core",
    sources: [`${HRI}/Core/FairDataPointShape`],
    note:
      "NOT an independent profile. It declares the same shape IRIs (hri:AgentShape, " +
      "hri:CatalogShape, …) as PiecesShape, and its 178 sh:path lines collapse to the " +
      "same 137 distinct (shape, path) pairs — each FDP file is self-contained and " +
      "redefines the shared shapes, so concatenation merges them by identity. " +
      "Unrelated to the FAIRDataTeam `fair-data-point` profile above.",
  },
];

// Health-RI's `Core/ValidationShape/HRI-Datamodel-shapes.ttl` is the assembled
// concatenation of `Core/PiecesShape` — identical counts (143 sh:path, 141
// dash:editor, 143 sh:name). Deliberately absent above; see README.
//
// `Core/ReusedCommunityStandards/dash.ttl` is the DASH *vocabulary*, not a
// profile. A naive repo-wide grep for `dash:editor` finds 467 hits, most of them
// there. Never counted.
