# E1 — Coverage across published SHACL profiles

Spec: `~/dev/kanzo/papers/swat4hcls2027/EVIDENCE.md`.

**Status: complete and re-runnable.** 15 shapes graphs measured, 11 counted as
independent profiles, 9 of those externally authored. The spec asked for ≥4,
preferably 6.

```sh
npx vitest run --config evaluation/experiments/vitest.config.ts
```

Outputs `results/coverage.json` and `results/coverage.md`; both are committed,
neither is hand-edited, and both are byte-stable across runs (see *Determinism*
below). The corpus lives in `profiles.ts`, the construct ledger in
`constructs.ts`, the measurement in `coverage.harness.ts`.

## Corpus

Every external profile is vendored under `data/<id>/` with a `PROVENANCE.md`
recording source URL, retrieval date, licence and commit/version.

| id | Profile | Publisher | Version | Licence |
|---|---|---|---|---|
| `dcat-ap-3` | DCAT-AP 3.0.1 | SEMIC / European Commission | 3.0.1 (2026-06-04) | CC-BY-4.0 |
| `healthdcat-ap` | HealthDCAT-AP | European Commission, HealthData@EU | Release 5 (2025-09-22) | CC-BY-4.0 |
| `health-ri-core` | Health-RI metadata | Health-RI (NL) | `acec1359` (2026-08-25) | CC-BY-4.0 |
| `dcat-ap-de` | DCAT-AP.de | GovData (DE) | V2.0 (`6d8ccac4`, 2024-04-17) | CC-BY-4.0 |
| `fair-data-point` | FAIR Data Point shapes | FAIR Data Team | v1.22.0 (2026-07-24) | MIT |
| `sphn` | SPHN RDF schema SHACL | SPHN / SIB (CH) | 2026-1 (2026-01-28) | CC-BY-4.0 |
| `bioschemas` | Bioschemas profiles | Bioschemas community | v20250219 | CC-BY-SA-4.0 |
| `spdx-3` | SPDX 3.0.1 model | Linux Foundation | 3.0.1 (2024-12-12) | Community Spec. Lic. 1.0 |
| `health-ri-modules` | Health-RI domain modules | Health-RI (NL) | same as above | CC-BY-4.0 |
| `evidenze-health` | Evidenze HealthDCAT-AP onboarding | ours | in-repo | — |
| `evidenze-dataspace` | Evidenze data space onboarding | ours | in-repo | — |

Measured and reported but **excluded from n**, because each is a re-serialisation
or a redundant slice of a profile already counted: `dcat-ap-3-generated`,
`healthdcat-ap-restricted`, `dcat-ap-vendored`, `health-ri-fdp`. The evidence for
each judgement is in its note in `profiles.ts` and reproduced in `coverage.md`.

### Candidates checked and not used

Recorded so the corpus is not mistaken for a convenience sample.

- **W3C DPV** — publishes no SHACL. `w3c-cg/dpv` and `dpvcg/dpv` contain none.
- **EJP-RD**, **EBI ejprd-metadata-models** — ShExC, not SHACL.
- **MIABIS**, **NFDI4Health** — no published SHACL.
- **openMINDS / EBRAINS** — JSON-Schema, not SHACL.
- **ODRL, PROV-O, SSN/SOSA** — no officially published domain SHACL; the W3C
  `.ttl` shapes that exist are the SHACL spec's own meta-shapes.
- **Croissant (MLCommons)** — real but tiny (9 node shapes, tasks extension only);
  the core spec is validated by Python, not SHACL. Dropped for size.
- **OSLO (Flanders)** — real government SHACL, but the live artefacts declare no
  licence and the git copy is a 2018 snapshot. Dropped on provenance.
- **Bioschemas ShEx** (`bioschemas-validation`) — ShEx, unlicensed. The SHACL we
  use is the separate generated release file.
