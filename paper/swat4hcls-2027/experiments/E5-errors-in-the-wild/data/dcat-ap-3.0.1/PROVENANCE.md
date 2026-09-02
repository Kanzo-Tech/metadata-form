# DCAT-AP 3.0.1 SHACL

| | |
|---|---|
| Source | https://github.com/SEMICeu/DCAT-AP, `releases/3.0.1/shacl/` |
| Tag | `3.0.1` (released 2026-06-04) |
| Commit | `21f43cee5d61aa29e729e2e9193fc697f7b63861` |
| Retrieved | 2026-08-27 |
| Licence | CC-BY-4.0 (repository `LICENSE`) — redistributable with attribution |

```
990d3e42721de6a4be8cc338a7171559f195e62dea89c0b56531356b78cc026f  dcat-ap-SHACL.ttl
a6eed0fae8d0f5ca977fe2098ca12081ac60b0efe1ddce802d5c08e49505ebcc  ranges.ttl
```

## What is applied

`dcat-ap-SHACL.ttl` only. It is layer L1 of the experiment: the profile exactly
as the ecosystem ships it.

`ranges.ttl` is vendored for completeness and is **not** applied. It restates the
range of each property as a separate node shape targeting classes the harvest
does not retrieve (`rdfs:Literal`, `dct:MediaTypeOrExtent`, …); applying it
alongside `dcat-ap-SHACL.ttl` would count the same mistake twice. 206 of its 297
`sh:property` links point at IRIs that carry no triples in the file, so most of
it would be inert in any case.

## Modifications at load time

`validate.py` removes `sh:property` links whose target has no triples anywhere in
the shapes graph. In `dcat-ap-SHACL.ttl` there are two, both on
`dcat:DataServiceShape`. pySHACL raises `ReportableRuntimeError` and refuses to
validate any record containing a `dcat:DataService` while they are present. An
empty property shape constrains nothing, so removing them cannot suppress a
violation. The file on disk is unmodified.
