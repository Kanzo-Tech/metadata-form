# E2 — DASH → SHACL 1.2 migration case study

See ../../EVIDENCE.md for the full spec.

## ⚠️ Blocker confirmed (checked 2026-08-26)

The "before" artefact is **not in this repository**. Verified:

- `git log --all --diff-filter=A` over the whole history: no DASH profile file.
- `git grep 'dash:'` across all revisions, `*.ttl`: no hits.
- No `dash:` prefix in any current example.

Both current profiles are already post-migration and say so in their header
comment ("Pure SHACL 1.2 + SHACL-UI (shui:) — no DASH"). The migration narrative
in `playground/examples/evidenze-health/shapes.ttl` (4 node shapes → 1, root
`sh:or` → `sh:if`/`sh:then`, DASH editors → `shui:editor`) is currently an
**undocumented claim**: we know it happened, but we cannot show the diff.

**Action, day 1:** locate the original DASH profile in the Evidenze/AIFOS repo or
wherever it was authored, and vendor it into `data/dash-original.ttl` with a
provenance note. Get permission to publish it if it is not already public.

**If it cannot be recovered:** do not fabricate a "before". Two honest fallbacks:

1. Reconstruct the DASH-equivalent of the *current* profile as a deliberate,
   clearly-labelled reference encoding ("what this profile would require in
   SHACL 1.0 + DASH"), and compare against that. Weaker, but defensible if
   labelled as a reconstruction rather than history.
2. Drop the historical framing and make §6 a *comparative encoding* study:
   same requirements, two encodings, measured. Loses the "real migration"
   credibility but keeps the technical content.

Decide which by Aug 28 — §6 depends on it.

## Numbers already available (post-migration side)

From `playground/examples/evidenze-health/shapes.ttl` (2026-08-26):

| Metric | Value |
|---|---|
| node shapes | 10 |
| property shapes (`sh:path`) | 48 |
| explicit `shui:editor` | 11 |
| `sh:if` conditionals | 3 |
| lang-tagged `sh:message` | 7 |

From `playground/examples/evidenze-dataspace/shapes.ttl`: 7 node shapes, 5
distinct `sh:targetClass`, **no duplicate target classes** — consistent with the
collapse having already happened.

Regenerate with `scripts/count.sh` (TODO: write it — every number in the paper
must be regenerable).
