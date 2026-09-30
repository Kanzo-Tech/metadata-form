# E1 — coverage across published SHACL profiles

Generated 2026-09-03 by `coverage.harness.ts`. Do not edit by hand.

**Baseline measured:** rudof reads only `shui:editor`, so the `dash:editor`
hints most published profiles carry are recorded and ignored, and every
editor is inferred from datatype/nodeKind facts. This is what a data space
adopting an official profile gets today, unmodified. The harness asserts
this rather than assuming it.

**n = 11 independent profiles, 9 of them externally authored.**
4 further input sets proved to be re-serialisations or redundant
slices of a profile already counted; they are reported in full below but kept
out of the headline tables. See each one's note for the evidence.

## Tab. 3 — coverage

| Profile | Node shapes | Property shapes | Groups | Labelled | Fields | Typed widget | Nested form | Plain-text floor | Read-only | No widget | **Zero-code control** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| DCAT-AP 3.0.1 (SEMIC) | 91 | 298 | 0 | 0 (0.0%) | 297 | 119 | 24 | 154 | 0 | 0 | **48.1%** |
| HealthDCAT-AP Release 5 (European Commission) | 52 | 139 | 0 | 0 (0.0%) | 134 | 56 | 34 | 44 | 0 | 0 | **67.2%** |
| Health-RI Core (HealthDCAT-AP national implementation) | 14 | 143 | 0 | 143 (100.0%) | 143 | 93 | 23 | 27 | 0 | 0 | **81.1%** |
| DCAT-AP.de 2.0 (national extension, Germany) | 29 | 121 | 0 | 0 (0.0%) | 104 | 48 | 2 | 54 | 0 | 0 | **48.1%** |
| FAIR Data Point (FAIRDataTeam reference implementation) | 13 | 37 | 0 | 1 (2.7%) | 37 | 22 | 7 | 8 | 0 | 0 | **78.4%** |
| SPHN 2026.1 (Swiss Personalized Health Network) | 1744 | 1246 | 0 | 0 (0.0%) | 1246 | 1085 | 0 | 90 | 71 | 0 | **87.1%** |
| Bioschemas profiles v20250219 | 32 | 643 | 0 | 0 (0.0%) | 641 | 0 | 0 | 641 | 0 | 0 | **0.0%** |
| SPDX 3.0.1 model | 64 | 193 | 0 | 0 (0.0%) | 193 | 98 | 0 | 95 | 0 | 0 | **50.8%** |
| Health-RI domain modules (health, imaging, omics) | 1 | 6 | 0 | 0 (0.0%) | 6 | 3 | 0 | 3 | 0 | 0 | **50.0%** |
| Evidenze HealthDCAT-AP onboarding (ours) | 10 | 48 | 13 | 47 (97.9%) | 48 | 32 | 8 | 8 | 0 | 0 | **83.3%** |
| Evidenze data space onboarding (ours) | 7 | 33 | 10 | 32 (97.0%) | 33 | 21 | 4 | 8 | 0 | 0 | **75.8%** |

*Labelled* = property shapes carrying an `sh:name`; the rest fall back to the
local name of their predicate. *Fields* ≤ *property shapes*: two property
shapes on one node shape with the same path are one field, which is what the
user sees. *Typed widget* = a control more specific than a text input (date,
number, boolean, enum select, autocomplete, IRI, lang-string…). *Nested form* =
an `sh:node` reference, rendered as a sub-form. *Plain-text floor* = the engine
could say nothing better than a bare text input. *Read-only* = the path is not
a simple predicate, so values are shown but not editable. *No widget* = nothing
rendered at all.

**Zero-code control** = (typed widget + nested form) / fields: the share that
gets a control reflecting what the property actually *is*, with no per-profile
code and no edit to the profile. The plain-text floor and the read-only column
are the complement and are deliberately not folded in — a bare text box for a
controlled vocabulary is a form that renders, not a form that works.

**No widget** is zero in every profile: the type-fact fallback always resolves to *something*, so nothing fails to render outright. The whole question is what it degrades to, which is why the literal 'renders with zero custom widget code' figure would be 100% everywhere and is not the number reported.

### What authoring a profile for this engine buys

| Comparison | Ours | | Externally authored | | Difference |
|---|---|---:|---|---:|---:|
| like for like — the same profile, authored twice | Evidenze HealthDCAT-AP onboarding | 83.3% | Health-RI Core | 81.1% | **+2.2 points** |
| corpus extremes — best of each origin | Evidenze HealthDCAT-AP onboarding | 83.3% | SPHN 2026.1 | 87.1% | **-3.7 points** |

The first row is the adoption-cost measurement: both are implementations of
the same application profile, one written with complete knowledge of this
engine and one written by people who had never heard of it. The second row is
reported so the first cannot be mistaken for a corpus maximum — the highest
external score belongs to a profile from another domain with a different
shape style, and comparing against it would measure that, not adoption.

### Variants — excluded from the headline, reported because the pairs are informative

| Variant | Variant of | Fields | Typed widget | Nested form | **Zero-code control** |
|---|---|---:|---:|---:|---:|
| DCAT-AP 3.0.1 | `dcat-ap-3` | 131 | 88 | 0 | **67.2%** |
| HealthDCAT-AP Release 5 | `healthdcat-ap` | 83 | 32 | 8 | **48.2%** |
| DCAT-AP as vendored by Health-RI | `dcat-ap-3` | 109 | 72 | 0 | **66.1%** |
| Health-RI FAIR Data Point shapes | `health-ri-core` | 143 | 93 | 23 | **81.1%** |

A variant is a second encoding or a re-serialisation of a profile already
counted, so it is kept out of Tab. 3. The figures are here because the *pairs*
say something Tab. 3 cannot: the same specification, encoded twice, does not
produce the same form.

## Scale and annotation as authored

