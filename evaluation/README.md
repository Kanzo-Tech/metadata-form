# Evaluation

The experiments behind our SWAT4HCLS 2027 submission: harnesses, vendored inputs
and raw results. The paper's prose lives outside this repository
(`~/dev/kanzo/papers/swat4hcls2027/`); this folder holds only what must be
versioned with the code.

**Rule: every number in the paper must be regenerable by a script here.** No
hand-copied figures. A number that cannot be regenerated does not go in the paper.

| Experiment | Question |
|---|---|
| `experiments/E1-coverage/` | Does shape-driven authoring generalise beyond our own profile? |
| `experiments/E2-migration/` | What does SHACL 1.2 replace in a DASH-encoded profile? |
| `experiments/E3-multilingual/` | Do validators preserve `sh:message` language tags? |
| `experiments/E4-performance/` | Is per-edit conditional re-evaluation affordable in the browser? |
| `experiments/E5-errors-in-the-wild/` | How much of what is published would entry-time validation have caught? |
| `experiments/E6-llm-assist/` | Shape-constrained suggestion (one subsection, no quality claim). |
| `experiments/E7-availability/` | Do the artefacts the paper describes exist, licensed and findable at a fixed version? |

Each has a `README.md` with its spec, how to run it, its status and findings.
The harnesses run under their own config, not `npm test`:

```sh
npx vitest run --config evaluation/experiments/vitest.config.ts
```

Their fixtures are the shared `examples/` at the repository root.
