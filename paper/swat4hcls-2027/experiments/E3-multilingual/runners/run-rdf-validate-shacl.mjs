// Run a shapes+data pair through rdf-validate-shacl, dumping BOTH the JS API
// surface (report.results[i].message) and the RDF report graph, because the
// SHACL spec only constrains the latter.
//
// Usage: node run-rdf-validate-shacl.mjs <dir-containing-node_modules> <shapes.ttl> <data.ttl>
//
// ESM resolves bare specifiers relative to THIS file, not the cwd, so every
// import is resolved explicitly against the install directory instead.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const [pkgRoot, shapesPath, dataPath] = process.argv.slice(2);
const require = createRequire(pathToFileURL(path.join(path.resolve(pkgRoot), 'package.json')));
const load = async (spec) => (await import(pathToFileURL(require.resolve(spec)).href)).default;

const rdf = await load('@zazuko/env-node');
const SHACLValidator = await load('rdf-validate-shacl');

const ver = require('rdf-validate-shacl/package.json').version;
const envVer = require('@zazuko/env-node/package.json').version;

const shapes = await rdf.dataset().import(rdf.fromFile(shapesPath));
const data = await rdf.dataset().import(rdf.fromFile(dataPath));
const report = await new SHACLValidator(shapes, { factory: rdf }).validate(data);

console.log(`### rdf-validate-shacl@${ver} (@zazuko/env-node@${envVer}, node ${process.version})`);
console.log('conforms:', report.conforms);

console.log('\n--- JS API surface: report.results[i].message ---');
const results = [...report.results].sort((a, b) => {
  const pv = (r) => (Array.isArray(r.path) ? r.path[0]?.value : r.path?.value) ?? '';
  return pv(a).localeCompare(pv(b));
});
for (const r of results) {
  const p = Array.isArray(r.path) ? r.path[0]?.value : r.path?.value;
  console.log('* path =', p ?? '(none)');
  console.log('  typeof message =', Array.isArray(r.message) ? `Array(${r.message.length})` : typeof r.message);
  const msgs = [].concat(r.message).map(
    (m) => `    { value: ${JSON.stringify(m.value)}, language: ${JSON.stringify(m.language)}, datatype: ${m.datatype?.value} }`,
  );
  msgs.sort();
  msgs.forEach((m) => console.log(m));
}

console.log('\n--- RDF report graph: sh:resultMessage triples ---');
const RM = 'http://www.w3.org/ns/shacl#resultMessage';
const rows = [];
for (const q of report.dataset) {
  if (q.predicate.value === RM) {
    rows.push(`    ${JSON.stringify(q.object.value)} | lang=${JSON.stringify(q.object.language)} | dt=${q.object.datatype.value}`);
  }
}
rows.sort();
rows.forEach((r) => console.log(r));
console.log('    total sh:resultMessage triples =', rows.length);
