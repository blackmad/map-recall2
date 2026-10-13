// Usage: node scripts/landmarks/big-landmark-register.mjs <id>
// Turns an ordinary spec made by big-install.mjs into a named LANDMARK: drops `category`, adds `landmarkId`, and appends/replaces the
// POI card (<id>-poi.json) in src/canalRecall/game/manual-poi-data.json. Idempotent.
import fs from 'node:fs';
const [id] = process.argv.slice(2);
const dir = 'scripts/landmarks/';
const poi = JSON.parse(fs.readFileSync(`${dir}${id}-poi.json`, 'utf8'));
const specFile = `${dir}${id}-spec.json`;
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
delete spec.category;
const ordered = {id: spec.id, name: spec.name, landmarkId: id};
for (const [k, v] of Object.entries(spec)) if (!(k in ordered)) ordered[k] = v;
if (spec.throughPassages) ordered.throughPassages = spec.throughPassages;
fs.writeFileSync(specFile, JSON.stringify(ordered, null, 2) + '\n');
const catFile = 'src/canalRecall/landmarks/manualCatalogue.json';
const cat = JSON.parse(fs.readFileSync(catFile, 'utf8'));
const i = cat.findIndex(x => x.id === id);
if (i < 0) throw new Error('not in catalogue; run big-install first');
cat[i] = ordered;
fs.writeFileSync(catFile, JSON.stringify(cat, null, 2) + '\n');
const poiFile = 'src/canalRecall/game/manual-poi-data.json';
const pois = JSON.parse(fs.readFileSync(poiFile, 'utf8'));
const j = pois.findIndex(x => x.modelId === id);
if (j >= 0) pois[j] = poi; else pois.push(poi);
fs.writeFileSync(poiFile, JSON.stringify(pois, null, 2) + '\n');
console.log('registered landmark', id, j >= 0 ? '(poi replaced)' : '(poi added)');
