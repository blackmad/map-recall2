// Usage: node --import tsx scripts/landmarks/nightlife-spec.ts <id>
// Reads <id>-meta.json {name, landmarkId, sourceUrl, suppressOsmIds, ringLngLat | pandId, anchor, materialOverrides,
// surveySource, modifications} and writes <id>-spec.json (catalogue entry with buildingFootprint).
import fs from 'node:fs';
import {fitObb, toLocal} from './nightlife-geometry';

const id = process.argv[2];
const dir = 'scripts/landmarks/';
const meta = JSON.parse(fs.readFileSync(`${dir}${id}-meta.json`, 'utf8'));
let ring: number[][] = meta.ringLngLat;
if (!ring && meta.pandId) {
  const r = await (await fetch(`https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?identificatie=${meta.pandId}&f=json`)).json();
  const g = r.features[0].geometry;
  ring = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0];
}
const anchor: number[] = meta.anchor ?? [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
const o = fitObb(toLocal(ring, anchor));
const mx = 111320 * Math.cos(anchor[1] * Math.PI / 180);
const centre = [anchor[0] + o.cx / mx, anchor[1] - o.cz / 111320];
// local +z maps to world (east sin a, south cos a), so the compass bearing is 180 - a, folded to [0, 180)
const heading = (((180 - o.ang * 180 / Math.PI) % 180) + 180) % 180;
const spec = {
  id, name: meta.name, landmarkId: meta.landmarkId, modelUrl: `./models/${id}.glb`,
  suppressOsmIds: meta.suppressOsmIds, spatialSuppression: false,
  footprint: {centre, headingDegrees: heading, lengthMetres: +(o.hl * 2).toFixed(2), widthMetres: +(o.hw * 2).toFixed(2)},
  surveyed: {anchor, northOffsetDegrees: 0, source: meta.surveySource},
  groundAltitudeMetres: 0, facingOffsetDegrees: 0,
  materialOverrides: meta.materialOverrides,
  attribution: {title: meta.name, author: 'Map Recall', sourceUrl: meta.sourceUrl, licence: 'Original project asset', licenceUrl: './LICENSE', modifications: meta.modifications},
  buildingFootprint: {type: 'Polygon', coordinates: [ring]},
};
fs.writeFileSync(`${dir}${id}-spec.json`, JSON.stringify(spec, null, 2) + '\n');
console.log(id, JSON.stringify(spec.footprint));
