# E2 — the encoding the ecosystem ships, and its SHACL 1.2 equivalent

**Status: done (2026-08-27; re-run 2026-09-02 under rudof 0.3.8).** Result:
`results/migration.md` → Tab. 1, Tab. 2, Listing 1 of §6. Raw output:
`results/metrics.json`, `results/equivalence-rudof.json`.

Reproduce:

```sh
make venv     # once — uv venv + rdflib==7.6.0 (measurement only, not a validator)
make check    # regenerates data/after/, runs the engine, rewrites results/
```

`make check` exits non-zero if any equivalence check breaks, so the claim is a
test, not a paragraph.

**One engine.** rudof is the engine this library ships and the engine that drives
the form, and it is the only SHACL implementation in this experiment. An earlier
revision cross-checked the SHACL 1.0 encodings against a second implementation;
that cross-check is withdrawn. What E2 claims now is that **rudof accepts and
rejects the same data under both encodings** — a demonstration in the engine that
matters, not a cross-validated proof. §7 of `results/migration.md` states what
that costs, and the "Threats" section below repeats it.

Re-running under `@kanzo-tech/rudof-wasm@0.3.8` (stricter than the `0.3.5` that
produced the first results: malformed IRIs are now parse errors, and
`sh:targetClass` now selects through the `rdfs:subClassOf` closure) moved
**nothing** on this corpus — all 55 verdicts, every base-shape result signature,
and every structural count are identical to the 0.3.5 run.

## The reframe, and why it is better than the original plan

The plan was to diff the Evidenze DASH profile against
`examples/evidenze-health/shapes.ttl`. That "before" is **not
recoverable** — re-verified: `git log --all --diff-filter=A`, `git grep 'dash:'`
across every revision, no hit. The migration narrative survives only as a header
comment in the current profile (4 node shapes on one `sh:targetClass` → 1; root
`sh:or` → `sh:if`/`sh:then`; DASH editors → `shui:editor`).

So §6 is no longer our migration history. It is the **published** Health-RI Core
profile (HealthDCAT-AP, commit `acec1359`, CC-BY-4.0, actively maintained) as the
"before", which is strictly better: reproducible by anyone, needs no permission,
and the claim it supports is about the ecosystem rather than about us. If the
Evidenze original ever turns up it becomes a corroborating second data point.

## Method

1. Vendor `Core/PiecesShape/*.ttl` verbatim into `data/before/health-ri-core/`.
2. Measure the shipped encoding (`report.py`).
3. Take **one requirement the profile states in prose and does not enforce** —
   *a dataset declaring `dpv:hasPersonalData` must state `dpv:hasLegalBasis` and
   `dpv:hasPurpose`* — and encode it five ways, as overlays merged with the
   verbatim profile: not at all, two SHACL 1.0 shape partitions, the SHACL 1.0
   implication, and SHACL 1.2 `sh:if`/`sh:then`.
4. Migrate the whole profile's UI vocabulary mechanically (`migrate.py`:
   `dash:editor` → `shui:editor`, `dash:viewer` dropped) and prove the non-UI
   subgraph is **isomorphic** before and after.
5. Validate 11 data graphs × 5 encodings and compare conformance *and* the exact
   base-shape result signatures — encoding against encoding, in one engine.

Engine, pinned: **rudof `@kanzo-tech/rudof-wasm@0.3.8`** (the fork; SHACL 1.2
`sh:if` lives in `shacl/src/validator/constraints/core/logical/if_.rs`). The venv
holds **rdflib 7.6.0** (Python 3.13) for measurement — counting shapes, comparing
subgraphs for isomorphism. It validates nothing.

## Findings

**The shipped profile has no conditionals at all.** 14 node shapes, 143 property
shapes, 282 DASH annotation triples — and 0 `sh:or`, 0 `sh:and`, 0 `sh:not`,
0 `sh:xone`, 0 `sh:qualifiedValueShape`, 0 `sh:if`. Conditional requirements are
there, written in English inside `sh:description`. That is the DASH-era encoding
in its purest form: the UI is over-specified in a vendor vocabulary and the logic
is not specified at all.

