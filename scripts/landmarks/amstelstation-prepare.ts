/**
 * Amstelstation (Julianaplein 1, BAG 0363100012145715; H.G.J. Schelling, 1939) plan source.
 *
 *   node --import tsx scripts/landmarks/amstelstation-prepare.ts
 *
 * Reads the BAG outline (PDOK WFS, CC0) and the 3DBAG LoD2.2 solid (api.3dbag.nl, CC BY 4.0) through the shared
 * pand-reference cache (fetched 2026-11-01) and writes scripts/landmarks/amstelstation-footprints.json in the native
 * frame: x east, z south, y up from the 3DBAG ground (-0.61 m NAP), metres, origin = vertex average of the BAG ring (RD).
 *
 *  - ring: the whole BAG pand. It is far larger than the station above ground: it takes in the bicycle cellar under the
 *    north/east forecourt and the passage under the tracks to the west. 3DBAG only measures what stands above ground.
 *  - hall: the oriented rectangle of the two 16.8-18.7 m roof planes (the ticket hall), with its ridge line.
 *  - shell: every 3DBAG LoD2.2 roof and wall surface (hall, wings, the passage block under the platforms, the west
 *    entrance), the hall's tagged `hall: true`. The builder keeps it as the measured shell and dresses it.
 */
import fs from 'node:fs';
import {cachedJson} from '../pand-reference/core.ts';
import {rdToLngLat} from '../../src/canalRecall/facade/rdNew.ts';

type V2 = [number, number];
type V3 = [number, number, number];
const PAND = '0363100012145715';
const wfsUrl = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::28992&count=1&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${PAND}</Literal></PropertyIsEqualTo></Filter>`)}`;
const wfs = await cachedJson(wfsUrl);
const ringRD: number[][] = wfs.features[0].geometry.coordinates[0].slice(0, -1);
const ax = ringRD.reduce((s, p) => s + p[0], 0) / ringRD.length, ay = ringRD.reduce((s, p) => s + p[1], 0) / ringRD.length;
const r2 = (v: number) => Math.round(v * 100) / 100;
const ring: V2[] = ringRD.map(p => [r2(p[0] - ax), r2(-(p[1] - ay))]);

const cj = await cachedJson(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${PAND}`);
const tr = cj.metadata.transform, verts: number[][] = cj.feature.vertices;
const ground: number = tr.translate[2];
const P = (i: number): V3 => {
  const v = verts[i];
  return [r2(v[0] * tr.scale[0] + tr.translate[0] - ax), r2(v[2] * tr.scale[2] + tr.translate[2] - ground), r2(-(v[1] * tr.scale[1] + tr.translate[1] - ay))];
};
const part = cj.feature.CityObjects[`NL.IMBAG.Pand.${PAND}-0`];
const lod = part.geometry.find((g: {lod: string}) => g.lod === '2.2');
const sem = lod.semantics, shell: number[][][] = lod.boundaries[0], values: (number | null)[] = sem.values[0];
const surfaces = shell.map((s, i) => ({type: values[i] == null ? 'none' : sem.surfaces[values[i]!].type as string, rings: s.map(r => r.map(P))}));

// ---- the hall: oriented rectangle of the high roof planes
const high = surfaces.filter(s => s.type === 'RoofSurface' && Math.min(...s.rings[0].map(p => p[1])) > 15);
const hp = high.flatMap(s => s.rings[0]);
let best = {area: Infinity, a: 0, lo: [0, 0], hi: [0, 0]};
for (let deg = 0; deg < 180; deg += 0.1) {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const us = hp.map(p => p[0] * c + p[2] * s), vs = hp.map(p => -p[0] * s + p[2] * c);
  const lo = [Math.min(...us), Math.min(...vs)], hi = [Math.max(...us), Math.max(...vs)], area = (hi[0] - lo[0]) * (hi[1] - lo[1]);
  if (area < best.area) best = {area, a, lo, hi};
}
const c = Math.cos(best.a), s = Math.sin(best.a);
let along: V2 = [c, s], across: V2 = [-s, c];
let L = best.hi[0] - best.lo[0], W = best.hi[1] - best.lo[1];
const centre: V2 = [((best.lo[0] + best.hi[0]) / 2) * c - ((best.lo[1] + best.hi[1]) / 2) * s, ((best.lo[0] + best.hi[0]) / 2) * s + ((best.lo[1] + best.hi[1]) / 2) * c];
if (W > L) { [L, W] = [W, L]; along = [-s, c]; across = [c, s]; }
if (along[0] < 0) along = [-along[0], -along[1]];            // `along` points east-ish (towards the stone gable)
across = [-along[1], along[0]];                              // right-handed in (x, z): `across` points south-ish
const hallTop = {eaves: r2(Math.min(...hp.map(p => p[1]))), ridge: r2(Math.max(...hp.map(p => p[1])))};
const local = (p: V3 | V2) => { const x = p[0], z = p.length === 3 ? p[2] : p[1]; const dx = x - centre[0], dz = z - centre[1]; return [dx * along[0] + dz * along[1], dx * across[0] + dz * across[1]]; };
const inHall = (p: V3) => { const [u, v] = local(p); return Math.abs(u) < L / 2 + 0.35 && Math.abs(v) < W / 2 + 0.35; };

// The hall's own surfaces stay in the shell (closed solid, no open seams against the wings) and carry `hall: true`:
// the builder colours them and dresses them with the hand-built glazing, piers, gables and roof.
const kept = surfaces.filter(s => s.type !== 'GroundSurface');
const round = (rs: V3[][]) => rs.map(r => r.map(p => p.map(r2) as V3));
const tag = (s: {rings: V3[][]}) => s.rings[0].every(inHall) ? {hall: true} : {};
const roofs = kept.filter(s => s.type === 'RoofSurface').map(s => ({rings: round(s.rings), ...tag(s)}));
const walls = kept.filter(s => s.type !== 'RoofSurface').map(s => ({ring: round(s.rings)[0], ...tag(s)}));

const anchor = rdToLngLat({x: ax, y: ay});
const out = {
  id: 'amstelstation', pand: PAND,
  frame: `x east, z south, y up from the 3DBAG ground (${r2(ground)} m NAP); origin = vertex average of the BAG ring (RD)`,
  anchorRD: [r2(ax), r2(ay)], anchor: [+anchor[0].toFixed(7), +anchor[1].toFixed(7)],
  sources: {
    bag: `https://api.data.amsterdam.nl/v1/bag/panden/${PAND}/ (CC0); outline via PDOK BAG WFS`,
    threeDBag: `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${PAND} (CC BY 4.0, fetched 2026-11-01)`,
  },
  hall: {centre: centre.map(r2), along: along.map(v => +v.toFixed(5)), across: across.map(v => +v.toFixed(5)), length: r2(L), width: r2(W), ...hallTop},
  ring, roofs, walls,
};
fs.writeFileSync('scripts/landmarks/amstelstation-footprints.json', JSON.stringify(out));
console.log(JSON.stringify({hall: out.hall, roofs: roofs.length, walls: walls.length, anchor: out.anchor}));
