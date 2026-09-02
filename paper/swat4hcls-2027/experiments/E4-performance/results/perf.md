# E4 — performance of per-edit conditional re-evaluation

Generated 2026-08-28T17:47:02Z by `perf.harness.ts`. Do not edit by hand.

Every cell is **median / p95** over the stated sample count, nearest-rank
(no interpolation), so each figure is an observation that happened.

## Headline

- **Per-edit re-evaluation is sub-frame.** Re-projecting the whole form tree from
  the graph — the wasm call that re-evaluates every `sh:if` — costs
  0.008–8.64 ms at p95 across 8 published profiles, and a committed
  edit reaches a new `FormModel` with updated conditional visibility in
  0.352–1.79 ms at p95. A 60 Hz frame is 16.7 ms.
- **Parsing is the one-off cost, and it is the one that scales badly.** It
  spans 0.543 ms for Health-RI domain modules (health, imaging, omics) (4.8 kB) to
  **13383 ms** for SPHN 2026.1 (Swiss Personalized Health Network)
  (1246 property shapes, 930 kB of Turtle) — and it grows faster than
  input size, not with it (see Tab. 4). Instantiating the module adds a flat
  10.1 ms. This is a load-time cost, paid once and never per edit, but at the
  top of the corpus it is seconds, not milliseconds, and a profile of that size
  needs the shapes parsed off the interaction path (a worker, or a cached IR)
  rather than in front of the user. The earlier Health-RI-only corpus topped out
  at 83 kB and did not show this at all.
- **Validation is off the visibility path.** `validate()` is 29.9 ms at worst
  here, and runs on its own 300 ms debounce, so it never gates a field appearing.
- **The payload is the weak point.** 629.9 kB of brotli-compressed wasm plus
  114.9 kB of JS. That is the honest cost of putting a SHACL engine in
  the browser, and it is a first-load cost, not a per-edit one.

## What was measured, and where

| | |
|---|---|
| Machine | Apple M4 Pro, 14 cores, 48 GiB |
| OS | macOS 26.2 (darwin arm64) |
| Runtime | Node v23.9.0 (V8 12.9.202.28-node.13) |
| DOM | jsdom, via vitest — **not a browser** |
| Engine | `@kanzo-tech/rudof-wasm@0.3.5` |
| `.wasm` sha256 | `e6ff1f2ee9cc5ae0…` |

> **Node-only, not a browser measurement.** V8 is the engine Chrome runs and
> the `.wasm` is byte-identical to the one a browser would fetch, so the engine
> timings are indicative of a Chromium desktop browser — but they are not a
> browser measurement, and Firefox (SpiderMonkey) and Safari (JavaScriptCore)
> are not represented at all. jsdom performs no style resolution, layout or
> paint, so the end-to-end figure below stops at the committed DOM mutation.
> See “Not measured” at the foot of this file.

## The corpus — the same list E1 measures

The profiles below are `E1-coverage/profiles.ts`, imported. E4 does not keep
its own list, so the two experiments' tables describe the same corpus by
construction and Tab. 4 can be read against E1's coverage table row for row.
What E4 adds per profile is a *rig*: a pinned root shape and focus node, and
data to project against. Parsing needs neither, so **every** profile is parsed
and sized here — including the ones no session could be stood up for.

| Profile | Origin | In E1 as | Measured |
|---|---|---|---|
| DCAT-AP 3.0.1 (SEMIC) | external | primary | parse + full engine ops |
| HealthDCAT-AP Release 5 (European Commission) | external | primary | parse + full engine ops |
| Health-RI Core (HealthDCAT-AP national implementation) | external | primary | parse + full engine ops |
| DCAT-AP.de 2.0 (national extension, Germany) | external | primary | parse + full engine ops |
| FAIR Data Point (FAIRDataTeam reference implementation) | external | primary | parse + full engine ops |
| SPHN 2026.1 (Swiss Personalized Health Network) | external | primary | parse + shape counts only |
| Bioschemas profiles v20250219 | external | primary | parse + shape counts only |
| SPDX 3.0.1 model | external | primary | parse + shape counts only |
| Health-RI domain modules (health, imaging, omics) | external | primary | parse + full engine ops |
| Evidenze HealthDCAT-AP onboarding (ours) | ours | primary | parse + full engine ops |
| Evidenze data space onboarding (ours) | ours | primary | parse + full engine ops |
| DCAT-AP 3.0.1 — generated encoding | external | variant of `dcat-ap-3` | parse + full engine ops |
| HealthDCAT-AP Release 5 — restricted tier | external | variant of `healthdcat-ap` | parse + full engine ops |
| DCAT-AP as vendored by Health-RI | external | variant of `dcat-ap-3` | parse + full engine ops |
| Health-RI FAIR Data Point shapes | external | variant of `health-ri-core` | parse + full engine ops |

