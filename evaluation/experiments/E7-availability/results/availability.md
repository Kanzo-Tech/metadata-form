# E7 — availability and sustainability

Every claim below was **checked on 30 Sep 2026** by `../run.sh`, whose raw output
is [`verification.txt`](verification.txt) in this directory. Where a claim could
not be verified, it says so and says why. This file is hand-written from that
transcript; if they disagree, the transcript wins. The 28 Aug version of this
audit (engine 0.3.5, vendored design-system tarballs, an unpublished library) is
in git history and is superseded, not corrected: most of its findings were about
a state that no longer exists.

---

## 1. The artefact list, with the exact versions to cite

| Artefact | Version | Where | Verified by |
|---|---|---|---|
| **`@kanzo-tech/rudof-wasm`** — the engine | **0.3.10**, published 2026-09-30 | npm, public; MIT OR Apache-2.0 | `npm view` (§1 of the transcript) |
| ↳ built from | `Kanzo-Tech/rudof`, tag `rudof-wasm-v0.3.10` → commit **`ce4ed73490720f923564874380f1781de5997c0a`** | GitHub, public | the tag (`git ls-remote`), the npm `gitHead` and the attestation's `gitCommit` are the same SHA |
| **`@kanzo-tech/ui`**, **`ai`**, **`theme`** — the design system | **0.12.0**, published 2026-09-30 | npm, public; MIT; repository `Kanzo-Tech/ui` | `npm view`; the repo resolves them from the registry (lockfile), no vendored tarballs (`vendor/` does not exist) |
| **`metadata-form`** — the library | `package.json` says 0.1.0 | `Kanzo-Tech/metadata-form`, public, MIT | **not on npm**: `npm view metadata-form` and `npm view @kanzo-tech/metadata-form` both 404 |
| **playground** | built from the public `main` | <https://kanzo-tech.github.io/metadata-form/> | HTTP 200 |

The published names the paper's `metadata-form/ai`, `/rudof` and `/i18n` entry
points live under are therefore a **source checkout**, not an installable
package. The engine and the design system are installable.

### What the public repository contains — and what it does not

`Kanzo-Tech/metadata-form` is public with an MIT licence (GitHub's licence
detection and the `LICENSE` file agree). Its `main` is at `0dba201` (pushed
2026-09-02). **The checkout this evaluation ran on is 54 commits ahead of it, and
those commits are not pushed** (`git rev-list --count 0dba201..HEAD`; `0dba201` is
an ancestor of HEAD). So everything that depends on them — the engine 0.3.10, the
score-based editor selection, engine-generated messages, `sh:targetWhere`, the
`metadata-form/ai` subpath, i18n as data, the date-time fix — is on the author's
machine and not in the repository a reader would clone. The deployed playground is
that `main` (the last `Deploy playground` run, `success`, is for `0dba201`), and its
bundle still contains the earlier SHACL-UI namespace string `shacl-ui#` (three
occurrences), where the current source uses `shacl-ui/`. The repository has one tag
(`v0.0.1-alpha`) and one GitHub release. **Before the paper cites a revision, the
branch has to be pushed and tagged**, and the playground redeployed if it is to run
the software the paper describes.

`package.json` has no `repository` field.

### The provenance attestations — what a reviewer can verify

`@kanzo-tech/rudof-wasm` carries an npm/SLSA provenance attestation on every
version from 0.3.5 to 0.3.10; **0.3.4 does not** (`npm view … dist.attestations`,
transcript §1). The attestation of 0.3.10, decoded, binds the tarball to:

```
subject:    pkg:npm/%40kanzo-tech/rudof-wasm@0.3.10
repository: https://github.com/Kanzo-Tech/rudof
ref:        refs/tags/rudof-wasm-v0.3.10
workflow:   .github/workflows/publish-wasm.yml
commit:     ce4ed73490720f923564874380f1781de5997c0a
builder:    https://github.com/actions/runner/github-hosted
```

`@kanzo-tech/ui`, `ai` and `theme` at 0.12.0 each carry a provenance attestation
too. The command a reviewer runs:

```sh
npm i @kanzo-tech/rudof-wasm@0.3.10 @kanzo-tech/ui@0.12.0 @kanzo-tech/ai@0.12.0 @kanzo-tech/theme@0.12.0
npm audit signatures
```

