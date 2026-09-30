#!/usr/bin/env bash
# E3 — what the CURRENT engine emits (the one this library ships).
#
# Uses the @kanzo-tech/rudof-wasm installed in this repository's node_modules; no
# network. Two runs of the same data graph:
#   17  shapes.ttl         - author-written sh:message in en/es/ca (and one untagged)
#   18  shapes-nomsg.ttl   - no author message at all
# and two assertions, which fail the script if the claim stops being true:
#   (a) a result whose shape declares sh:message carries EXACTLY those messages
#       (SHACL 1.0 s2.1.5), and nothing the engine generated;
#   (b) a result whose shape declares none carries engine-generated messages in
#       en, es and ca (s3.6.2.7 permits generating them).
# run.sh regenerates raw/00-16 (the pinned 0.3.4/0.3.5 before/after, the upstream
# CLI, and the W3C suite count); this script regenerates raw/17-20.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
OUT="$HERE/results/raw"
mkdir -p "$OUT"

node "$HERE/runners/run-rudof.mjs" "$REPO" "$HERE/data/shapes.ttl"        "$HERE/data/data.ttl" > "$OUT/17-rudof-wasm-current-author-messages.json.txt"
node "$HERE/runners/run-rudof.mjs" "$REPO" "$HERE/data/shapes-nomsg.ttl"  "$HERE/data/data.ttl" > "$OUT/18-rudof-wasm-current-no-author-message.json.txt"

{
  echo "# E3 current-engine environment, captured $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "node:                 $(node --version)"
  echo "rudof-wasm installed: $(node -e "console.log(require('$REPO/node_modules/@kanzo-tech/rudof-wasm/package.json').version)")"
  echo "rudof-wasm published: $(npm view @kanzo-tech/rudof-wasm versions --json 2>/dev/null | tr -d ' \n' || echo '(offline)')"
  echo "rudof-wasm latest:    $(npm view @kanzo-tech/rudof-wasm dist-tags.latest 2>/dev/null || echo '(offline)')"
  echo "rudof-wasm publish times: $(npm view @kanzo-tech/rudof-wasm time --json 2>/dev/null | tr -d ' \n' || echo '(offline)')"
} > "$OUT/20-current-environment.txt"

node - "$OUT" > "$OUT/19-current-engine-assertions.txt" <<'JS'
const fs = require('node:fs');
const out = process.argv[2];
const load = (f) => {
  const t = fs.readFileSync(`${out}/${f}`, 'utf8');
  return { version: t.match(/rudof-wasm@(\S+)/)[1], report: JSON.parse(t.slice(t.indexOf('{'))) };
};
const a = load('17-rudof-wasm-current-author-messages.json.txt');
const b = load('18-rudof-wasm-current-no-author-message.json.txt');
const byPath = (r, p) => r.report.results.find((x) => x.path.value.endsWith(p));
const langs = (res) => res.message.map((m) => m.language || '(untagged)').sort();
const lines = [`# @kanzo-tech/rudof-wasm@${a.version}`];
let ok = true;
const check = (name, cond, detail) => { ok &&= cond; lines.push(`${cond ? 'OK  ' : 'FAIL'} ${name}: ${detail}`); };

const id = byPath(a, 'identifier'), iss = byPath(a, 'issued');
check('(a) three author messages, exactly', JSON.stringify(langs(id)) === JSON.stringify(['ca', 'en', 'es']),
  `identifier -> ${JSON.stringify(langs(id))} (${id.message.length} messages)`);
check('(a) no engine text next to the author messages', !id.message.some((m) => /not satisfied/i.test(m.value)),
  JSON.stringify(id.message.map((m) => m.value)));
check('(a) one untagged author message kept as is', iss.message.length === 1 && iss.message[0].language === '',
  JSON.stringify(iss.message));

for (const p of ['identifier', 'issued']) {
  const r = byPath(b, p);
  const l = langs(r);
  check(`(b) generated messages in en, es, ca (${p})`, ['ca', 'en', 'es'].every((x) => l.includes(x)) && !l.includes('(untagged)'),
    `${JSON.stringify(l)}: ${JSON.stringify(r.message.map((m) => `${m.language}:${m.value}`))}`);
}
lines.push(ok ? 'ALL HOLD' : 'A CLAIM FAILED');
console.log(lines.join('\n'));
process.exitCode = ok ? 0 : 1;
JS
cat "$OUT/19-current-engine-assertions.txt"