### Why 3 of the 15 carry no session timings

Stated rather than skipped. Each needs a root shape to attach a focus node to,
and for each one, picking that shape would be a choice the timing then measures
instead of the profile:

- **SPHN 2026.1 (Swiss Personalized Health Network)** — No dataset-equivalent root shape. 1744 node shapes over 208 target classes, none of them a record/dataset the other profiles' focus node is comparable to; any pick would be an arbitrary one shape in a thousand, and the timing would measure that choice rather than the profile.
- **Bioschemas profiles v20250219** — Not one profile but 32 independent ones in a single file, with no shape that contains the others. There is no single form to focus, and every path is an sh:alternativePath, which the form layer renders read-only.
- **SPDX 3.0.1 model** — Zero sh:targetClass in the whole file (E1 Finding: generated SHACL interleaved with OWL). Nothing declares what a focus node would be an instance of, so a root shape could only be hand-picked from 64 untargeted node shapes.

Their parse timings and shape counts are in Tab. 4 and are directly comparable;
only the `projectForm` / `projectValues` / `validate` columns read “—”.

## Tab. 4 — engine cost by profile size (ms, median / p95)

| Profile | Shapes (kB / lines) | Node shapes | Prop. shapes | Data triples | Parse | `projectForm` | `projectValues` (tree) | `validate()` | `validateTree` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| DCAT-AP 3.0.1 (SEMIC) | 65.5 / 2155 | 91 | 298 | 198 | 1216 / 1337 | 0.987 / 3.23 | 0.940 / 2.59 | 11.5 / 26.0 | 2.76 / 3.80 |
| HealthDCAT-AP Release 5 (European Commission) | 49.5 / 1281 | 52 | 139 | 198 | 287 / 394 | 1.41 / 2.98 | 1.53 / 2.18 | 6.19 / 10.0 | 1.75 / 2.55 |
| Health-RI Core (HealthDCAT-AP national implementation) | 82.8 / 1819 | 14 | 143 | 198 | 227 / 301 | 4.49 / 8.34 | 6.02 / 8.64 | 22.2 / 29.9 | 82.8 / 108 |
| DCAT-AP.de 2.0 (national extension, Germany) | 69.6 / 1608 | 29 | 121 | 198 | 164 / 204 | 2.28 / 3.45 | 2.42 / 3.91 | 4.82 / 6.82 | 1.98 / 2.81 |
| FAIR Data Point (FAIRDataTeam reference implementation) | 9.1 / 340 | 13 | 37 | 198 | 25.6 / 32.4 | 0.466 / 0.893 | 0.456 / 0.873 | 1.02 / 1.92 | 0.407 / 0.730 |
| SPHN 2026.1 (Swiss Personalized Health Network) | 929.9 / 17025 | 1744 | 1246 | — | 13383 / 66730 | — | — | — | — |
| Bioschemas profiles v20250219 | 222.3 / 2152 | 32 | 643 | — | 2315 / 2331 | — | — | — | — |
| SPDX 3.0.1 model | 178.9 / 3331 | 64 | 193 | — | 280 / 282 | — | — | — | — |
| Health-RI domain modules (health, imaging, omics) | 4.8 / 147 | 1 | 6 | 1 | 0.543 / 0.558 | 0.003 / 0.003 | 0.005 / 0.008 | 0.032 / 0.035 | 0.029 / 0.030 |
| Evidenze HealthDCAT-AP onboarding (ours) | 32.8 / 793 | 10 | 48 | 98 | 17.8 / 18.2 | 0.299 / 0.314 | 0.797 / 0.818 | 0.377 / 0.387 | 2.56 / 2.61 |
| Evidenze data space onboarding (ours) | 27.6 / 590 | 7 | 33 | 23 | 10.3 / 10.4 | 0.123 / 0.132 | 0.154 / 0.163 | 0.160 / 0.168 | 0.386 / 0.394 |

