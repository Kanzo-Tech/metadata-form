# E7 — availability and sustainability

Every claim below was **checked on 28 Aug 2026** by `../run.sh`, whose raw output
is [`verification.txt`](verification.txt) in this directory. Where a claim could
not be verified, it says so and says why. Numbers copied from an earlier plan and
not re-checked are marked as such — there is one, and re-checking it changed it by
a factor of ten.

---

## 1. The artefact list, with the exact versions to cite

| Artefact | Version to cite | Where | Verified |
|---|---|---|---|
| **`@kanzo-tech/rudof-wasm`** — the engine | **0.3.5**, published 2026-08-27 | npm, public | `npm view`; two versions exist (0.3.4, 0.3.5), `latest` is 0.3.5 |
| ↳ built from | `Kanzo-Tech/rudof`, tag `rudof-wasm-v0.3.5` → commit **`8bf8bcc5a43ddf832e515146e3c4ce1f477aea43`** | GitHub, public | `git ls-remote --tags`; the same SHA appears as `gitHead` in the npm metadata *and* inside the SLSA attestation |
| ↳ licence | **MIT OR Apache-2.0** | | npm metadata + `Cargo.toml` + `LICENSE-MIT`/`LICENSE-APACHE` in the tree |
| **`metadata-form`** — the library | **0.1.0**, source only | `Kanzo-Tech/metadata-form`, public, MIT | **not on npm** (`npm view metadata-form` → 404) |
| **playground** | deployed from `main` | <https://kanzo-tech.github.io/metadata-form/> | HTTP 200; loads and runs |
| `@kanzo-tech/ui` / `ai` / `theme` | 0.1.0 on npm — **but the repo builds against vendored 0.0.0 tarballs** | `vendor/*.tgz`, committed | `npm view` + `git ls-files vendor/` |

### The provenance attestation — the one thing here a reviewer can verify cryptographically

`@kanzo-tech/rudof-wasm@0.3.5` carries an npm/SLSA provenance attestation.
**0.3.4 does not** — it was published 2026-06-30, before the trusted publisher was
configured. Confirmed by `npm view @kanzo-tech/rudof-wasm@0.3.5 dist`
(`dist.attestations` present) against the same query on 0.3.4 (absent).

Decoding the attestation payload, it binds the published tarball to:

```
subject:    pkg:npm/%40kanzo-tech/rudof-wasm@0.3.5
repository: https://github.com/Kanzo-Tech/rudof
ref:        refs/tags/rudof-wasm-v0.3.5
workflow:   .github/workflows/publish-wasm.yml
builder:    https://github.com/actions/runner/github-hosted
predicate:  https://slsa.dev/provenance/v1
```

**The command a reviewer runs:**

```sh
npm install @kanzo-tech/rudof-wasm@0.3.5
npm audit signatures
```

Run here, in a throwaway project, it prints:

```
1 package has a verified registry signature
1 package has a verified attestation
```

This is stronger than a DOI in one specific respect and weaker in another. A DOI
pins *bytes we assert came from a revision*; the attestation ties the published
binary to a named repository, tag and workflow run, cryptographically, without
asking anyone to take our word for it. But CEUR readers will not run `npm`, and
the attestation covers only the wasm package — not the TypeScript library, not
the shapes, not the experiments. Both are needed. §8 can claim *verifiable*
provenance for the engine and should not over-claim it for the rest.

---

## 2. Playground permalink — and a real problem with it

**The link that works today:**

```
https://kanzo-tech.github.io/metadata-form/#N4IgbiBcCMA0IFMAeBDAtgBwDYIJIBMoQALBFLAF2IFp8B…
```

— a **v1 embedded** permalink to the bundled *HealthDCAT-AP · COVID-19 registry*
example. Fragment: 4,538 characters; full URL 4,577. The exact string is in
`../data/permalink-v1-covid.txt`.

**Verified end to end in a real browser**, not by reading the codec: loading it
against the live deployment and reading the DOM gives

```
input[0] = "COVID-19 Patient Registry"
input[1] = "Anonymised registry of COVID-19 cases collected during 2020-2022."
input[2] = "epidemiology"   input[3] = "covid-19"   input[4] = "2023-01-15"
```

