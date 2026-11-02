/**
 * Oranje-Nassau Kazerne (Sarphatistraat 600-ish, Rijksmonument 5140, 1810-1813, Abraham van der Hart and Picot de Moras):
 * the 16 BAG pands of the one 278 m range, their union outline, a fitted building axis, and the 3DBAG heights.
 *
 *   node --import tsx scripts/landmarks/oranje-nassau-kazerne-prepare.ts
 *
 * BAG rings from the PDOK BAG WFS (CC0), 3DBAG items (CC BY 4.0), both cached under .cache/. Native frame: x east,
 * z south, y up from the pavement (3DBAG maaiveld ~1.45 m NAP), metres from the anchor (the union ring's vertex average).
 * Building frame (`axis`): u along the range towards the north-east end, v across it towards the Sarphatistraat (NW);
 * the builder authors everything in (u, v) and maps it with church-kit `localB`.
 */
import fs from 'node:fs';
import path from 'node:path';
import polygonClipping from 'polygon-clipping';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

export const PANDS = ['0363100012180523', '0363100012180524', '0363100012180521', '0363100012169164', '0363100012170400', '0363100012170399', '0363100012169165', '0363100012181498', '0363100012181499', '0363100012181497', '0363100012170462', '0363100012170463', '0363100012170464', '0363100012181501', '0363100012181500', '0363100012170524'];
const r3 = (v: number) => Math.round(v * 1000) / 1000;
async function cached(file: string, url: string) {
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const r = await fetch(url);
  if (!r.ok) throw Error(`${url}: ${r.status}`);
  const j = await r.json();
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(j));
  return j;
}
const bagUrl = (p: string) => `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=EPSG:28992&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${p}</Literal></PropertyIsEqualTo></Filter>`)}`;

const pands: {id: string; year: number; ring: number[][]; ground: number; eaves: number; r70: number; max: number}[] = [];
for (const p of PANDS) {
  const g = await cached(path.join('.cache', 'bag-wfs', `${p}.json`), bagUrl(p));
  const item = await cached(path.join('.cache', '3dbag', `${p}.json`), `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${p}`);
  const b = Object.values(item.feature.CityObjects as Record<string, {type: string; attributes: Record<string, number>}>).find(o => o.type === 'Building')!.attributes;
  pands.push({id: p, year: Number(g.features[0].properties.bouwjaar), ring: g.features[0].geometry.coordinates[0].slice(0, -1), ground: b.b3_h_maaiveld, eaves: b.b3_h_dak_min, r70: b.b3_h_dak_70p, max: b.b3_h_dak_max});
}
const union = polygonClipping.union(...pands.map(p => [[...p.ring, p.ring[0]]] as [number, number][][]));
if (union.length !== 1 || union[0].length !== 1) throw Error(`expected one solid outline, got ${union.length} polygons`);
// drop near-collinear vertices (< 5 cm off the line through their neighbours)
let ring = union[0][0].slice(0, -1);
for (let changed = true; changed;) {
  changed = false;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[(i + ring.length - 1) % ring.length], b = ring[i], c = ring[(i + 1) % ring.length];
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]), off = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / L;
    if (off < 0.05) { ring.splice(i, 1); changed = true; break; }
  }
}
const ax = ring.reduce((s, q) => s + q[0], 0) / ring.length, ay = ring.reduce((s, q) => s + q[1], 0) / ring.length;
const anchor = rdToLngLat(ax, ay).map(v => +v.toFixed(8));
// axis: principal direction of the outline's long edges, length-weighted
let sxx = 0, sxy = 0, syy = 0;
for (let i = 0; i < ring.length; i++) {
  const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  if (L < 20) continue;
  sxx += dx * dx / L; sxy += dx * dy / L; syy += dy * dy / L;
}
const th = 0.5 * Math.atan2(2 * sxy, sxx - syy); // RD angle of the long axis
let ux = Math.cos(th), uy = Math.sin(th);
if (ux < 0) { ux = -ux; uy = -uy; } // towards the north-east end
const vx = -uy, vy = ux; // left of u: north-west, the Sarphatistraat
const UV = (q: number[]) => [r3((q[0] - ax) * ux + (q[1] - ay) * uy), r3((q[0] - ax) * vx + (q[1] - ay) * vy)];
const N = (q: number[]) => [r3(q[0] - ax), r3(-(q[1] - ay))];
const alongBearing = (Math.atan2(ux, uy) * 180 / Math.PI + 360) % 360;
const ground = pands.reduce((s, p) => s + p.ground, 0) / pands.length;

const json = {
  id: 'oranje-nassau-kazerne',
  pands: PANDS,
  address: 'Sarphatistraat 600 and the rest of the range along the Sarphatistraat, Kazernestraat and Ir. Jakoba Mulderplein, Amsterdam (Rijksmonument 5140)',
  sources: [
    {what: 'BAG pand rings (16 pands, bouwjaar 1813)', url: 'https://service.pdok.nl/lv/bag/wfs/v2_0 (typeName bag:pand, srsName EPSG:28992)', retrieved: '2026-11-02', licence: 'CC0'},
    {what: '3DBAG LoD2.2 attributes (maaiveld, roof heights)', url: 'https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.<id>', retrieved: '2026-11-02', licence: 'CC BY 4.0'},
    {what: 'Monument register', url: 'https://monumentenregister.cultureelerfgoed.nl/monumenten/5140', retrieved: '2026-11-02', licence: 'CC0', text: 'Oranje-Nassau Kazerne. Enorm langgerekt sober bakstenen gebouw (1810-1811 door Abraham van der Hart) de gevels geleed door hoeken middenrisalieten met geblokte lisenen en frontons.'},
    {what: 'Wikipedia (nl)', url: 'https://nl.wikipedia.org/wiki/Oranje-Nassau_Kazerne', retrieved: '2026-11-02', licence: 'CC BY-SA 4.0'},
  ],
  anchorRD: [r3(ax), r3(ay)], anchor,
  groundNAP: r3(ground),
  axis: {alongBearing: r3(alongBearing), localDeg: r3(90 - alongBearing), note: 'u along the range to the NE end, v across it to the Sarphatistraat (NW); native = localB(deg = 90 - alongBearing)'},
  pandHeights: pands.map(p => ({id: p.id, year: p.year, eavesM: r3(p.eaves - p.ground), roof70M: r3(p.r70 - p.ground), roofMaxM: r3(p.max - p.ground)})),
  pandUV: Object.fromEntries(pands.map(p => [p.id, p.ring.map(UV)])),
  ringRD: ring.map(q => q.map(r3)),
  ringUV: ring.map(UV),
  nativeRing: ring.map(N),
};
fs.writeFileSync('scripts/landmarks/oranje-nassau-kazerne-footprints.json', JSON.stringify(json, null, 1));
console.log('anchor', anchor, 'along', r3(alongBearing), 'ground', r3(ground), 'verts', ring.length);
for (const q of ring.map(UV)) console.log(q.join(' '));
