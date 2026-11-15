/**
 * Union a bespoke landmark's manualCatalogue.json entry from its spec and its bag-shell-prepare.ts footprints (2026-11-15).
 *
 *   node --import tsx scripts/landmarks/catalogue-entry-from-shell.ts <id> [--heading=<deg>]
 *
 * Reads scripts/landmarks/<id>-spec.json (name, landmarkId?, heightMetres, galleryView, materialOverrides, attribution,
 * surveyedSource) and scripts/landmarks/<id>-footprints.json (anchor, anchorRD, nativeRing, bagId), writes the entry with
 * `suppressOsmIds: [NL.IMBAG.Pand.<bagId>]`, the footprint extents of the native ring, `bagYear` from the brief facts when
 * given in the spec, and `buildingFootprint` (the BAG ring in WGS84, for check:osm-under-models). Union by id, indent 1.
 */
import fs from 'node:fs';
import {rdToLngLat} from '../../src/canalRecall/facade/rdNew.ts';

const id = process.argv[2];
if (!id) throw new Error('usage: catalogue-entry-from-shell.ts <id> [--heading=<deg>]');
const heading = Number(process.argv.find(a => a.startsWith('--heading='))?.slice(10) ?? 0);
const spec = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-spec.json`, 'utf8'));
const src = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
const ring: number[][] = src.nativeRing;
const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
const r7 = (v: number) => Math.round(v * 1e7) / 1e7;
const ll = ring.map(p => { const [lng, lat] = rdToLngLat({x: src.anchorRD[0] + p[0], y: src.anchorRD[1] - p[1]}); return [r7(lng), r7(lat)]; });
ll.push([...ll[0]]);
const entry: Record<string, unknown> = {
  id, name: spec.name, ...(spec.landmarkId ? {landmarkId: spec.landmarkId} : {}),
  modelUrl: `./models/${id}.glb`,
  suppressOsmIds: [`NL.IMBAG.Pand.${src.bagId}`],
  spatialSuppression: false,
  footprint: {centre: src.anchor, headingDegrees: heading, lengthMetres: Math.round((Math.max(...zs) - Math.min(...zs)) * 10) / 10, widthMetres: Math.round((Math.max(...xs) - Math.min(...xs)) * 10) / 10},
  surveyed: {anchor: src.anchor, northOffsetDegrees: 0, source: spec.surveyedSource},
  groundAltitudeMetres: 0, facingOffsetDegrees: 0,
  heightMetres: spec.heightMetres, galleryView: spec.galleryView,
  ...(spec.bagYear ? {bagYear: spec.bagYear} : {}),
  materialOverrides: spec.materialOverrides, attribution: spec.attribution,
  buildingFootprint: {type: 'Polygon', coordinates: [ll]},
};
const cat = 'src/canalRecall/landmarks/manualCatalogue.json';
// Textual union: the file carries Python-style floats (`8.0`) a JSON round trip would rewrite, so replace or append only this entry.
let text = fs.readFileSync(cat, 'utf8');
const list = JSON.parse(text) as {id: string}[];
const body = JSON.stringify(entry, null, 1).split('\n').map(l => ' ' + l).join('\n');
const at = list.findIndex(e => e.id === id);
if (at >= 0) {
  // entries are top-level objects opened by ' {' and closed by ' }' at indent 1; find this one by its id line
  const start = text.lastIndexOf('\n {\n', text.indexOf(`\n  "id": ${JSON.stringify(id)},`));
  const end = text.indexOf('\n }', start + 3) + 3;
  text = text.slice(0, start + 1) + body + text.slice(end);
} else {
  const close = text.lastIndexOf('\n }');
  text = text.slice(0, close + 3) + ',\n' + body + text.slice(close + 3);
}
JSON.parse(text);
fs.writeFileSync(cat, text);
console.log(at >= 0 ? 'updated' : 'added', id);
