#!/usr/bin/env bash
# E3 — does a lang-tagged sh:message survive to the consumer?
#
# Two things are measured here, and no third-party SHACL validator is involved
# in either:
#
#   1. rudof's own before/after. @kanzo-tech/rudof-wasm@0.3.4 flattened every
#      sh:message to a bare string at the wasm ABI boundary; 0.3.5 carries the
#      language tag. Both are installed side by side and given the same input.
#      The upstream rudof CLI is run too, as the same engine family seen from
#      the other side of the binding.
#   2. What the W3C SHACL conformance suites actually test, counted by parsing
#      every test graph with rdflib. rdflib is an RDF toolkit, not a SHACL
#      engine; it is here to read Turtle, nothing more.
#
# An earlier round of this experiment also ran four third-party SHACL products.
# It refuted our original draft claim, and those runs have been removed: the
# paper makes no claim about other implementations. See ../README.md.
#
#   ./run.sh              # install (if needed) + run everything
#   E3_WORK=~/e3 ./run.sh # keep the installs between runs
#
# Prerequisites: python3 + uv, node + npm, cargo, git, curl.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA="$HERE/data"
OUT="$HERE/results/raw"
WORK="${E3_WORK:-${TMPDIR:-/tmp}/e3-validators}"

# ---- pinned versions -------------------------------------------------------
RDFLIB_V=7.6.0            # pip; used only to parse the W3C test graphs
RUDOF_CLI_V=0.3.14        # crates.io rudof_cli (upstream, unforked)
RUDOF_WASM_BEFORE=0.3.4   # npm @kanzo-tech/rudof-wasm, published 2026-06-30
RUDOF_WASM_AFTER=0.3.5    # npm @kanzo-tech/rudof-wasm, published 2026-08-27

mkdir -p "$WORK" "$OUT"

say() { printf '\n=== %s\n' "$*" >&2; }

# ---- install ---------------------------------------------------------------
say "installing into $WORK"

if [ ! -x "$WORK/rdflib/.venv/bin/python" ]; then
  mkdir -p "$WORK/rdflib"
  uv venv -q "$WORK/rdflib/.venv"
  VIRTUAL_ENV="$WORK/rdflib/.venv" uv pip install -q "rdflib==$RDFLIB_V"
fi
PY="$WORK/rdflib/.venv/bin/python"

for d in rudof-before rudof-after; do [ -d "$WORK/$d" ] || { mkdir -p "$WORK/$d"; (cd "$WORK/$d" && npm init -y >/dev/null); }; done
[ -d "$WORK/rudof-before/node_modules/@kanzo-tech/rudof-wasm" ] || \
  (cd "$WORK/rudof-before" && npm install --silent "@kanzo-tech/rudof-wasm@$RUDOF_WASM_BEFORE")
[ -d "$WORK/rudof-after/node_modules/@kanzo-tech/rudof-wasm" ] || \
  (cd "$WORK/rudof-after" && npm install --silent "@kanzo-tech/rudof-wasm@$RUDOF_WASM_AFTER")

command -v rudof >/dev/null || cargo install --locked "rudof_cli@$RUDOF_CLI_V"

# ---- record the environment ------------------------------------------------
{
  echo "# E3 environment, captured $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "uname:        $(uname -srm)"
  echo "python:       $("$PY" --version 2>&1)"
  echo "rdflib:       $(VIRTUAL_ENV="$WORK/rdflib/.venv" uv pip list 2>/dev/null | grep -i '^rdflib' || true)"
  echo "node:         $(node --version)"
  echo "rudof (cli):  $(rudof --version 2>&1 | head -1)"
  echo "rudof-wasm before: $(node -e "console.log(require('$WORK/rudof-before/node_modules/@kanzo-tech/rudof-wasm/package.json').version)")"
  echo "rudof-wasm after:  $(node -e "console.log(require('$WORK/rudof-after/node_modules/@kanzo-tech/rudof-wasm/package.json').version)")"
  # Every version of our package that exists, so the writeup never has to
  # hand-type "the fix shipped in every release since 0.3.5".
  echo "rudof-wasm published: $(npm view @kanzo-tech/rudof-wasm versions --json 2>/dev/null | tr -d ' \n' || echo '(offline)')"
  echo "rudof-wasm latest:    $(npm view @kanzo-tech/rudof-wasm dist-tags.latest 2>/dev/null || echo '(offline)')"
  echo "rudof-wasm publish times: $(npm view @kanzo-tech/rudof-wasm time --json 2>/dev/null | tr -d ' \n' || echo '(offline)')"
} > "$OUT/00-environment.txt"

