# E4 — performance of per-edit conditional re-evaluation

Generated 2026-09-30T14:29:53Z by `perf.harness.ts`. Do not edit by hand.

Every cell is **median / p95** over the stated sample count, nearest-rank
(no interpolation), so each figure is an observation that happened.

## Headline

- **Per-edit re-evaluation is sub-frame.** Re-projecting the whole form tree from
  the graph — the wasm call that re-evaluates every `sh:if` — costs
  0.012–1.56 ms at p95 across 8 published profiles, and a committed
  edit reaches a new `FormModel` with updated conditional visibility in
  0.365–2.05 ms at p95. A 60 Hz frame is 16.7 ms.
- **Parsing is the one-off cost.** It spans 8.67 ms for Health-RI domain modules (health, imaging, omics)
  (4.8 kB) to **1062 ms** for SPHN 2026.1 (Swiss Personalized Health Network)
  (1246 property shapes, 930 kB of Turtle): 0.387–1.82 ms per kB
  of Turtle across the corpus (see Tab. 4). Instantiating the module adds a flat
  10.9 ms. This is a load-time cost, paid once and never per edit.
- **Validation is off the visibility path.** `validate()` is 4.89 ms at worst
  here, and runs after the edit is drawn (a deferred render), so it never gates a field appearing.
- **The payload is the weak point.** 662.2 kB of brotli-compressed wasm plus
  118.6 kB of JS. That is the honest cost of putting a SHACL engine in
  the browser, and it is a first-load cost, not a per-edit one.

## What was measured, and where

| | |
|---|---|
| Machine | Apple M4 Pro, 14 cores, 48 GiB |
| OS | macOS 26.2 (darwin arm64) |
| Runtime | Node v23.9.0 (V8 12.9.202.28-node.13) |
| DOM | jsdom, via vitest — **not a browser** |
| Engine | `@kanzo-tech/rudof-wasm@0.3.10` |
| `.wasm` sha256 | `0030b43f8775995b…` |

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
| DCAT-AP 3.0.1 (SEMIC) | 65.5 / 2155 | 91 | 298 | 198 | 88.9 / 92.7 | 0.186 / 0.212 | 0.181 / 0.199 | 2.24 / 2.41 | 0.570 / 0.586 |
| HealthDCAT-AP Release 5 (European Commission) | 49.5 / 1281 | 52 | 139 | 198 | 44.9 / 45.7 | 0.382 / 0.408 | 0.388 / 0.403 | 1.50 / 1.57 | 0.393 / 0.403 |
| Health-RI Core (HealthDCAT-AP national implementation) | 82.8 / 1819 | 14 | 143 | 198 | 44.2 / 45.2 | 0.964 / 1.03 | 1.46 / 1.56 | 4.53 / 4.89 | 15.4 / 15.8 |
| DCAT-AP.de 2.0 (national extension, Germany) | 69.6 / 1608 | 29 | 121 | 198 | 42.0 / 43.4 | 0.588 / 0.608 | 0.597 / 0.628 | 1.07 / 1.14 | 0.437 / 0.451 |
| FAIR Data Point (FAIRDataTeam reference implementation) | 9.1 / 340 | 13 | 37 | 198 | 16.4 / 16.7 | 0.142 / 0.151 | 0.144 / 0.149 | 0.261 / 0.278 | 0.110 / 0.116 |
| SPHN 2026.1 (Swiss Personalized Health Network) | 929.9 / 17025 | 1744 | 1246 | — | 1062 / 1080 | — | — | — | — |
| Bioschemas profiles v20250219 | 222.3 / 2152 | 32 | 643 | — | 169 / 173 | — | — | — | — |
| SPDX 3.0.1 model | 178.9 / 3331 | 64 | 193 | — | 69.3 / 72.9 | — | — | — | — |
| Health-RI domain modules (health, imaging, omics) | 4.8 / 147 | 1 | 6 | 1 | 8.67 / 8.89 | 0.003 / 0.004 | 0.006 / 0.012 | 0.040 / 0.045 | 0.035 / 0.039 |
| Evidenze HealthDCAT-AP onboarding (ours) | 33.1 / 795 | 11 | 48 | 98 | 23.8 / 24.5 | 0.313 / 0.332 | 0.958 / 0.998 | 0.342 / 0.361 | 2.72 / 2.79 |
| Evidenze data space onboarding (ours) | 28.0 / 591 | 8 | 33 | 23 | 19.1 / 19.8 | 0.131 / 0.144 | 0.173 / 0.182 | 0.154 / 0.164 | 0.463 / 0.478 |

