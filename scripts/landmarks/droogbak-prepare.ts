/**
 * Droogbak shell source: the 3DBAG LoD2.2 walls and roofs and the BAG outline of pand 0363100012171155 (Droogbak 1A,
 * 1884, former HIJSM head office, Rijksmonument 518416), in the native landmark frame.
 *
 *   node --import tsx scripts/landmarks/droogbak-prepare.ts
 *
 * Item from the 3DBAG API (CC BY 4.0), cached under .cache/3dbag/. Frame: x east, z south, y up, metres; origin = vertex
 * average of the BAG LoD0 outline (RD), y = 0 at the pand's 3DBAG ground (b3_h_maaiveld). The spec's anchor is the origin.
 */
import fs from 'node:fs';
import path from 'node:path';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

const PAND = '0363100012171155';
type Item = {feature: {CityObjects: Record<string, {type: string; attributes?: Record<string, unknown>; geometry?: {lod: string | number; boundaries: unknown; semantics?: {surfaces: {type: string}[]; values: number[][]}}[]}>; vertices: number[][]}; metadata: {transform: {scale: number[]; translate: number[]}}};

async function item(pand: string): Promise<Item> {
  const file = path.join('.cache', '3dbag', `${pand}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const r = await fetch(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${pand}`);
  if (!r.ok) throw Error(`3DBAG ${pand}: ${r.status}`);
  const j = await r.json();
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(j));
  return j as Item;
}
const r3 = (v: number) => Math.round(v * 1000) / 1000;

const it = await item(PAND);
const t = it.metadata.transform, verts = it.feature.vertices.map(v => v.map((x, i) => x * t.scale[i] + t.translate[i]));
let attributes: Record<string, unknown> = {};
const footprint: number[][] = [], surfaces: {type: string; rings: number[][][]}[] = [];
for (const o of Object.values(it.feature.CityObjects)) {
  if (o.type === 'Building') attributes = o.attributes ?? {};
  for (const g of o.geometry ?? []) {
    if (String(g.lod) === '0' && !footprint.length) for (const k of ((g.boundaries as number[][][])[0][0])) footprint.push(verts[k].slice(0, 2));
    if (String(g.lod) !== '2.2' || !g.semantics) continue;
    (g.boundaries as number[][][][]).forEach((shell, si) => shell.forEach((surface, j) => {
      const type = g.semantics!.surfaces[g.semantics!.values[si][j]]?.type ?? 'WallSurface';
      surfaces.push({type, rings: surface.map(r => r.map(i => verts[i]))});
    }));
  }
}
const ax = footprint.reduce((s, p) => s + p[0], 0) / footprint.length, ay = footprint.reduce((s, p) => s + p[1], 0) / footprint.length;
const ground = Number(attributes.b3_h_maaiveld);
const L3 = (p: number[]) => [r3(p[0] - ax), r3(Math.max(0, p[2] - ground)), r3(-(p[1] - ay))];
const anchor = rdToLngLat(ax, ay).map(v => +v.toFixed(8));
// The open courtyard: 3DBAG walls that stand on the ground away from the BAG outline (> 0.8 m), chained into one ring.
const ringN = footprint.map(p => [p[0] - ax, -(p[1] - ay)]);
const distRing = (x: number, z: number) => Math.min(...ringN.map((a, i) => { const q = ringN[(i + 1) % ringN.length], dx = q[0] - a[0], dz = q[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz); }));
const segs: number[][][] = [];
for (const s of surfaces) {
  if (s.type !== 'WallSurface') continue;
  const r = s.rings[0].map(L3), low = r.filter(v => v[1] < 0.5);
  const mx = r.reduce((a, v) => a + v[0], 0) / r.length, mz = r.reduce((a, v) => a + v[2], 0) / r.length;
  if (low.length >= 2 && distRing(mx, mz) > 0.8) segs.push([[low[0][0], low[0][2]], [low[1][0], low[1][2]]]);
}
const courtyard: number[][] = [segs[0][0], segs[0][1]]; segs.shift();
while (segs.length) {
  const end = courtyard.at(-1)!;
  let best = -1, flip = false, bd = Infinity;
  segs.forEach((s, k) => { for (const [e, f] of [[0, false], [1, true]] as const) { const d = Math.hypot(s[e][0] - end[0], s[e][1] - end[1]); if (d < bd) { bd = d; best = k; flip = f; } } });
  if (bd > 0.3) break;
  const s = segs.splice(best, 1)[0]; courtyard.push(flip ? s[0] : s[1]);
}
if (Math.hypot(courtyard[0][0] - courtyard.at(-1)![0], courtyard[0][1] - courtyard.at(-1)![1]) < 0.05) courtyard.pop();
console.log('courtyard vertices', courtyard.length, 'unchained wall segments', segs.length);
const json = {
  id: 'droogbak', bagId: PAND, anchorRD: [r3(ax), r3(ay)], anchor, groundNAP: ground,
  coordinateConvention: 'native east/south metres from anchor; y above local ground',
  source: `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${PAND} (3DBAG, CC BY 4.0; BAG CC0)`,
  attributes: {roofMaxNAP: attributes.b3_h_dak_max, ridgeNAP: attributes.b3_h_nok, roof70NAP: attributes.b3_h_dak_70p, builtYear: attributes.oorspronkelijkbouwjaar},
  courtyard: courtyard.map(p => [r3(p[0]), r3(p[1])]),
  nativeRing: footprint.map(p => [r3(p[0] - ax), r3(-(p[1] - ay))]),
  surfaces: surfaces.filter(s => s.type !== 'GroundSurface').map(s => ({type: s.type, rings: s.rings.map(r => r.map(L3))})),
};
fs.writeFileSync('scripts/landmarks/droogbak-footprints.json', JSON.stringify(json));
console.log('anchor', anchor, 'ring', json.nativeRing.length, 'surfaces', json.surfaces.length, 'ground', ground, json.attributes);
