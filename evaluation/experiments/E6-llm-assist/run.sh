#!/usr/bin/env bash
# E6 — regenerate results/assist.json + results/assist.md.
#
#   bash evaluation/experiments/E6-llm-assist/run.sh
#
# No API key and no network: the harness calls no model. It reads the two bundled
# profiles through the real rudof wasm engine and exercises the commit path
# directly. Nothing in results/ is hand-edited.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"

cd "$REPO"
npx vitest run \
  --config evaluation/experiments/vitest.config.ts \
  E6-llm-assist

echo "[E6] done → $HERE/results/assist.md"
