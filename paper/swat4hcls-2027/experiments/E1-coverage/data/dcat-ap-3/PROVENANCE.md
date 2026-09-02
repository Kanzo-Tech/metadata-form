# DCAT-AP 3.0.1 — vendored snapshot

- Source: https://github.com/SEMICeu/DCAT-AP
- Release: **3.0.1**, published 2026-06-04 (tag object `21f43cee5d61aa29e729e2e9193fc697f7b63861`)
- Last commit touching `releases/3.0.1/shacl`: `729eddfc176d0afee5850ade6528f96f72579412` (2025-07-10)
- Retrieved: 2026-08-27
- Licence: **CC-BY-4.0** (declared on the repository) — redistribution permitted with attribution.
- Publisher: SEMIC / ISA² programme, European Commission.
- Canonical HTML: https://semiceu.github.io/DCAT-AP/releases/3.0.1/

## What is here, and why there are two of them

The release publishes the *same* application profile as SHACL **twice**:

- `src/html-shacl/` ← `releases/3.0.1/html/shacl/` — the hand-maintained encoding.
  `shapes.ttl` (core constraints), `range.ttl` (class ranges),
  `mdr-vocabularies.shape.ttl` (controlled-vocabulary constraints),
  `shapes_recommended.ttl`, `deprecateduris.ttl`, plus two `*imports*.ttl` stubs
  that contain only `owl:imports` and no shapes.
- `src/dcat-ap-SHACL.ttl` + `src/ranges.ttl` ← `releases/3.0.1/shacl/` — generated
  from the UML model. Binds the SHACL namespace to `shacl:` rather than `sh:`,
  closes every node shape, and carries `sh:name` + `sh:description` on all 290 of
  its property shapes.

E1 measures the first as the profile (`dcat-ap-3`) and the second as a variant
(`dcat-ap-3-generated`), so DCAT-AP is counted once. The pair is the corpus's
only controlled comparison of two encodings of one specification.

No LICENSE file exists at the repository root; the licence above is the one
GitHub reports for the repository and the one stated on the specification pages.
