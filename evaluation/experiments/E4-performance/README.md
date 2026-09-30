# E4 — Performance

Spec: `~/dev/kanzo/papers/swat4hcls2027/EVIDENCE.md`, §E4.

**Claim it supports:** per-edit conditional re-evaluation in the browser is
affordable, so §4's design is practical rather than theoretical.

## Status

**Measured, desktop only — re-run 2026-09-30 on `@kanzo-tech/rudof-wasm@0.3.10`.**
The numbers live in `results/perf.md` (→ Tab. 4), raw in `results/perf.json` and
`results/bundle.json`. Nothing in `results/` is hand-edited. The figures quoted
in *Findings* below are rounded and drift slightly between runs;
`results/perf.md` is the record. The previous run (2026-08-27, engine 0.3.5)
is in git history.

The mobile half of the spec is **not done and cannot be done from here** — see
*Gaps* below. Do not let the table into the paper without the caveats travelling
with it.

## How to reproduce

```sh
bash evaluation/experiments/E4-performance/run.sh
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
profiles in `examples/`, so the size scaling is comparable across the
two experiments and there is one copy of each profile in the repo.

Fifteen inputs, eleven counted as independent profiles (the other four are E1's
variants, reported but kept out of the headline). Sizes span 4.8 kB → 930 kB of
Turtle, 6 → 1246 property shapes.

## Environment measured

| | |
|---|---|
| Machine | Apple M4 Pro, 14 cores, 48 GiB |
| OS | macOS 26.2 (darwin arm64) |
| Runtime | Node v23.9.0 (V8 12.9.202.28-node.13) |
| DOM | jsdom via vitest 3.2.6 — **not a browser** |
| Engine | `@kanzo-tech/rudof-wasm@0.3.10` (sha256 `0030b43f8775995b…`) |
| Bundler | Vite 6.4.3, React 19.2.8 (`results/bundle.json`) |

## Findings

Numbers are `results/perf.md` of the 2026-09-30 run, medians unless stated.

### Finding 1 — the per-edit path is well inside a frame

Re-projecting the *whole* form tree from the graph — the wasm call that
re-evaluates every conditional — is 0.006–1.46 ms median (p95 ≤ 1.56 ms) across
the eight profiles with a session. A committed edit reaches a new `FormModel`
with updated conditional visibility in 0.34–1.70 ms median (p95 ≤ 2.05 ms), on
the two profiles that carry a conditional. A 60 Hz frame is 16.7 ms.

### Finding 2 — the cost is in load, not in editing, and load got much cheaper

Parse (`loadShapes`) is the dominant engine cost and it is a one-off. It went
from 227 ms to 44 ms for Health-RI Core (143 property shapes, 83 kB), from
1216 ms to 89 ms for DCAT-AP 3.0.1, and from 13.4 s to 1.06 s for SPHN (1246
property shapes, 930 kB) against the 0.3.5 run. Per kB of Turtle it now spans
0.39–1.82 ms across the corpus; the earlier run's super-linear growth is gone.
The one thing that got *more* expensive is the floor: the smallest profile (6
property shapes) parsed in 0.54 ms on 0.3.5 and takes 8.7 ms now, and Evidenze
Health went from 17.8 to 23.8 ms. Not investigated here; it is a fixed cost per
`loadShapes` on top of the (much faster) shapes loader. Module compile +
instantiate is 10.9 ms (was 10.1 ms). All of this happens once; per-edit work
is far below the parse.

### Finding 3 — the honest weak point is the payload, and it is mostly not the engine

2.8 MB of `.wasm` — 959 kB gzipped, 662 kB brotli (0.3.5: 630 kB brotli) — plus
a **147 kB gzipped JS delta** for the full library (0.3.5 build: 142 kB). The
split matters: the *engine seam* (`metadata-form/rudof`) is only **11.7 kB
gzipped**; the remaining ~136 kB is the form UI and the design system it is
built on, which an adopter with their own components does not have to take. The
library no longer ships a CSS file (the styles are the consumer's Tailwind
build), so the CSS row of the payload table is 0 by construction.

Measured as a real diff: three production builds of the same minimal React app,
identical but for how much of the library they import. React is in every build,
so it is not in the delta.

### Finding 4 — `validateTree` is the one place cost tracks tree size, not shape size

Whole-graph `validate()` is 4.5 ms at worst (Health-RI Core). `validateTree` —
which re-enters wasm once per projected node — costs 15.4 ms on Health-RI Core (4
tree nodes; was 82.8 ms) and 2.7 ms on Evidenze Health (16 tree nodes). It is off
the visibility path: validation runs in the render React defers behind the edit
(`useDeferredValue`), with **no timer of its own**, so it never gates a field
appearing. It is the number that will grow with deeply nested profiles and it is
worth a sentence in §8.

### Finding 5 — one debounce is design, not engine cost, and the paper should say so

Free-text widgets keep local state and commit to the graph after **250 ms** of
quiet, or at once on blur (`useDebouncedCommit`, the design system's hook; its
default delay). So typing is never blocked by the engine: the character echoes
immediately, the form re-shapes ~250 ms after the user stops typing, and errors
follow as soon as React has drawn it. Discrete widgets — select, switch, date,
exactly the kind a conditional keys off — commit immediately and pay only the
figure in Finding 1. Validation has no fixed delay.

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