| Profile | Files | kB | `shui:editor` | `dash:editor` | `sh:group` | `sh:name` | `sh:message` | of those, lang-tagged | Languages |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| DCAT-AP 3.0.1 (SEMIC) | 5 | 65 | 0 | 0 | 0 | 0 | 11 | 6 (54.5%) | en (51) |
| HealthDCAT-AP Release 5 (European Commission) | 4 | 50 | 0 | 0 | 0 | 0 | 43 | 0 (0.0%) | en (17) |
| Health-RI Core (HealthDCAT-AP national implementation) | 14 | 83 | 0 | 141 | 0 | 143 | 0 | — | en (321) |
| DCAT-AP.de 2.0 (national extension, Germany) | 4 | 70 | 0 | 0 | 0 | 23 | 183 | 179 (97.8%) | de (251) |
| FAIR Data Point (FAIRDataTeam reference implementation) | 8 | 9 | 0 | 27 | 0 | 1 | 0 | — | — |
| SPHN 2026.1 (Swiss Personalized Health Network) | 1 | 930 | 0 | 0 | 0 | 0 | 636 | 0 (0.0%) | — |
| Bioschemas profiles v20250219 | 1 | 222 | 0 | 0 | 0 | 0 | 0 | — | — |
| SPDX 3.0.1 model | 1 | 179 | 0 | 0 | 0 | 0 | 0 | — | en (530) |
| Health-RI domain modules (health, imaging, omics) | 5 | 5 | 0 | 0 | 0 | 1 | 0 | — | en (15) |
| Evidenze HealthDCAT-AP onboarding (ours) | 1 | 34 | 11 | 0 | 47 | 47 | 14 | 14 (100.0%) | es (106), ca (82) |
| Evidenze data space onboarding (ours) | 1 | 28 | 7 | 0 | 32 | 32 | 8 | 8 (100.0%) | es (113), ca (87) |

These are textual counts over the whole profile, i.e. what the author wrote.
They can exceed the *Labelled* column of Tab. 3, which counts only property
shapes: DCAT-AP.de's 23 `sh:name`s are all on **node** shapes, and a node
shape's name has nowhere to go in a form that renders one shape as one page.

The `sh:message` pair is what makes the multilingual gap visible: a profile can
carry hundreds of author-written error messages and still offer the reader only
one language. Counted per literal, not per predicate — one `sh:message` may
carry several translations in one object list.

## Property paths

| Profile | predicate | inverse | sequence | alternative | zeroOrMore | oneOrMore | zeroOrOne |
|---|---:|---:|---:|---:|---:|---:|---:|
| DCAT-AP 3.0.1 (SEMIC) | 298 | 2 | · | · | · | · | · |
| HealthDCAT-AP Release 5 (European Commission) | 141 | · | · | 2 | · | · | · |
| Health-RI Core (HealthDCAT-AP national implementation) | 143 | · | · | · | · | · | · |
| DCAT-AP.de 2.0 (national extension, Germany) | 129 | · | · | 3 | · | · | · |
| FAIR Data Point (FAIRDataTeam reference implementation) | 37 | · | · | · | · | · | · |
| SPHN 2026.1 (Swiss Personalized Health Network) | 1377 | 26 | 71 | · | · | · | · |
| Bioschemas profiles v20250219 | 1173 | · | · | 530 | · | · | · |
| SPDX 3.0.1 model | 193 | · | · | · | · | · | · |
| Health-RI domain modules (health, imaging, omics) | 6 | · | · | · | · | · | · |
| Evidenze HealthDCAT-AP onboarding (ours) | 48 | · | · | · | · | · | · |
| Evidenze data space onboarding (ours) | 33 | · | · | · | · | · | · |

## Constraint components

Derived statically from the parameters each profile uses; these are the
components a validation report over that profile would name in
`sh:sourceConstraintComponent`. Counted per property shape.

| Component | `dcat-ap-3` | `healthdcat-ap` | `health-ri-core` | `dcat-ap-de` | `fair-data-point` | `sphn` | `bioschemas` | `spdx-3` | `health-ri-modules` | `evidenze-health` | `evidenze-dataspace` | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `sh:MinCountConstraintComponent` | 71 | 62 | 44 | 17 | 6 | 1220 | 353 | 54 | 6 | 25 | 14 | 1872 |
| `sh:MaxCountConstraintComponent` | 54 | 17 | 67 | 19 | 27 | 962 | · | 134 | · | 25 | 23 | 1328 |
| `sh:ClassConstraintComponent` | 84 | 25 | 1 | 27 | · | 765 | · | 71 | 2 | 8 | 4 | 987 |
| `sh:NodeKindConstraintComponent` | 144 | 85 | 112 | 30 | 22 | · | · | 184 | · | 39 | 28 | 644 |
| `sh:DatatypeConstraintComponent` | 6 | 4 | 20 | · | 8 | 256 | · | 113 | 4 | 16 | 16 | 443 |
| `sh:OrConstraintComponent` | · | · | · | 2 | · | 199 | · | · | · | · | · | 201 |
| `sh:NodeConstraintComponent` | 38 | 36 | 23 | 3 | 7 | · | · | · | · | 8 | 4 | 119 |
| `sh:InConstraintComponent` | · | · | 2 | · | · | 26 | · | 28 | · | 15 | 8 | 79 |
| `sh:HasValueConstraintComponent` | 16 | 24 | · | · | · | · | · | · | · | 1 | 1 | 42 |
| `sh:PatternConstraintComponent` | · | · | 13 | 6 | · | · | · | 21 | · | 1 | 1 | 42 |
| `sh:PropertyConstraintComponent` | · | · | · | 19 | · | · | · | · | · | · | · | 19 |
| `sh:UniqueLangConstraintComponent` | · | · | 13 | · | · | · | · | · | · | · | · | 13 |
| `sh:NotConstraintComponent` | · | · | · | · | · | · | · | 9 | · | · | · | 9 |
| `sh:QualifiedMinCountConstraintComponent` | · | · | · | 2 | · | · | · | · | · | · | · | 2 |
| `sh:QualifiedValueShapeConstraintComponent` | · | · | · | 2 | · | · | · | · | · | · | · | 2 |
| `sh:MinExclusiveConstraintComponent` | · | · | 1 | · | · | · | · | · | · | · | · | 1 |
| `sh:MinInclusiveConstraintComponent` | · | · | · | · | · | · | · | · | · | · | 1 | 1 |
| `sh:QualifiedMaxCountConstraintComponent` | · | · | · | 1 | · | · | · | · | · | · | · | 1 |

## What we cannot render, and why

