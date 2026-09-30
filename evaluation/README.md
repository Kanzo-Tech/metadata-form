# Evaluation

The two experiments behind our SWAT4HCLS 2027 submission: harnesses, vendored
inputs and raw results. The paper's prose lives outside this repository
(`~/dev/kanzo/papers/swat4hcls2027/`); this folder holds only what must be
versioned with the code.

**Rule: every number in the paper must be regenerable by a script here.** No
hand-copied figures. A number that cannot be regenerated does not go in the paper.

| Experiment | Question |
|---|---|
| [`coverage/`](coverage/README.md) | Does shape-driven authoring generalise beyond our own profile? Nine externally authored SHACL profiles, measured statically. |
| [`published-errors/`](published-errors/README.md) | How much of what is published would entry-time validation have caught? A sample of real health dataset records, validated against the profile they claim. |

Each folder has a `README.md` with its method, findings and status; its
`results/` are committed and are what the paper's figures read.

## Running

The harnesses run under their own vitest config, not `npm test`, and take
minutes rather than seconds:

```sh
# coverage: writes coverage/results/coverage.{json,md}
npx vitest run --config evaluation/vitest.config.ts evaluation/coverage/coverage.harness.ts

# published errors: writes published-errors/results/form-fields.json, the form's
# field inventory (offline). The rest of that pipeline is Python and, from
# harvest.py, needs the network; see its README for the order.
npx vitest run --config evaluation/vitest.config.ts evaluation/published-errors
```

Their fixtures are the shared `examples/` at the repository root and the profiles
vendored under each experiment's `data/`.
