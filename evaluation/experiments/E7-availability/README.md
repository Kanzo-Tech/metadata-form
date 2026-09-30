# E7 — availability and sustainability

Spec: `~/dev/kanzo/papers/swat4hcls2027/EVIDENCE.md`, §E7.

**Claim it supports:** the in-use track's sustainability points — that the
artefacts the paper describes exist, are licensed, are findable at a fixed
version, and that what is *not* yet available is said out loud.

- `data/` — the one vendored input, a working permalink (committed)
- `results/` — the report and the raw verification transcript (committed)

## Status

**Run and reported — 28 Aug 2026.** The report is
[`results/availability.md`](results/availability.md); the raw transcript it was
written from is [`results/verification.txt`](results/verification.txt), produced
by `run.sh`.

This experiment is not a measurement, it is an **audit**. Its whole discipline is
that every line is a check whose output is recorded, rather than a sentence
someone believed. Re-running `run.sh` on a later date and diffing
`verification.txt` is how a stale claim gets caught.

## How to reproduce

```sh
bash evaluation/experiments/E7-availability/run.sh
```

~30 s. Needs `node`, `npm`, `curl`, `python3`, `git`, and network access to
`registry.npmjs.org` and `api.github.com`. The rudof checks need the fork
checkout beside this repo (`../rudof-fork`, override with `$RUDOF_FORK`); they
are skipped, loudly, if it is missing.

One claim in the report is **not** covered by `run.sh` and was verified by hand:
that the permalink in `data/permalink-v1-covid.txt` actually loads the COVID
example in a browser. `run.sh` checks the codec and the deployment; it does not
drive a browser. That check was done manually on 28 Aug — see `data/README.md`.

## Findings

Full detail in `results/availability.md`. What matters:

### The artefacts, with versions

| Artefact | Cite | Notes |
|---|---|---|
| `@kanzo-tech/rudof-wasm` | **0.3.5** (2026-08-27) | the engine; MIT OR Apache-2.0; **carries an npm/SLSA provenance attestation** — 0.3.4 does not |
| built from | `Kanzo-Tech/rudof` tag `rudof-wasm-v0.3.5` = **`8bf8bcc5a4`** | the tag, the commit and the attestation all agree |
| `metadata-form` | 0.1.0, **source only** | not published to npm |
| playground | <https://kanzo-tech.github.io/metadata-form/> | live, HTTP 200 |

A reviewer verifies the provenance with

```sh
npm install @kanzo-tech/rudof-wasm@0.3.5 && npm audit signatures
```

which prints *"1 package has a verified attestation"*. The attestation binds the
tarball to the repository, the tag and the workflow file — verified by decoding
the payload, not by trusting the badge.

### Seven things less available than the plan assumed

1. **`metadata-form` is not on npm** (404). Only the engine is installable.
2. **The 67-character permalink does not work on the deployed playground.** The
   deployment is built from `main`, which is v1-only; a v2 link decodes to `null`
   there and silently opens the default example. Verified in a browser. The
   citable link today is the 4.5 KB v1 one in `data/`.
3. **The design-system peers resolve to committed `vendor/*.tgz` at 0.0.0**, not
   to the `@kanzo-tech/*@0.1.0` published on npm under the same names.
4. **The rudof fork tree is dirty** (three modified files), so no DOI can be cut
   from it as it stands.
5. **Five of seven experiments have a one-command runner**, not all seven. E1 has
   no wrapper (one vitest invocation, just not written down); E5 cannot have one
   and should not pretend to — it harvests live records.
6. **`.npmrc` is load-bearing**: without `legacy-peer-deps=true`, `npm install`
   fails outright on an upstream `workspace:^` range npm cannot parse.
7. **`PLAN.md`'s "3,047 commits behind upstream" is wrong by ~10×.** See below.

### The divergence number, corrected

`PLAN.md` (27 Aug) records the fork as *3,047 commits behind* upstream. That came
from `git rev-list --left-right --count` in a **shallow** clone — `.git/shallow`
is present and the local history is 73 commits deep, so every upstream commit
before the graft point, back to 2023, was counted as missing. The GitHub compare
API, which has the full graph, says:

| | |
|---|---:|
| Fork ahead of `master` | **70** |
| Fork behind `master` | **297** |
| Merge base | `a756cee4` (2026-06-29) |
| Merged upstream | **nothing** |

Correct §9 to 297. The local command still prints `70 3051` and should not be
used again in this checkout.

### Upstream status, plainly

Fork-only, and no PR has been opened. Two commits are separable and §9 should say
which is which:

- **`c12ecaaa`** — first-class `sh:if`/`sh:then`/`sh:else`. The paper's mechanism.
  Verified absent upstream (`IfConstraintComponent`: 0 hits; upstream's
  `logical/` has no `if_.rs`).
- **`c4362e002`** — every constraint component keeps the shape's `sh:message`.
  16 files, a test per component, no dependency on the 408-file refactor. Also
  absent upstream. **The easier PR**, and the one a maintainer merges without a
  design conversation.

### Licences

All clear, all evidenced by a `PROVENANCE.md` per vendored profile. Code is MIT
(library) and MIT OR Apache-2.0 (rudof). Two shapes need care in the paper:
**Bioschemas is CC-BY-SA** (ShareAlike, so derivatives inherit) and **SPDX 3.0.1
is the Community Specification License 1.0**, which is neither CC nor an
SPDX-listed OSS licence. E5's harvested records are CC0 at source and are not
redistributed anyway, for the reasons that experiment gives.

The one gap is our own design system: the vendored `@kanzo-tech/*` tarballs carry
no licence statement this audit could verify. That needs resolving before a
deposit.

### What a Zenodo DOI must pin

Not created here — the fork tree is dirty, which is the blocking prerequisite.
When it is cut it must contain **two** source snapshots (this repo *and*
`Kanzo-Tech/rudof` at `8bf8bcc5a4` — the mechanism is in the Rust, not the
TypeScript), the wasm artefact or its `integrity` hash, the vendored shapes with
their provenance, `package-lock.json` plus the three `vendor/*.tgz`, and an
explicit statement of what is deliberately absent (E5's corpus). Details in
`results/availability.md` §3.