A “—” means no live session was stood up for that profile — see the corpus
table above for why; it never means the operation was slow or failed.

**Parse does not scale linearly.** Across the corpus, roughly a 4× larger
shapes document costs 5–6× the parse, so the cost per kB rises with size:
the smallest profiles parse at well under 1 ms/kB and the largest at ~16 ms/kB.
Every other operation is projection- and instance-bound, not document-bound,
and stays sub-frame even on the largest profile a session could be stood up for.

Samples: parse n=30, everything else n=50, after 5 warm-up calls.
All figures are **warm**: the process has already instantiated the module and
V8 has JIT-compiled the wasm↔JS glue. The first call of each operation in a
fresh process is reported separately below.

### Warm vs. JIT-cold first call (ms)

| Profile | Parse warm p50 | Parse 1st call | `validate()` warm p50 | `validate()` 1st call |
|---|---:|---:|---:|---:|
| DCAT-AP 3.0.1 (SEMIC) | 1216 | 1051 | 11.5 | 23.9 |
| HealthDCAT-AP Release 5 (European Commission) | 287 | 266 | 6.19 | 8.89 |
| Health-RI Core (HealthDCAT-AP national implementation) | 227 | 235 | 22.2 | 30.7 |
| DCAT-AP.de 2.0 (national extension, Germany) | 164 | 155 | 4.82 | 4.61 |
| FAIR Data Point (FAIRDataTeam reference implementation) | 25.6 | 28.3 | 1.02 | 2.43 |
| SPHN 2026.1 (Swiss Personalized Health Network) | 13383 | 62075 | — | — |
| Bioschemas profiles v20250219 | 2315 | 2327 | — | — |
| SPDX 3.0.1 model | 280 | 279 | — | — |
| Health-RI domain modules (health, imaging, omics) | 0.543 | 0.565 | 0.032 | 0.058 |
| Evidenze HealthDCAT-AP onboarding (ours) | 17.8 | 17.9 | 0.377 | 0.425 |
| Evidenze data space onboarding (ours) | 10.3 | 10.2 | 0.160 | 0.192 |

## Cold start — module instantiate (ms, median / p95)

One fresh Node process per sample, n=25.

| Stage | median | p95 |
|---|---:|---:|
| Read 2.6 MB `.wasm` from disk (stands in for `fetch`) | 0.241 | 0.264 |
| `import` the wasm-bindgen glue | 0.647 | 0.670 |
| **compile + instantiate** | **10.1** | **10.3** |
| `new Session()` | 0.146 | 0.171 |
| total, bytes in hand → usable session | 11.2 | 11.3 |

**The fetch is not in these numbers.** A disk read is not a network round trip;
a browser's real cold path is `WebAssembly.instantiateStreaming(fetch(…))`,
which overlaps transfer with compilation and is dominated by transfer. Take the
compile+instantiate row as the engine's own cost and add your own transfer
estimate for 629.9 kB over the wire.

## End-to-end: edit → updated conditional visibility (ms, median / p95)

| Profile | Fields rendered | commit → new `FormModel` | commit → DOM mutated |
|---|---:|---:|---:|
| Evidenze HealthDCAT-AP onboarding (ours) | 39 | 1.41 / 1.79 | 26.3 / 53.2 |
| Evidenze data space onboarding (ours) | 24 | 0.334 / 0.352 | 5.45 / 6.41 |

n=30 flips per profile (alternating on/off), after 5 warm-up flips.
Each flip writes the committed value into the graph the way a discrete widget
(select, switch, date) does, then the whole chain runs synchronously inside
React's `act()`: wasm graph mutation → version bump → `projectValues` over the
full tree (re-entering wasm once per tree node, `sh:if` re-evaluated) →
`buildFormModel` → React re-render → the revealed field enters or leaves the DOM.
The measurement is asserted, not assumed: a run in which the field fails to
appear and disappear aborts the harness.

**Read the two columns differently.** `commit → new FormModel` is the engine and
model work — a wasm re-projection of the tree plus `buildFormModel` plus React
state — and transfers to a browser reasonably well. `commit → DOM mutated` adds
React's render of the whole field tree into **jsdom**, whose DOM is a JavaScript
object graph and is materially slower than a browser's native DOM for the same
mutations; at the same time it does no style resolution, layout or paint, which a
browser must do. It is therefore neither an upper nor a lower bound on browser
latency — it is a different quantity, and the paper should quote the first column
for the engine claim rather than the second.