- **HealthDCAT-AP on GitHub** — decommissioned 2025-09-22; its shapes now sit
  under `OldContent/`. We use the EC's code.europa.eu Release 5 instead. Note
  that a Release 6 existed and was *deprecated*, so R5 is `releases/latest`.

## Tab. 3

The full table, with every column, is `results/coverage.md` (generated; not
copied here, so it cannot go stale). Columns:

- *Typed widget*, *Nested form*, *Plain-text floor*, *Read-only*, *No widget*: what
  the field got. **Zero-code control** = (typed widget + nested form) / fields.
- *Declared* / *Scored* / *Branch* / *Fallback*: where the engine took each field's
  editor from (`editorSource`): a `shui:editor` the profile states; the SHACL-UI
  Editor's Draft score function over the shape's facts (a declared editor counts
  40); the first renderable `sh:or` branch; or the engine's own fallback (nested
  form for `sh:node`, text field otherwise). Only the first two are SHACL-UI.

The literal metric the spec asked for — "% that render with zero custom widget
code" — is **100% in every profile** (*No widget* is 0 everywhere; the fallback
always answers). That number is vacuous, so the table reports what the property
degrades *to*.

## Findings

### F1 — the range is 0% to 83%, and the spread is about the profile, not us

The nine external profiles span 0.0% to 86.8% (SPHN). Our own two, designed
against this engine, sit at 83.3% and 75.8% — **one of them below** Health-RI's
81.1%, which was authored with no knowledge of us. What picks the widget is what
the profile says its values *are* (datatype, class, node kind, `sh:in`), not
annotation aimed at this engine: designing the profile for this engine buys 2.2
points over the best profile that was not authored for it (like for like: our
HealthDCAT-AP onboarding against Health-RI Core).

The spread is explained almost entirely by whether the profile bothers to say
what its values *are*: SPHN (765 `sh:class`, 256 `sh:datatype`) gets 86.8%,
Bioschemas (none of either) gets 0.0%.

### F2 — Bioschemas is the profile that breaks it, and the break is a path

**0.0% zero-code control.** All 641 fields fall to the engine's fallback (a text
field): none of the Bioschemas shapes states a datatype or a class, so the score
function has nothing to score. Nothing crashed and nothing failed to parse.

Every path in Bioschemas is `[ sh:alternativePath ( http://schema.org/x
https://schema.org/x ) ]` (530 alternative paths in the source, 528 fields) — a
complex path used to paper over the schema.org http/https namespace split, not to
express a choice. With this engine these fields are *editable* (Read-only = 0 for
Bioschemas in `results/coverage.md`); the earlier run of this experiment rendered
them read-only. The floor here is the missing type facts, not the path.

### F3 — complex paths ship, and most of them are editable now

The earlier README said "no published profile uses a complex path" and told §8 to
concede the point. With n=2 external profiles that was true. With n=9 it is not:

| Profile | inverse | sequence | alternative |
|---|---:|---:|---:|
| Bioschemas | · | · | 530 |
| SPHN | 26 | 71 | · |
| DCAT-AP 3.0.1 | 2 | · | · |
| DCAT-AP.de | · | · | 3 |
| HealthDCAT-AP | · | · | 2 |

Five of nine external profiles ship at least one, across three of the seven path
kinds. The full `PathExpr` union is *used*, not speculative. The corpus holds 632
complex-path fields (`form.complexPathFields` in `results/coverage.json`); **71**
of them render read-only — all SPHN sequence paths — and the rest are editable.

### F4 — annotation does not predict usability, and one profile proves it twice

DCAT-AP 3.0.1 publishes the **same specification as SHACL twice**:

| Encoding | `sh:name` on property shapes | Zero-code control |
|---|---:|---:|
| `html/shacl/` (hand-maintained) | 0 / 298 (0%) | **47.5%** |
| `shacl/` (generated from UML) | 292 / 292 (100%) | **67.2%** |

