# HealthDCAT-AP profile — source & provenance

`shapes.ttl` in this folder is a **curated demo subset** of the HealthDCAT-AP /
Health-RI metadata model, authored for this library to exercise the form engine
end-to-end (DASH editors, property groups, nested node shapes, enumerations,
multi-value and live SHACL validation).

It is **not** the complete official specification. It models the core
`dcat:Dataset` properties plus a few HealthDCAT-AP health-specific properties
(`health:healthTheme`, `health:populationCoverage`, `health:numberOfRecords`,
`health:hasCodeSystem`) and nested `foaf:Agent` (publisher), `vcard:Kind`
(contact point) and `dcat:Distribution` shapes.

## Upstream references

- HealthDCAT-AP specification: https://healthdcat-ap.github.io/
- Health-RI metadata (full SHACL shapes, split across files):
  https://github.com/Health-RI/health-ri-metadata
  → `Formalisation(shacl)/Core/PiecesShape/*.ttl` and
    `Formalisation(shacl)/Core/ValidationShape/HRI-Datamodel-shapes.ttl`
- EU HealthDCAT-AP releases:
  https://healthdataeu.pages.code.europa.eu/healthdcat-ap/

## Replacing with the official shapes

The official shapes use cross-file `sh:node` references and do not carry DASH
editor hints or `sh:group` sections. To use them:

1. Concatenate the relevant `*.ttl` pieces into a single graph.
2. Optionally add `sh:group` / `dash:editor` annotations for nicer layout.
3. Pass that Turtle as `shapes` with the correct `rootShape`.

The editor engine still works without DASH hints — it falls back to the
datatype/nodeKind-based selection in `src/core/editors/selectEditor.ts`.

## License

Upstream Health-RI metadata is published under the license in their repository
(see the repo `LICENSE`). This curated subset is provided for demonstration; if
you redistribute the official shapes, retain their license and attribution.
