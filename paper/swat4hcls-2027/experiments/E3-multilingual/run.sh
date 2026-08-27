#!/usr/bin/env bash
# E3 — does a lang-tagged sh:message survive to the consumer?
#
# Installs six pinned SHACL validators into $E3_WORK (default: a temp dir),
# runs data/shapes.ttl + data/data.ttl through each, and writes every raw
# output under results/raw/. Re-runnable; installs are skipped if present.
#
#   ./run.sh              # install (if needed) + run everything
#   E3_WORK=~/e3 ./run.sh # keep the installs between runs
#
# Prerequisites: python3 + uv, node + npm, java, brew, curl, cargo.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA="$HERE/data"
OUT="$HERE/results/raw"
WORK="${E3_WORK:-${TMPDIR:-/tmp}/e3-validators}"

# ---- pinned versions -------------------------------------------------------
PYSHACL_V=0.40.1          # pip; pulls rdflib 7.6.0
JENA_V=6.2.0              # brew install jena
RVS_V=0.6.5               # npm rdf-validate-shacl
ZAZUKO_ENV_V=3.1.0        # npm @zazuko/env-node (rdf-validate-shacl's factory)
TOPBRAID_V=1.4.4          # Maven Central org.topbraid:shacl (bin dist)
TOPBRAID_SHA256=f382585dea378cda596068db239f89c26b339071c91cfdea720f9cd116128c62
RUDOF_CLI_V=0.3.14        # crates.io rudof_cli (upstream, unforked)
RUDOF_WASM_BEFORE=0.3.4   # npm @kanzo-tech/rudof-wasm, published 2026-06-30
RUDOF_WASM_AFTER=0.3.5    # npm @kanzo-tech/rudof-wasm, published 2026-08-27

mkdir -p "$WORK" "$OUT"

say() { printf '\n=== %s\n' "$*" >&2; }

# ---- install ---------------------------------------------------------------
say "installing into $WORK"

if [ ! -x "$WORK/pyshacl/.venv/bin/pyshacl" ]; then
  mkdir -p "$WORK/pyshacl"
  uv venv -q "$WORK/pyshacl/.venv"
  VIRTUAL_ENV="$WORK/pyshacl/.venv" uv pip install -q "pyshacl==$PYSHACL_V"
fi
PYSHACL="$WORK/pyshacl/.venv/bin/pyshacl"

command -v shacl >/dev/null || brew install jena

for d in js rudof-before rudof-after; do [ -d "$WORK/$d" ] || { mkdir -p "$WORK/$d"; (cd "$WORK/$d" && npm init -y >/dev/null); }; done
[ -d "$WORK/js/node_modules/rdf-validate-shacl" ] || \
  (cd "$WORK/js" && npm install --silent "rdf-validate-shacl@$RVS_V" "@zazuko/env-node@$ZAZUKO_ENV_V")
[ -d "$WORK/rudof-before/node_modules/@kanzo-tech/rudof-wasm" ] || \
  (cd "$WORK/rudof-before" && npm install --silent "@kanzo-tech/rudof-wasm@$RUDOF_WASM_BEFORE")
[ -d "$WORK/rudof-after/node_modules/@kanzo-tech/rudof-wasm" ] || \
  (cd "$WORK/rudof-after" && npm install --silent "@kanzo-tech/rudof-wasm@$RUDOF_WASM_AFTER")

