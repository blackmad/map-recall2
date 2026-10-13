// Usage: node scripts/landmarks/add-church-catalogue-entry.mjs <id>
// Upserts the manualCatalogue.json entry for a hand-built church from scripts/landmarks/<id>-spec.json plus the BAG ring
// in <id>-footprints.json (buildingFootprint). Keeps the catalogue's formatting (2-space JSON).
import fs from 'node:fs';
const id = process.argv[2];
const cat = 'src/canalRecall/landmarks/manualCatalogue.json';
const list = JSON.parse(fs.readFileSync(cat, 'utf8'));
const spec = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-spec.json`, 'utf8'));
const fp = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
const entry = {...spec, buildingFootprint: fp.buildingFootprint};
const i = list.findIndex(e => e.id === id);
if (i >= 0) list[i] = entry; else list.push(entry);
fs.writeFileSync(cat, JSON.stringify(list, null, 2) + '\n');
console.log(i >= 0 ? 'updated' : 'added', id);