A “—” means no live session was stood up for that profile — see the corpus
table above for why; it never means the operation was slow or failed.

**Parse against document size.** The largest document is 195× the smallest and its
parse is 122× the smallest's; per kB of Turtle the corpus spans
0.387–1.82 ms (median parse over shapes size, one figure per profile).
Every other operation is projection- and instance-bound, not document-bound,
and stays sub-frame even on the largest profile a session could be stood up for.

Samples: parse n=30, everything else n=50, after 5 warm-up calls.
All figures are **warm**: the process has already instantiated the module and
V8 has JIT-compiled the wasm↔JS glue. The first call of each operation in a
fresh process is reported separately below.

### Warm vs. JIT-cold first call (ms)

| Profile | Parse warm p50 | Parse 1st call | `validate()` warm p50 | `validate()` 1st call |
|---|---:|---:|---:|---:|
| DCAT-AP 3.0.1 (SEMIC) | 88.9 | 89.8 | 2.24 | 2.58 |
| HealthDCAT-AP Release 5 (European Commission) | 44.9 | 43.5 | 1.50 | 1.73 |
| Health-RI Core (HealthDCAT-AP national implementation) | 44.2 | 42.5 | 4.53 | 5.09 |
| DCAT-AP.de 2.0 (national extension, Germany) | 42.0 | 40.9 | 1.07 | 1.25 |
| FAIR Data Point (FAIRDataTeam reference implementation) | 16.4 | 16.2 | 0.261 | 0.319 |
| SPHN 2026.1 (Swiss Personalized Health Network) | 1062 | 1309 | — | — |
| Bioschemas profiles v20250219 | 169 | 168 | — | — |
| SPDX 3.0.1 model | 69.3 | 68.0 | — | — |
| Health-RI domain modules (health, imaging, omics) | 8.67 | 9.43 | 0.040 | 0.060 |
| Evidenze HealthDCAT-AP onboarding (ours) | 23.8 | 23.7 | 0.342 | 0.429 |
| Evidenze data space onboarding (ours) | 19.1 | 18.9 | 0.154 | 0.185 |

## Cold start — module instantiate (ms, median / p95)

One fresh Node process per sample, n=25.

| Stage | median | p95 |
|---|---:|---:|
| Read 2.6 MB `.wasm` from disk (stands in for `fetch`) | 0.273 | 0.297 |
| `import` the wasm-bindgen glue | 0.713 | 0.771 |
| **compile + instantiate** | **10.9** | **11.4** |
| `new Session()` | 0.161 | 0.171 |
| total, bytes in hand → usable session | 12.0 | 12.6 |

**The fetch is not in these numbers.** A disk read is not a network round trip;
a browser's real cold path is `WebAssembly.instantiateStreaming(fetch(…))`,
which overlaps transfer with compilation and is dominated by transfer. Take the
compile+instantiate row as the engine's own cost and add your own transfer
estimate for 662.2 kB over the wire.

## End-to-end: edit → updated conditional visibility (ms, median / p95)

| Profile | Fields rendered | commit → new `FormModel` | commit → DOM mutated |
|---|---:|---:|---:|
| Evidenze HealthDCAT-AP onboarding (ours) | 39 | 1.70 / 2.05 | 51.5 / 67.9 |
| Evidenze data space onboarding (ours) | 24 | 0.337 / 0.365 | 12.0 / 14.7 |

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

