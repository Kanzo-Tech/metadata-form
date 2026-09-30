# DCAT-AP.de 2.0 — vendored snapshot

- Source: https://github.com/GovDataOfficial/DCAT-AP.de
- Path: `Releases/DCAT-AP.de V2.0/shacl/`
- Last commit touching that directory: `6d8ccac44da1474c019a4b0bfc3cf1341ee0cec1` (2024-04-17)
- Retrieved: 2026-08-27
- Licence: **CC-BY-4.0** (`src/LICENSE`, Attribution 4.0 International) — redistribution permitted with attribution.
- Publisher: GovData (Bund/Länder open-data portal, Germany).

## Files

All six SHACL files of the V2.0 release are vendored. E1 measures only the four
that are DCAT-AP.de's **own** contribution:

- `dcat-ap-spec-german-additions.ttl` — the national extension proper
- `dcat-ap-spec-german-messages.ttl` — `sh:message`, in German
- `dcat-ap-konventionen.ttl` — national conventions
- `dcat-ap-de-deprecated.ttl` — deprecation shapes

Excluded from the measurement, kept for completeness:

- `dcat-ap_2.1.1_shacl_shapes.ttl` — a verbatim copy of DCAT-AP 2.1.1, which
  would double-count the DCAT-AP core already counted as its own profile
- `dcat-ap-de-imports.ttl` — `owl:imports` stub

## Why it is in the corpus

It is the only profile here that is genuinely multilingual (251 `@de`, 22 `@en`)
and it is by some way the most construct-diverse: `sh:or`, `sh:qualifiedValueShape`
with `sh:qualifiedMinCount`/`sh:qualifiedMaxCount`, `sh:deactivated`,
`sh:pattern` + `sh:flags`, `sh:targetObjectsOf`, `sh:alternativePath`, and
property shapes nested inside property shapes.