Two deliberate debounces sit *outside* this number and are not engine cost:

- free-text widgets buffer keystrokes locally and commit after **250 ms**
  (`useCommit` in `defaultWidgets.tsx`), so typing is never blocked by the engine.
  Discrete widgets — the kind a `sh:if` keys off — commit immediately, with no debounce.
- validation runs on a separate **300 ms** debounce
  (`validationDebounceMs`), so it never sits on the visibility path at all.

So a user typing into a text field sees their character echoed immediately, the
form re-shape ~250 ms after they stop, and errors ~300 ms after that. A user
picking from a select sees the form re-shape within the figure above.

## Payload

| Artefact | Raw | gzip -9 | brotli -11 |
|---|---:|---:|---:|
| `rudof_wasm_bg.wasm` | 2655.3 kB | 909.2 kB | 629.9 kB |
| wasm-bindgen glue `rudof_wasm.js` | 22.2 kB | 4.9 kB | 4.3 kB |
| App JS, baseline (React 19.2.8 + ReactDOM only) | 189.9 kB | 59.2 kB | 51.1 kB |
| App JS, + `metadata-form/rudof` (engine seam only) | 233.8 kB | 70.5 kB | 61.0 kB |
| App JS, + `metadata-form` (hook + `<MetadataForm>`) | 689.8 kB | 201.7 kB | 165.9 kB |
| — of which the engine seam | 43.9 kB | 11.4 kB | 10.0 kB |
| **JS delta the full library adds** | **499.9 kB** | **142.5 kB** | **114.9 kB** |
| App CSS added by the library | 223.2 kB | 34.0 kB | — |

Three real production builds of the same minimal React app (Vite 6.4.3,
`bundle-delta.mjs`), differing only in how much of the library they import. The
delta includes everything the library drags in that the app did not already
have — but **not** React, which every build pays for, and **not** the `.wasm`,
which is emitted as a separate on-demand asset and is listed on its own row above.

The split matters for the paper's claim. The **engine seam** — the wasm-bindgen
glue, the `RudofEngine` wrapper, the shape IR and projection — is
11.4 kB gzipped. Everything above that is the form UI and the design
system it is built on, which an adopter with their own components does not have
to take: the argument for browser-native SHACL does not rest on the larger number.

## Per-profile detail

### DCAT-AP 3.0.1 (SEMIC)

> Upstream SEMIC. Same shape IRI as the vendored copy below, so the pair is a like-for-like drift comparison.

- 5 shape file(s), 67023 B, 2155 lines
- 91 node shapes, 298 property shapes, 0 `sh:if` conditional(s)
- root shape pinned: `http://data.europa.eu/r5r#Dataset_Shape`
- projected tree: 1 node(s) — `validateTree` re-enters wasm once per node
- data graph: 10697 B, 198 triples; `validate()` returned 111 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 1074 | 1216 | 1337 | 1370 | 1051 |
| `projectForm` | 50 | 0.527 | 0.987 | 3.23 | 5.51 | 1.17 |
| `projectTree` | 50 | 0.388 | 0.940 | 2.59 | 4.11 | 3.24 |
| `validateFull` | 50 | 7.86 | 11.5 | 26.0 | 43.5 | 23.9 |
| `validateTree` | 50 | 1.97 | 2.76 | 3.80 | 7.01 | 3.73 |
| `serializeTurtle` | 50 | 1.01 | 1.43 | 2.44 | 3.54 | 6.61 |

### HealthDCAT-AP Release 5 (European Commission)

> Public tier.

- 4 shape file(s), 50711 B, 1281 lines
- 52 node shapes, 139 property shapes, 0 `sh:if` conditional(s)
- root shape pinned: `http://data.europa.eu/r5r#Dataset_Shape`
- projected tree: 1 node(s) — `validateTree` re-enters wasm once per node
- data graph: 10697 B, 198 triples; `validate()` returned 135 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 231 | 287 | 394 | 400 | 266 |
| `projectForm` | 50 | 0.968 | 1.41 | 2.98 | 3.40 | 3.19 |
| `projectTree` | 50 | 1.07 | 1.53 | 2.18 | 2.56 | 1.45 |
| `validateFull` | 50 | 3.98 | 6.19 | 10.0 | 11.4 | 8.89 |
| `validateTree` | 50 | 1.16 | 1.75 | 2.55 | 2.62 | 2.06 |
| `serializeTurtle` | 50 | 0.918 | 1.51 | 2.67 | 2.98 | 1.76 |

