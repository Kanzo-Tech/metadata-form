# E2 inputs — what is verbatim and what is derived

## Verbatim (published, third-party)

`before/health-ri-core/*.ttl` — byte-for-byte copies of

    Health-RI/health-ri-metadata @ acec135965997d65e04b42d45728b7dd3f390c9b
    Formalisation(shacl)/Core/PiecesShape/*.ttl

retrieved 2026-08-26, licensed **CC-BY-4.0** (see
`../../E1-coverage/data/health-ri/src/LICENSE`). 14 files, 1792 lines, 14 node
shapes, 143 property shapes, 464 `dash:editor` + 464 `dash:viewer` triples across
the wider corpus (141 + 141 in these 14 files). This is the *shipped* encoding —
nothing here was written by us.

`cases/hri-*.ttl` — copies of the publisher's own test records from
`src/testdata/`, same commit and licence.

## Derived, and labelled as such

The published profile states one of its conditional requirements **in prose, in
`sh:description`**, and does not constrain it:

> `DatasetShape#legal-basis` — *"The legal basis used to justify processing of
> personal data."* (`before/health-ri-core/Dataset.ttl`, `dpv:hasLegalBasis`,
> `sh:minCount` absent)

The four overlay files encode that one requirement four ways. They are **our**
artefacts, not Health-RI's, and they exist so that the same requirement can be
measured under each encoding:

| File | Encoding | SHACL version |
|---|---|---|
| `before/overlay-00-shipped.ttl` | not encoded (prose only) | — |
| `before/overlay-01-partition-subjectsof.ttl` | node-shape partition, `sh:targetSubjectsOf`, `dash:hidden` stamps | 1.0 |
| `before/overlay-02-partition-sparql.ttl` | node-shape partition, `sh:SPARQLTarget`, `dash:hidden` stamps | 1.0 (advanced) |
| `before/overlay-03-implication.ttl` | `sh:or ( [ sh:not C ] T )` | 1.0 |
| `after/overlay-04-shacl12-if.ttl` | `sh:if` / `sh:then` / `sh:else` | 1.2 |
| `after/overlay-05-targetwhere.ttl` | `sh:targetWhere` selector plus the two required properties | 1.2 |

`after/health-ri-core-shacl12/` is generated from `before/health-ri-core/` by
`migrate.py` (a deterministic rewrite: `dash:editor` → `shui:editor`,
`dash:viewer` dropped). Regenerate with `make` — never edit by hand.
