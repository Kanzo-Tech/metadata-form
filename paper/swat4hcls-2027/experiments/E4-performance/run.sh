#!/usr/bin/env bash
# E4 — regenerate every performance number in results/ from scratch.
#
#   bash paper/swat4hcls-2027/experiments/E4-performance/run.sh
#
# Two steps, in order:
#   1. bundle-delta.mjs — three Vite production builds → results/bundle.json
#   2. perf.harness.ts  — engine + per-edit + cold-start timings, reads
#                         bundle.json → results/perf.json + results/perf.md
#
# Nothing in results/ is hand-edited. Close other work first: the timings are
# wall-clock and a busy machine will show up in the p95.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../../.." && pwd)"

echo "[E4] 1/2 bundle delta (three Vite builds)…"
(cd "$HERE" && node bundle-delta.mjs)

echo "[E4] 2/2 engine, per-edit and cold-start timings…"
(cd "$REPO" && npx vitest run \
  --config paper/swat4hcls-2027/experiments/vitest.config.ts \
  E4-performance)

echo "[E4] done → $HERE/results/perf.md"
