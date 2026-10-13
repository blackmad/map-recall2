// Usage: node scripts/landmarks/backlog-sync-spec.mjs <id>  -- replaces the manualCatalogue entry with scripts/landmarks/<id>-spec.json
import fs from 'node:fs';
const id = process.argv[2];
const spec = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-spec.json`, 'utf8'));
const file = 'src/canalRecall/landmarks/manualCatalogue.json';
const cat = JSON.parse(fs.readFileSync(file, 'utf8'));
const i = cat.findIndex(x => x.id === id);
if (i < 0) throw Error('not installed: ' + id);
const before = JSON.stringify(cat[i]);
cat[i] = spec;
if (before === JSON.stringify(spec)) { console.log('unchanged', id); process.exit(0); }
// keep the file's existing formatting: only re-serialise the one entry
const txt = fs.readFileSync(file, 'utf8');
const old = JSON.stringify(JSON.parse(before), null, 2).replace(/^/gm, '  ');
const idx = txt.indexOf(`"id": "${id}"`);
if (idx < 0) throw Error('entry text not found');
const start = txt.lastIndexOf('{', idx), depthEnd = (() => { let d = 0; for (let k = start; k < txt.length; k++) { if (txt[k] === '{') d++; else if (txt[k] === '}') { d--; if (!d) return k + 1; } } return -1; })();
const entry = JSON.stringify(spec, null, 2);
fs.writeFileSync(file, txt.slice(0, start) + entry + txt.slice(depthEnd));
JSON.parse(fs.readFileSync(file, 'utf8'));
console.log('synced', id);