Two deliberate delays sit *outside* this number and are not engine cost:

- free-text widgets buffer keystrokes locally and commit after **250 ms**
  (`useDebouncedCommit`, `@kanzo-tech/ui`'s default delay; a blur commits at once), so typing is never blocked by the engine.
  Discrete widgets — the kind a `sh:if` keys off — commit immediately, with no debounce.
- validation runs in the render React defers behind the edit (`useDeferredValue`),
  with no timer, so it never sits on the visibility path at all.

So a user typing into a text field sees their character echoed immediately, the
form re-shape ~250 ms after they stop, and errors as soon as React has drawn it. A user
picking from a select sees the form re-shape within the figure above.

## Payload

| Artefact | Raw | gzip -9 | brotli -11 |
|---|---:|---:|---:|
| `rudof_wasm_bg.wasm` | 2810.5 kB | 958.5 kB | 662.2 kB |
| wasm-bindgen glue `rudof_wasm.js` | 24.3 kB | 5.4 kB | 4.7 kB |
| App JS, baseline (React 19.2.8 + ReactDOM only) | 189.9 kB | 59.2 kB | 51.1 kB |
| App JS, + `metadata-form/rudof` (engine seam only) | 234.9 kB | 70.9 kB | 61.4 kB |
| App JS, + `metadata-form` (hook + `<MetadataForm>`) | 699.4 kB | 206.6 kB | 169.7 kB |
| — of which the engine seam | 45.0 kB | 11.7 kB | 10.4 kB |
| **JS delta the full library adds** | **509.5 kB** | **147.4 kB** | **118.6 kB** |
| App CSS added by the library | 0.0 kB | 0.0 kB | — |

Three real production builds of the same minimal React app (Vite 6.4.3,
`bundle-delta.mjs`), differing only in how much of the library they import. The
delta includes everything the library drags in that the app did not already
have — but **not** React, which every build pays for, and **not** the `.wasm`,
which is emitted as a separate on-demand asset and is listed on its own row above.

The split matters for the paper's claim. The **engine seam** — the wasm-bindgen
glue, the `RudofEngine` wrapper, the shape IR and projection — is
11.7 kB gzipped. Everything above that is the form UI and the design
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
| `loadShapes` | 30 | 87.0 | 88.9 | 92.7 | 93.4 | 89.8 |
| `projectForm` | 50 | 0.183 | 0.186 | 0.212 | 0.348 | 0.262 |
| `projectTree` | 50 | 0.179 | 0.181 | 0.199 | 0.203 | 0.277 |
| `validateFull` | 50 | 2.19 | 2.24 | 2.41 | 2.70 | 2.58 |
| `validateTree` | 50 | 0.558 | 0.570 | 0.586 | 0.606 | 0.864 |
| `serializeTurtle` | 50 | 0.343 | 0.351 | 0.383 | 0.404 | 1.81 |

### HealthDCAT-AP Release 5 (European Commission)

> Public tier.

- 4 shape file(s), 50711 B, 1281 lines
- 52 node shapes, 139 property shapes, 0 `sh:if` conditional(s)
- root shape pinned: `http://data.europa.eu/r5r#Dataset_Shape`
- projected tree: 1 node(s) — `validateTree` re-enters wasm once per node
- data graph: 10697 B, 198 triples; `validate()` returned 135 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 43.9 | 44.9 | 45.7 | 46.1 | 43.5 |
| `projectForm` | 50 | 0.378 | 0.382 | 0.408 | 0.629 | 0.475 |
| `projectTree` | 50 | 0.384 | 0.388 | 0.403 | 0.409 | 0.413 |
| `validateFull` | 50 | 1.45 | 1.50 | 1.57 | 1.81 | 1.73 |
| `validateTree` | 50 | 0.378 | 0.393 | 0.403 | 0.407 | 0.447 |
| `serializeTurtle` | 50 | 0.337 | 0.341 | 0.364 | 0.412 | 0.450 |

### Health-RI Core (HealthDCAT-AP national implementation)

> Cross-file sh:node. Data = the profile's own Example-Data.

- 14 shape file(s), 84832 B, 1819 lines
- 14 node shapes, 143 property shapes, 0 `sh:if` conditional(s)
- root shape pinned: `http://data.health-ri.nl/core/p2/DatasetShape`
- projected tree: 4 node(s) — `validateTree` re-enters wasm once per node
- data graph: 10697 B, 198 triples; `validate()` returned 1 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 42.9 | 44.2 | 45.2 | 45.3 | 42.5 |
| `projectForm` | 50 | 0.943 | 0.964 | 1.03 | 1.15 | 1.06 |
| `projectTree` | 50 | 1.44 | 1.46 | 1.56 | 1.63 | 1.58 |
| `validateFull` | 50 | 4.47 | 4.53 | 4.89 | 5.16 | 5.09 |
| `validateTree` | 50 | 15.2 | 15.4 | 15.8 | 17.3 | 15.7 |
| `serializeTurtle` | 50 | 0.336 | 0.342 | 0.380 | 0.384 | 0.428 |

### DCAT-AP.de 2.0 (national extension, Germany)

> The German delta's own dataset shape; the DCAT-AP core it extends is counted under dcat-ap-3, not here.

- 4 shape file(s), 71266 B, 1608 lines
- 29 node shapes, 121 property shapes, 0 `sh:if` conditional(s)
- root shape pinned: `http://dcat-ap.de/def/dcatde/Dataset_Shape`
- projected tree: 1 node(s) — `validateTree` re-enters wasm once per node
- data graph: 10697 B, 198 triples; `validate()` returned 34 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 40.8 | 42.0 | 43.4 | 43.8 | 40.9 |
| `projectForm` | 50 | 0.584 | 0.588 | 0.608 | 0.693 | 0.656 |
| `projectTree` | 50 | 0.590 | 0.597 | 0.628 | 0.651 | 0.598 |
| `validateFull` | 50 | 1.04 | 1.07 | 1.14 | 1.56 | 1.25 |
| `validateTree` | 50 | 0.424 | 0.437 | 0.451 | 0.465 | 0.470 |
| `serializeTurtle` | 50 | 0.334 | 0.340 | 0.363 | 0.374 | 0.418 |

### FAIR Data Point (FAIRDataTeam reference implementation)

> Not a specification document but the shapes a running FDP instance ships and serves to its own metadata editor — the closest thing in the corpus to a profile authored FOR a form. DASH-annotated throughout.

- 8 shape file(s), 9287 B, 340 lines
- 13 node shapes, 37 property shapes, 0 `sh:if` conditional(s)
- root shape pinned: `http://fairdatapoint.org/DatasetShape`
- projected tree: 1 node(s) — `validateTree` re-enters wasm once per node
- data graph: 10697 B, 198 triples; `validate()` returned 6 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 16.2 | 16.4 | 16.7 | 17.1 | 16.2 |
| `projectForm` | 50 | 0.140 | 0.142 | 0.151 | 0.156 | 0.173 |
| `projectTree` | 50 | 0.143 | 0.144 | 0.149 | 0.153 | 0.149 |
| `validateFull` | 50 | 0.254 | 0.261 | 0.278 | 0.293 | 0.319 |
| `validateTree` | 50 | 0.107 | 0.110 | 0.116 | 0.119 | 0.123 |
| `serializeTurtle` | 50 | 0.341 | 0.348 | 0.396 | 0.439 | 0.424 |

### SPHN 2026.1 (Swiss Personalized Health Network)

> The corpus's non-DCAT health profile, and by two orders of magnitude its largest single file (952 kB). Closed shapes throughout and ~480 SPARQL-based constraints. Included precisely because it is the profile most likely to break something.

- 1 shape file(s), 952178 B, 17025 lines
- 1744 node shapes, 1246 property shapes, 0 `sh:if` conditional(s)
- **parse only — no live session was stood up.** No dataset-equivalent root shape. 1744 node shapes over 208 target classes, none of them a record/dataset the other profiles' focus node is comparable to; any pick would be an arbitrary one shape in a thousand, and the timing would measure that choice rather than the profile.

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 1047 | 1062 | 1080 | 1080 | 1309 |

### Bioschemas profiles v20250219

> 32 life-science profiles in one file, generated from the Bioschemas specifications. Every single path is an sh:alternativePath over the http/https forms of a schema.org term — a complex path used not for expressiveness but to paper over a namespace split. Carries sh:severity and sh:description and NOTHING else: no datatype, no class, no maxCount, no name. The corpus's worst case for type-fact inference, by construction.

- 1 shape file(s), 227639 B, 2152 lines
- 32 node shapes, 643 property shapes, 0 `sh:if` conditional(s)
- **parse only — no live session was stood up.** Not one profile but 32 independent ones in a single file, with no shape that contains the others. There is no single form to focus, and every path is an sh:alternativePath, which the form layer renders read-only.

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 163 | 169 | 173 | 175 | 168 |

### SPDX 3.0.1 model

> Not health, and not a metadata catalogue: the software bill-of-materials model, published by the Linux Foundation as generated SHACL interleaved with OWL axioms in one file. In the corpus as the out-of-domain control — if the coverage number holds here it is not a fact about DCAT.

- 1 shape file(s), 183176 B, 3331 lines
- 64 node shapes, 193 property shapes, 0 `sh:if` conditional(s)
- **parse only — no live session was stood up.** Zero sh:targetClass in the whole file (E1 Finding: generated SHACL interleaved with OWL). Nothing declares what a focus node would be an instance of, so a root shape could only be hand-picked from 64 untargeted node shapes.

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 67.5 | 69.3 | 72.9 | 75.8 | 68.0 |

### Health-RI domain modules (health, imaging, omics)

> No published example data and no dataset shape - an empty, seeded graph on its one node shape.

- 5 shape file(s), 4883 B, 147 lines
- 1 node shapes, 6 property shapes, 0 `sh:if` conditional(s)
- root shape pinned: `http://coreRule-healthri.nl#Scan_Shape`
- projected tree: 1 node(s) — `validateTree` re-enters wasm once per node
- data graph: 0 B, 1 triples; `validate()` returned 6 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 8.56 | 8.67 | 8.89 | 9.00 | 9.43 |
| `projectForm` | 50 | 0.003 | 0.003 | 0.004 | 0.004 | 0.007 |
| `projectTree` | 50 | 0.005 | 0.006 | 0.012 | 0.014 | 0.011 |
| `validateFull` | 50 | 0.039 | 0.040 | 0.045 | 0.045 | 0.060 |
| `validateTree` | 50 | 0.035 | 0.035 | 0.039 | 0.045 | 0.044 |
| `serializeTurtle` | 50 | 0.002 | 0.002 | 0.003 | 0.003 | 0.012 |

### Evidenze HealthDCAT-AP onboarding (ours)

> Pure SHACL 1.2 + SHACL-UI. The deployment.

- 1 shape file(s), 33892 B, 795 lines
- 11 node shapes, 48 property shapes, 1 `sh:if` conditional(s)
- root shape pinned: `https://dataspace.evidenze.example/shapes#HealthDatasetOnboardingShape`
- projected tree: 17 node(s) — `validateTree` re-enters wasm once per node
- data graph: 5991 B, 98 triples; `validate()` returned 0 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 23.3 | 23.8 | 24.5 | 24.5 | 23.7 |
| `projectForm` | 50 | 0.304 | 0.313 | 0.332 | 0.337 | 0.380 |
| `projectTree` | 50 | 0.934 | 0.958 | 0.998 | 1.18 | 1.10 |
| `validateFull` | 50 | 0.331 | 0.342 | 0.361 | 0.367 | 0.429 |
| `validateTree` | 50 | 2.68 | 2.72 | 2.79 | 3.05 | 2.84 |
| `serializeTurtle` | 50 | 0.391 | 0.403 | 0.426 | 0.440 | 0.520 |

### Evidenze data space onboarding (ours)

> Pure SHACL 1.2 + SHACL-UI.

- 1 shape file(s), 28628 B, 591 lines
- 8 node shapes, 33 property shapes, 1 `sh:if` conditional(s)
- root shape pinned: `https://dataspace.evidenze.example/shapes#DatasetOnboardingShape`
- projected tree: 5 node(s) — `validateTree` re-enters wasm once per node
- data graph: 1971 B, 23 triples; `validate()` returned 0 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 18.7 | 19.1 | 19.8 | 19.9 | 18.9 |
| `projectForm` | 50 | 0.126 | 0.131 | 0.144 | 0.157 | 0.171 |
| `projectTree` | 50 | 0.168 | 0.173 | 0.182 | 0.201 | 0.195 |
| `validateFull` | 50 | 0.148 | 0.154 | 0.164 | 0.174 | 0.185 |
| `validateTree` | 50 | 0.454 | 0.463 | 0.478 | 0.485 | 0.492 |
| `serializeTurtle` | 50 | 0.056 | 0.058 | 0.068 | 0.073 | 0.104 |

### DCAT-AP 3.0.1 — generated encoding *(variant of dcat-ap-3 — excluded from the headline)*

> The generated encoding of the same release; `shacl:` prefix, every node shape closed.

- 2 shape file(s), 235795 B, 3452 lines
- 40 node shapes, 292 property shapes, 0 `sh:if` conditional(s)
- root shape pinned: `https://semiceu.github.io/DCAT-AP/releases/3.0.1#dcat:DatasetShape`
- projected tree: 1 node(s) — `validateTree` re-enters wasm once per node
- data graph: 10697 B, 198 triples; `validate()` returned 32 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 82.3 | 84.2 | 85.6 | 86.3 | 82.2 |
| `projectForm` | 50 | 0.759 | 0.771 | 0.789 | 0.793 | 0.842 |
| `projectTree` | 50 | 0.773 | 0.786 | 0.809 | 0.871 | 0.807 |
| `validateFull` | 50 | 1.42 | 1.45 | 1.49 | 1.54 | 1.67 |
| `validateTree` | 50 | 0.505 | 0.519 | 0.572 | 0.582 | 0.564 |
| `serializeTurtle` | 50 | 0.335 | 0.339 | 0.350 | 0.354 | 0.426 |

### HealthDCAT-AP Release 5 — restricted tier *(variant of healthdcat-ap — excluded from the headline)*

> Restricted tier of the same shape IRIs.

- 3 shape file(s), 25611 B, 684 lines
- 17 node shapes, 87 property shapes, 0 `sh:if` conditional(s)
- root shape pinned: `http://data.europa.eu/r5r#Dataset_Shape`
- projected tree: 1 node(s) — `validateTree` re-enters wasm once per node
- data graph: 10697 B, 198 triples; `validate()` returned 108 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 28.5 | 29.4 | 31.4 | 35.3 | 29.1 |
| `projectForm` | 50 | 0.364 | 0.375 | 0.424 | 0.441 | 0.459 |
| `projectTree` | 50 | 0.364 | 0.373 | 0.392 | 0.455 | 0.402 |
| `validateFull` | 50 | 0.990 | 1.01 | 1.05 | 1.08 | 1.62 |
| `validateTree` | 50 | 0.240 | 0.251 | 0.272 | 0.471 | 0.287 |
| `serializeTurtle` | 50 | 0.333 | 0.343 | 0.384 | 0.406 | 0.430 |

### DCAT-AP as vendored by Health-RI *(variant of dcat-ap-3 — excluded from the headline)*

> Health-RI's in-tree copy of DCAT-AP. Was the E1 'DCAT-AP' row until the upstream SEMIC release was vendored; demoted to a variant so DCAT-AP is counted once. Kept because the drift between a vendored copy and its upstream is itself worth a sentence.

- 1 shape file(s), 20344 B, 698 lines
- 21 node shapes, 109 property shapes, 0 `sh:if` conditional(s)
- root shape pinned: `http://data.europa.eu/r5r#Dataset_Shape`
- projected tree: 1 node(s) — `validateTree` re-enters wasm once per node
- data graph: 10697 B, 198 triples; `validate()` returned 25 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 34.3 | 35.4 | 37.1 | 37.2 | 34.7 |
| `projectForm` | 50 | 0.709 | 0.736 | 0.839 | 0.846 | 0.793 |
| `projectTree` | 50 | 0.719 | 0.738 | 0.797 | 0.818 | 0.780 |
| `validateFull` | 50 | 0.738 | 0.772 | 0.868 | 0.925 | 1.03 |
| `validateTree` | 50 | 0.241 | 0.252 | 0.268 | 0.273 | 0.281 |
| `serializeTurtle` | 50 | 0.337 | 0.348 | 0.415 | 0.440 | 0.429 |

### Health-RI FAIR Data Point shapes *(variant of health-ri-core — excluded from the headline)*

> NOT an independent profile. It declares the same shape IRIs (hri:AgentShape, hri:CatalogShape, …) as PiecesShape, and its 178 sh:path lines collapse to the same 137 distinct (shape, path) pairs — each FDP file is self-contained and redefines the shared shapes, so concatenation merges them by identity. Unrelated to the FAIRDataTeam `fair-data-point` profile above.

- 6 shape file(s), 94599 B, 2077 lines
- 14 node shapes, 143 property shapes, 0 `sh:if` conditional(s)
- root shape pinned: `http://data.health-ri.nl/core/p2/DatasetShape`
- projected tree: 4 node(s) — `validateTree` re-enters wasm once per node
- data graph: 10697 B, 198 triples; `validate()` returned 1 result(s)

| Operation | n | min | p50 | p95 | max | 1st call |
|---|---:|---:|---:|---:|---:|---:|
| `loadShapes` | 30 | 43.9 | 45.4 | 46.9 | 47.4 | 46.1 |
| `projectForm` | 50 | 0.949 | 0.959 | 0.980 | 0.987 | 1.06 |
| `projectTree` | 50 | 1.46 | 1.49 | 1.55 | 1.66 | 1.52 |
| `validateFull` | 50 | 4.55 | 4.67 | 4.86 | 5.00 | 4.98 |
| `validateTree` | 50 | 15.5 | 15.8 | 16.4 | 16.7 | 15.7 |
| `serializeTurtle` | 50 | 0.335 | 0.342 | 0.374 | 0.439 | 0.440 |

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
7. **Repeat-run variance of the large parse-only profiles is not re-established.**
   Within this run, the widest parse spread is SPDX 3.0.1 model: p95 is
   1.05× its median. Earlier engine versions showed run-to-run swings of the *medians*
   of the largest profiles that a single run cannot reveal; this run does not test
   whether 0.3.10 still has them. Quote the large parse figures as one observation.
8. **One machine, one run, and the machine must be idle.** No cross-machine
   variance and no thermal control. This matters more than it sounds: running
   the harness on a loaded machine inflated p95 by up to 3× in our own repeats,
   while the medians moved much less. Regenerate on a quiet machine, and read
   the p95 column as "p95 under these conditions", not as a worst case.