# ---- run -------------------------------------------------------------------
# Raw-file numbers 01-07 and 14 belonged to the removed third-party round and
# are deliberately left unused, so a reader of an older revision can see what
# went and where.

say "rudof CLI $RUDOF_CLI_V (upstream)"
rudof validate -M shacl -s "$DATA/shapes.ttl" -f turtle             "$DATA/data.ttl" > "$OUT/08-rudof-cli-compact.txt" 2>&1 || true
rudof validate -M shacl -s "$DATA/shapes.ttl" -f turtle -r turtle   "$DATA/data.ttl" > "$OUT/09-rudof-cli-turtle.ttl"  2>&1 || true
rudof validate -M shacl -s "$DATA/shapes.ttl" -f turtle -r details  "$DATA/data.ttl" > "$OUT/10-rudof-cli-details.txt" 2>&1 || true
rudof validate -M shacl -s "$DATA/shapes.ttl" -f turtle -r json     "$DATA/data.ttl" > "$OUT/11-rudof-cli-json.txt"    2>&1 || true

say "rudof-wasm $RUDOF_WASM_BEFORE (before the fix) and $RUDOF_WASM_AFTER (after)"
node "$HERE/runners/run-rudof.mjs" "$WORK/rudof-before" "$DATA/shapes.ttl" "$DATA/data.ttl" > "$OUT/12-rudof-wasm-0.3.4.json.txt" || true
node "$HERE/runners/run-rudof.mjs" "$WORK/rudof-after"  "$DATA/shapes.ttl" "$DATA/data.ttl" > "$OUT/13-rudof-wasm-0.3.5.json.txt" || true

say "probe: is the rudof-wasm message set stable across runs?"
{
  echo "# rudof-wasm 0.3.5: language tags on the ex:identifier result, 8 runs."
  echo "# (Result ORDER varies between runs; the runner sorts by path.)"
  for _ in $(seq 8); do
    node "$HERE/runners/run-rudof.mjs" "$WORK/rudof-after" "$DATA/shapes.ttl" "$DATA/data.ttl" \
      | "$PY" -c '
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
# Counted by parsing each test graph with rdflib, not by grep: the question is
# how many *subjects* carry two or more sh:message values, which is the case
# SHACL 1.0 s2.1.5 / 1.2 s3.1.5 exists to govern.
"$PY" - "$WORK/data-shapes" <<'PY' > "$OUT/16-w3c-test-suite-coverage.txt"
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

# The graphs rdflib cannot parse are excluded from the counts above, so grep
# each one for the literal string "sh:message" to show what the exclusion costs.
# Only core/misc/message-002.ttl matches; its three hits are one sh:message
# triple ("Test message"@en) and two mentions in the test's own rdfs:comment.
{
  echo "## graphs rdflib could not parse, excluded from the counts above"
  echo "## (literal 'sh:message' occurrences per file, grepped not parsed)"
  grep 'unparseable, skipped' "$OUT/16-w3c-test-suite-coverage.txt" | sed 's/.*skipped: //' | while read -r f; do
    for suite in data-shapes-test-suite shacl12-test-suite; do
      p="$WORK/data-shapes/$suite/tests/$f"
      if [ -f "$p" ]; then
        printf '   %2s  %s/%s\n' "$(grep -c 'sh:message' "$p" || true)" "$suite" "$f"
      fi
    done
  done
} >> "$OUT/16-w3c-test-suite-coverage.txt"

say "done — raw output in $OUT"
