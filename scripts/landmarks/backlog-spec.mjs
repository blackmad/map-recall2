// Usage: node scripts/landmarks/backlog-spec.mjs <id> <meta.json>
// Writes <id>-spec.json from <id>-footprints.json (min-area rectangle for footprint, BAG ring) and a small meta file
// {name, landmarkId, sourceUrl, suppressOsmIds[], materialOverrides{}, modifications}.
import fs from 'node:fs';
const [id, metaFile] = process.argv.slice(2);
const dir = 'scripts/landmarks/';
const fp = JSON.parse(fs.readFileSync(`${dir}${id}-footprints.json`, 'utf8'));
const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
const ring = fp.nativeRing, a = fp.anchor;
let best = null;
for (let k = 0; k < 1800; k++) {
  const t = k / 10 * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  const us = ring.map(p => p[0] * c + p[1] * s), vs = ring.map(p => -p[0] * s + p[1] * c);
  const L = Math.max(...us) - Math.min(...us), W = Math.max(...vs) - Math.min(...vs);
  if (!best || L * W < best.ar) best = {ar: L * W, k: k / 10, L, W, cu: (Math.max(...us) + Math.min(...us)) / 2, cv: (Math.max(...vs) + Math.min(...vs)) / 2, c, s};
}
let {L, W, k, cu, cv, c, s} = best;
let long = k; if (W > L) { [L, W] = [W, L]; long = k + 90; }
const ex = cu * c - cv * s, sz = cu * s + cv * c;
const lat = a[1] - sz / 111320, lng = a[0] + ex / (111320 * Math.cos(a[1] * Math.PI / 180));
const rad = long * Math.PI / 180;
const heading = ((Math.atan2(Math.cos(rad), -Math.sin(rad)) * 180 / Math.PI) % 360 + 360) % 360;
const spec = {
  id, name: meta.name, landmarkId: meta.landmarkId, modelUrl: `./models/${id}.glb`,
  suppressOsmIds: meta.suppressOsmIds, spatialSuppression: false,
  footprint: {centre: [lng, lat], headingDegrees: heading, lengthMetres: +L.toFixed(2), widthMetres: +W.toFixed(2)},
  surveyed: {anchor: a, northOffsetDegrees: 0, source: `Current BAG ${fp.bagId} footprint and 3DBAG LoD2.2 surfaces, native east/south metres from the footprint centroid.`},
  groundAltitudeMetres: 0, facingOffsetDegrees: 0, materialOverrides: meta.materialOverrides,
  attribution: {title: meta.name, author: 'Map Recall', sourceUrl: meta.sourceUrl, licence: 'Original project asset', licenceUrl: './LICENSE', modifications: meta.modifications},
  buildingFootprint: fp.buildingFootprint,
};
fs.writeFileSync(`${dir}${id}-spec.json`, JSON.stringify(spec, null, 2) + '\n');
console.log(id, spec.footprint);