### Health-RI Core (HealthDCAT-AP national implementation)

> Cross-file sh:node. Data = the profile's own Example-Data.

- 14 shape file(s), 84832 B, 1819 lines
- 14 node shapes, 143 property shapes, 0 `sh:if` conditional(s)
- root shape pinned: `http://data.health-ri.nl/core/p2/DatasetShape`
- projected tree: 4 node(s) — `validateTree` re-enters wasm once per node
- data graph: 10697 B, 198 triples; `validate()` returned 1 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 197 | 227 | 301 | 306 | 235 |
| `projectForm` | 50 | 3.27 | 4.49 | 8.34 | 12.0 | 7.66 |
| `projectTree` | 50 | 4.48 | 6.02 | 8.64 | 11.4 | 7.15 |
| `validateFull` | 50 | 16.0 | 22.2 | 29.9 | 33.0 | 30.7 |
| `validateTree` | 50 | 56.8 | 82.8 | 108 | 109 | 88.1 |
| `serializeTurtle` | 50 | 0.902 | 1.46 | 2.53 | 4.29 | 2.34 |

### DCAT-AP.de 2.0 (national extension, Germany)

> The German delta's own dataset shape; the DCAT-AP core it extends is counted under dcat-ap-3, not here.

- 4 shape file(s), 71266 B, 1608 lines
- 29 node shapes, 121 property shapes, 0 `sh:if` conditional(s)
- root shape pinned: `http://dcat-ap.de/def/dcatde/Dataset_Shape`
- projected tree: 1 node(s) — `validateTree` re-enters wasm once per node
- data graph: 10697 B, 198 triples; `validate()` returned 34 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 139 | 164 | 204 | 236 | 155 |
| `projectForm` | 50 | 1.76 | 2.28 | 3.45 | 3.58 | 2.98 |
| `projectTree` | 50 | 1.88 | 2.42 | 3.91 | 5.28 | 2.13 |
| `validateFull` | 50 | 3.30 | 4.82 | 6.82 | 10.8 | 4.61 |
| `validateTree` | 50 | 1.32 | 1.98 | 2.81 | 3.77 | 1.73 |
| `serializeTurtle` | 50 | 1.04 | 1.50 | 2.04 | 2.20 | 1.36 |

### FAIR Data Point (FAIRDataTeam reference implementation)

> Not a specification document but the shapes a running FDP instance ships and serves to its own metadata editor — the closest thing in the corpus to a profile authored FOR a form. DASH-annotated throughout.

- 8 shape file(s), 9287 B, 340 lines
- 13 node shapes, 37 property shapes, 0 `sh:if` conditional(s)
- root shape pinned: `http://fairdatapoint.org/DatasetShape`
- projected tree: 1 node(s) — `validateTree` re-enters wasm once per node
- data graph: 10697 B, 198 triples; `validate()` returned 6 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 22.1 | 25.6 | 32.4 | 38.8 | 28.3 |
| `projectForm` | 50 | 0.328 | 0.466 | 0.893 | 1.02 | 0.568 |
| `projectTree` | 50 | 0.342 | 0.456 | 0.873 | 1.42 | 0.521 |
| `validateFull` | 50 | 0.760 | 1.02 | 1.92 | 3.72 | 2.43 |
| `validateTree` | 50 | 0.291 | 0.407 | 0.730 | 0.790 | 0.773 |
| `serializeTurtle` | 50 | 1.12 | 1.37 | 2.29 | 2.50 | 1.59 |

### SPHN 2026.1 (Swiss Personalized Health Network)

> The corpus's non-DCAT health profile, and by two orders of magnitude its largest single file (952 kB). Closed shapes throughout and ~480 SPARQL-based constraints. Included precisely because it is the profile most likely to break something.

- 1 shape file(s), 952178 B, 17025 lines
- 1744 node shapes, 1246 property shapes, 0 `sh:if` conditional(s)
- **parse only — no live session was stood up.** No dataset-equivalent root shape. 1744 node shapes over 208 target classes, none of them a record/dataset the other profiles' focus node is comparable to; any pick would be an arbitrary one shape in a thousand, and the timing would measure that choice rather than the profile.

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 13250 | 13383 | 66730 | 106095 | 62075 |