The list §8 is built from. Three failure modes, kept apart because they are
not the same problem:

- **unrendered** — the construct reaches the IR and changes nothing the user sees.
- **carried** — it reaches the field model and no widget reads it.
- **dropped** — it is in the published source and never reaches the IR at all.

| Construct | Mode | Occurrences | Profiles | Why we cannot render it |
|---|---|---:|---|---|
| `sh:select` | dropped | 784 | sphn=784 | Body of sh:sparql. |
| `sh:sparql` | dropped | 480 | sphn=480 | SPARQL-based constraint. Validation-only; there is no affordance a form can derive from a query. |
| `sh:closed` | dropped | 233 | sphn=233 | Node-level closedness. A form offers exactly the fields the shape declares, so it cannot violate closedness — but it also cannot show the user that no other property is permitted. |
| `sh:ignoredProperties` | dropped | 233 | sphn=233 | Parameter of sh:closed. |
| `sh:or` | dropped / unrendered | 216 | dcat-ap-3=9, healthdcat-ap=2, dcat-ap-de=4, sphn=199, evidenze-health=2 | Parsed into the IR's `logical.or` and never read by buildFormModel. The field renders from its own facts only, so the disjuncts — often the real datatype/class alternatives — are invisible and unenforced in the UI. |
| `dash:editor` | unrendered | 168 | health-ri-core=141, fair-data-point=27 | The DASH editor vocabulary. The engine records the term and does not act on it: only `shui:editor` selects a widget. This is the measured baseline — see the note above the coverage table. |
| `dash:viewer` | unrendered | 165 | health-ri-core=141, fair-data-point=24 | See dash:editor. |
| `sh:target` | dropped | 96 | sphn=96 | SPARQL/custom target; not used for root-shape resolution. |
| `sh:hasValue` | carried / dropped | 84 | dcat-ap-3=16, healthdcat-ap=25, dcat-ap-de=28, spdx-3=12, evidenze-health=2, evidenze-dataspace=1 | Reaches FieldConstraints and no widget reads it. A property pinned to one value still renders as a free input the user can wrongly change. |
| `sh:property` | unrendered | 19 | dcat-ap-de=19 | A property shape nested INSIDE another property shape — reached as a constraint parameter (under sh:or, sh:qualifiedValueShape…) rather than from a node shape. Only node-shape properties are built into fields, so these are invisible. (The ordinary node-shape sh:property is the mechanism itself and is of course read; it is filtered out of this count.) |
| `sh:not` | unrendered | 12 | spdx-3=12 | Negation has no form affordance; nothing narrows the input. |
| `sh:shape` | unrendered | 5 | dcat-ap-3=5 | Not a SHACL 1.2 term at all — a leftover from a pre-REC draft, still shipped by DCAT-AP 3.0.1. It is recorded and ignored. |
| `sh:deactivated` | dropped | 3 | dcat-ap-de=3 | WRONGLY RENDERED, not merely ignored: the component is recorded but never honoured, so a property the profile switched off still gets a field. A correctness bug, not a missing feature. |
| `sh:qualifiedMinCount` | unrendered | 3 | dcat-ap-de=3 | Parameter of sh:qualifiedValueShape. |
| `sh:qualifiedValueShape` | unrendered | 3 | dcat-ap-de=3 | No slot in the typed IR. 'at least n of the values must match shape S' is a per-value constraint the field, which models one editor for all its values, cannot express. |
| `sh:entailment` | dropped | 1 | sphn=1 | Entailment regime declaration; ignored. |
| `sh:minExclusive` | carried | 1 | health-ri-core=1 | No numeric control here takes an exclusive bound, and no epsilon is right for both xsd:integer and xsd:double. Enforced on commit by the validator, invisible in the UI. |
| `sh:qualifiedMaxCount` | unrendered | 1 | dcat-ap-de=1 | Parameter of sh:qualifiedValueShape. |
| `sh:targetObjectsOf` | dropped | 1 | dcat-ap-de=1 | Target selector; not used for root-shape resolution. |

## DCAT-AP 3.0.1 (SEMIC)

> The upstream SEMIC release, not Health-RI's vendored copy. `shapes.ttl` (core constraints) + `range.ttl` (class ranges) + `mdr-vocabularies.shape.ttl` (controlled-vocabulary constraints) + `shapes_recommended.ttl` + `deprecateduris.ttl`. The two `*imports*.ttl` files are owl:imports stubs with no shapes in them and are excluded.

- source: 5 file(s), 2155 lines, 65 kB
- node shapes: 91 (61 carry property shapes)
- property shapes: 298; property groups: 0
- carrying sh:name: 0 (0.0%); sh:description: 27 (9.1%)
- SHACL 1.2 conditionals (`sh:if`): 0
- editor resolution: 119 from a stated `shui:editor`, 154 inferred, 0 degraded to the type-fact fallback

**Editors resolved:** TextFieldEditor=154, AutoCompleteEditor=87, DetailsEditor=24, IRIEditor=22, DatePickerEditor=7, NumberFieldEditor=3

**SHACL parameters present:** path=298, severity=281, nodeKind=144, class=84, minCount=71, maxCount=54, node=38, description=27, hasValue=16, datatype=6, message=6, shape=5

**Diagnostics:** conflicting-constraint=2, conjoined-property=1

- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://www.w3.org/ns/adms#status
- [conflicting-constraint] Property shapes on this path disagree on sh:node: kept http://data.europa.eu/r5r#StatusRestriction, not carried http://data.europa.eu/r5r#StatusRestrictionADMS. The validator still checks all of them. — http://www.w3.org/ns/adms#status
- [conflicting-constraint] Property shapes on this path disagree on sh:description: kept A non EU managed concept is used to indicate the status of the distribution. If no corresponding can be found inform the maintainer of the adms:status codelist., not carried The codelist of adms:status has changed from DCAT-AP 2.1 to DCAT-AP 3.0.0. — http://www.w3.org/ns/adms#status

**Each file loaded alone** — a profile is only a graph once someone concatenates it:

