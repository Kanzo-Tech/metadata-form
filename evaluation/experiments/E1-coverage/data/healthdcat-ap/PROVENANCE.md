# HealthDCAT-AP Release 5 — vendored snapshot

- Source: https://healthdataeu.pages.code.europa.eu/healthdcat-ap/releases/release-5/
- Repository: https://code.europa.eu/healthdataeu/healthdcat-ap (GitLab project `1256`, public)
- Version: **Release 5**, status *European Commission Draft Specification*, published 2025-09-22
- Repository HEAD at retrieval: `e90053e73b3c5252706efa16afd4da424875e1b1` (2026-05-08)
- Retrieved: 2026-08-27
- Licence: **CC-BY-4.0** — "Copyright © 2025 European Union. All material in this
  repository is published under the license CC-BY 4.0, unless explicitly otherwise
  mentioned." (stated in the specification document itself; the repository carries
  no LICENSE file, and the GitLab API reports no licence key)
- Publisher: European Commission, HealthData@EU.

## Why this source and not GitHub

The former `healthdcat-ap.github.io` was **decommissioned on 2025-09-22** and its
shapes now sit under `OldContent/` in the archived repository. Its README names
code.europa.eu Release 5 as "the current and authoritative version". A later
Release 6 existed and was deprecated ("Deprecation of Release 6 and update latest
link", 2026-04-24), so Release 5 is what `releases/latest/` resolves to.

## Files

`src/` is `releases/release-5/html/shacl/` verbatim. The profile ships **three
sensitivity tiers of the same shapes**:

- `public-shapes.ttl` + `public-shapes_recommended.ttl` — measured as `healthdcat-ap`
- `restricted-shapes.ttl` + `restricted-shapes_recommended.ttl` — measured as the
  variant `healthdcat-ap-restricted`
- `non-public-shapes.ttl` + `non-public-shapes_recommended.ttl` — vendored, not measured
- `range.ttl`, `mdr-vocabularies.shape.ttl` — shared, folded into the public tier
- `imports.ttl`, `mdr_imports.ttl` — `owl:imports` stubs, no shapes

Note that `public-shapes.ttl` binds `:` to the **DCAT-AP** shapes namespace
(`https://semiceu.github.io/DCAT-AP/releases/3.0.0/html/shacl/shapes.ttl#`) and
extends the DCAT-AP shape IRIs in place rather than declaring its own.