### Bioschemas profiles v20250219

> 32 life-science profiles in one file, generated from the Bioschemas specifications. Every single path is an sh:alternativePath over the http/https forms of a schema.org term — a complex path used not for expressiveness but to paper over a namespace split. Carries sh:severity and sh:description and NOTHING else: no datatype, no class, no maxCount, no name. The corpus's worst case for type-fact inference, by construction.

- 1 shape file(s), 227639 B, 2152 lines
- 32 node shapes, 643 property shapes, 0 `sh:if` conditional(s)
- **parse only — no live session was stood up.** Not one profile but 32 independent ones in a single file, with no shape that contains the others. There is no single form to focus, and every path is an sh:alternativePath, which the form layer renders read-only.

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 2304 | 2315 | 2331 | 2335 | 2327 |

### SPDX 3.0.1 model

> Not health, and not a metadata catalogue: the software bill-of-materials model, published by the Linux Foundation as generated SHACL interleaved with OWL axioms in one file. In the corpus as the out-of-domain control — if the coverage number holds here it is not a fact about DCAT.

- 1 shape file(s), 183176 B, 3331 lines
- 64 node shapes, 193 property shapes, 0 `sh:if` conditional(s)
- **parse only — no live session was stood up.** Zero sh:targetClass in the whole file (E1 Finding: generated SHACL interleaved with OWL). Nothing declares what a focus node would be an instance of, so a root shape could only be hand-picked from 64 untargeted node shapes.

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 277 | 280 | 282 | 283 | 279 |

### Health-RI domain modules (health, imaging, omics)

> No published example data and no dataset shape - an empty, seeded graph on its one node shape.

- 5 shape file(s), 4883 B, 147 lines
- 1 node shapes, 6 property shapes, 0 `sh:if` conditional(s)
- root shape pinned: `http://coreRule-healthri.nl#Scan_Shape`
- projected tree: 1 node(s) — `validateTree` re-enters wasm once per node
- data graph: 0 B, 1 triples; `validate()` returned 6 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 0.524 | 0.543 | 0.558 | 0.566 | 0.565 |
| `projectForm` | 50 | 0.003 | 0.003 | 0.003 | 0.004 | 0.006 |
| `projectTree` | 50 | 0.005 | 0.005 | 0.008 | 0.018 | 0.006 |
| `validateFull` | 50 | 0.029 | 0.032 | 0.035 | 0.043 | 0.058 |
| `validateTree` | 50 | 0.028 | 0.029 | 0.030 | 0.033 | 0.041 |
| `serializeTurtle` | 50 | 0.002 | 0.002 | 0.002 | 0.002 | 0.017 |

### Evidenze HealthDCAT-AP onboarding (ours)

> Pure SHACL 1.2 + SHACL-UI. The deployment.

- 1 shape file(s), 33566 B, 793 lines
- 10 node shapes, 48 property shapes, 1 `sh:if` conditional(s)
- root shape pinned: `https://dataspace.evidenze.example/shapes#HealthDatasetOnboardingShape`
- projected tree: 16 node(s) — `validateTree` re-enters wasm once per node
- data graph: 5991 B, 98 triples; `validate()` returned 0 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 17.2 | 17.8 | 18.2 | 18.3 | 17.9 |
| `projectForm` | 50 | 0.286 | 0.299 | 0.314 | 0.322 | 0.349 |
| `projectTree` | 50 | 0.779 | 0.797 | 0.818 | 0.834 | 0.862 |
| `validateFull` | 50 | 0.369 | 0.377 | 0.387 | 0.391 | 0.425 |
| `validateTree` | 50 | 2.53 | 2.56 | 2.61 | 2.77 | 2.65 |
| `serializeTurtle` | 50 | 0.402 | 0.418 | 0.438 | 0.442 | 0.520 |

### Evidenze data space onboarding (ours)

> Pure SHACL 1.2 + SHACL-UI.