The fully-labelled encoding now renders *better* (67.2% against 47.5%), which
reverses the earlier run (48.0% against 30.1%): the two encodings' relative order
depends on how the engine chooses an editor, not on the spec. What stays true is
that labels are annotation and the widget comes from type facts, and that the same
specification, encoded twice, does not produce the same form. The generated
encoding still has no `sh:node` composition (0 nested sub-forms; the hand-written
one has 24) and flattens the spec into a closed, documented list.

This is a controlled comparison — same spec, same release, same day — and it is
the strongest single piece of evidence in E1.

### F5 — a profile is not a graph until someone concatenates it, and that is where its coverage lives

DCAT-AP 3.0.1 partitions the facts a widget is chosen from across published
files. Loaded alone:

| File | Fields | Zero-code control |
|---|---:|---:|
| `shapes.ttl` (core constraints) | 130 | **12.3%** |
| `range.ttl` (class ranges) | 82 | **100.0%** |
| `mdr-vocabularies.shape.ttl` | 42 | **100.0%** |
| `shapes_recommended.ttl` | 36 | **0.0%** |
| `deprecateduris.ttl` | 8 | **25.0%** |

`shapes.ttl` is the file a tool would naturally reach for — and it states
cardinality and node kind and almost no class ranges, so it yields an almost
entirely untyped form. The ranges are a separate file with *different shape IRIs*,
so they do not even merge with it; they are a parallel set of shapes over the
same classes. A consumer must load both and accept that most DCAT-AP properties
are then described by two shapes at once.

`results/coverage.md` reports this per-file table for every multi-file profile.
It is worth a paragraph in §7.1: real profiles ship split, most tooling assumes a
single graph, and *which* split a consumer picks moves the headline number by 35
points.

### F6 — no external profile uses `sh:group`. Still true, now with n=9.

Zero in all nine externally authored profiles. Layout has nothing to work from
and every field lands in the default group. Only our two profiles use it (13 and
10 groups). This is the clearest adoption gap in the corpus and it is not a
criticism of any publisher: nothing in the SHACL ecosystem rewards authoring it.

### F7 — labels are rarer than expected, and that is a usability floor

Property shapes carrying `sh:name`: DCAT-AP 3.0.1 **0**, HealthDCAT-AP **0**,
DCAT-AP.de **0**, SPHN **0**, Bioschemas **0**, SPDX **0**. Only Health-RI (143 /
143) and, marginally, FDP (1 / 37) label their properties at all.

Everything else falls back to the local name of the predicate: a form whose
labels read `accessRights`, `wasGeneratedBy`, `hasQualifiedRelation`. It renders.
It is not a form a data steward can fill in. DCAT-AP.de does write 23 `sh:name`s
— all on **node** shapes, where a one-shape-per-page form has nowhere to put
them.

Note the interaction with F4: `sh:description` is much more common than
`sh:name` (DCAT-AP 27, Bioschemas 643), so profiles are writing help text for
fields that have no label.

### F8 — `dash:` is the ecosystem's UI vocabulary, and it is still only two profiles

`dash:editor` appears in Health-RI (141) and FAIR Data Point (27), and **nowhere
else in the corpus**. `shui:editor` appears only in our own two profiles. The
DASH-alias question raised in the earlier run stays closed: honouring `dash:`
would move two of nine profiles, and F4 shows explicit editor hints are not what
drives the number anyway. Mention it in §8 as a compatibility note, as EVIDENCE.md
decided; do not spend fork time on it.

The harness now **asserts** the baseline instead of describing it: a second test
fails the run if `dash:editor` ever starts selecting a widget, or if
`shui:editor` ever stops.

### F9 — monolingual, with one exception

Language tags across the corpus: `en` everywhere, `de` only in DCAT-AP.de (214
`@de` outside comments; 251 counting commented-out lines), `es`/`ca` only in ours. SPHN, Bioschemas and FDP carry no
language tags at all.

The shapes meant to onboard health data holders across the EU are published in
one language. DCAT-AP.de is the counter-example that shows it is achievable, and
it does it in the place that matters most — 143 lang-tagged `sh:message`s. Feed
this to §5 and E3, and note that a validator which flattens lang tags removes the
only incentive to write them.

