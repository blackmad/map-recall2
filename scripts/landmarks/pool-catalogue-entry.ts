/**
 * Union a pool landmark's manualCatalogue.json entry from its spec and its pool-site-prepare.ts footprints (2026-11-15, pools lane).
 *
 *   node --import tsx scripts/landmarks/pool-catalogue-entry.ts <id>
 *
 * Like catalogue-entry-from-shell.ts, for a site: every BAG pand drawn by the builder (main + `pands`) is suppressed, the
 * footprint extent covers the main ring, the pavilions and the basins with their decks, and `buildingFootprint` is the main
 * BAG ring (or, for a site without a hall, the OSM site outline) in WGS84. Union by id, indent 1, textual (keeps `8.0` floats).
 */
import fs from 'node:fs';
import {rdToLngLat} from '../../src/canalRecall/facade/rdNew.ts';
import {neighbourhood, pointInRing} from '../pand-reference/core.ts';

const id = process.argv[2];
if (!id) throw new Error('usage: pool-catalogue-entry.ts <id>');
const spec = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-spec.json`, 'utf8'));
const src = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
const r7 = (v: number) => Math.round(v * 1e7) / 1e7;
const all: number[][] = [...(src.nativeRing ?? []), ...src.pands.flatMap((p: {nativeRing: number[][]}) => p.nativeRing), ...src.basins.flatMap((b: {ring: number[][]}) => b.ring), ...(spec.extraExtent ?? [])];
const xs = all.map(p => p[0]), zs = all.map(p => p[1]);
const planRing: number[][] = src.nativeRing ?? src.site;
const ll = planRing.map(p => { const [lng, lat] = rdToLngLat({x: src.anchorRD[0] + p[0], y: src.anchorRD[1] - p[1]}); return [r7(lng), r7(lat)]; });
ll.push([...ll[0]]);
const pandIds = [src.bagId, ...src.pands.map((p: {id: string}) => p.id)].filter(Boolean);
// OSM building(-part) outlines in the city tiles that stand on a drawn pand (centroid inside its ring): De Mirandabad's OSM parts
// with a min_height drew a floating ring over the site. They are suppressed with the panden.
const toRd = (p: number[]) => ({x: src.anchorRD[0] + p[0], y: src.anchorRD[1] - p[1]});
const drawnRings = [src.nativeRing, ...src.pands.map((p: {nativeRing: number[][]}) => p.nativeRing)].filter(Boolean).map((r: number[][]) => r.map(toRd));
const osmIds = new Set<string>();
for (const r of drawnRings) for (const fp of await neighbourhood(r[0])) {
  if (!/^[wr]\d+$/.test(fp.id)) continue;
  const c = {x: fp.ring.reduce((s, q) => s + q.x, 0) / fp.ring.length, y: fp.ring.reduce((s, q) => s + q.y, 0) / fp.ring.length};
  if (drawnRings.some(d => pointInRing(c, d))) osmIds.add(fp.id);
}
const entry: Record<string, unknown> = {
  id, name: spec.name, ...(spec.landmarkId ? {landmarkId: spec.landmarkId} : {}),
  modelUrl: `./models/${id}.glb`,
  suppressOsmIds: [...pandIds.map((p: string) => `NL.IMBAG.Pand.${p}`), ...[...osmIds].sort()],
  spatialSuppression: false,
  footprint: {centre: src.anchor, headingDegrees: 0, lengthMetres: Math.round((Math.max(...zs) - Math.min(...zs)) * 10) / 10, widthMetres: Math.round((Math.max(...xs) - Math.min(...xs)) * 10) / 10},
  surveyed: {anchor: src.anchor, northOffsetDegrees: 0, source: spec.surveyedSource},
  groundAltitudeMetres: 0, facingOffsetDegrees: 0,
  heightMetres: spec.heightMetres, galleryView: spec.galleryView,
  ...(spec.bagYear ? {bagYear: spec.bagYear} : {}),
  materialOverrides: spec.materialOverrides, ...(spec.measuredOverrides ? {measuredOverrides: true} : {}), attribution: spec.attribution,
  buildingFootprint: {type: 'Polygon', coordinates: [ll]},
};
const cat = 'src/canalRecall/landmarks/manualCatalogue.json';
let text = fs.readFileSync(cat, 'utf8');
const list = JSON.parse(text) as {id: string}[];
const body = JSON.stringify(entry, null, 1).split('\n').map(l => ' ' + l).join('\n');
const at = list.findIndex(e => e.id === id);
if (at >= 0) {
  const start = text.lastIndexOf('\n {\n', text.indexOf(`\n  "id": ${JSON.stringify(id)},`));
  const end = text.indexOf('\n }', start + 3) + 3;
  text = text.slice(0, start + 1) + body + text.slice(end);
} else {
  const close = text.lastIndexOf('\n }');
  text = text.slice(0, close + 3) + ',\n' + body + text.slice(close + 3);
}
JSON.parse(text);
fs.writeFileSync(cat, text);
console.log(at >= 0 ? 'updated' : 'added', id, `${pandIds.length} panden and ${osmIds.size} OSM outlines suppressed: ${[...osmIds].join(' ')}`);
