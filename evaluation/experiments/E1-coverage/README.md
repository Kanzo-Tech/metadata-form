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

Full table with all columns in `results/coverage.md`. Headline:

| Profile | Node shapes | Property shapes | Groups | Labelled | Typed widget | Nested | Plain text | Read-only | **Zero-code control** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| DCAT-AP 3.0.1 | 91 | 298 | 0 | 0% | 108 | 35 | 153 | 2 | **48.0%** |
| HealthDCAT-AP R5 | 52 | 139 | 0 | 0% | 56 | 34 | 47 | 2 | **64.7%** |
| Health-RI Core | 14 | 143 | 0 | 100% | 93 | 23 | 27 | 0 | **81.1%** |
| DCAT-AP.de 2.0 | 29 | 121 | 0 | 0% | 46 | 2 | 70 | 3 | **39.7%** |
| FAIR Data Point | 13 | 37 | 0 | 2.7% | 22 | 7 | 8 | 0 | **78.4%** |
| SPHN 2026.1 | 1744 | 1246 | 0 | 0% | 891 | 0 | 258 | 97 | **71.5%** |
| Bioschemas v20250219 | 32 | 643 | 0 | 0% | 0 | 0 | 113 | 530 | **0.0%** |
| SPDX 3.0.1 | 64 | 193 | 0 | 0% | 98 | 0 | 95 | 0 | **50.8%** |
| Health-RI modules | 1 | 6 | 0 | 0% | 3 | 0 | 3 | 0 | **50.0%** |
| Evidenze health (ours) | 10 | 48 | 13 | 97.9% | 32 | 8 | 8 | 0 | **83.3%** |
| Evidenze data space (ours) | 7 | 33 | 10 | 97.0% | 21 | 4 | 8 | 0 | **75.8%** |

**Zero-code control** = (typed widget + nested sub-form) / property shapes: the
share that gets a control reflecting what the property actually *is*, with no
per-profile code and no edit to the profile.

The literal metric the spec asked for — "% that render with zero custom widget
code" — is **100% in every profile**, because the type-fact fallback always
resolves to a registered editor and nothing fails outright. That number is
vacuous, so it is reported once, here, and the table reports what the property
degrades *to*.

## Findings

### F1 — the range is 0% to 83%, and the spread is about the profile, not us

The nine external profiles span 0.0% to 81.1%. Our own two, designed against this
engine, sit at 83.3% and 75.8% — **one of them below** Health-RI's 81.1%, which
was authored with no knowledge of us. Type-fact inference is doing nearly all the
work, and the adoption cost of shape-driven authoring is close to zero for a
profile that already states its types: designing the profile for this engine buys
2.2 points over the best profile that was not.

The spread is explained almost entirely by whether the profile bothers to say
what its values *are*: SPHN (765 `sh:class`, 256 `sh:datatype`) gets 71.5%,
Bioschemas (none of either) gets 0.0%.

### F2 — Bioschemas is the profile that breaks it, and the break is a path

**0.0% zero-code control. 530 of 643 property shapes render read-only.** Nothing
crashed; nothing failed to parse; the form is simply not editable.

Every path in Bioschemas is `[ sh:alternativePath ( http://schema.org/x
https://schema.org/x ) ]` — a complex path used to paper over the schema.org
http/https namespace split, not to express a choice. Our engine projects complex
paths correctly and then renders them read-only, because there is no
well-defined "which branch do I write to" for an alternative path. For a profile
that uses it once, that is a fair degradation. For a profile that uses it 530
times as a portability workaround, it is total.

This is the E1 result the spec's trap was written for. It is recorded, not
excluded. It also suggests a cheap, principled fix worth a sentence in §8: an
alternative path whose branches differ only in scheme/authority has an obvious
canonical write target, and could be made editable.

### F3 — Finding 6 of the earlier run was WRONG. Complex paths ship.

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
kinds. The full `PathExpr` union is *used*, not speculative — but note what F2
says about it: parsing them is not the same as rendering them, and **all 634**
complex-path fields in the corpus render read-only.

### F4 — annotation does not predict usability, and one profile proves it twice

DCAT-AP 3.0.1 publishes the **same specification as SHACL twice**:

| Encoding | `sh:name` on property shapes | Zero-code control |
|---|---:|---:|
| `html/shacl/` (hand-maintained) | 0 / 298 (0%) | **48.0%** |
| `shacl/` (generated from UML) | 292 / 292 (100%) | **30.1%** |

The fully-labelled encoding renders *worse*. Labels are annotation; the widget
comes from type facts, and the generated encoding drops the `sh:node`
composition (0 nested sub-forms vs 35) in favour of a flat, closed, thoroughly
documented list. A profile author optimising for readable documentation can make
the form worse while making the spec better.