### F10 — nothing broke the engine

15 shapes graphs, 2.1 MB of Turtle, 2 059 node shapes and 2 907 property shapes
in the 11 counted profiles: **0 parse failures, 0 shapes that failed to build.**
Diagnostics are not zero any more (the form builder reports what it declines to
do): `conjoined-property` (two property shapes on one path), `conflicting-constraint`
(2, DCAT-AP), `unrenderable-alternative` (2, DCAT-AP.de: an `sh:or` branch that asks
for a blank node); see the per-profile sections of `results/coverage.md`. SPHN's
930 kB single file (1744 node shapes, 233 of them closed, ~480 SPARQL
constraints) parses and builds without complaint.

The harness is written to make a failure a first-class result: on a parse error
it re-parses the profile file by file and reports which file and which message,
and the profile keeps its row in Tab. 3 marked `parse failed`. That machinery is
present and, on this corpus, unexercised — which is itself the honest thing to
report.

## The "cannot render" list

Full table with counts and per-profile attribution in `results/coverage.md`. It
is assembled from three places because the failures are three different kinds:

- **unrendered** — reaches the IR and changes nothing the user sees
- **carried** — reaches the field model and no widget reads it
- **dropped** — is in the published source and never reaches the IR at all

Ranked by occurrences across the corpus:

