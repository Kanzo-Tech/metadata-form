# E1 — coverage across published SHACL profiles

Generated 2026-08-26 by `coverage.harness.ts`. Do not edit by hand.

Baseline measured: rudof reads only `shui:editor`, so `dash:editor`
annotations are ignored and every editor is inferred from datatype/nodeKind
facts. This is what a data space adopting an official profile gets today.

**n = 5 independent profiles.** 1 further input set(s)
proved to be re-serialisations of a profile already counted; they are reported
in full below but kept out of the headline tables. See each one's note for the
evidence.

## Scale and annotation as authored

| Profile | Files | Node shapes | Property shapes | `shui:editor` | `dash:editor` | `sh:group` | Languages |
|---|---:|---:|---:|---:|---:|---:|---|
| Health-RI Core (HealthDCAT-AP) | 14 | 14 | 143 | 0 | 141 | 0 | en |
| Health-RI domain modules (health, imaging, omics) | 5 | 1 | 6 | 0 | 0 | 0 | en |
| DCAT-AP (as vendored by Health-RI) | 1 | 21 | 109 | 0 | 0 | 0 | en |
| Evidenze HealthDCAT-AP R7 onboarding (ours) | 1 | 10 | 48 | 11 | 0 | 47 | ca, es |
| Evidenze data space onboarding (ours) | 1 | 7 | 33 | 7 | 0 | 32 | ca, es |

## Coverage

| Profile | Parsed | Shapes built | Fields | Typed editor | Plain-text fallback | Complex paths |
|---|:--:|---:|---:|---:|---:|---:|
| Health-RI Core (HealthDCAT-AP) | ✓ | 14/14 | 143 | 93 (65.0%) | 50 (35.0%) | 0 |
| Health-RI domain modules (health, imaging, omics) | ✓ | 1/1 | 6 | 3 (50.0%) | 3 (50.0%) | 0 |
| DCAT-AP (as vendored by Health-RI) | ✓ | 21/21 | 109 | 66 (60.6%) | 43 (39.4%) | 0 |
| Evidenze HealthDCAT-AP R7 onboarding (ours) | ✓ | 10/10 | 48 | 32 (66.7%) | 16 (33.3%) | 0 |
| Evidenze data space onboarding (ours) | ✓ | 7/7 | 33 | 21 (63.6%) | 12 (36.4%) | 0 |

*Typed editor* = the engine resolved a datatype-appropriate widget
(date, number, boolean, select, reference, URL, lang-string…). *Plain-text
fallback* = it could say nothing better than a bare text input.

## Health-RI Core (HealthDCAT-AP)

> Per-class shapes with cross-file sh:node references. DASH-annotated.

- 14 file(s), 1819 lines of Turtle
- SHACL 1.2 conditionals (`sh:if`): **0**
- property groups: 0
- path kinds: predicate=143

**Widgets resolved:** url=74, text=50, datetime=11, number=5, select=2, reference=1

**Constraint components (top 15):** path=143, name=143, editor=141, viewer=141, description=123, nodeKind=112, maxCount=67, minCount=44, node=23, datatype=20, uniqueLang=13, pattern=13, in=2, defaultValue=2, class=1

## Health-RI FAIR Data Point *(variant — excluded from headline)*

> NOT an independent profile. It declares the same shape IRIs (hri:AgentShape, hri:CatalogShape, …) as PiecesShape, and its 178 sh:path lines collapse to the same 137 distinct (shape, path) pairs — each FDP file is self-contained and redefines the shared shapes, so concatenation merges them by identity. Reported for the record; excluded from the headline table so it cannot inflate n.

- 6 file(s), 2077 lines of Turtle
- SHACL 1.2 conditionals (`sh:if`): **0**
- property groups: 0
- path kinds: predicate=143

**Widgets resolved:** url=74, text=50, datetime=11, number=5, select=2, reference=1

**Constraint components (top 15):** path=143, name=143, viewer=141, editor=141, description=123, nodeKind=112, maxCount=67, minCount=44, node=23, datatype=20, pattern=13, uniqueLang=13, in=2, defaultValue=2, minExclusive=1

## Health-RI domain modules (health, imaging, omics)

> Small; expected to be mostly rules rather than form-bearing shapes.

- 5 file(s), 147 lines of Turtle
- SHACL 1.2 conditionals (`sh:if`): **0**
- property groups: 0
- path kinds: predicate=6

**Widgets resolved:** text=3, reference=2, number=1

**Constraint components (top 15):** path=6, minCount=6, datatype=4, class=2

## DCAT-AP (as vendored by Health-RI)

> Prefer the upstream SEMIC release once vendored; this is a copy.

- 1 file(s), 698 lines of Turtle
- SHACL 1.2 conditionals (`sh:if`): **0**
- property groups: 0
- path kinds: predicate=109

**Widgets resolved:** reference=63, text=43, number=3

**Constraint components (top 15):** severity=109, path=109, class=63, maxCount=47, nodeKind=27, minCount=18, node=6, shape=5, datatype=5, hasValue=1, dateTime=1

## Evidenze HealthDCAT-AP R7 onboarding (ours)

> Pure SHACL 1.2 + SHACL-UI. The deployment.

- 1 file(s), 793 lines of Turtle
- SHACL 1.2 conditionals (`sh:if`): **1**
- property groups: 13
- path kinds: predicate=48

**Widgets resolved:** text=16, select=15, url=9, lang=7, boolean=1

**Constraint components (top 15):** path=48, group=47, type=47, name=47, order=47, nodeKind=39, maxCount=25, minCount=25, description=23, datatype=16, in=15, node=8, class=8, message=7, pattern=1

## Evidenze data space onboarding (ours)

> Pure SHACL 1.2 + SHACL-UI.

- 1 file(s), 590 lines of Turtle
- SHACL 1.2 conditionals (`sh:if`): **1**
- property groups: 10
- path kinds: predicate=33

**Widgets resolved:** text=12, select=8, url=5, textarea=3, boolean=2, lang=2, number=1

**Constraint components (top 15):** path=33, name=32, order=32, type=32, group=32, description=32, nodeKind=28, maxCount=23, datatype=16, minCount=14, in=8, editor=7, message=5, node=4, class=4
