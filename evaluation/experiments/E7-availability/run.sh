#!/usr/bin/env bash
# E7 — re-verify every availability claim in results/availability.md.
#
#   bash evaluation/experiments/E7-availability/run.sh
#
# Writes results/verification.txt. Everything here is a CHECK, not an assertion:
# each block prints what the npm registry, GitHub or the working tree actually
# says on the day it runs, so a claim that has gone stale shows up as a changed
# line rather than as a sentence nobody re-read. What cannot be checked from a
# shell (a permalink loading in a browser) is not here and is said so in the
# report.
#
# Needs: node, npm, curl, python3, git, and network access to registry.npmjs.org,
# github.com and kanzo-tech.github.io. `gh` (read-only) is used for the GitHub
# API when present, because the unauthenticated API rate-limits quickly; without
# it the API blocks print "(unavailable)".
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
EXP="$(cd "$HERE/.." && pwd)"
OUT="$HERE/results/verification.txt"
ORG="Kanzo-Tech"
PLAYGROUND="https://kanzo-tech.github.io/metadata-form/"

mkdir -p "$HERE/results"

# GitHub API through gh when it exists, else curl.
ghapi() {
  if command -v gh >/dev/null 2>&1; then gh api "$@" 2>/dev/null
  else curl -s "https://api.github.com/$1"; fi
}
installed() { node -e "try{console.log(require('$REPO/node_modules/$1/package.json').version)}catch(e){console.log('(not installed)')}"; }

ENGINE_V="$(installed @kanzo-tech/rudof-wasm)"
DS_V="$(installed @kanzo-tech/ui)"

