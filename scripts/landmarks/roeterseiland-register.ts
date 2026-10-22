/** Adds / refreshes the roeterseiland-rec-a entry of manualCatalogue.json from roeterseiland-footprints.json (idempotent): `node --import tsx scripts/landmarks/roeterseiland-register.ts`. */
import fs from 'node:fs';

const CAT = 'src/canalRecall/landmarks/manualCatalogue.json';
const fp = JSON.parse(fs.readFileSync('scripts/landmarks/roeterseiland-footprints.json', 'utf8'));
const catalogue = JSON.parse(fs.readFileSync(CAT, 'utf8')) as {id: string}[];
const ring: [number, number][] = fp.nativeRing;
// minimum-area oriented rectangle of the outline in native metres (x east, z south): heading = bearing of the long axis from north
let best = {area: Infinity, ang: 0, w: 0, l: 0, cx: 0, cz: 0};
for (let deg = 0; deg < 180; deg += 0.5) {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const u = ring.map(p => p[0] * c + p[1] * s), v = ring.map(p => -p[0] * s + p[1] * c);
  const w = Math.max(...u) - Math.min(...u), l = Math.max(...v) - Math.min(...v);
  if (w * l < best.area) best = {area: w * l, ang: a, w, l, cx: ((Math.max(...u) + Math.min(...u)) / 2) * c - ((Math.max(...v) + Math.min(...v)) / 2) * s, cz: ((Math.max(...u) + Math.min(...u)) / 2) * s + ((Math.max(...v) + Math.min(...v)) / 2) * c};
}
const [aLng, aLat] = fp.anchor as [number, number];
const mPerLat = 111320, mPerLng = 111320 * Math.cos(aLat * Math.PI / 180);
const long = Math.max(best.w, best.l), short = Math.min(best.w, best.l);
// long axis direction: u axis (cos a, sin a) if w >= l, else v axis (-sin a, cos a); bearing from north, x east / z south
const dir = best.w >= best.l ? [Math.cos(best.ang), Math.sin(best.ang)] : [-Math.sin(best.ang), Math.cos(best.ang)];
const heading = Math.round(((Math.atan2(dir[0], -dir[1]) * 180 / Math.PI) % 180 + 180) % 180);
const entry = {
  id: 'roeterseiland-rec-a',
  name: 'Roeterseilandcampus REC (UvA, Amsterdam Law School and De Brug)',
  landmarkId: 'extract_landmarks_596580010',
  modelUrl: './models/roeterseiland-rec-a.glb',
  suppressOsmIds: ['NL.IMBAG.Pand.0363100012185420', 'r3604223', 'w269006492'],
  spatialSuppression: false,
  footprint: {centre: [Math.round((aLng + best.cx / mPerLng) * 1e7) / 1e7, Math.round((aLat - best.cz / mPerLat) * 1e7) / 1e7], headingDegrees: heading, lengthMetres: Math.round(long * 10) / 10, widthMetres: Math.round(short * 10) / 10},
  surveyed: {anchor: fp.anchor, northOffsetDegrees: 0, source: `BAG pand 0363100012185420 outline (${ring.length - 1} vertices, PDOK WFS) and 3DBAG LoD2.2 walls and roofs, native east/south metres from the anchor (the large-tier frame, origin = the BAG outline vertex mean); BGT pand cross-check IoU ${fp.bgtCheck.iou}; the Nieuwe Achtergracht passage under the bridge block is opened in the shell.`},
  groundAltitudeMetres: 0,
  facingOffsetDegrees: 0,
  materialOverrides: {slate: '#3a4350', greyBrick: '#403d3b', bronze: '#7b6a4c', brick: '#6a3b34', ochre: '#c9ab7c', concrete: '#b8bdbd', copper: '#2f8f8c', dark: '#252a30', glass: '#4b6372', frame: '#aab6b3', stone: '#cfc7b5', sandstone: '#5e5f5f', white: '#e9e7df', blue: '#6f7fb0', red: '#7d2c3b', gold: '#d9822b'},
  attribution: {
    title: 'UvA Roeterseilandcampus REC-A, Nieuwe Achtergracht 166 / Roetersstraat 11',
    author: 'Map Recall; University of Amsterdam Roeterseilandcampus (BAG year 1990, extended since)',
    sourceUrl: 'https://nl.wikipedia.org/wiki/Roeterseiland',
    licence: 'CC BY 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    modifications: 'Original texture-free flat-colour geometry: 3DBAG LoD2.2 walls and roofs (CC BY 4.0) with block-kit facade systems and hand-drawn window sheets cut into wall groups by architectural part, the canal passage under the bridge block opened and closed with a glazed soffit and channel walls, all read from Gemeente Amsterdam panoramas (CC BY 4.0). No pixels or third-party meshes imported.',
  },
  buildingFootprint: fp.buildingFootprint,
  bagYear: 1990,
};
const i = catalogue.findIndex(c => c.id === entry.id);
if (i >= 0) catalogue[i] = entry; else catalogue.push(entry);
fs.writeFileSync(CAT, JSON.stringify(catalogue, null, 2) + '\n');
console.log(`${i >= 0 ? 'updated' : 'added'} ${entry.id}: centre ${entry.footprint.centre}, heading ${heading}, ${entry.footprint.lengthMetres} x ${entry.footprint.widthMetres} m`);