TB="$WORK/topbraid/shacl-$TOPBRAID_V"
if [ ! -d "$TB" ]; then
  mkdir -p "$WORK/topbraid"
  curl -sSL -o "$WORK/topbraid/shacl.zip" \
    "https://repo1.maven.org/maven2/org/topbraid/shacl/$TOPBRAID_V/shacl-$TOPBRAID_V-bin.zip"
  echo "$TOPBRAID_SHA256  $WORK/topbraid/shacl.zip" | shasum -a 256 -c -
  unzip -q -o "$WORK/topbraid/shacl.zip" -d "$WORK/topbraid"
  chmod +x "$TB"/bin/*.sh
fi

command -v rudof >/dev/null || cargo install --locked "rudof_cli@$RUDOF_CLI_V"

# ---- record the environment ------------------------------------------------
{
  echo "# E3 environment, captured $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "uname:        $(uname -srm)"
  echo "python:       $(python3 --version 2>&1)"
  echo "pySHACL:      $("$PYSHACL" --version 2>&1)"
  echo "rdflib:       $(VIRTUAL_ENV="$WORK/pyshacl/.venv" uv pip list 2>/dev/null | grep -i '^rdflib' || true)"
  echo "node:         $(node --version)"
  echo "java:         $(java -version 2>&1 | head -1)"
  echo "jena shacl:   $(shacl --version 2>&1 | head -1)"
  echo "topbraid:     org.topbraid:shacl:$TOPBRAID_V (sha256 $TOPBRAID_SHA256)"
  echo "rdf-validate-shacl: $(node -e "console.log(require('$WORK/js/node_modules/rdf-validate-shacl/package.json').version)")"
  echo "rudof (cli):  $(rudof --version 2>&1 | head -1)"
  echo "rudof-wasm before: $(node -e "console.log(require('$WORK/rudof-before/node_modules/@kanzo-tech/rudof-wasm/package.json').version)")"
  echo "rudof-wasm after:  $(node -e "console.log(require('$WORK/rudof-after/node_modules/@kanzo-tech/rudof-wasm/package.json').version)")"
} > "$OUT/00-environment.txt"

# ---- run -------------------------------------------------------------------
say "pySHACL $PYSHACL_V"
"$PYSHACL" -s "$DATA/shapes.ttl" -df turtle -f turtle "$DATA/data.ttl" > "$OUT/01-pyshacl-turtle.ttl" || true
"$PYSHACL" -s "$DATA/shapes.ttl" -df turtle -f human  "$DATA/data.ttl" > "$OUT/02-pyshacl-human.txt" || true
"$PYSHACL" -s "$DATA/shapes.ttl" -df turtle -f table  "$DATA/data.ttl" > "$OUT/03-pyshacl-table.txt" || true

say "Apache Jena SHACL $JENA_V"
shacl validate        --shapes "$DATA/shapes.ttl" --data "$DATA/data.ttl" > "$OUT/04-jena-report.ttl" || true
shacl validate --text --shapes "$DATA/shapes.ttl" --data "$DATA/data.ttl" > "$OUT/05-jena-text.txt"   || true

say "TopBraid SHACL API $TOPBRAID_V"
(cd "$TB" && SHACLROOT="$TB" ./bin/shaclvalidate.sh -datafile "$DATA/data.ttl" -shapesfile "$DATA/shapes.ttl") \
  > "$OUT/06-topbraid-report.ttl" 2>/dev/null || true   # exits 1 when the data does not conform

say "rdf-validate-shacl $RVS_V"
node "$HERE/runners/run-rdf-validate-shacl.mjs" "$WORK/js" "$DATA/shapes.ttl" "$DATA/data.ttl" \
  > "$OUT/07-rdf-validate-shacl.txt" || true

say "rudof CLI $RUDOF_CLI_V (upstream)"
rudof validate -M shacl -s "$DATA/shapes.ttl" -f turtle             "$DATA/data.ttl" > "$OUT/08-rudof-cli-compact.txt" 2>&1 || true
rudof validate -M shacl -s "$DATA/shapes.ttl" -f turtle -r turtle   "$DATA/data.ttl" > "$OUT/09-rudof-cli-turtle.ttl"  2>&1 || true
rudof validate -M shacl -s "$DATA/shapes.ttl" -f turtle -r details  "$DATA/data.ttl" > "$OUT/10-rudof-cli-details.txt" 2>&1 || true
rudof validate -M shacl -s "$DATA/shapes.ttl" -f turtle -r json     "$DATA/data.ttl" > "$OUT/11-rudof-cli-json.txt"    2>&1 || true

say "rudof-wasm $RUDOF_WASM_BEFORE (before the fix) and $RUDOF_WASM_AFTER (after)"
node "$HERE/runners/run-rudof.mjs" "$WORK/rudof-before" "$DATA/shapes.ttl" "$DATA/data.ttl" > "$OUT/12-rudof-wasm-0.3.4.json.txt" || true
node "$HERE/runners/run-rudof.mjs" "$WORK/rudof-after"  "$DATA/shapes.ttl" "$DATA/data.ttl" > "$OUT/13-rudof-wasm-0.3.5.json.txt" || true

# ---- probe: on what basis does a one-message renderer choose? ---------------
# pySHACL's `table` renderer emits a single message. Run it N times on three
# different shapes graphs to show the choice is neither locale-aware, nor
# document order, nor stable between runs.
say "probe: pySHACL table selection basis, 12 runs each"
{
  echo "# Which single message does pyshacl -f table print? 12 runs per input."
  echo
  for probe in "shapes:data" "probe-no-en:probe-data" "probe-en-last:probe-data"; do
    sh="${probe%%:*}"; dt="${probe##*:}"
    echo "## shapes=$sh.ttl data=$dt.ttl"
    for _ in $(seq 12); do
      # The Message column of the MinCount row. The table wraps long cells, and
      # rejoining the fragments loses the space at each wrap point — read WHICH
      # language was printed, not the exact string.
      "$PYSHACL" -s "$DATA/$sh.ttl" -df turtle -f table "$DATA/$dt.ttl" 2>/dev/null \
        | python3 -c '
import sys
rows, cur = [], None
for line in sys.stdin:
    if not line.startswith("|"): continue
    cols = [c.strip() for c in line.strip().strip("|").split("|")]
    if len(cols) < 6: continue
    if cols[0].rstrip(".").isdigit(): rows.append(cur := [""] * len(cols))
    if cur is not None: cur[:] = [a + b for a, b in zip(cur, cols)]
print("  " + (rows[0][4] if rows else "(no row)"))
' || true
    done
    echo
  done
} > "$OUT/14-probe-pyshacl-table-selection.txt"

say "probe: is the rudof-wasm message set stable across runs?"
{
  echo "# rudof-wasm 0.3.5: language tags on the ex:identifier result, 8 runs."
  echo "# (Result ORDER varies between runs; the runner sorts by path.)"
  for _ in $(seq 8); do
    node "$HERE/runners/run-rudof.mjs" "$WORK/rudof-after" "$DATA/shapes.ttl" "$DATA/data.ttl" \
      | python3 -c '
import sys, json
t = sys.stdin.read()
j = json.loads(t[t.index("{"):])
r = next(r for r in j["results"] if r["path"]["value"].endswith("identifier"))
print("  " + json.dumps(sorted(m["language"] or "(untagged)" for m in r["message"])))
' || true
  done
} > "$OUT/15-probe-rudof-stability.txt"

# ---- W3C conformance-suite coverage ----------------------------------------
say "W3C SHACL test suite: how many tests exercise multilingual sh:message?"
if [ ! -d "$WORK/data-shapes" ]; then
  git clone --depth 1 -q https://github.com/w3c/data-shapes.git "$WORK/data-shapes"
fi
# Counted by parsing each test graph with rdflib (from the pySHACL venv), not
# by grep: the question is how many *subjects* carry two or more sh:message
# values, which is the case SHACL 1.0 s2.1.5 / 1.2 s3.1.5 exists to govern.
"$WORK/pyshacl/.venv/bin/python" - "$WORK/data-shapes" <<'PY' > "$OUT/16-w3c-test-suite-coverage.txt"
import pathlib, subprocess, sys
from collections import Counter
from rdflib import Graph, URIRef

root = pathlib.Path(sys.argv[1])
SH_MESSAGE = URIRef("http://www.w3.org/ns/shacl#message")
head = subprocess.run(["git", "-C", str(root), "log", "-1", "--format=%H %ad"],
                      capture_output=True, text=True).stdout.strip()
print(f"# w3c/data-shapes @ {head}")
print("# Parsed with rdflib; counts are over SUBJECTS, not lines.\n")

for suite in ("data-shapes-test-suite", "shacl12-test-suite"):
    files = sorted((root / suite / "tests").rglob("*.ttl"))
    n_multi = n_tagged = n_multilingual = 0
    detail = []
    for f in files:
        g = Graph()
        try:
            g.parse(f, format="turtle")
        except Exception:
            # shacl12-test-suite/core/misc/message-002.ttl uses RDF 1.2 reifier
            # syntax ({| ... |}) that rdflib 7.6.0 cannot parse. Read by hand:
            # one sh:message, one language (@en). Does not change the totals.
            print(f"   ! unparseable, skipped: {f.relative_to(root / suite / 'tests')}")
            continue
        per_subject = Counter(s for s, _, _ in g.triples((None, SH_MESSAGE, None)))
        for subj, count in per_subject.items():
            langs = {o.language for o in g.objects(subj, SH_MESSAGE)}
            tagged = {l for l in langs if l}
            if count > 1: n_multi += 1
            if tagged: n_tagged += 1
            if len(tagged) > 1: n_multilingual += 1
            detail.append(f"     {f.relative_to(root / suite / 'tests')}: "
                          f"{count} sh:message, languages={sorted(l or '(untagged)' for l in langs)}")
    print(f"## {suite}")
    print(f"   .ttl test files parsed:                        {len(files)}")
    print(f"   subjects carrying >=1 sh:message:              {len(detail)}")
    print(f"   subjects carrying >1 sh:message value:         {n_multi}")
    print(f"   subjects with a lang-TAGGED sh:message:        {n_tagged}")
    print(f"   subjects with TWO OR MORE distinct languages:  {n_multilingual}   <-- the multilingual case")
    print("   every sh:message-bearing subject in the suite:")
    for d in sorted(detail):
        print(d)
    print()
PY

say "done — raw output in $OUT"