Run here in a throwaway project it printed *148 packages have verified registry
signatures* and *15 packages have verified attestations* (the four packages above
and their transitive dependencies; the count is the registry's, at the time).

This covers **the engine and the design system only**. It says nothing about the
TypeScript library, which is not published, nor about the shapes or the
experiments. A CEUR reader will not run `npm`, and a DOI pins bytes where the
attestation pins a build; both are needed.

---

## 2. Playground permalinks

The committed permalink, `../data/permalink-v1-covid.txt`, is a **v1 embedded**
link (4,538 characters) to the bundled *HealthDCAT-AP · COVID-19 registry* example.
Decoded with the codec (`lz-string`), it is version 1, example `health-dcat-ap`,
with 8,069 characters of shapes and 692 of data. That the codec reads it is
checked in the transcript; **that the deployment loads it in a browser was verified
by hand on 28 Aug and is not re-verified here** (the deployed bundle is unchanged
since 2 Sep, so nothing suggests it stopped working, but this run did not open it).

The 28 Aug audit found the short v2 link (67 characters, by reference to a bundled
example) dead on the deployment, because `main` was v1-only then. That has changed:
the public `main` now carries the v2 codec (four `v: 2` markers in
`playground/src/lib/permalink.ts`, on this branch and on `main`, which is what the deployment was built from). **A v2 link resolving on the deployment has not been
verified in a browser**; do not cite one until it has.

---

## 3. Zenodo DOI — what it must pin

Not created (out of scope here). What it has to contain, so the paper cites a
DOI rather than a moving branch:

1. **Two source snapshots.** `Kanzo-Tech/metadata-form` at the pushed, tagged
   revision the paper was measured from (see §1: that revision is not yet
   public), including `evaluation/experiments/` with `data/` and `results/`; and
   `Kanzo-Tech/rudof` at `ce4ed73490720f923564874380f1781de5997c0a` (tag
   `rudof-wasm-v0.3.10`) — the engine source, where the SHACL-UI score function,
   the message catalogue and `sh:targetWhere` live.
2. **The built `.wasm`**, or a pointer to `@kanzo-tech/rudof-wasm@0.3.10` with its
   `integrity` (`sha512-kNPSumTFkK5otw5Ruay3unJ+H8lrk7N1GnM0rTJd+wwFih7JjQzpNHWyxKZap9/Uw/cWCmcw28Kyiy7BtI4ueg==`,
   from `npm view … dist`), so "the engine" is a fixed binary and not whatever
   `^0.3.10` resolves to.
3. **The vendored shapes** under `E1-coverage/data/` and `E5-…/data/`, each with its
   `PROVENANCE.md` (§5).
4. **`package-lock.json`**, which now resolves every `@kanzo-tech/*` package from the
   registry; no tarballs to vendor.
5. **What is deliberately absent**: E5's harvested corpus (excluded on
   personal-data and research-ethics grounds; see that README).

---

## 4. Reproducibility — what has one command, checked

`run.sh` §6 inspects every experiment directory:

| Experiment | Single command? | What |
|---|---|---|
| **E1** coverage | no wrapper | one `npx vitest run --config evaluation/experiments/vitest.config.ts …/E1-coverage/coverage.harness.ts` |
| **E2** migration | yes | `make check` (`Makefile`; `make venv` first, rdflib only) |
| **E3** multilingual | yes, two | `run.sh` (pinned installs, upstream CLI, W3C suite count; network) and `run-current.sh` (the engine in this repo; no network) |
| **E4** performance | yes | `run.sh` (three Vite builds + the vitest harness) |
| **E5** errors in the wild | no | ordered python steps in its README plus a live harvest; the derived stages re-run from the local, non-redistributed corpus |
| **E6** LLM assist | yes | `run.sh`; no key, no network |
| **E7** availability | yes | `run.sh` (this file's source); network |

So the honest sentence is **six of seven** have a wrapper command (E1's is one
line; E5 cannot, on principle: a live harvest is not a reproducible input, which
is why it commits a manifest instead of a corpus). Nothing is pinned to a
container.

---

## 5. Licences

| What | Licence | Evidence |
|---|---|---|
| `metadata-form` (library, playground, harnesses) | **MIT** | `LICENSE`, `package.json`, GitHub repository metadata |
| rudof, fork and upstream | **MIT OR Apache-2.0** | npm `license` of `@kanzo-tech/rudof-wasm`; GitHub reports `Apache-2.0` for the fork's default branch (its detector picks one file) |
| `@kanzo-tech/ui`, `ai`, `theme` | **MIT** by their `package.json` `license` field | `npm view`. **None of the four published tarballs ships a licence file** (`npm pack --dry-run`: no `LICENSE*` among 5, 521, 60 and 44 files), and GitHub's detector reports no licence for `Kanzo-Tech/ui`. The metadata says MIT; a text to attach to a deposit does not exist in the package |
| Bioschemas profiles | CC-BY-SA-4.0 | `E1-coverage/data/bioschemas/PROVENANCE.md` |
| DCAT-AP 3.0.1 (E1 and E5) | CC-BY-4.0 | two `PROVENANCE.md` files |
| DCAT-AP.de 2.0 | CC-BY-4.0 | `E1-coverage/data/dcat-ap-de/PROVENANCE.md` |
| FAIR Data Point shapes | MIT | `E1-coverage/data/fair-data-point/PROVENANCE.md` |
| Health-RI metadata (E1 and E2) | CC-BY-4.0 | `E1-coverage/data/health-ri/PROVENANCE.md` |
| HealthDCAT-AP Release 5 | CC-BY-4.0 (stated in the spec; no LICENSE file in the repository) | `E1-coverage/data/healthdcat-ap/PROVENANCE.md` |
| SPDX 3.0.1 model | **Community Specification License 1.0** — redistributable with attribution; not CC, not an SPDX-listed OSS licence | `E1-coverage/data/spdx-3/PROVENANCE.md` |
| SPHN 2026.1 | CC-BY-4.0 | `E1-coverage/data/sphn/PROVENANCE.md` |
| E5 harvested records | CC0 at source; **not redistributed** | E5 README, "Licence verdict" |

Two shapes need care in the paper: **Bioschemas is ShareAlike** (derivatives
inherit) and **SPDX is the Community Specification License**.

---

## 6. What this audit does not cover

- The fork's divergence from upstream `rudof-project/rudof` and the state of its
  working tree were audited on 28 Aug and are **not re-checked here** (the checks
  needed a local fork checkout). Do not reuse the 28 Aug numbers.
- A browser load of any permalink (§2).
- Whether the deployed playground runs the paper's software (it does not: §1).