| File | Node shapes | Fields | Typed | Nested | Plain text | Read-only | Zero-code |
|---|---:|---:|---:|---:|---:|---:|---:|
| `deprecateduris.ttl` | 5 | 8 | 1 | 1 | 6 | 0 | 25.0% |
| `mdr-vocabularies.shape.ttl` | 28 | 42 | 18 | 24 | 0 | 0 | 100.0% |
| `range.ttl` | 15 | 82 | 82 | 0 | 0 | 0 | 100.0% |
| `shapes.ttl` | 25 | 130 | 18 | 0 | 112 | 0 | 13.8% |
| `shapes_recommended.ttl` | 19 | 36 | 0 | 0 | 36 | 0 | 0.0% |

**Cannot render:**

- `sh:hasValue` ×16 (carried) — Reaches FieldConstraints and no widget reads it. A property pinned to one value still renders as a free input the user can wrongly change.
- `sh:or` ×9 (dropped) — Parsed into the IR's `logical.or` and never read by buildFormModel. The field renders from its own facts only, so the disjuncts — often the real datatype/class alternatives — are invisible and unenforced in the UI.
- `sh:shape` ×5 (unrendered) — Not a SHACL 1.2 term at all — a leftover from a pre-REC draft, still shipped by DCAT-AP 3.0.1. It is recorded and ignored.

## HealthDCAT-AP Release 5 (European Commission)

> The authoritative HealthDCAT-AP, migrated off GitHub to the Commission's code.europa.eu in Sept 2025. Ships THREE sensitivity tiers of the same shapes — public / restricted / non-public. The public tier is measured here; the restricted tier is reported as a variant below.

- source: 4 file(s), 1281 lines, 50 kB
- node shapes: 52 (47 carry property shapes)
- property shapes: 139; property groups: 0
- carrying sh:name: 0 (0.0%); sh:description: 6 (4.3%)
- SHACL 1.2 conditionals (`sh:if`): 0
- editor resolution: 56 from a stated `shui:editor`, 44 inferred, 0 degraded to the type-fact fallback

**Editors resolved:** TextFieldEditor=44, DetailsEditor=34, IRIEditor=27, AutoCompleteEditor=25, NumberFieldEditor=4

**SHACL parameters present:** path=139, severity=112, nodeKind=85, message=65, minCount=62, node=36, class=25, hasValue=24, maxCount=17, description=6, datatype=4

**Diagnostics:** conjoined-property=5

- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://purl.org/dc/terms/publisher
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://healthdataportal.eu/ns/health#hdab
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://data.europa.eu/930/custodian
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://www.w3.org/ns/csvw#column
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://www.w3.org/ns/dcat#theme

**Each file loaded alone** — a profile is only a graph once someone concatenates it:

| File | Node shapes | Fields | Typed | Nested | Plain text | Read-only | Zero-code |
|---|---:|---:|---:|---:|---:|---:|---:|
| `public-shapes.ttl` | 13 | 53 | 20 | 8 | 25 | 0 | 52.8% |
| `public-shapes_recommended.ttl` | 1 | 18 | 0 | 0 | 18 | 0 | 0.0% |
| `range.ttl` | 3 | 13 | 12 | 0 | 1 | 0 | 92.3% |
| `mdr-vocabularies.shape.ttl` | 35 | 50 | 24 | 26 | 0 | 0 | 100.0% |

**Cannot render:**

- `sh:hasValue` ×25 (carried) — Reaches FieldConstraints and no widget reads it. A property pinned to one value still renders as a free input the user can wrongly change.
- `sh:or` ×2 (dropped) — Parsed into the IR's `logical.or` and never read by buildFormModel. The field renders from its own facts only, so the disjuncts — often the real datatype/class alternatives — are invisible and unenforced in the UI.

## Health-RI Core (HealthDCAT-AP national implementation)

> Per-class shapes with cross-file sh:node references. DASH-annotated.

- source: 14 file(s), 1819 lines, 83 kB
- node shapes: 14 (13 carry property shapes)
- property shapes: 143; property groups: 0
- carrying sh:name: 143 (100.0%); sh:description: 123 (86.0%)
- SHACL 1.2 conditionals (`sh:if`): 0
- editor resolution: 93 from a stated `shui:editor`, 27 inferred, 0 degraded to the type-fact fallback

**Editors resolved:** IRIEditor=74, TextFieldEditor=27, DetailsEditor=23, DateTimePickerEditor=11, NumberFieldEditor=5, EnumSelectEditor=2, AutoCompleteEditor=1

**SHACL parameters present:** name=143, path=143, editor=141, viewer=141, description=123, nodeKind=112, maxCount=67, minCount=44, node=23, datatype=20, pattern=13, uniqueLang=13, defaultValue=2, in=2, class=1, minExclusive=1

**Each file loaded alone** — a profile is only a graph once someone concatenates it:

| File | Node shapes | Fields | Typed | Nested | Plain text | Read-only | Zero-code |
|---|---:|---:|---:|---:|---:|---:|---:|
| `Agent.ttl` | 1 | 8 | 5 | 0 | 3 | 0 | 62.5% |
| `Attribution.ttl` | 2 | 2 | 1 | 1 | 0 | 0 | 100.0% |
| `Catalog.ttl` | 4 | 19 | 12 | 4 | 3 | 0 | 84.2% |
| `Checksum.ttl` | 1 | 2 | 1 | 0 | 1 | 0 | 50.0% |
| `DataService.ttl` | 4 | 22 | 14 | 4 | 4 | 0 | 81.8% |
| `Dataset.ttl` | 8 | 47 | 30 | 9 | 8 | 0 | 83.0% |
| `DatasetSeries.ttl` | 4 | 10 | 5 | 3 | 2 | 0 | 80.0% |
| `Distribution.ttl` | 3 | 22 | 17 | 2 | 3 | 0 | 86.4% |
| `Identifier.ttl` | 1 | 2 | 0 | 0 | 2 | 0 | 0.0% |
| `Kind.ttl` | 1 | 3 | 2 | 0 | 1 | 0 | 66.7% |
| `PeriodOfTime.ttl` | 1 | 2 | 2 | 0 | 0 | 0 | 100.0% |
| `QualityCertificate.ttl` | 1 | 2 | 2 | 0 | 0 | 0 | 100.0% |
| `Relationship.ttl` | 1 | 2 | 2 | 0 | 0 | 0 | 100.0% |
| `Resource.ttl` | 1 | 0 | 0 | 0 | 0 | 0 | — |

