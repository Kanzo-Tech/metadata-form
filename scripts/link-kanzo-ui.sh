#!/usr/bin/env bash
# Local link to kanzo-ui while it is unpublished.
#
# `pnpm pack`, never `npm pack`: packages/ui declares `@kanzo-tech/theme: "workspace:*"`
# and only pnpm rewrites that range into a real version. An npm-packed tarball is
# uninstallable — kanzo-ui's own scripts/smoke-install.mjs asserts exactly this.
#
# Re-run after every change in kanzo-ui (pnpm build there first).
set -euo pipefail

KANZO="${KANZO_UI_DIR:-$(cd "$(dirname "$0")/../../kanzo-ui" && pwd)}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$HERE/vendor"

echo "packing from $KANZO"
rm -f "$OUT"/kanzo-tech-*.tgz
for pkg in theme ui ai; do
  (cd "$KANZO/packages/$pkg" && pnpm pack --pack-destination "$OUT" >/dev/null)
  echo "  ✓ @kanzo-tech/$pkg"
done
ls -1 "$OUT"/kanzo-tech-*.tgz

# Re-installing is NOT optional, and neither is dropping the old trees first.
# The tarball path and the version never change, so npm resolves the lockfile
# entry from its cache and a refreshed tarball is silently ignored — the symptom
# is a new export that typechecks in kanzo-ui and is "not exported" here.
# Re-install by naming the tarballs, and it has to be by name. A bare
# `npm install` resolves them from the lockfile entry, whose integrity hash still
# describes the PREVIOUS tarball, so npm serves the old one out of its cache and a
# refreshed build is silently ignored — the symptom is an export that typechecks
# in kanzo-ui and is "not exported" here. Deleting node_modules first does not
# help: the cache is keyed by that hash, not by what is on disk.
echo "reinstalling"
(cd "$HERE" && npm install --no-audit --no-fund --silent --save-dev \
  "$OUT/kanzo-tech-theme-0.0.0.tgz" "$OUT/kanzo-tech-ui-0.0.0.tgz" "$OUT/kanzo-tech-ai-0.0.0.tgz")
echo "done"
