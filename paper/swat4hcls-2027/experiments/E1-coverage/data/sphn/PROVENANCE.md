# SPHN 2026.1 SHACL — vendored snapshot

- Source: https://git.dcc.sib.swiss/sphn-semantic-framework/sphn-schema
  (SIB GitLab, project `166`)
- Path: `quality_assurance/shacl/shacl_2026-1.ttl`
- Release tag: **2026-1** (2026-01-28)
- Last commit touching the file: `64bc9ade396e42423409f111cdefd7edba2bce62` (2026-01-28);
  content commit `4f16cedde796847597061c139ec3f2d16c5bed61` (2026-01-20, "added sparqls + shacls 2026.1")
- Retrieved: 2026-08-27
- Licence: **CC-BY-4.0** (`src/LICENSE`, Attribution 4.0 International; GitLab
  declares `cc-by-4.0`) — redistribution permitted with attribution.
- Publisher: Swiss Personalized Health Network (SPHN), SIB Swiss Institute of Bioinformatics.
- Release series: 2023-2, 2024-1, 2024-2, 2025-1, 2025-2, 2026-1.

## Why it is in the corpus

The only **non-DCAT health profile** available as real published SHACL, and by
two orders of magnitude the largest single file measured (930 kB, 1744 node
shapes). It was vendored specifically because it is the profile most likely to
break something: every shape is `sh:closed` with `sh:ignoredProperties`, roughly
two thirds of its node shapes are SPARQL-constraint shapes carrying no
`sh:property` at all, and it is the only profile in the corpus that uses
`sh:sequencePath` at scale.