{
echo "# E7 verification, run $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "# repo:     $REPO @ $(git -C "$REPO" rev-parse --short HEAD) ($(git -C "$REPO" rev-parse --abbrev-ref HEAD)), working tree: $(git -C "$REPO" status --short | grep -q . && echo DIRTY || echo clean)"
echo "# installed engine: @kanzo-tech/rudof-wasm@$ENGINE_V   design system: @kanzo-tech/ui@$DS_V"
echo

echo "## 1. npm — what is published under each name"
for pkg in @kanzo-tech/rudof-wasm @kanzo-tech/ui @kanzo-tech/ai @kanzo-tech/theme metadata-form @kanzo-tech/metadata-form; do
  v="$(npm view "$pkg" version 2>/dev/null)"
  if [ -n "$v" ]; then
    lic="$(npm view "$pkg" license 2>/dev/null)"
    repo="$(npm view "$pkg" repository.url 2>/dev/null)"
    when="$(npm view "$pkg" "time[$v]" 2>/dev/null)"
    att="$(npm view "$pkg@$v" dist.attestations.provenance.predicateType 2>/dev/null)"
    echo "   $pkg  latest=$v  published=$when  license=${lic:-?}"
    echo "       repository=${repo:-?}"
    echo "       provenance attestation on $v: ${att:-none}"
  else
    echo "   $pkg  NOT PUBLISHED (npm view -> 404)"
  fi
done
echo
echo "   @kanzo-tech/rudof-wasm versions: $(npm view @kanzo-tech/rudof-wasm versions --json 2>/dev/null | tr -d ' \n')"
for v in $(npm view @kanzo-tech/rudof-wasm versions --json 2>/dev/null | tr -d '[]" \n' | tr ',' ' '); do
  a="$(npm view "@kanzo-tech/rudof-wasm@$v" dist.attestations.provenance.predicateType 2>/dev/null)"
  echo "     $v  provenance: ${a:-none}"
done
echo

echo "## 2. what this repository depends on, and what is installed"
python3 - "$REPO" <<'PY'
import json, sys, os
repo = sys.argv[1]
p = json.load(open(os.path.join(repo, "package.json")))
print(f"   package.json: name={p['name']} version={p['version']} license={p.get('license')} private={p.get('private', False)}")
for section in ("dependencies", "peerDependencies", "devDependencies", "optionalDependencies"):
    for k, v in (p.get(section) or {}).items():
        if k.startswith("@kanzo-tech/"):
            try:
                inst = json.load(open(os.path.join(repo, "node_modules", k, "package.json")))["version"]
            except Exception:
                inst = "(not installed)"
            print(f"   {section:<21} {k:<24} {v:<10} installed {inst}")
lock = json.load(open(os.path.join(repo, "package-lock.json")))
for k, v in lock.get("packages", {}).items():
    if k.startswith("node_modules/@kanzo-tech/"):
        print(f"   lockfile {k[13:]:<24} {v.get('version')}  resolved={str(v.get('resolved'))[:70]}")
PY
echo "   vendored tarballs in the repo: $(ls "$REPO"/vendor/*.tgz 2>/dev/null | wc -l | tr -d ' ')  (0 = the design system comes from the registry)"
echo

echo "## 3. provenance — what the engine's attestation binds"
ATT="https://registry.npmjs.org/-/npm/v1/attestations/@kanzo-tech%2frudof-wasm@$ENGINE_V"
curl -s "$ATT" | python3 -c '
import json,sys,base64
d=json.load(sys.stdin)
for a in d.get("attestations",[]):
    p=json.loads(base64.b64decode(a["bundle"]["dsseEnvelope"]["payload"]))
    pred=p.get("predicate",{})
    if pred.get("buildDefinition"):
        w=pred["buildDefinition"]["externalParameters"]["workflow"]
        dep=pred["buildDefinition"].get("resolvedDependencies",[{}])[0]
        print("   subject:   ", p["subject"][0]["name"])
        print("   repository:", w["repository"])
        print("   ref:       ", w["ref"])
        print("   workflow:  ", w["path"])
        print("   commit:    ", dep.get("digest",{}).get("gitCommit"))
        print("   builder:   ", pred["runDetails"]["builder"]["id"])
' 2>/dev/null || echo "   (attestation fetch failed)"
echo "   gitHead in the npm metadata:  $(npm view "@kanzo-tech/rudof-wasm@$ENGINE_V" gitHead 2>/dev/null)"
echo "   tag on GitHub (peeled):       $(git ls-remote --tags "https://github.com/$ORG/rudof.git" "rudof-wasm-v$ENGINE_V*" 2>/dev/null | awk '{print $1, $2}' | tr '\n' ';')"
echo
echo "   A reviewer verifies with:"
echo "     npm i @kanzo-tech/rudof-wasm@$ENGINE_V @kanzo-tech/ui@$DS_V @kanzo-tech/ai@$DS_V @kanzo-tech/theme@$DS_V && npm audit signatures"
echo "   running it here, in a throwaway project:"
TMP="$(mktemp -d)"
( cd "$TMP" && npm init -y >/dev/null 2>&1 \
  && npm i "@kanzo-tech/rudof-wasm@$ENGINE_V" "@kanzo-tech/ui@$DS_V" "@kanzo-tech/ai@$DS_V" "@kanzo-tech/theme@$DS_V" \
       --no-audit --no-fund --legacy-peer-deps >/dev/null 2>&1 \
  && npm audit signatures 2>&1 | sed 's/^/     /' )
rm -rf "$TMP"
echo

echo "## 4. repositories, licence, and what the public branch contains"
for r in metadata-form rudof ui; do
  echo "   $ORG/$r: $(ghapi "repos/$ORG/$r" --jq '"visibility=\(.visibility) default_branch=\(.default_branch) license=\(.license.spdx_id) pushed_at=\(.pushed_at)"' 2>/dev/null || echo '(unavailable)')"
done
echo "   LICENSE file in this repo: $(head -1 "$REPO/LICENSE"), package.json license: $(python3 -c "import json;print(json.load(open('$REPO/package.json')).get('license'))")"
echo "   repository field of package.json: $(python3 -c "import json;print(json.load(open('$REPO/package.json')).get('repository'))")"
echo "   origin: $(git -C "$REPO" remote get-url origin)"
PUB_MAIN="$(git ls-remote "https://github.com/$ORG/metadata-form.git" refs/heads/main 2>/dev/null | cut -c1-40)"
echo "   public main is at:      ${PUB_MAIN:-(unavailable)}"
echo "   this checkout's HEAD:   $(git -C "$REPO" rev-parse HEAD)"
if [ -n "$PUB_MAIN" ] && git -C "$REPO" cat-file -e "$PUB_MAIN" 2>/dev/null; then
  echo "   commits in HEAD not in public main: $(git -C "$REPO" rev-list --count "$PUB_MAIN..HEAD")"
  git -C "$REPO" merge-base --is-ancestor "$PUB_MAIN" HEAD && echo "   public main is an ancestor of HEAD: yes"
fi
echo "   tags on the public repo: $(git ls-remote --tags "https://github.com/$ORG/metadata-form.git" 2>/dev/null | awk '{print $2}' | sed 's|refs/tags/||' | tr '\n' ' ')"
echo "   GitHub releases: $(ghapi "repos/$ORG/metadata-form/releases" --jq 'length' 2>/dev/null || echo '(unavailable)')"
echo

echo "## 5. playground deployment"
code="$(curl -s -o /dev/null -w '%{http_code}' "$PLAYGROUND")"
echo "   $PLAYGROUND -> HTTP $code"
echo "   deployed entry script: $(curl -s "$PLAYGROUND" | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1)"
echo "   pages source: $(ghapi "repos/$ORG/metadata-form/pages" --jq '"\(.source.branch) build_type=\(.build_type)"' 2>/dev/null || echo '(unavailable)')"
echo "   last deploy workflow runs: $(gh run list -R "$ORG/metadata-form" -w 'Deploy playground' -L 1 --json conclusion,headSha,createdAt --jq '.[] | "\(.conclusion) sha=\(.headSha[0:7]) at \(.createdAt)"' 2>/dev/null || echo '(unavailable)')"
echo "   SHACL-UI namespace strings in the deployed bundle (slash = Editor's Draft, hash = the older one):"
JS="$(curl -s "$PLAYGROUND" | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1)"
[ -n "$JS" ] && curl -s "${PLAYGROUND}${JS}" | grep -o 'shacl-ui[#/]' | sort | uniq -c | sed 's/^/     /'
echo "   the committed permalink (data/permalink-v1-covid.txt), decoded — the codec, not a browser:"
( cd "$REPO" && node -e '
const {decompressFromEncodedURIComponent:d}=require("lz-string");
const fs=require("fs");
const url=fs.readFileSync(process.argv[1],"utf8").trim();
const frag=url.slice(url.indexOf("#")+1);
const j=JSON.parse(d(frag));
console.log("     fragment chars:",frag.length,"| v:",j.v,"| example:",j.exampleId,"| shapes chars:",(j.shapesText||"").length,"| data chars:",(j.dataText||"").length);
' "$HERE/data/permalink-v1-covid.txt" 2>&1 | sed 's/^/  /' )
echo "   permalink versions this checkout can write:"
echo "     v: 2 markers in playground/src/lib/permalink.ts (this checkout): $(grep -cE 'v: 2' "$REPO/playground/src/lib/permalink.ts")"
echo "     v: 2 markers in the same file on public main:                    $(git -C "$REPO" show "${PUB_MAIN:-origin/main}:playground/src/lib/permalink.ts" 2>/dev/null | grep -cE 'v: 2')"
echo "   NOT verified here: that the permalink loads the example in a browser (needs one)."
echo

echo "## 6. can each experiment be re-run with ONE command?"
for d in "$EXP"/E*/; do
  name="$(basename "$d")"
  if   [ -f "$d/run.sh" ];   then how="run.sh"
  elif [ -f "$d/Makefile" ]; then how="Makefile (make)"
  elif compgen -G "$d"'*.harness.ts' >/dev/null; then how="vitest harness only (no wrapper)"
  else how="NO single command"; fi
  py=$(ls "$d"/*.py 2>/dev/null | wc -l | tr -d ' ')
  extra=""; [ -f "$d/run-current.sh" ] && extra=" + run-current.sh"
  echo "   $name: $how$extra   (python steps: $py)"
done
echo

echo "## 7. licences of what the paper describes"
echo "   metadata-form:            $(python3 -c "import json;print(json.load(open('$REPO/package.json'))['license'])")"
for pkg in @kanzo-tech/rudof-wasm @kanzo-tech/ui @kanzo-tech/ai @kanzo-tech/theme; do
  v="$(npm view "$pkg" version 2>/dev/null)"
  files="$(npm pack "$pkg@$v" --dry-run --json 2>/dev/null | python3 -c 'import json,sys;d=json.load(sys.stdin)[0];l=[f["path"] for f in d["files"] if "LICEN" in f["path"].upper()];print(len(d["files"]),"files;","licence files: "+(", ".join(l) if l else "none"))' 2>/dev/null)"
  echo "   $pkg@$v: license field = $(npm view "$pkg" license 2>/dev/null); tarball: ${files:-(unavailable)}"
done
echo "   vendored shapes, one PROVENANCE.md each:"
for f in $(cd "$EXP" && find . -name PROVENANCE.md | sort); do
  lic=$(grep -m1 -i '^- Licence\|^| Licence' "$EXP/${f#./}" | sed 's/.*Licence[:*| ]*//' | cut -c1-60)
  echo "     ${f#./}  ->  ${lic:-<see file>}"
done

echo
echo "# end"
} 2>&1 | tee "$OUT"

echo
echo "[E7] done → $OUT"