This is a controlled comparison — same spec, same release, same day — and it is
the strongest single piece of evidence in E1.

### F5 — a profile is not a graph until someone concatenates it, and that is where its coverage lives

DCAT-AP 3.0.1 partitions the facts a widget is chosen from across published
files. Loaded alone:

| File | Fields | Zero-code control |
|---|---:|---:|
| `shapes.ttl` (core constraints) | 130 | **13.8%** |
| `range.ttl` (class ranges) | 82 | **98.8%** |
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
single graph, and *which* split a consumer picks moves the headline number by 34
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

Language tags across the corpus: `en` everywhere, `de` only in DCAT-AP.de (251
`@de` to 22 `@en`), `es`/`ca` only in ours. SPHN, Bioschemas and FDP carry no
language tags at all.

The shapes meant to onboard health data holders across the EU are published in
one language. DCAT-AP.de is the counter-example that shows it is achievable, and
it does it in the place that matters most — 102 lang-tagged `sh:message`s. Feed
this to §5 and E3, and note that a validator which flattens lang tags removes the
only incentive to write them.

### F10 — nothing broke the engine

15 shapes graphs, 2.0 MB of Turtle, 2 149 node shapes and 2 907 property shapes
in the 11 counted profiles: **0 parse failures, 0
shapes that failed to build, 0 diagnostics.** SPHN's 930 kB single file (1744
node shapes, 233 of them closed, ~480 SPARQL constraints) parses and builds
without complaint.

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
| `sh:or` | unrendered | 216 | sphn, dcat-ap-3, dcat-ap-de, healthdcat-ap, evidenze-health | Parsed into `logical.or` and never read. The disjuncts — usually the real datatype/class alternatives — are invisible and unenforced in the UI. |
| `dash:editor` | unrendered | 168 | health-ri-core, fair-data-point | Recorded, not acted on. Only `shui:editor` selects a widget. This is the measured baseline. |
| `dash:viewer` | unrendered | 165 | health-ri-core, fair-data-point | As `dash:editor`. |
| `sh:target` | dropped | 96 | sphn | SPARQL/custom target; only `sh:targetClass` resolves a root shape. |
| `sh:hasValue` | carried | 84 | dcat-ap-de, healthdcat-ap, dcat-ap-3, spdx-3, ours | Reaches `FieldConstraints`; no widget reads it. A property pinned to one value renders as a free input the user can wrongly change. |
| `sh:property` (nested) | unrendered | 19 | dcat-ap-de | A property shape *inside* another property shape (under `sh:or`, `sh:qualifiedValueShape`). Only node-shape properties become fields. |
| `sh:not` | unrendered | 12 | spdx-3 | Negation has no form affordance. |
| `sh:shape` | unrendered | 5 | dcat-ap-3 | Not a SHACL 1.2 term at all — a pre-REC leftover DCAT-AP 3.0.1 still ships. |
| `sh:deactivated` | dropped | 3 | dcat-ap-de | **Wrongly rendered, not merely ignored**: a property the profile switched off still gets a field. A correctness bug. |
| `sh:qualifiedValueShape` (+`Min`/`MaxCount`) | unrendered | 7 | dcat-ap-de | "at least n values matching shape S" is per-value; a field models one editor for all its values. |
| `sh:targetObjectsOf` | dropped | 1 | dcat-ap-de | Target selector; not used for root-shape resolution. |
| `sh:entailment` | dropped | 1 | sphn | Entailment regime; ignored. |
| `sh:minExclusive` | carried | 1 | health-ri-core | No numeric control takes an exclusive bound and no epsilon is right for both `xsd:integer` and `xsd:double`. Rejected on commit, invisible in the UI. |
| `sh:equals` / `sh:disjoint` / `sh:lessThan` / `sh:lessThanOrEquals` | unrendered | 0 | — | Cross-property constraints; the field model is per-property with no view of a sibling. In the ledger, unused by this corpus. |

Two of these deserve §8 in their own right rather than a table row:

1. **`sh:deactivated` is a bug, not a gap.** Everything else here degrades. This
   one renders a property the author explicitly turned off. Small fix, and it is
   dishonest to report it as a limitation.
2. **`sh:or` is the largest real gap** (216 occurrences, five profiles). It is
   the standard way to say "an IRI *or* a literal", "a `dct:LicenseDocument` *or*
   a URL", and we show a field derived from neither branch.

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
  `dcat-ap-3` is the whole published SHACL set of the release (48.0%); the
  `dcat-ap-vendored` variant, which is `shapes.ttl` alone as Health-RI copied it,
  scores 66.1%. Both are in `coverage.md`; F5 is the honest way to read the pair.
- **`health-ri-modules` is tiny** (6 property shapes) and its 50.0% is one
  property either way. Kept for honesty about corpus composition, not for weight.