**Cannot render:**

- `dash:editor` ×141 (unrendered) — The DASH editor vocabulary. The engine records the term and does not act on it: only `shui:editor` selects a widget. This is the measured baseline — see the note above the coverage table.
- `dash:viewer` ×141 (unrendered) — See dash:editor.
- `sh:minExclusive` ×1 (carried) — No numeric control here takes an exclusive bound, and no epsilon is right for both xsd:integer and xsd:double. Enforced on commit by the validator, invisible in the UI.

## DCAT-AP.de 2.0 (national extension, Germany)

> The national extension's OWN shapes. The release also ships a verbatim copy of `dcat-ap_2.1.1_shacl_shapes.ttl`; it is excluded here because DCAT-AP is already counted, and folding it in would double-count the core. The richest profile in the corpus by construct variety.

- source: 4 file(s), 1608 lines, 70 kB
- node shapes: 29 (23 carry property shapes)
- property shapes: 121; property groups: 0
- carrying sh:name: 0 (0.0%); sh:description: 1 (0.8%)
- SHACL 1.2 conditionals (`sh:if`): 0
- editor resolution: 48 from a stated `shui:editor`, 54 inferred, 0 degraded to the type-fact fallback

**Editors resolved:** TextFieldEditor=54, AutoCompleteEditor=27, IRIEditor=21, DetailsEditor=2

**SHACL parameters present:** path=121, message=102, severity=99, nodeKind=30, class=27, maxCount=19, property=19, minCount=17, flags=3, node=3, pattern=3, or=2, qualifiedMinCount=2, qualifiedValueShape=2, description=1, qualifiedMaxCount=1

**Diagnostics:** conjoined-property=17, unrenderable-alternative=2

- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://schema.org/endDate
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://schema.org/startDate
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://data.europa.eu/r5r#availability
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://purl.org/dc/terms/license
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://data.europa.eu/r5r#availability
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://dcat-ap.de/def/dcatde/plannedAvailability
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://purl.org/dc/terms/license
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://spdx.org/rdf/terms#algorithm
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://purl.org/dc/terms/type
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://dcat-ap.de/def/dcatde/politicalGeocodingLevelURI
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://purl.org/dc/terms/publisher
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://www.w3.org/ns/dcat#granularity

**Each file loaded alone** — a profile is only a graph once someone concatenates it:

| File | Node shapes | Fields | Typed | Nested | Plain text | Read-only | Zero-code |
|---|---:|---:|---:|---:|---:|---:|---:|
| `dcat-ap-spec-german-additions.ttl` | 17 | 70 | 42 | 2 | 26 | 0 | 62.9% |
| `dcat-ap-spec-german-messages.ttl` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `dcat-ap-konventionen.ttl` | 8 | 27 | 6 | 0 | 21 | 0 | 22.2% |
| `dcat-ap-de-deprecated.ttl` | 4 | 7 | 0 | 0 | 7 | 0 | 0.0% |

**Cannot render:**

- `sh:hasValue` ×28 (dropped) — Reaches FieldConstraints and no widget reads it. A property pinned to one value still renders as a free input the user can wrongly change.
- `sh:property` ×19 (unrendered) — A property shape nested INSIDE another property shape — reached as a constraint parameter (under sh:or, sh:qualifiedValueShape…) rather than from a node shape. Only node-shape properties are built into fields, so these are invisible. (The ordinary node-shape sh:property is the mechanism itself and is of course read; it is filtered out of this count.)
- `sh:or` ×4 (unrendered) — Parsed into the IR's `logical.or` and never read by buildFormModel. The field renders from its own facts only, so the disjuncts — often the real datatype/class alternatives — are invisible and unenforced in the UI.
- `sh:deactivated` ×3 (dropped) — WRONGLY RENDERED, not merely ignored: the component is recorded but never honoured, so a property the profile switched off still gets a field. A correctness bug, not a missing feature.
- `sh:qualifiedMinCount` ×3 (unrendered) — Parameter of sh:qualifiedValueShape.
- `sh:qualifiedValueShape` ×3 (unrendered) — No slot in the typed IR. 'at least n of the values must match shape S' is a per-value constraint the field, which models one editor for all its values, cannot express.
- `sh:qualifiedMaxCount` ×1 (unrendered) — Parameter of sh:qualifiedValueShape.
- `sh:targetObjectsOf` ×1 (dropped) — Target selector; not used for root-shape resolution.

## FAIR Data Point (FAIRDataTeam reference implementation)

> Not a specification document but the shapes a running FDP instance ships and serves to its own metadata editor — the closest thing in the corpus to a profile authored FOR a form. DASH-annotated throughout.

- source: 8 file(s), 340 lines, 9 kB
- node shapes: 13 (11 carry property shapes)
- property shapes: 37; property groups: 0
- carrying sh:name: 1 (2.7%); sh:description: 0 (0.0%)
- SHACL 1.2 conditionals (`sh:if`): 0
- editor resolution: 22 from a stated `shui:editor`, 8 inferred, 0 degraded to the type-fact fallback

**Editors resolved:** IRIEditor=14, TextFieldEditor=8, DetailsEditor=7, DateTimePickerEditor=6, DatePickerEditor=2

**SHACL parameters present:** path=37, order=30, editor=27, maxCount=27, viewer=24, nodeKind=22, datatype=8, node=7, minCount=6, defaultValue=3, name=1

**Each file loaded alone** — a profile is only a graph once someone concatenates it:

| File | Node shapes | Fields | Typed | Nested | Plain text | Read-only | Zero-code |
|---|---:|---:|---:|---:|---:|---:|---:|
| `defaultNavigationShacl.ttl` | 5 | 6 | 0 | 6 | 0 | 0 | 100.0% |
| `shape-catalog.ttl` | 1 | 4 | 4 | 0 | 0 | 0 | 100.0% |
| `shape-data-service.ttl` | 1 | 2 | 2 | 0 | 0 | 0 | 100.0% |
| `shape-dataset.ttl` | 1 | 6 | 5 | 0 | 1 | 0 | 83.3% |
| `shape-distribution.ttl` | 1 | 7 | 4 | 0 | 3 | 0 | 57.1% |
| `shape-fdp.ttl` | 1 | 4 | 4 | 0 | 0 | 0 | 100.0% |
| `shape-metadata-service.ttl` | 1 | 0 | 0 | 0 | 0 | 0 | — |
| `shape-resource.ttl` | 2 | 8 | 3 | 1 | 4 | 0 | 50.0% |

