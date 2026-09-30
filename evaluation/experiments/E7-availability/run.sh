#!/usr/bin/env bash
# E7 — re-verify every availability claim in results/availability.md.
#
#   bash evaluation/experiments/E7-availability/run.sh
#
# Writes results/verification.txt. Everything here is a CHECK, not an assertion:
# each block prints what the registry, the GitHub API or the tree actually says
# on the day it runs, so a claim that has gone stale shows up as a changed line
# rather than as a sentence nobody re-read.
#
# Needs: node, npm, curl, python3, git, and network access to registry.npmjs.org
# and api.github.com. The fork checks need ~/dev/kanzo/keasy/rudof-fork (override
# with $RUDOF_FORK); they are skipped, loudly, if it is not there.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
EXP="$(cd "$HERE/.." && pwd)"
FORK="${RUDOF_FORK:-$(cd "$REPO/../rudof-fork" 2>/dev/null && pwd || true)}"
OUT="$HERE/results/verification.txt"

mkdir -p "$HERE/results"

{
echo "# E7 verification, run $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "# repo:     $REPO @ $(git -C "$REPO" rev-parse --short HEAD) ($(git -C "$REPO" rev-parse --abbrev-ref HEAD))"
echo "# fork:     ${FORK:-<not found>}"
echo

echo "## 1. npm packages"
for pkg in @kanzo-tech/rudof-wasm @kanzo-tech/ui @kanzo-tech/ai @kanzo-tech/theme metadata-form; do
  v="$(npm view "$pkg" version 2>/dev/null)"
  if [ -n "$v" ]; then echo "   $pkg  latest=$v"; else echo "   $pkg  NOT PUBLISHED (404)"; fi
done
echo
echo "   @kanzo-tech/rudof-wasm versions: $(npm view @kanzo-tech/rudof-wasm versions --json 2>/dev/null | tr -d ' \n')"
for v in 0.3.4 0.3.5; do
  echo "   0.$v dist.attestations:" | sed "s/0\.$v/$v/"
  npm view "@kanzo-tech/rudof-wasm@$v" dist.attestations --json 2>/dev/null | sed 's/^/     /'
done
echo

echo "## 2. provenance — what the attestation actually binds"
curl -s "https://registry.npmjs.org/-/npm/v1/attestations/@kanzo-tech%2frudof-wasm@0.3.5" \
| python3 -c '
import json,sys,base64
d=json.load(sys.stdin)
for a in d.get("attestations",[]):
    p=json.loads(base64.b64decode(a["bundle"]["dsseEnvelope"]["payload"]))
    pred=p.get("predicate",{})
    if pred.get("buildDefinition"):
        w=pred["buildDefinition"]["externalParameters"]["workflow"]
        print("   subject:   ", p["subject"][0]["name"])
        print("   repository:", w["repository"])
        print("   ref:       ", w["ref"])
        print("   workflow:  ", w["path"])
        print("   builder:   ", pred["runDetails"]["builder"]["id"])
' 2>/dev/null || echo "   (attestation fetch failed)"
echo
echo "   A reviewer verifies it with:"
echo "     npm i @kanzo-tech/rudof-wasm@0.3.5 && npm audit signatures"
echo "   running it here, in a throwaway project:"
TMP="$(mktemp -d)"
( cd "$TMP" && npm init -y >/dev/null 2>&1 \
  && npm i @kanzo-tech/rudof-wasm@0.3.5 --no-audit --no-fund >/dev/null 2>&1 \
  && npm audit signatures 2>&1 | sed 's/^/     /' )
rm -rf "$TMP"
echo

echo "## 3. the tag the attestation names, and the commit it resolves to"
if [ -n "$FORK" ]; then
  git -C "$FORK" ls-remote --tags origin 2>/dev/null | grep 'rudof-wasm-v' | sed 's/^/   /'
else
  echo "   SKIPPED — fork not found"
fi
echo

echo "## 4. playground deployment"
code="$(curl -s -o /dev/null -w '%{http_code}' https://kanzo-tech.github.io/metadata-form/)"
echo "   https://kanzo-tech.github.io/metadata-form/ -> HTTP $code"
echo "   permalink codec on origin/main (what the deployment is built from):"
git -C "$REPO" show origin/main:playground/src/lib/permalink.ts 2>/dev/null \
  | grep -cE '\bv: 2\b|"preset"' | sed 's/^/     v2 markers: /'
echo "   permalink codec on this branch:"
grep -cE '\bv: 2\b' "$REPO/playground/src/lib/permalink.ts" | sed 's/^/     v2 markers: /'
echo "   fragments this repo can produce for health-dcat-ap / covid:"
( cd "$REPO" && node -e '
const {compressToEncodedURIComponent:z}=require("lz-string");
const fs=require("fs");
const sh=fs.readFileSync("examples/health-dcat-ap/shapes.ttl","utf8");
const dt=fs.readFileSync("examples/health-dcat-ap/sample.ttl","utf8");
const v2=z(JSON.stringify({v:2,ex:"health-dcat-ap",preset:"covid"}));
const v1=z(JSON.stringify({v:1,exampleId:"health-dcat-ap",shapesText:sh,dataText:dt,options:{validateOn:"change"}}));
console.log("     v2 by-reference:", v2.length, "chars ->", v2);
console.log("     v1 embedded:    ", v1.length, "chars (not printed)");
' 2>&1 | sed 's/^/  /' )
echo

echo "## 5. fork divergence from real upstream (GitHub API — authoritative)"
BASE=a756cee4ce82b5930524b0847491c88b0cf88795
curl -s "https://api.github.com/repos/rudof-project/rudof/compare/$BASE...Kanzo-Tech:rudof:arch/wasm-validator" \
| python3 -c 'import json,sys;d=json.load(sys.stdin);print("   base..fork:    ahead_by",d.get("ahead_by"),"files",len(d.get("files",[])))' 2>/dev/null
curl -s "https://api.github.com/repos/rudof-project/rudof/compare/master...Kanzo-Tech:rudof:arch/wasm-validator" \
| python3 -c 'import json,sys;d=json.load(sys.stdin);print("   master..fork:  status",d.get("status"),"ahead_by",d.get("ahead_by"),"behind_by",d.get("behind_by"))' 2>/dev/null
if [ -n "$FORK" ]; then
  echo "   local clone is shallow: $([ -f "$FORK/.git/shallow" ] && echo YES || echo no)"
  echo "   (a shallow clone makes \`git rev-list --left-right --count\` overcount the"
  echo "    'behind' side by every commit before the graft point — use the API above)"
  echo "   local left-right count (WRONG if shallow): $(git -C "$FORK" rev-list --left-right --count HEAD...rudof-upstream/master 2>/dev/null || echo 'n/a')"
  echo "   fork working tree:"
  git -C "$FORK" status --short 2>/dev/null | sed 's/^/     /' || true
  git -C "$FORK" status --short 2>/dev/null | grep -q . && echo "     ^^ DIRTY — a DOI cannot pin this" || echo "     clean"
  echo "   is sh:if support upstream? \`IfConstraintComponent\` in rudof-upstream/master:"
  n=$(git -C "$FORK" grep -c "IfConstraintComponent" rudof-upstream/master -- shacl rudof_rdf 2>/dev/null | wc -l | tr -d ' ')
  echo "     hits: $n  (0 = fork-only)"
else
  echo "   SKIPPED — fork not found"
fi
echo

echo "## 6. can each experiment be re-run with ONE command?"
for d in "$EXP"/E*/; do
  name="$(basename "$d")"
  if   [ -f "$d/run.sh" ];   then how="run.sh"
  elif [ -f "$d/Makefile" ]; then how="Makefile (make)"
  elif compgen -G "$d"'*.harness.ts' >/dev/null; then how="vitest harness only (no wrapper)"
  else how="NO single command"; fi
  py=$(ls "$d"/*.py 2>/dev/null | wc -l | tr -d ' ')
  echo "   $name: $how   (python steps: $py)"
done
echo

echo "## 7. licences"
echo "   metadata-form:        $(python3 -c "import json;print(json.load(open('$REPO/package.json'))['license'])")"
if [ -n "$FORK" ]; then
  echo "   rudof (fork + upstream): $(grep -m1 '^license' "$FORK/Cargo.toml" | cut -d'"' -f2)"
  echo "   rudof LICENSE files:  $(ls "$FORK" | grep -i '^LICENSE' | tr '\n' ' ')"
fi
echo "   @kanzo-tech/rudof-wasm on npm: $(npm view @kanzo-tech/rudof-wasm license 2>/dev/null)"
echo "   vendored shapes, one PROVENANCE.md each:"
for f in $(cd "$EXP" && find . -name PROVENANCE.md | sort); do
  lic=$(grep -m1 -i '^- Licence\|^| Licence' "$EXP/${f#./}" | sed 's/.*Licence[:*| ]*//' | cut -c1-60)
  echo "     ${f#./}  ->  ${lic:-<see file>}"
done
echo
echo "   vendored @kanzo-tech tarballs in the repo (NOT the npm versions):"
for t in "$REPO"/vendor/*.tgz; do
  echo "     $(basename "$t")  sha256=$(shasum -a 256 "$t" | cut -c1-16)…  tracked=$(git -C "$REPO" ls-files --error-unmatch "vendor/$(basename "$t")" >/dev/null 2>&1 && echo yes || echo no)"
done

echo
echo "# end"
} 2>&1 | tee "$OUT"

echo
echo "[E7] done → $OUT"
