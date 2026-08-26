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
