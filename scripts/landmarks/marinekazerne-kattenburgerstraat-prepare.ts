/**
 * Marinekazerne street range ('s Lands Werf, Kattenburgerstraat 5-7, BAG pand 0363100012165822, Rijksmonument 2206):
 * BAG ring (RD) and the 3DBAG LoD2.2 shell in the native landmark frame, plus the two street-front frames.
 *
 *   node --import tsx scripts/landmarks/marinekazerne-kattenburgerstraat-prepare.ts
 *
 * BAG ring from the PDOK BAG WFS (CC0); 3DBAG item (CC BY 4.0), both cached under .cache/. Native frame: x east, z south,
 * y up from the pavement (3DBAG maaiveld 1.84 m NAP), metres; anchor = the vertex average of the BAG ring (RD).
 * Fronts (church-kit `local`): `long` runs from the SW corner (BAG vertex 30) north-east along the 105 m Kattenburgerstraat
 * front (edges 30, 0-3, with the gate frontispiece on edges 0-2); `corner` runs along the 74.5 m front that turns 19 degrees
 * further north at vertex 4 (edge 4). z points out of each front towards the street, the building at z <= 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

const PAND = '0363100012165822';
type Item = {feature: {CityObjects: Record<string, {type: string; attributes?: Record<string, unknown>; geometry?: {lod: string | number; boundaries: unknown; semantics?: {surfaces: {type: string}[]; values: number[][]}}[]}>; vertices: number[][]}; metadata: {transform: {scale: number[]; translate: number[]}}};
async function cached(file: string, url: string) {
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const r = await fetch(url);
  if (!r.ok) throw Error(`${url}: ${r.status}`);
  const j = await r.json();
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(j));
  return j;
}
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const bagUrl = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=EPSG:28992&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${PAND}</Literal></PropertyIsEqualTo></Filter>`)}`;
const g = await cached(path.join('.cache', 'bag-wfs', `${PAND}.json`), bagUrl);
const ring: number[][] = g.features[0].geometry.coordinates[0].slice(0, -1);
const item: Item = await cached(path.join('.cache', '3dbag', `${PAND}.json`), `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${PAND}`);

const ax = ring.reduce((s, q) => s + q[0], 0) / ring.length, ay = ring.reduce((s, q) => s + q[1], 0) / ring.length;
const anchor = rdToLngLat(ax, ay).map(v => +v.toFixed(8));
const N = (q: number[]) => [r3(q[0] - ax), r3(-(q[1] - ay))];

const t = item.metadata.transform, verts = item.feature.vertices.map(v => v.map((x, i) => x * t.scale[i] + t.translate[i]));
let at: Record<string, unknown> = {};
const shell: {type: string; rings: number[][][]}[] = [];
for (const o of Object.values(item.feature.CityObjects)) {
  if (o.type === 'Building') at = o.attributes ?? {};
  for (const geo of o.geometry ?? []) {
    if (String(geo.lod) !== '2.2' || !geo.semantics) continue;
    (geo.boundaries as number[][][][]).forEach((sh, si) => sh.forEach((surface, j) => {
      const type = geo.semantics!.surfaces[geo.semantics!.values[si][j]]?.type ?? 'WallSurface';
      if (type === 'GroundSurface') return;
      shell.push({type, rings: surface.map(r => r.map(i => { const v = verts[i]; return [r3(v[0] - ax), r3(Math.max(0, v[2] - Number(at.b3_h_maaiveld ?? 1.84))), r3(-(v[1] - ay))]; }))});
    }));
  }
}
const ground = Number(at.b3_h_maaiveld);

/** A front frame from BAG vertex a to b (RD): church-kit local() angle and origin; x along a->b, z outward. */
function frontFrame(a: number[], b: number[]) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), u = [dx / L, dy / L];
  const bearing = (Math.atan2(u[0], u[1]) * 180 / Math.PI + 360) % 360; // along-front bearing
  // ring is counter-clockwise (positive area): the outward normal of a->b is (dy, -dx)
  const nb = (bearing + 90) % 360;
  return {axisDeg: r3(90 - bearing), origin: N(a), lengthM: r3(L), alongBearing: r3(bearing), facingBearing: r3(nb)};
}
const area = ring.reduce((s, a, i) => { const b = ring[(i + 1) % ring.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
if (area <= 0) throw Error('expected a counter-clockwise BAG ring');
const long = frontFrame(ring[30], ring[3 + 1 - 1 + 1]); // v30 -> v4 (edges 30, 0, 1, 2, 3)
const corner = frontFrame(ring[4], ring[5]);
// how far each long-front vertex stands off the v30-v4 line (gate frontispiece jogs)
const lu = [(ring[4][0] - ring[30][0]) / long.lengthM, (ring[4][1] - ring[30][1]) / long.lengthM];
const jogs = [30, 0, 1, 2, 3, 4].map(i => { const q = ring[i], d = [q[0] - ring[30][0], q[1] - ring[30][1]]; return {v: i, t: r3(d[0] * lu[0] + d[1] * lu[1]), off: r3(d[0] * lu[1] - d[1] * lu[0])}; });

const json = {
  id: 'marinekazerne-kattenburgerstraat',
  pand: PAND,
  address: "Kattenburgerstraat 5-7, 1018JA Amsterdam ('s Lands Werf street range of the Marineterrein, Rijksmonument 2206)",
  sources: [
    {what: 'BAG pand ring', url: 'https://service.pdok.nl/lv/bag/wfs/v2_0 (typeName bag:pand, srsName EPSG:28992)', retrieved: '2026-11-02', licence: 'CC0'},
    {what: '3DBAG LoD2.2 shell and height attributes', url: `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${PAND}`, retrieved: '2026-11-02', licence: 'CC BY 4.0'},
  ],
  bagYear: Number(g.features[0].properties.bouwjaar),
  anchorRD: [r3(ax), r3(ay)], anchor,
  groundNAP: ground,
  eavesM: r3(Number(at.b3_h_dak_min) - ground), roof70M: r3(Number(at.b3_h_dak_70p) - ground), roofMaxM: r3(Number(at.b3_h_dak_max) - ground), ridgeM: r3(Number(at.b3_h_nok) - ground),
  fronts: {long, corner},
  longJogs: jogs,
  ringRD: ring.map(q => q.map(r3)),
  nativeRing: ring.map(N),
  shellNative: shell,
};
fs.writeFileSync('scripts/landmarks/marinekazerne-kattenburgerstraat-footprints.json', JSON.stringify(json, null, 1));
console.log('anchor', anchor, 'fronts', long, corner, 'jogs', jogs, 'eaves', json.eavesM, 'ridge', json.ridgeM, 'surfaces', shell.length);
