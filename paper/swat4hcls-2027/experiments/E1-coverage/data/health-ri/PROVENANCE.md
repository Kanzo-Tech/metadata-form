# Health-RI metadata — vendored snapshot

- Source: https://github.com/Health-RI/health-ri-metadata
- Branch: `develop`
- Commit: `acec135965997d65e04b42d45728b7dd3f390c9b` (2026-08-25T07:16:25Z)
- Retrieved: 2026-08-26
- Licence: **CC-BY-4.0** (see `src/LICENSE`) — redistribution permitted with attribution.

Pruned to the SHACL formalisation, the test data and the licence/citation files.
Spreadsheets, images and CI config were dropped; re-fetch the tarball from the
commit above to restore them.

## Why this repository

`playground/examples/health-dcat-ap/SOURCE.md` already identifies it as the
upstream full SHACL shapes for HealthDCAT-AP / Health-RI. For E1 it gives us
several *independently authored* profiles in one place:

- `Core/PiecesShape/*.ttl` — per-class shapes, cross-referenced by `sh:node`
- `Core/ValidationShape/HRI-Datamodel-shapes.ttl` — the assembled validation graph
- `Core/FairDataPointShape/*.ttl` — the FAIR Data Point variant
- `Modules(Leaves_Petals)/{health,Imaging,Omics}` — domain modules
- `Core/ReusedCommunityStandards/dcatap.shapes.ttl` — DCAT-AP

Note `Core/ReusedCommunityStandards/dash.ttl`: DASH is vendored here as a reused
community standard. Relevant to §6 and to E2 — check whether these shapes use
DASH editor annotations, which would bear directly on the coverage claim.