- 1 shape file(s), 28309 B, 590 lines
- 7 node shapes, 33 property shapes, 1 `sh:if` conditional(s)
- root shape pinned: `https://dataspace.evidenze.example/shapes#DatasetOnboardingShape`
- projected tree: 4 node(s) — `validateTree` re-enters wasm once per node
- data graph: 1971 B, 23 triples; `validate()` returned 0 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 9.85 | 10.3 | 10.4 | 10.7 | 10.2 |
| `projectForm` | 50 | 0.113 | 0.123 | 0.132 | 0.133 | 0.143 |
| `projectTree` | 50 | 0.150 | 0.154 | 0.163 | 0.167 | 0.176 |
| `validateFull` | 50 | 0.155 | 0.160 | 0.168 | 0.172 | 0.192 |
| `validateTree` | 50 | 0.380 | 0.386 | 0.394 | 0.400 | 0.406 |
| `serializeTurtle` | 50 | 0.055 | 0.057 | 0.063 | 0.067 | 0.104 |

### DCAT-AP 3.0.1 — generated encoding *(variant of dcat-ap-3 — excluded from the headline)*

> The generated encoding of the same release; `shacl:` prefix, every node shape closed.

- 2 shape file(s), 235795 B, 3452 lines
- 40 node shapes, 292 property shapes, 0 `sh:if` conditional(s)
- root shape pinned: `https://semiceu.github.io/DCAT-AP/releases/3.0.1#dcat:DatasetShape`
- projected tree: 1 node(s) — `validateTree` re-enters wasm once per node
- data graph: 10697 B, 198 triples; `validate()` returned 32 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 148 | 149 | 151 | 153 | 148 |
| `projectForm` | 50 | 0.697 | 0.701 | 0.711 | 0.713 | 0.761 |
| `projectTree` | 50 | 0.654 | 0.715 | 0.724 | 0.805 | 0.719 |
| `validateFull` | 50 | 1.23 | 1.30 | 1.35 | 1.68 | 1.38 |
| `validateTree` | 50 | 0.473 | 0.482 | 0.502 | 0.508 | 0.508 |
| `serializeTurtle` | 50 | 0.332 | 0.334 | 0.348 | 0.355 | 0.413 |

### HealthDCAT-AP Release 5 — restricted tier *(variant of healthdcat-ap — excluded from the headline)*

> Restricted tier of the same shape IRIs.

- 3 shape file(s), 25611 B, 684 lines
- 17 node shapes, 87 property shapes, 0 `sh:if` conditional(s)
- root shape pinned: `http://data.europa.eu/r5r#Dataset_Shape`
- projected tree: 1 node(s) — `validateTree` re-enters wasm once per node
- data graph: 10697 B, 198 triples; `validate()` returned 108 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 21.9 | 22.4 | 22.8 | 22.9 | 22.5 |
| `projectForm` | 50 | 0.336 | 0.338 | 0.356 | 0.359 | 0.396 |
| `projectTree` | 50 | 0.341 | 0.346 | 0.354 | 0.362 | 0.346 |
| `validateFull` | 50 | 0.818 | 0.847 | 0.869 | 1.17 | 0.969 |
| `validateTree` | 50 | 0.203 | 0.208 | 0.218 | 0.231 | 0.240 |
| `serializeTurtle` | 50 | 0.331 | 0.333 | 0.346 | 0.351 | 0.414 |

### DCAT-AP as vendored by Health-RI *(variant of dcat-ap-3 — excluded from the headline)*

> Health-RI's in-tree copy of DCAT-AP. Was the E1 'DCAT-AP' row until the upstream SEMIC release was vendored; demoted to a variant so DCAT-AP is counted once. Kept because the drift between a vendored copy and its upstream is itself worth a sentence.

- 1 shape file(s), 20344 B, 698 lines
- 21 node shapes, 109 property shapes, 0 `sh:if` conditional(s)
- root shape pinned: `http://data.europa.eu/r5r#Dataset_Shape`
- projected tree: 1 node(s) — `validateTree` re-enters wasm once per node
- data graph: 10697 B, 198 triples; `validate()` returned 25 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 33.5 | 33.9 | 34.4 | 34.4 | 33.6 |
| `projectForm` | 50 | 0.665 | 0.668 | 0.677 | 0.680 | 0.719 |
| `projectTree` | 50 | 0.675 | 0.682 | 0.698 | 0.731 | 0.684 |
| `validateFull` | 50 | 0.621 | 0.655 | 0.719 | 0.971 | 0.729 |
| `validateTree` | 50 | 0.225 | 0.232 | 0.245 | 0.251 | 0.247 |
| `serializeTurtle` | 50 | 0.332 | 0.336 | 0.347 | 0.352 | 0.428 |

