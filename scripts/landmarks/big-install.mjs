// Usage: node scripts/landmarks/big-install.mjs <id> <BuilderName> "<Display name>" <materialOverridesJson|-> [--bag-id=...]
// Registers a large ORDINARY building (no route destination, no POI): appends the catalogue spec built from
// <id>-footprints.json and the dispatch + import in build-manual-landmarks.ts. Idempotent.
import fs from 'node:fs';
const [id, fn, name, mats = '-'] = process.argv.slice(2);
const dir = 'scripts/landmarks/';
const src = JSON.parse(fs.readFileSync(`${dir}${id}-footprints.json`, 'utf8'));
const ringLL = src.buildingFootprint.coordinates[0];
const pts = src.nativeRing;
// Oriented bounding box over a sweep of angles (east/south metres).
let best = null;
for (let a = 0; a < 180; a += 0.5) {
  const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180);
  const us = pts.map(p => p[0] * c + p[1] * s), vs = pts.map(p => -p[0] * s + p[1] * c);
  const L = Math.max(...us) - Math.min(...us), W = Math.max(...vs) - Math.min(...vs);
  if (!best || L * W < best.L * best.W) best = {a, L, W, cu: (Math.max(...us) + Math.min(...us)) / 2, cv: (Math.max(...vs) + Math.min(...vs)) / 2};
}
const c = Math.cos(best.a * Math.PI / 180), s = Math.sin(best.a * Math.PI / 180);
const cx = best.cu * c - best.cv * s, cz = best.cu * s + best.cv * c;
const anchor = src.anchor;
const centre = [anchor[0] + cx / (111320 * Math.cos(anchor[1] * Math.PI / 180)), anchor[1] - cz / 111320];
const bag = src.bagId;
const spec = {
  id, name, category: 'ordinary', modelUrl: `./models/${id}.glb`,
  suppressOsmIds: [`NL.IMBAG.Pand.${bag}`, ...JSON.parse(process.env.EXTRA_SUPPRESS ?? '[]')],
  spatialSuppression: false,
  footprint: {centre, headingDegrees: +((best.a + 90) % 180).toFixed(2), lengthMetres: +Math.max(best.L, best.W).toFixed(2), widthMetres: +Math.min(best.L, best.W).toFixed(2)},
  groundAltitudeMetres: 0, facingOffsetDegrees: 0,
  surveyed: {anchor, northOffsetDegrees: 0, source: `PDOK BAG ${bag} footprint and 3DBAG LoD2.2 surfaces, native east/south metres from the footprint vertex mean.`},
  ...(mats !== '-' ? {materialOverrides: JSON.parse(mats)} : {}),
  preservePositionPrecision: true,
  attribution: {title: `${name} original architecture`, author: 'Map Recall', sourceUrl: `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${bag}`, licence: 'Original project asset', licenceUrl: './LICENSE', modifications: 'Original texture-free native metre geometry on the 3DBAG LoD2.2 massing; facade rhythm counted by eye from municipal panoramas, no pixels or meshes imported. Ordinary large building, no POI or route destination.'},
  buildingFootprint: {type: 'Polygon', coordinates: [ringLL]},
};
fs.writeFileSync(`${dir}${id}-spec.json`, JSON.stringify(spec, null, 2) + '\n');
const cat = 'src/canalRecall/landmarks/manualCatalogue.json';
const list = JSON.parse(fs.readFileSync(cat, 'utf8'));
if (!list.some(x => x.id === id)) {
  let t = fs.readFileSync(cat, 'utf8').replace(/\s*\]\s*$/, '');
  t += ',\n' + JSON.stringify(spec, null, 2) + '\n]\n';
  fs.writeFileSync(cat, t);
} else {
  const i = list.findIndex(x => x.id === id); list[i] = spec;
  fs.writeFileSync(cat, JSON.stringify(list, null, 2) + '\n');
}
const bf = `${dir}build-manual-landmarks.ts`;
let t = fs.readFileSync(bf, 'utf8');
if (!t.includes(`from './${id}-builder'`)) t = t.replace(/(import \{buildHaparandaweg9\} from '\.\/haparandaweg-9-builder';\n)/, `$1import {${fn}} from './${id}-builder';\n`);
if (!t.includes(`id==='${id}'`)) t = t.replace(/(    else if\(id==='haparandaweg-9'\)buildHaparandaweg9\(w,d,helpers\);\n)/, `$1    else if(id==='${id}')${fn}(w,d,helpers);\n`);
fs.writeFileSync(bf, t);
console.log('installed', id, JSON.stringify(spec.footprint));
