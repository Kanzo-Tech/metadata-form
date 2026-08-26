# E1 — Coverage across published SHACL profiles

Spec: `~/dev/kanzo/papers/swat4hcls2027/EVIDENCE.md`.

## Inputs vendored

`data/health-ri/` — Health-RI metadata, commit `acec1359` (2026-08-25), **CC-BY-4.0**,
so redistributable with attribution. See `data/health-ri/PROVENANCE.md`.

## First probe — 2026-08-26 (grep-level, NOT the harness)

These are line counts, not parsed shapes. They need re-deriving through
`buildFormModel` before any of them goes in the paper. But they already change
the story.

| Profile dir | `sh:path` | `dash:editor` | `shui:editor` | `sh:group` | `sh:name` |
|---|---|---|---|---|---|
| `Core/PiecesShape` | 143 | 141 | 0 | 0 | 143 |
| `Core/ValidationShape` | 143 | 141 | 0 | 0 | 143 |
| `Core/FairDataPointShape` | 184 | 182 | 0 | 0 | 184 |
| `Core/ReusedCommunityStandards` | 160 | 3 | 0 | 4 | 55 |
| `Modules(Leaves_Petals)` | 6 | 0 | 0 | 0 | 1 |

### Finding 1 — our own SOURCE.md is misleading

`playground/examples/health-dcat-ap/SOURCE.md` says the official shapes "do not
carry SHACL-UI editor hints". True for `shui:` (zero hits) but it omits that
**141 of 143 property shapes carry `dash:editor`**. The real profile is fully
UI-annotated — in DASH.

This is *better* for us, and it reframes two sections:

- **§7.1 / E1 headline changes.** The interesting number is no longer "how much
  renders from bare datatype fallback". It is: *if the widget resolver accepts
  `dash:editor` as an alias for `shui:editor` (same vocabulary lineage), what
  fraction of a real, current, official health profile renders with **zero**
  modification to the published artefact?* That is a much stronger adoption claim.
  → **Action:** check whether `src/form/editors.ts` already accepts `dash:`. If
  not, adding the alias is small and is itself a paper-worthy design point.
- **§6 / E2 gets its "before" back.** We could not find the Evidenze DASH original
  (see E2). But here is a *published, actively maintained, real* DASH-encoded
  health profile, updated the day before we looked. §6 can be reframed from
  "our migration history" to "the encoding the ecosystem actually ships today, and
  its SHACL 1.2 equivalent" — which is more general and needs no private artefact.

### Finding 2 — the official profile is monolingual

321 `@en` lang tags in `PiecesShape`, and **no other language at all**. `sh:name`
is English-only across the profile.

This is the motivating gap for §5: the shapes intended to onboard health data
holders across the EU are published in one language. Not a criticism of Health-RI
— it is what the tooling makes easy. Use it to argue *why* lang-tagged `sh:name` /
`sh:description` / `sh:message` needs to become routine, and note that a validator
that flattens lang tags (E3) removes the incentive to author them.

### Finding 3 — no `sh:group` anywhere in the real profiles

Zero in every profile dir except the reused standards. Layout has nothing to work
from. Honest limitation for §8, and a concrete argument for the datatype/nodeKind
fallback carrying more weight than a profile author might expect.

### Finding 4 — methodology trap, already avoided once

`Core/ValidationShape` has identical counts to `Core/PiecesShape` (143/141/143):
it is the assembled concatenation of the pieces, **not an independent profile**.
Counting both would inflate n. Treat Health-RI as *two* profiles (Core, FDP) plus
the modules, not five.

Similarly: the 467 `dash:editor` hits in a naive repo-wide grep come mostly from
`ReusedCommunityStandards/dash.ttl`, which is the DASH vocabulary itself. Always
exclude it.

## Still to vendor

- DCAT-AP 3.0 (SEMIC) — `ReusedCommunityStandards/dcatap.shapes.ttl` is a copy;
  prefer the upstream release and record its version
- HealthDCAT-AP EU release (healthdataeu)
- Evidenze profile (in-repo)

## Harness — RUNNING (26 Aug 2026)

`coverage.harness.ts`, run with:

```sh
npx vitest run --config paper/swat4hcls-2027/experiments/vitest.config.ts
```