### Health-RI FAIR Data Point shapes *(variant of health-ri-core — excluded from the headline)*

> NOT an independent profile. It declares the same shape IRIs (hri:AgentShape, hri:CatalogShape, …) as PiecesShape, and its 178 sh:path lines collapse to the same 137 distinct (shape, path) pairs — each FDP file is self-contained and redefines the shared shapes, so concatenation merges them by identity. Unrelated to the FAIRDataTeam `fair-data-point` profile above.

- 6 shape file(s), 94599 B, 2077 lines
- 14 node shapes, 143 property shapes, 0 `sh:if` conditional(s)
- root shape pinned: `http://data.health-ri.nl/core/p2/DatasetShape`
- projected tree: 4 node(s) — `validateTree` re-enters wasm once per node
- data graph: 10697 B, 198 triples; `validate()` returned 1 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 52.8 | 53.7 | 54.5 | 54.6 | 52.7 |
| `projectForm` | 50 | 0.853 | 0.890 | 0.951 | 2.35 | 0.981 |
| `projectTree` | 50 | 1.23 | 1.28 | 1.32 | 1.33 | 1.32 |
| `validateFull` | 50 | 4.39 | 4.49 | 4.52 | 4.53 | 4.79 |
| `validateTree` | 50 | 15.1 | 15.2 | 15.4 | 15.6 | 15.2 |
| `serializeTurtle` | 50 | 0.333 | 0.336 | 0.346 | 0.355 | 0.424 |

(4 variant profiles above are reported in full but kept out of
the headline table. Which profiles are variants, and why, is E1's judgement —
carried here with the corpus rather than decided again.)

## Not measured — gaps, stated rather than omitted

1. **No browser.** Everything is Node + jsdom. No Chrome, Firefox or Safari
   number appears here. The paper may say the engine cost is *indicative of* a
   Chromium desktop browser (same V8, same `.wasm`); it may not say it was
   measured in one.
2. **No mid-range mobile device.** The spec asks for one; this harness cannot
   produce it. Mobile matters most exactly where this design is weakest —
   wasm compilation and single-core throughput are several times slower on a
   mid-range phone, and the 2.6 MB module is a real cost on a cellular link.
   Treat every timing here as a floor: a phone will be slower, plausibly by a
   multiple, and this experiment says nothing about how large that multiple is.
3. **No network fetch.** The cold-start table reads the module from local disk.
   Transfer time for the compressed module over a real connection is not in any
   figure, and on a slow link it would dominate the cold start entirely.
4. **No style, layout or paint.** jsdom stops at the committed DOM mutation, so
   the user-perceived latency of a field appearing is not measured. jsdom's DOM
   is also slower than a browser's for the mutations it does perform, so the
   `commit → DOM` column errs in both directions at once and is not a browser
   latency estimate — see the note beside that table.
5. **No real keystroke.** The end-to-end figure starts at the committed value,
   not at `keydown`. Input event dispatch and the widget's own local echo are
   excluded; the 250 ms text-commit debounce is reported as a constant, not
   measured.
6. **No memory figure.** Peak wasm heap per session is not measured, and a
   long editing session's memory behaviour is unknown.
7. **The large parse-only profiles are not stable to a single figure.** Across
   repeat runs on the same idle machine, the SPHN and Bioschemas parse *medians*
   moved by up to 4× (Bioschemas: 2.5 s, 2.5 s, 9.6 s), and SPHN's p95 ranged
   from 16 s to 66 s against a median that stayed near 15 s. The small and
   mid-sized profiles repeat to within a few percent. Read the top two rows of
   Tab. 4 as an order of magnitude — seconds, not milliseconds — and not as a
   figure to quote to three digits. Why parse variance grows this sharply with
   input size is not established here; wasm heap growth is the obvious suspect
   and is not measured (see 6).
8. **One machine, one run, and the machine must be idle.** No cross-machine
   variance and no thermal control. This matters more than it sounds: running
   the harness on a loaded machine inflated p95 by up to 3× in our own repeats,
   while the medians moved much less. Regenerate on a quiet machine, and read
   the p95 column as "p95 under these conditions", not as a worst case.
