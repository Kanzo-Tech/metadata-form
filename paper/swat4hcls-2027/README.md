# SWAT4HCLS 2027 — experiments

Evidence for our SWAT4HCLS 2027 submission (Basel, 1–4 Feb 2027; deadline
**14 Sep 2026**).

**The prose lives elsewhere:** `~/dev/kanzo/papers/swat4hcls2027/`
(`PLAN.md`, `OUTLINE.md`, `EVIDENCE.md`, `RELATED-WORK.md`), alongside
`papers/icds2026/`. This folder holds only what must be versioned with the code:
harnesses, vendored inputs, raw results, figures.

**Rule: every number in the paper must be regenerable by a script here.** No
hand-copied figures. A number that cannot be regenerated does not go in the paper.

| Experiment | Question |
|---|---|
| `E1-coverage/` | Does shape-driven authoring generalise beyond our own profile? |
| `E2-migration/` | What does SHACL 1.2 replace in a DASH-encoded profile? |
| `E3-multilingual/` | Do validators preserve `sh:message` language tags? |
| `E4-performance/` | Is per-edit conditional re-evaluation affordable in the browser? |
| `E5-errors-in-the-wild/` | How much of what is published would entry-time validation have caught? |
| `E6-llm-assist/` | Shape-constrained suggestion (one subsection, no quality claim). |

Each has a `README.md` with its spec, status and findings so far. Start with
`E1-coverage/` — it has vendored inputs and day-0 findings already.