| Construct | Mode | n | Where | Why |
|---|---|---:|---|---|
| `sh:select` | dropped | 784 | sphn | Body of `sh:sparql`. |
| `sh:sparql` | dropped | 480 | sphn | SPARQL constraint: validation-only, no affordance a form can derive from a query. |
| `sh:closed` | dropped | 233 | sphn | The form offers exactly the declared fields so it cannot *violate* closedness — but it cannot show the user that nothing else is allowed. |
| `sh:ignoredProperties` | dropped | 233 | sphn | Parameter of `sh:closed`. |
| `sh:or` | **read** (was: unrendered) | 216 | sphn, dcat-ap-3, dcat-ap-de, healthdcat-ap, ours | Now read: `planDisjunction` turns branches that constrain the value itself (datatype, nodeKind, class, `sh:in`) into the field's alternatives. A branch about the value's own structure is not offered and is reported as an `unrenderable-alternative` diagnostic (2 in the corpus, DCAT-AP.de). Removed from the "cannot render" table of `results/coverage.md`. |
| `dash:editor` | unrendered | 168 | health-ri-core, fair-data-point | Recorded, not acted on. Only `shui:editor` selects a widget. This is the measured baseline. |
| `dash:viewer` | unrendered | 165 | health-ri-core, fair-data-point | As `dash:editor`. |
| `sh:target` | dropped | 96 | sphn | SPARQL/custom target; only `sh:targetClass` resolves a root shape. |
| `sh:hasValue` | carried | 81 | dcat-ap-de, healthdcat-ap, dcat-ap-3, spdx-3, ours | Seeds a new instance's graph, and reaches `FieldConstraints`; no widget reads it. A property pinned to one value renders as a free input the user can change (the validator then reports it). |
| `sh:property` (nested) | unrendered | 19 | dcat-ap-de | A property shape *inside* another property shape (under `sh:or`, `sh:qualifiedValueShape`). Only node-shape properties become fields. |
| `sh:not` | unrendered | 14 | spdx-3, ours | Negation has no form affordance. (Inside the Core conditional `sh:or ( [ sh:not C ] T )` it is consumed by the engine's conditional evaluation: our two profiles state one each.) |
| `sh:shape` | unrendered | 5 | dcat-ap-3 | Not a SHACL 1.2 term at all — a pre-REC leftover DCAT-AP 3.0.1 still ships. |
| `sh:deactivated` | **honoured** (was: dropped) | 3 | dcat-ap-de | Fixed: a deactivated property or node shape builds no field, with a `deactivated-shape` diagnostic (`test/deactivated.test.ts`). Removed from the "cannot render" table. |
| `sh:qualifiedValueShape` (+`Min`/`MaxCount`) | unrendered | 5 | dcat-ap-de | "at least n values matching shape S" is per-value; a field models one editor for all its values. |
| `sh:targetObjectsOf` | dropped | 1 | dcat-ap-de | Target selector; not used for root-shape resolution. |
| `sh:entailment` | dropped | 1 | sphn | Entailment regime; ignored. |
| `sh:minExclusive` | carried | 1 | health-ri-core | No numeric control takes an exclusive bound and no epsilon is right for both `xsd:integer` and `xsd:double`. Rejected on commit, invisible in the UI. |
| `sh:equals` / `sh:disjoint` / `sh:lessThan` / `sh:lessThanOrEquals` | unrendered | 0 | — | Cross-property constraints; the field model is per-property with no view of a sibling. In the ledger, unused by this corpus. |

Two entries of the earlier run no longer belong to the list:

1. **`sh:deactivated` was a bug, not a gap**, and is fixed: the engine now drops a
   deactivated shape (SHACL 2.1.6).
2. **`sh:or` was the largest real gap** (216 occurrences) and is now read. It is
   still the standard way to say "an IRI *or* a literal"; the field now offers the
   branches it can render as alternatives.

The largest remaining gap is validation-only constructs (`sh:sparql`, `sh:closed`)
in SPHN, which have no form affordance by nature.

## Methodology notes

### Determinism

`results/coverage.md` and `results/coverage.json` are byte-identical across runs
(verified). Two things had to change to make that true, and both are worth
knowing before trusting an earlier number:

- The harness used to deduplicate fields that shared a path within a node shape.
  rudof iterates properties in hash order, so *which* duplicate survived — and
  therefore which constraints it carried — varied between runs. Every property
  shape is now classified, and `duplicatePath` reports how often a profile does
  it (DCAT-AP's generated encoding: 161 of 292).
- Every histogram is sorted with an alphabetical tie-break, and the JSON is
  emitted with sorted keys.

### Anti-double-counting

Four input sets are demoted to variants (see *Corpus*). Additionally:
`Core/ValidationShape/HRI-Datamodel-shapes.ttl` is the assembled concatenation of
`Core/PiecesShape` and is not in the corpus at all;
`Core/ReusedCommunityStandards/dash.ttl` is the DASH *vocabulary* and is never
counted (a naive repo-wide grep for `dash:editor` finds 467 hits, most of them
there); DCAT-AP.de's verbatim copy of `dcat-ap_2.1.1_shacl_shapes.ttl` is
vendored but excluded from its measurement.

### Prefix-awareness

DCAT-AP 3.0.1's generated encoding binds the SHACL namespace to `shacl:`, not
`sh:`. A `grep -c 'sh:NodeShape'` on it returns 0, and it is easy to conclude the
file contains no SHACL. The source scan resolves `@prefix` declarations before
counting anything.

## Known limits of this experiment

- **Coverage is measured structurally, not by use.** A field with an
  `AutoCompleteEditor` counts as a typed widget even though it needs an
  `assist.search` implementation to return anything. That is a real caveat for
  the 48–81% figures: the reference-heavy profiles (DCAT-AP: 84 `sh:class`)
  lean on it hardest.
- **`sh:sourceConstraintComponent` is derived statically** from the parameters a
  profile uses, since E1 validates nothing. The histogram is what a report *would*
  cite. E5 measures the observed distribution.
- **Profile boundaries are a judgement call** and they move the numbers.
  `dcat-ap-3` is the whole published SHACL set of the release (47.5%); the
  `dcat-ap-vendored` variant, which is `shapes.ttl` alone as Health-RI copied it,
  scores 66.1%. Both are in `coverage.md`; F5 is the honest way to read the pair.
- **`health-ri-modules` is tiny** (6 property shapes) and its 50.0% is one
  property either way. Kept for honesty about corpus composition, not for weight.