Separate vitest config on purpose: these are report generators, not tests, and the
root config's `include` does not reach them, so `npm test` stays clean. Outputs
`results/coverage.json` and `results/coverage.md`; both are committed and neither
is hand-edited.

### First real numbers

| Profile | Property shapes | Typed editor | Plain-text fallback |
|---|---:|---:|---:|
| Health-RI Core (HealthDCAT-AP) | 143 | 93 (65.0%) | 50 (35.0%) |
| DCAT-AP | 109 | 66 (60.6%) | 43 (39.4%) |
| Health-RI domain modules | 6 | 3 (50.0%) | 3 (50.0%) |
| Evidenze HealthDCAT-AP R7 (ours) | 48 | 32 (66.7%) | 16 (33.3%) |
| Evidenze data space (ours) | 33 | 21 (63.6%) | 12 (36.4%) |

Every node shape built: 0 build failures, 0 diagnostics, 0 parse errors.

### Finding 5 — the striking one: annotation barely beats inference

Our own profile carries 11 explicit `shui:editor` annotations and 47 `sh:group`
sections. It scores **66.7%**. Health-RI, whose `dash:editor` hints are ignored
entirely and which has no groups at all, scores **65.0%**. DCAT-AP, with no UI
annotation of any kind, scores **60.6%**.

Type-fact inference is doing almost all the work. That is the honest headline and
it is more interesting than the one we set out to measure: the adoption cost of
shape-driven authoring is near zero because the profile does not need annotating
for the form to be usable. It also *deflates* the value of the DASH-alias idea —
another reason not to spend fork time on it.

Do not oversell it: 35–40% still degrade to a bare text field. Report both halves,
and characterise the residue (see below).

### Finding 6 — no published profile uses a complex path

`sh:path` is a plain predicate everywhere: zero inverse, sequence, alternative or
cardinality paths across all five profiles. Our full `PathExpr` union handles
constructs nobody ships today.

State this plainly in §8. It cuts against a claim we were going to make in §3, and
saying so is worth more than the claim was. The honest framing: complex paths are
cheap insurance and correctness for a spec-complete implementation, not a
differentiator with evidence behind it.

### Finding 7 — FDP is not an independent profile

`Core/FairDataPointShape` declares the *same* shape IRIs as `Core/PiecesShape`;
its 178 `sh:path` lines collapse to the same 137 distinct (shape, path) pairs
because each FDP file is self-contained and redefines the shared shapes, so
concatenation merges them by identity. Correct RDF merge semantics, not a bug.

It is marked `variantOf` in the harness: measured and reported in full, excluded
from the headline tables so it cannot inflate n. Same treatment as
`Core/ValidationShape`.

## Still to vendor — n is too thin

Only **two** of the five are externally authored (Health-RI Core, DCAT-AP); the
modules are tiny and two are ours. A generality claim needs more:

- DCAT-AP 3.0 from SEMIC upstream (the current input is Health-RI's vendored copy;
  record the upstream version)
- HealthDCAT-AP EU release (healthdataeu)
- One non-DCAT health profile, so the result is not "we handle DCAT dialects"

## Next on this experiment

1. Vendor the profiles above; re-run.
2. **Characterise the 35–40% residue.** Which properties fall back to plain text,
   and why? If most are `xsd:string` with no further constraint, the fallback is
   correct and the number is a floor, not a failure. That distinction decides
   whether §7.1 reads as a strength or a weakness, and it is the single most
   valuable follow-up here.
3. Decide whether `sh:group` absence (0 in every external profile) deserves its own
   row — layout has nothing to work from, which is a real adoption limit.

## Old plan (superseded, kept for the record)

`run.ts` driving `buildFormModel` headlessly per profile, emitting
`results/coverage.json` + `results/coverage.md`. Start from
`test/shacl-engine.test.ts` and `test/rudof-wasm.integration.test.ts`, which
already drive the engine outside React.

Must handle: cross-file `sh:node` references (concatenate pieces into one graph
before parsing). Worth a sentence in §7.1 — real profiles ship split across files
and most tooling assumes a single graph.

**Trap:** do not silently drop a profile that breaks the engine. A failure is a
result and §8 needs it.
