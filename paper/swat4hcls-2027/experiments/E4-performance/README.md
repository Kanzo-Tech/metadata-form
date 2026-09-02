# E4 — Performance

Spec: `~/dev/kanzo/papers/swat4hcls2027/EVIDENCE.md`, §E4.

**Claim it supports:** per-edit conditional re-evaluation in the browser is
affordable, so §4's design is practical rather than theoretical.

## Status

**Measured, desktop only — 2026-08-27.** The numbers live in `results/perf.md`
(→ Tab. 4), raw in `results/perf.json` and `results/bundle.json`. Nothing in
`results/` is hand-edited. The figures quoted in *Findings* below are rounded
and drift slightly between runs; `results/perf.md` is the record.

The mobile half of the spec is **not done and cannot be done from here** — see
*Gaps* below. Do not let the table into the paper without the caveats travelling
with it.

## How to reproduce

```sh
bash paper/swat4hcls-2027/experiments/E4-performance/run.sh
```

Two steps, in order:

1. `bundle-delta.mjs` — three production Vite builds of the same minimal React
   app → `results/bundle.json`
2. `perf.harness.ts` — engine timings, the per-edit React path, and cold start
   (25 child processes) → `results/perf.json` + `results/perf.md`

Run it on an **idle machine**. Repeats on a loaded one inflated p95 by up to 3×
while the medians barely moved.

## Inputs

`data/` is empty on purpose. E4 vendors nothing new: it measures across the same
profiles E1 vendored (`../E1-coverage/data/health-ri/`) plus the two Evidenze
profiles in `playground/examples/`, so the size scaling is comparable across the
two experiments and there is one copy of each profile in the repo.

Six inputs, five counted (Health-RI FDP is E1's Finding 7 variant, reported but
kept out of the headline). Sizes span 4.8 kB → 83 kB of Turtle, 6 → 143 property
shapes.

## Environment measured

| | |
|---|---|
| Machine | Apple M4 Pro, 14 cores, 48 GiB |
| OS | macOS 26.2 (darwin arm64) |
| Runtime | Node v23.9.0 (V8 12.9.202.28-node.13) |
| DOM | jsdom via vitest 3.2.6 — **not a browser** |
| Engine | `@kanzo-tech/rudof-wasm@0.3.5` (sha256 `e6ff1f2ee9cc5ae0…`) |
| Bundler | Vite 6.4.3, React 19.2.8 |

## Findings

### Finding 1 — the per-edit path is two orders of magnitude inside a frame

Re-projecting the *whole* form tree from the graph — the wasm call that
re-evaluates every `sh:if` — is ~0.005–1.4 ms median (p95 ≤ 1.5 ms) across the
five profiles. A committed edit reaches a new `FormModel` with updated
conditional visibility in ~0.3–1.5 ms median (p95 ≤ 2 ms). A 60 Hz frame is 16.7 ms.

The design section can say per-edit conditional re-evaluation is affordable and
have a number behind it.

### Finding 2 — the cost is in load, not in editing

Parse is the dominant engine cost and it is a one-off: ~58 ms for the largest
profile (Health-RI Core, 143 property shapes, 83 kB of Turtle), ~11 ms for the
smallest real one. Module compile + instantiate adds ~11 ms (p95 ~12 ms).
Both happen once. Per-edit work is 1/40th of the parse.

### Finding 3 — the honest weak point is the payload, and it is mostly not the engine

2.6 MB of `.wasm` — 909 kB gzipped, 630 kB brotli — plus a **142 kB gzipped JS
delta** for the full library. But the split matters: the *engine seam*
(`metadata-form/rudof` — wasm-bindgen glue, the `RudofEngine` wrapper, the shape
IR and projection) is only **11.3 kB gzipped**. The remaining ~131 kB is the form
UI and the design system it is built on, which an adopter with their own
components does not have to take.

Measured as a real diff: three production builds of the same minimal React app,
identical but for how much of the library they import. React is in every build,
so it is not in the delta.

### Finding 4 — `validateTree` is the one place cost tracks tree size, not shape size

Whole-graph `validate()` is ~5 ms at worst. `validateTree` — which re-enters
wasm once per projected node, because a `sh:node` violation reports as one
boolean rollup and an untargeted nested shape is reached by no target — costs
~16 ms on Health-RI Core (4 tree nodes) and ~2.6 ms on Evidenze Health
(16 tree nodes). It is off the visibility path (its own 300 ms debounce), so it
never gates a field appearing, but it is the number that will grow with deeply
nested profiles and it is worth a sentence in §8.

### Finding 5 — two debounces are design, not engine cost, and the paper should say so

Free-text widgets keep local state and commit to the graph after **250 ms**
(`useCommit`, `defaultWidgets.tsx`); validation runs on a separate **300 ms**
debounce. So typing is never blocked by the engine, and the honest description of
"keystroke → visibility" is: character echoes immediately, the form re-shapes
~250 ms after the user stops typing, errors follow ~300 ms later. Discrete widgets
— select, switch, date, exactly the kind a `sh:if` keys off — commit immediately
and pay only the figure in Finding 1.

Reporting a single "keystroke → visibility" number without this would be
misleading in both directions.

### Finding 6 — a real bug the harness surfaced, worth knowing about

Editing the graph in the window between React's commit and its passive-effect
flush bumps a store nobody is subscribed to yet (`useSyncExternalStore`'s
`subscribe` runs in that effect): the mutation lands, no re-render is scheduled,
and the model goes silently stale. It made this harness intermittently wrong
before `settle()` was added. Not a production bug — nothing commits a value that
early in a real session — but it is the reason the timed loops now assert the
flip took effect on every sample rather than trusting it.

## Gaps — what the spec asked for and this does not measure

1. **No mid-range mobile device.** The spec asks for one explicitly. It cannot be
   produced from this machine. This is the gap that matters most: mobile is
   exactly where the design is weakest (wasm compile and single-core throughput
   are several times slower; 2.6 MB is a real cost on a cellular link). Every
   timing here is a floor.
2. **No browser at all.** Node + jsdom. Same V8 as Chrome and a byte-identical
   `.wasm`, so the engine timings are *indicative of* a Chromium desktop browser
   — but Firefox and Safari are unrepresented and nothing was measured in a
   browser. The paper must not claim otherwise.
3. **No network fetch.** Cold start reads the module from disk. On a slow link
   transfer would dominate.
4. **No style / layout / paint.** jsdom stops at the committed DOM mutation, and
   its DOM is slower than a browser's for the mutations it does perform, so the
   `commit → DOM` column errs in both directions and is not a browser latency
   estimate. Quote `commit → FormModel` for the engine claim.
5. **No real keystroke.** The measurement starts at the committed value, not at
   `keydown`.
6. **No memory figure.** Peak wasm heap per session, and long-session behaviour,
   are unmeasured.

## If this experiment gets more time

- Drive the same harness in a real browser (Playwright over the built playground)
  for one Chromium and one WebKit data point. That closes gap 2 cheaply and turns
  "indicative of" into a measurement.
- A single mid-range Android device over the deployed playground, hand-timed with
  the Performance API, would close gap 1 well enough to report honestly.
- Measure the streaming cold path (`instantiateStreaming` behind a throttled
  connection) rather than a disk read.