**Cannot render:**

- `dash:editor` ×27 (unrendered) — The DASH editor vocabulary. The engine records the term and does not act on it: only `shui:editor` selects a widget. This is the measured baseline — see the note above the coverage table.
- `dash:viewer` ×24 (unrendered) — See dash:editor.

## SPHN 2026.1 (Swiss Personalized Health Network)

> The corpus's non-DCAT health profile, and by two orders of magnitude its largest single file (952 kB). Closed shapes throughout and ~480 SPARQL-based constraints. Included precisely because it is the profile most likely to break something.

- source: 1 file(s), 17025 lines, 930 kB
- node shapes: 1744 (233 carry property shapes)
- property shapes: 1246; property groups: 0
- carrying sh:name: 0 (0.0%); sh:description: 0 (0.0%)
- SHACL 1.2 conditionals (`sh:if`): 0
- editor resolution: 1085 from a stated `shui:editor`, 90 inferred, 0 degraded to the type-fact fallback

**Editors resolved:** AutoCompleteEditor=961, DateTimePickerEditor=160, TextFieldEditor=90, EnumSelectEditor=26, NumberFieldEditor=5, IRIEditor=4

**SHACL parameters present:** path=1246, minCount=1220, maxCount=962, class=765, datatype=256, or=199, in=26

**Cannot render:**

- `sh:select` ×784 (dropped) — Body of sh:sparql.
- `sh:sparql` ×480 (dropped) — SPARQL-based constraint. Validation-only; there is no affordance a form can derive from a query.
- `sh:closed` ×233 (dropped) — Node-level closedness. A form offers exactly the fields the shape declares, so it cannot violate closedness — but it also cannot show the user that no other property is permitted.
- `sh:ignoredProperties` ×233 (dropped) — Parameter of sh:closed.
- `sh:or` ×199 (unrendered) — Parsed into the IR's `logical.or` and never read by buildFormModel. The field renders from its own facts only, so the disjuncts — often the real datatype/class alternatives — are invisible and unenforced in the UI.
- `sh:target` ×96 (dropped) — SPARQL/custom target; not used for root-shape resolution.
- `sh:entailment` ×1 (dropped) — Entailment regime declaration; ignored.

## Bioschemas profiles v20250219

> 32 life-science profiles in one file, generated from the Bioschemas specifications. Every single path is an sh:alternativePath over the http/https forms of a schema.org term — a complex path used not for expressiveness but to paper over a namespace split. Carries sh:severity and sh:description and NOTHING else: no datatype, no class, no maxCount, no name. The corpus's worst case for type-fact inference, by construction.

- source: 1 file(s), 2152 lines, 222 kB
- node shapes: 32 (32 carry property shapes)
- property shapes: 643; property groups: 0
- carrying sh:name: 0 (0.0%); sh:description: 643 (100.0%)
- SHACL 1.2 conditionals (`sh:if`): 0
- editor resolution: 0 from a stated `shui:editor`, 641 inferred, 0 degraded to the type-fact fallback

**Editors resolved:** TextFieldEditor=641

**SHACL parameters present:** description=643, path=643, minCount=353, severity=353

**Diagnostics:** conjoined-property=2

- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — (http://schema.org/sameAs|https://schema.org/sameAs)
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — (http://schema.org/sameAs|https://schema.org/sameAs)

## SPDX 3.0.1 model

> Not health, and not a metadata catalogue: the software bill-of-materials model, published by the Linux Foundation as generated SHACL interleaved with OWL axioms in one file. In the corpus as the out-of-domain control — if the coverage number holds here it is not a fact about DCAT.

- source: 1 file(s), 3331 lines, 179 kB
- node shapes: 64 (52 carry property shapes)
- property shapes: 193; property groups: 0
- carrying sh:name: 0 (0.0%); sh:description: 0 (0.0%)
- SHACL 1.2 conditionals (`sh:if`): 0
- editor resolution: 98 from a stated `shui:editor`, 95 inferred, 0 degraded to the type-fact fallback

**Editors resolved:** TextFieldEditor=95, AutoCompleteEditor=43, EnumSelectEditor=28, IRIEditor=13, NumberFieldEditor=9, BooleanEditor=5

**SHACL parameters present:** path=193, nodeKind=184, maxCount=134, datatype=113, class=71, minCount=54, in=28, pattern=21, message=9, not=9

**Cannot render:**

- `sh:hasValue` ×12 (dropped) — Reaches FieldConstraints and no widget reads it. A property pinned to one value still renders as a free input the user can wrongly change.
- `sh:not` ×12 (unrendered) — Negation has no form affordance; nothing narrows the input.

## Health-RI domain modules (health, imaging, omics)

> Small; mostly rules rather than form-bearing shapes. Kept for honesty about size.

- source: 5 file(s), 147 lines, 5 kB
- node shapes: 1 (1 carry property shapes)
- property shapes: 6; property groups: 0
- carrying sh:name: 0 (0.0%); sh:description: 0 (0.0%)
- SHACL 1.2 conditionals (`sh:if`): 0
- editor resolution: 3 from a stated `shui:editor`, 3 inferred, 0 degraded to the type-fact fallback

**Editors resolved:** TextFieldEditor=3, AutoCompleteEditor=2, NumberFieldEditor=1

**SHACL parameters present:** minCount=6, path=6, datatype=4, class=2

**Each file loaded alone** — a profile is only a graph once someone concatenates it:

| File | Node shapes | Fields | Typed | Nested | Plain text | Read-only | Zero-code |
|---|---:|---:|---:|---:|---:|---:|---:|
| `ImagingRules.shape.ttl` | 1 | 6 | 3 | 0 | 3 | 0 | 50.0% |
| `dicomBodyParts.ttl` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `dicomScanModality.ttl` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `omicsRules.shape.ttl` | 0 | 0 | 0 | 0 | 0 | 0 | — |
| `healthRules.shape.ttl` | 0 | 0 | 0 | 0 | 0 | 0 | — |

## Evidenze HealthDCAT-AP onboarding (ours)

> Pure SHACL 1.2 + SHACL-UI. The deployment.

- source: 1 file(s), 804 lines, 34 kB
- node shapes: 10 (10 carry property shapes)
- property shapes: 48; property groups: 13
- carrying sh:name: 47 (97.9%); sh:description: 23 (47.9%)
- SHACL 1.2 conditionals (`sh:if`): 1
- editor resolution: 32 from a stated `shui:editor`, 8 inferred, 0 degraded to the type-fact fallback

**Editors resolved:** EnumSelectEditor=15, IRIEditor=9, DetailsEditor=8, TextFieldEditor=8, TextFieldWithLangEditor=5, TextAreaEditor=2, BooleanEditor=1

**SHACL parameters present:** path=48, group=47, name=47, order=47, type=47, nodeKind=39, maxCount=25, minCount=25, description=23, datatype=16, in=15, editor=10, class=8, node=8, message=7, hasValue=1, pattern=1

**Cannot render:**

- `sh:hasValue` ×2 (carried) — Reaches FieldConstraints and no widget reads it. A property pinned to one value still renders as a free input the user can wrongly change.
- `sh:or` ×2 (dropped) — Parsed into the IR's `logical.or` and never read by buildFormModel. The field renders from its own facts only, so the disjuncts — often the real datatype/class alternatives — are invisible and unenforced in the UI.

## Evidenze data space onboarding (ours)

> Pure SHACL 1.2 + SHACL-UI.

- source: 1 file(s), 600 lines, 28 kB
- node shapes: 7 (7 carry property shapes)
- property shapes: 33; property groups: 10
- carrying sh:name: 32 (97.0%); sh:description: 32 (97.0%)
- SHACL 1.2 conditionals (`sh:if`): 1
- editor resolution: 21 from a stated `shui:editor`, 8 inferred, 0 degraded to the type-fact fallback

**Editors resolved:** EnumSelectEditor=8, TextFieldEditor=8, IRIEditor=5, DetailsEditor=4, TextAreaEditor=3, BooleanEditor=2, TextFieldWithLangEditor=2, NumberFieldEditor=1

**SHACL parameters present:** path=33, description=32, group=32, name=32, order=32, type=32, nodeKind=28, maxCount=23, datatype=16, minCount=14, in=8, editor=7, message=5, class=4, node=4, hasValue=1, minInclusive=1, pattern=1

**Cannot render:**

- `sh:hasValue` ×1 (carried) — Reaches FieldConstraints and no widget reads it. A property pinned to one value still renders as a free input the user can wrongly change.

## DCAT-AP 3.0.1 — generated encoding *(variant of `dcat-ap-3` — excluded from headline)*

> The SAME release, second encoding: `releases/3.0.1/shacl/` is generated from the UML model, uses the `shacl:` prefix rather than `sh:`, closes every node shape, and carries sh:name + sh:description on every one of its 290 property shapes — which the hand-maintained `html/shacl/` encoding of the same spec has none of. Excluded from the headline (it is not an independent profile) but the pair is the cleanest natural experiment in the corpus: one spec, two encodings, measurably different forms.

- source: 2 file(s), 3452 lines, 230 kB
- node shapes: 40 (15 carry property shapes)
- property shapes: 292; property groups: 0
- carrying sh:name: 292 (100.0%); sh:description: 292 (100.0%)
- SHACL 1.2 conditionals (`sh:if`): 0
- editor resolution: 88 from a stated `shui:editor`, 43 inferred, 0 degraded to the type-fact fallback

**Editors resolved:** AutoCompleteEditor=85, TextFieldEditor=43, NumberFieldEditor=3

**SHACL parameters present:** description=292, name=292, path=292, seeAlso=292, nodeKind=131, class=85, maxCount=50, minCount=20, datatype=6

**Diagnostics:** conjoined-property=119

- [conjoined-property] 3 property shapes state this path; the field is their conjunction. — http://purl.org/dc/terms/source
- [conjoined-property] 4 property shapes state this path; the field is their conjunction. — http://xmlns.com/foaf/0.1/primaryTopic
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://purl.org/dc/terms/language
- [conjoined-property] 3 property shapes state this path; the field is their conjunction. — http://purl.org/dc/terms/modified
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://purl.org/dc/terms/issued
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://purl.org/dc/terms/conformsTo
- [conjoined-property] 3 property shapes state this path; the field is their conjunction. — http://www.w3.org/ns/adms#status
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://www.w3.org/ns/dcat#endpointDescription
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://purl.org/dc/terms/title
- [conjoined-property] 3 property shapes state this path; the field is their conjunction. — http://purl.org/dc/terms/license
- [conjoined-property] 3 property shapes state this path; the field is their conjunction. — http://purl.org/dc/terms/accessRights
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://xmlns.com/foaf/0.1/page

**Each file loaded alone** — a profile is only a graph once someone concatenates it:

| File | Node shapes | Fields | Typed | Nested | Plain text | Read-only | Zero-code |
|---|---:|---:|---:|---:|---:|---:|---:|
| `dcat-ap-SHACL.ttl` | 35 | 131 | 86 | 0 | 45 | 0 | 65.6% |
| `ranges.ttl` | 240 | 91 | 88 | 0 | 3 | 0 | 96.7% |

**Cannot render:**

- `<http://www.w3.org/2000/01/rdf-schema#seeAlso>` ×292 (unrendered) — Not in the construct ledger — unclassified, and therefore unread by the form layer.
- `sh:closed` ×67 (dropped) — Node-level closedness. A form offers exactly the fields the shape declares, so it cannot violate closedness — but it also cannot show the user that no other property is permitted.

## HealthDCAT-AP Release 5 — restricted tier *(variant of `healthdcat-ap` — excluded from headline)*

> Same shape IRIs as the public tier with different severities/cardinalities for sensitive properties. Reported to show the tiering; not an independent n.

- source: 3 file(s), 684 lines, 25 kB
- node shapes: 17 (16 carry property shapes)
- property shapes: 87; property groups: 0
- carrying sh:name: 0 (0.0%); sh:description: 2 (2.3%)
- SHACL 1.2 conditionals (`sh:if`): 0
- editor resolution: 32 from a stated `shui:editor`, 43 inferred, 0 degraded to the type-fact fallback

**Editors resolved:** TextFieldEditor=43, AutoCompleteEditor=17, IRIEditor=11, DetailsEditor=8, NumberFieldEditor=4

**SHACL parameters present:** path=87, severity=83, message=40, minCount=40, nodeKind=35, class=17, maxCount=17, node=8, datatype=4, description=2, hasValue=1

**Diagnostics:** conjoined-property=4

- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://healthdataportal.eu/ns/health#hdab
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://purl.org/dc/terms/publisher
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://data.europa.eu/930/custodian
- [conjoined-property] 2 property shapes state this path; the field is their conjunction. — http://www.w3.org/ns/csvw#column

**Each file loaded alone** — a profile is only a graph once someone concatenates it:

| File | Node shapes | Fields | Typed | Nested | Plain text | Read-only | Zero-code |
|---|---:|---:|---:|---:|---:|---:|---:|
| `restricted-shapes.ttl` | 13 | 52 | 20 | 8 | 24 | 0 | 53.8% |
| `restricted-shapes_recommended.ttl` | 1 | 18 | 0 | 0 | 18 | 0 | 0.0% |
| `range.ttl` | 3 | 13 | 12 | 0 | 1 | 0 | 92.3% |

**Cannot render:**

- `sh:hasValue` ×1 (carried) — Reaches FieldConstraints and no widget reads it. A property pinned to one value still renders as a free input the user can wrongly change.

## DCAT-AP as vendored by Health-RI *(variant of `dcat-ap-3` — excluded from headline)*

> Health-RI's in-tree copy of DCAT-AP. Was the E1 'DCAT-AP' row until the upstream SEMIC release was vendored; demoted to a variant so DCAT-AP is counted once. Kept because the drift between a vendored copy and its upstream is itself worth a sentence.

- source: 1 file(s), 698 lines, 20 kB
- node shapes: 21 (14 carry property shapes)
- property shapes: 109; property groups: 0
- carrying sh:name: 0 (0.0%); sh:description: 0 (0.0%)
- SHACL 1.2 conditionals (`sh:if`): 0
- editor resolution: 72 from a stated `shui:editor`, 37 inferred, 0 degraded to the type-fact fallback

**Editors resolved:** AutoCompleteEditor=64, TextFieldEditor=37, DatePickerEditor=5, NumberFieldEditor=3

**SHACL parameters present:** path=109, severity=109, class=63, maxCount=47, nodeKind=27, minCount=18, node=6, datatype=5, shape=5, dateTime=1, hasValue=1

**Cannot render:**

- `sh:shape` ×5 (unrendered) — Not a SHACL 1.2 term at all — a leftover from a pre-REC draft, still shipped by DCAT-AP 3.0.1. It is recorded and ignored.
- `sh:or` ×2 (dropped) — Parsed into the IR's `logical.or` and never read by buildFormModel. The field renders from its own facts only, so the disjuncts — often the real datatype/class alternatives — are invisible and unenforced in the UI.
- `sh:dateTime` ×1 (unrendered) — Not in the construct ledger — unclassified, and therefore unread by the form layer.
- `sh:hasValue` ×1 (carried) — Reaches FieldConstraints and no widget reads it. A property pinned to one value still renders as a free input the user can wrongly change.

## Health-RI FAIR Data Point shapes *(variant of `health-ri-core` — excluded from headline)*

> NOT an independent profile. It declares the same shape IRIs (hri:AgentShape, hri:CatalogShape, …) as PiecesShape, and its 178 sh:path lines collapse to the same 137 distinct (shape, path) pairs — each FDP file is self-contained and redefines the shared shapes, so concatenation merges them by identity. Unrelated to the FAIRDataTeam `fair-data-point` profile above.

- source: 6 file(s), 2077 lines, 92 kB
- node shapes: 14 (13 carry property shapes)
- property shapes: 143; property groups: 0
- carrying sh:name: 143 (100.0%); sh:description: 123 (86.0%)
- SHACL 1.2 conditionals (`sh:if`): 0
- editor resolution: 93 from a stated `shui:editor`, 27 inferred, 0 degraded to the type-fact fallback

**Editors resolved:** IRIEditor=74, TextFieldEditor=27, DetailsEditor=23, DateTimePickerEditor=11, NumberFieldEditor=5, EnumSelectEditor=2, AutoCompleteEditor=1

**SHACL parameters present:** name=143, path=143, editor=141, viewer=141, description=123, nodeKind=112, maxCount=67, minCount=44, node=23, datatype=20, pattern=13, uniqueLang=13, defaultValue=2, in=2, class=1, minExclusive=1

**Each file loaded alone** — a profile is only a graph once someone concatenates it:

| File | Node shapes | Fields | Typed | Nested | Plain text | Read-only | Zero-code |
|---|---:|---:|---:|---:|---:|---:|---:|
| `Catalog.ttl` | 4 | 32 | 21 | 4 | 7 | 0 | 78.1% |
| `DataService.ttl` | 4 | 35 | 21 | 4 | 10 | 0 | 71.4% |
| `Dataset.ttl` | 8 | 68 | 44 | 10 | 14 | 0 | 79.4% |
| `DatasetSeries.ttl` | 4 | 23 | 14 | 3 | 6 | 0 | 73.9% |
| `Distribution.ttl` | 3 | 26 | 20 | 2 | 4 | 0 | 84.6% |
| `Resource.ttl` | 1 | 0 | 0 | 0 | 0 | 0 | — |

**Cannot render:**

- `dash:editor` ×182 (unrendered) — The DASH editor vocabulary. The engine records the term and does not act on it: only `shui:editor` selects a widget. This is the measured baseline — see the note above the coverage table.
- `dash:viewer` ×182 (unrendered) — See dash:editor.
- `sh:minExclusive` ×1 (carried) — No numeric control here takes an exclusive bound, and no epsilon is right for both xsd:integer and xsd:double. Enforced on commit by the validator, invisible in the UI.
