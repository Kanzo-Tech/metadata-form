// Run a shapes+data pair through a pinned @kanzo-tech/rudof-wasm build.
// Usage: node run-rudof.mjs <dir-containing-node_modules> <shapes.ttl> <data.ttl>
import fs from 'node:fs';
import path from 'node:path';

const [pkgRoot, shapesPath, dataPath] = process.argv.slice(2);
const modDir = path.join(pkgRoot, 'node_modules/@kanzo-tech/rudof-wasm');
const pkg = JSON.parse(fs.readFileSync(path.join(modDir, 'package.json'), 'utf8'));
const mod = await import(path.join(modDir, 'rudof_wasm.js'));
mod.initSync({ module: fs.readFileSync(path.join(modDir, 'rudof_wasm_bg.wasm')) });

const s = new mod.Session();
s.loadShapes(fs.readFileSync(shapesPath, 'utf8'), 'text/turtle');
s.loadData(fs.readFileSync(dataPath, 'utf8'), 'text/turtle');
const report = s.validate();

console.log(`### @kanzo-tech/rudof-wasm@${pkg.version} (node ${process.version})`);
// Sort results by path so the dump is stable: rudof's result ORDER is not.
report.results.sort((a, b) => (a.path?.value ?? '').localeCompare(b.path?.value ?? ''));
console.log(JSON.stringify(report, null, 2));
