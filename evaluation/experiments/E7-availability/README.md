# E7 — availability and sustainability

Spec: `~/dev/kanzo/papers/swat4hcls2027/EVIDENCE.md`, §E7.

**Claim it supports:** the in-use track's sustainability points — that the
artefacts the paper describes exist, are licensed, are findable at a fixed
version, and that what is *not* yet available is said out loud.

- `data/` — the one vendored input, a working permalink (committed)
- `results/` — the report and the raw verification transcript (committed)

## Status

**Run and reported — re-audited 30 Sep 2026.** The report is
[`results/availability.md`](results/availability.md); the raw transcript it was
written from is [`results/verification.txt`](results/verification.txt), produced
by `run.sh`. The 28 Aug audit (engine 0.3.5, vendored design-system tarballs, an
unpublished engine fork checkout) described a state that no longer exists and is
superseded.

This experiment is an **audit**, not a measurement. Every line of the transcript
is a check whose output is recorded, rather than a sentence someone believed.
Re-running `run.sh` on a later date and diffing `verification.txt` is how a stale
claim gets caught.

## How to reproduce

```sh
bash evaluation/experiments/E7-availability/run.sh
```

About a minute. Needs `node`, `npm`, `curl`, `python3`, `git`, and network access
to `registry.npmjs.org`, `github.com` and `kanzo-tech.github.io`. `gh` (read-only)
is used for the GitHub API when present; without it those lines print
"(unavailable)" because the unauthenticated API rate-limits.

What the script audits: the npm packages (`@kanzo-tech/rudof-wasm`, `ui`, `ai`,
`theme`, and whether `metadata-form` is on npm) with versions, licences,
repositories and provenance attestations; what this repository depends on and what
is installed; what the engine attestation binds (repository, tag, workflow, commit)
against the git tag and npm `gitHead`; `npm audit signatures` in a throwaway
project; repository visibility and licence, and how far the checkout is ahead of
the public `main`; the playground's reachability, the workflow run it was deployed
from and the permalink codec; the one-command runner of each experiment; and the
licence of each vendored shape file and published package.

One claim is **not** covered by `run.sh`: that a permalink actually loads the
example in a browser. `run.sh` checks the codec and the deployment; it does not
drive a browser. See `data/README.md` and `results/availability.md` §2.

## Findings

Full detail in `results/availability.md`. What matters:

- The engine (`@kanzo-tech/rudof-wasm` **0.3.10**) and the design system
  (`@kanzo-tech/ui|ai|theme` **0.12.0**) are on npm, licensed (MIT OR Apache-2.0;
  MIT) and carry provenance attestations that verify with `npm audit signatures`.
  The engine's attestation, git tag and `gitHead` name the same commit,
  `ce4ed73490720f923564874380f1781de5997c0a`.
- `metadata-form` itself is **not on npm**. The public repository's `main`
  (`0dba201`, 2 Sep) is 54 commits behind the checkout the paper was measured on,
  and the deployed playground is built from it.
- The four published `@kanzo-tech` tarballs ship **no licence file**; the licence
  is only in `package.json` metadata.