**The rewrite is behaviour-preserving in the engine that drives the form.** rudof
gives the same verdict — and the same base-shape violations — for the SHACL 1.0
implication and the SHACL 1.2 conditional on all 11 cases. Both encodings also
match the verdicts the requirement demands, fixed in `report.py` before any run,
so the agreement is not two encodings agreeing on the same mistake. And the
conditional overlay leaves the profile's base-shape results untouched. That is a
demonstration, not a cross-validated proof — see Threats.

**The cheap SHACL 1.0 idiom is wrong.** `sh:targetSubjectsOf` on the
discriminator — the obvious way to partition without SPARQL — fires on every
subject of the property, dataset or not. rudof reports the over-firing on case
`08`, where the implication and the `sh:if` encodings both correctly stay quiet.
Making it correct in SHACL 1.0 means putting the condition into a SPARQL string
where no structural tool can read it.

**Three places SHACL 1.2 does not cleanly replace the DASH pattern** — §6 of
`results/migration.md` states them: a disjunction is not a conditional
(`DateOrDateTimeDataType_Shape`, referenced by 10 property shapes, stays
`sh:or`); a `sh:hasValue` stamp that is a genuine constraint stays (only the
discriminator-restating stamps go); and a partition whose discriminator lives in
the *application* rather than the data cannot become `sh:if` without changing the
data model.

## Threats

**The equivalence is demonstrated in one engine only.** An encoding difference
that both encodings happen to hit the same way in rudof would not be detected
here: if rudof's `sh:if` and its `sh:or ( [ sh:not C ] T )` shared a bug, the two
rows of Tab. 2 would agree and this experiment would call that equivalence. What
it rules out is divergence *between the encodings under rudof*, not divergence
from the SHACL specification.

**The tooling cost of adopting SHACL 1.2 is now unmeasured.** How many deployed
validators understand `sh:if` today matters to anyone weighing this migration,
and this experiment no longer answers it. The earlier revision had one datum from
a second engine; it is withdrawn and nothing replaced it. That claim got weaker
and the writeup says so rather than working around it.

**rudof does not implement `sh:SPARQLTarget`,** so the `partition-sparql` row of
Tab. 2 records silence, not a verdict. That encoding survives in Tab. 1 for its
structural cost — the size of the SPARQL string a correct SHACL 1.0 partition
needs — which needs no validator to measure.

**The structural measurements need no validator at all** and are unaffected by
any of the above: 14 node shapes, 143 property shapes, 282 DASH triples, 0
conditionals, and the isomorphism of the non-UI subgraph before and after.

## Files

| | |
|---|---|
| `data/PROVENANCE.md` | what is verbatim and what is ours — read first |
| `data/before/health-ri-core/` | verbatim Health-RI, CC-BY-4.0 |
| `data/before/overlay-0{0,1,2,3}-*.ttl` | the four SHACL 1.0 / not-encoded variants |
| `data/after/overlay-04-shacl12-if.ttl` | the SHACL 1.2 conditional |
| `data/after/health-ri-core-shacl12/` | generated by `migrate.py` — do not edit |
| `data/cases/*.ttl` | 11 data graphs, positive and negative |
| `migrate.py` | the mechanical DASH → SHACL-UI rewrite |
| `equivalence.harness.ts` | the equivalence run — rudof, vitest, real wasm |
| `report.py` | all measurement + renders `results/migration.md` |

## Open

- **Fig. 2** (a screenshot of the same conditional rendering live) is not done.
  The behaviour is already covered by `test/conditionals.integration.test.ts`;
  the figure is a capture job, not an experiment.
- If the Evidenze DASH original surfaces, add it as `data/before/evidenze/` and
  a sixth row — the harness takes a new overlay without changes.
