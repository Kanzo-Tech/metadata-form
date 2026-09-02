# Bioschemas profiles (SHACL) — vendored snapshot

- Source: https://github.com/BioSchemas/bioschemas_specification_releases
- Path: `versions/v20250219/bioschemas_profiles_shacl.ttl`
- Commit: `3c9d9c247671f3d6c5582803128c1b5dff5ea363` (2025-06-26)
- Version: **v20250219** (the version is the directory name; the repository carries no git tags)
- Retrieved: 2026-08-27
- Licence: **CC-BY-SA-4.0** (`src/LICENSE`, Attribution-ShareAlike 4.0 International).
- Publisher: the Bioschemas community.

## Why this copy

The identical file (SHA-1 `46202cb083ee306a167bc39c8c4c3cbc4f00a3f0`) is also
served from `BioSchemas/bioschemas.github.io` at
`pages/_profiles/bioschemas_profiles_shacl.ttl`, but **that repository declares no
licence**. The release repository is used here so the vendored copy is
attributable and redistributable.

There is no `BioSchemas/bioschemas-shacl` repository, and
`BioSchemas/bioschemas-validation` holds only ShEx files from a 2021 biohackathon
with no licence. This single generated file is the whole of Bioschemas' published
SHACL: 32 profiles (ChemicalSubstance, Gene, Protein, Sample, Taxon, …) in one
document.

## The thing to know before reading its numbers

Every one of its 643 property shapes has an `sh:alternativePath` over the `http:`
and `https:` forms of the same schema.org term. That is a complex path used to
paper over a namespace split, not to express anything. It also carries
`sh:description` and `sh:severity` and **nothing else** — no `sh:datatype`, no
`sh:class`, no `sh:maxCount`, no `sh:name`.