It resolves at the deployed playground. The fragment never reaches the server —
it is decoded in the browser — so the link is self-contained and works on any
deployment that ships the same app, whether or not that deployment ships the
example.

### The short link does **not** work yet

`playground/src/lib/permalink.ts` on the current branch (`feat/kanzo-ui`) has a
**v2** wire format that references a bundled example by id:

```
{"v":2,"ex":"health-dcat-ap","preset":"covid"}  →  67 characters
https://kanzo-tech.github.io/metadata-form/#N4IgbiBcBMA0IFMAeUQAsEEMA2AXNAtACYDGmuBmADiPFQE4IDOCuqJA9mAJZEgC+QA
```

**That link is dead on the deployed playground.** The deployment is built from
`main` by `.github/workflows/deploy-playground.yml`, and `main`'s `permalink.ts`
is v1-only: its `decodeState` returns `null` for anything whose `v !== 1`, and the
app then silently opens the default example. Verified two ways —

- grepping `origin/main:playground/src/lib/permalink.ts` for v2 markers: **0**
  (the same grep on this branch: 4);
- loading the short link in a browser with a hard reload: 14 fields render, every
  one of them **empty**. No error, no message. The reader is shown the wrong
  document and told nothing.

So: **the short permalink the paper wants to cite requires `feat/kanzo-ui` to
merge to `main` and the Pages deploy to run.** Until then the citable link is the
4.5 KB v1 one, which some mail and chat clients will truncate — the exact failure
the v2 format was written to avoid. (The branch's decoder is better behaved: it
distinguishes `unreadable` and `unknown` from `empty`, so after the merge a
truncated link is at least reported. `main`'s does not.)

---

## 3. Zenodo DOI — what it must pin

Not created (out of scope for this experiment, and the prerequisite is not met —
see below). What it has to contain, so the paper cites a DOI rather than a moving
branch:

1. **Two source snapshots, not one.**
   - `Kanzo-Tech/metadata-form` at the revision the paper was measured from,
     including `evaluation/experiments/` with `data/` and `results/`.
   - `Kanzo-Tech/rudof` at **`8bf8bcc5a4`** (tag `rudof-wasm-v0.3.5`) — the engine
     source. The paper's central mechanism lives here, not in the TypeScript.
     A DOI for the library alone would pin the half that is not the contribution.
2. **The built `.wasm` artefact**, or an explicit pointer to
   `@kanzo-tech/rudof-wasm@0.3.5` plus its `integrity` hash
   `sha512-G+rKIn0jHjHEQmA+JEUTdTNayuR9CfnO1/ZogwUdQFuzJnnXri+pVFZEhoe7Bl39m8xSgpsK4UOBWPv7vrkB3A==`,
   so "the engine" is a fixed binary and not "whatever `^0.3.5` resolves to".
3. **The vendored shapes under `E1-coverage/data/` and `E5-.../data/`**, each with
   its `PROVENANCE.md`. Every one of them is redistributable (§5) — that is the
   point of having checked.
4. **`package-lock.json`**, and the three `vendor/*.tgz` design-system tarballs.
   Without them the tree does not build: the `@kanzo-tech/*` peers resolve to
   `file:vendor/…@0.0.0`, not to the 0.1.0 published on npm (§5).
5. **What is deliberately absent**, stated in the deposit: E5's harvested corpus
   (excluded on personal-data and research-ethics grounds — see that experiment's
   README) and E3's per-validator installs.

**Blocking prerequisite, and it is still blocking.** A DOI pins a revision, so the
tree must be clean. `rudof-fork` on `arch/wasm-validator` has **three uncommitted
files** right now — `rudof_wasm/src/dto.rs`, `rudof_wasm/src/shapes.rs`,
`shacl/src/ast/property_shape.rs`. The plan flagged this on 26 Aug for a different
set of files; a different set is dirty today. Commit or discard before cutting the
deposit, and cite the resulting revision everywhere.

---

## 4. Reproducibility — what actually has one command, checked

Not assumed. Every experiment directory was inspected:

| Experiment | Single command? | What |
|---|---|---|
| **E1** coverage | **no wrapper** | `npx vitest run --config evaluation/experiments/vitest.config.ts E1-coverage` — one command, but it is not written down as a script. Runs in ~87 s. |
| **E2** migration | **yes** | `make` (`Makefile`). Needs `uv` + pySHACL 0.40.1 (`make venv`). |
| **E3** multilingual | **yes** | `run.sh`. Heaviest by far: installs six validators — `uv`, `npm`, `brew`, `java`, `cargo`, `curl`, plus a `git clone` of `w3c/data-shapes`. Network-dependent and not hermetic. |
| **E4** performance | **yes** | `run.sh` (three Vite builds + the vitest harness). |
| **E5** errors in the wild | **NO** | six ordered `python` steps documented in its README, plus a `uv venv` and a live harvest from `data.europa.eu`. Deliberately re-runnable but **not** reproducible byte-for-byte: the records change. Its `data/manifest.csv` SHA-256 column is what detects that. |
| **E6** LLM assist | **yes** | `run.sh` (added by this pass). No key, no network, ~3 s. |
| **E7** availability | **yes** | `run.sh` (this file's source). Needs network. |

So the honest sentence for §8 is **five of seven**, not "all". E1 needs a
three-line `run.sh` to join them, which is trivial. E5 cannot join them and should
not pretend to: a live harvest is not a reproducible input, which is precisely why
that experiment commits a manifest instead of a corpus.

Two further caveats a reviewer will hit:

- **Nothing is pinned to a container or a lockfile-verified toolchain.** E3 pins
  every validator version and one SHA-256 (TopBraid); E2 pins pySHACL; E4 and E6
  inherit whatever `package-lock.json` resolves. No experiment records the Node
  version it ran under except E4.
- **`npm install` in this repo needs `legacy-peer-deps=true`** (in `.npmrc`, with
  the reason written down: an upstream `workspace:^` range npm cannot parse in an
  optional transitive peer). A reviewer who copies the source without `.npmrc`
  gets `EUNSUPPORTEDPROTOCOL` and no build.

---

## 5. Licences

| What | Licence | Evidence |
|---|---|---|
| `metadata-form` (this library, playground, harnesses) | **MIT** | `LICENSE`, `package.json` |
| rudof, fork and upstream alike | **MIT OR Apache-2.0** | workspace `Cargo.toml`, `LICENSE-MIT` + `LICENSE-APACHE`, and the npm metadata for the published wasm |
| Bioschemas profiles | CC-BY-SA-4.0 | `E1-coverage/data/bioschemas/PROVENANCE.md` |
| DCAT-AP 3.0.1 (E1 and E5) | CC-BY-4.0 | two `PROVENANCE.md` files |
| DCAT-AP.de 2.0 | CC-BY-4.0 | `E1-coverage/data/dcat-ap-de/PROVENANCE.md` |
| FAIR Data Point shapes | MIT | `E1-coverage/data/fair-data-point/PROVENANCE.md` |
| Health-RI metadata (E1 and E2) | CC-BY-4.0 | `E1-coverage/data/health-ri/PROVENANCE.md` |
| HealthDCAT-AP Release 5 | CC-BY-4.0 (stated in the spec; **no LICENSE file in the repository**) | `E1-coverage/data/healthdcat-ap/PROVENANCE.md` |
| SPDX 3.0.1 model | **Community Specification License 1.0** — redistributable, attribution required, *not* an SPDX-listed OSS licence and not CC | `E1-coverage/data/spdx-3/PROVENANCE.md` |
| SPHN 2026.1 | CC-BY-4.0 | `E1-coverage/data/sphn/PROVENANCE.md` |
| E5 harvested records | CC0 at source — **not redistributed anyway** | that experiment's README states the personal-data and ethics reasoning |

Every vendored shape file is redistributable. Two need care in the paper: SPDX is
not CC and must be attributed under its own terms, and Bioschemas is **ShareAlike**
— a derivative of that file inherits CC-BY-SA. Neither blocks the deposit.

**The gap in this table is our own design system.** `@kanzo-tech/ui`, `ai` and
`theme` are consumed as `file:vendor/kanzo-tech-*-0.0.0.tgz`. The tarballs are
committed (so a checkout builds), but they carry no licence statement that this
experiment could verify, and they are **not** the 0.1.0 packages published on npm
under the same names. Anyone reproducing the build gets the tarballs; anyone
installing from npm gets something else. That needs resolving before the deposit,
and it is not a paper-writing task.

---

## 6. Upstream status of the rudof changes — plainly

The paper's central mechanism is **fork-only.** No hedging:

| | |
|---|---|
| Fork | `Kanzo-Tech/rudof`, branch `arch/wasm-validator`, head `8bf8bcc5a4` |
| Real upstream | `rudof-project/rudof`, `master` |
| Merge base | `a756cee4` (2026-06-29) |
| Fork ahead of the merge base | **70 commits**, 300 files changed |
| Upstream ahead of the fork | **297 commits** |
| Merged upstream | **nothing** |

Verified through the GitHub compare API rather than the local clone, and that
distinction matters:

> **The "3,047 commits behind upstream" figure in `PLAN.md` (27 Aug) is wrong.**
> It came from `git rev-list --left-right --count HEAD...rudof-upstream/master` in
> a **shallow** clone (`.git/shallow` is present; the local history is 73 commits
> deep). A shallow graft has no parents, so every upstream commit before the graft
> point — back to 2023 — is counted as "not in HEAD". The same command still prints
> `70 3051` today. GitHub, which has the full graph, says **297**. Correct §9 to
> 297 and do not repeat the local count.

The correction makes the sustainability story less alarming but not different in
kind: a fork two months and 297 commits off upstream, with 70 commits of its own,
none of them merged and none of them opened as a pull request. No PR from the fork
appears in the 100 most recent PRs on `rudof-project/rudof` (checked 28 Aug); that
is a bounded check, not proof of none, and it is the check that was run.

### Which commits are separable, and which is the easier PR

- **`c12ecaaa` — first-class `sh:if`/`sh:then`/`sh:else`.** The paper's mechanism.
  Confirmed absent upstream: `IfConstraintComponent` has **0 hits** anywhere in
  `rudof-upstream/master`'s `shacl/` or `rudof_rdf/`, and upstream's
  `validator/constraints/core/logical/` has `and`, `not`, `or`, `xone` and no
  `if_.rs`. Touches vocab, AST, IR, validator, the wasm wrapper and the parser.
- **`c4362e002` — every constraint component keeps the shape's `sh:message`.**
  Confined to `shacl/src/validator/constraints/`, 16 files, a test per component,
  independent of the 408-file refactor. Also absent upstream (upstream's `and.rs`
  contains no `message` handling at all). **This is the one a maintainer merges
  without a design conversation**, and §9 should say which is which.
- **The rest** — flattening `rudof_rdf`, collapsing the IR newtypes, the
  `rudof_lib::form::FormEngine` façade, the generic validator spine, the wasm
  publish pipeline — is architectural work that should not be attached to either.

The honest §9 sentence: *the mechanism the paper describes runs today only in an
unmerged branch, at commit `8bf8bcc5a4`, 297 commits behind its upstream; the two
separable pieces are named and neither has been proposed upstream yet.* A rudof
core author writing "we plan to upstream this" without a PR reads worse than that.

---

## 7. What is less available than the plan assumes

Collected in one place, because these are the things a reviewer or a re-user
actually trips over:

1. **`metadata-form` is not on npm.** The paper cannot say "available on npm"
   about the library — only about the engine. Source and a live playground, yes;
   an installable package, no.
2. **The short permalink does not resolve on the deployed playground** (§2). The
   citable link today is 4.5 KB long.
3. **The design-system peers resolve to committed 0.0.0 tarballs, not to the
   0.1.0 packages on npm** (§5). Reproducing the build and installing from the
   registry give different dependencies.
4. **The fork tree is dirty**, so no DOI can be cut from it as it stands (§3).
5. **E1 and E5 have no run script**; five of seven experiments do (§4).
6. **`.npmrc` is load-bearing.** Without `legacy-peer-deps=true`, `npm install`
   fails outright.
7. **The `PLAN.md` divergence figure was off by ~10×** (§6). Re-derived here; the
   local `git` command that produced it is unreliable in this clone and should not
   be used again.

Items 1–4 are decisions to make before submission. Items 5–7 are corrections.
