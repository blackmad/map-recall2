/**
 * Olympisch Stadion (Olympisch Stadion 2, BAG pand 0363100012076088, 1928, Jan Wils) and its Marathontoren (BAG pand
 * 0363100012250984, 1928) plan source.
 *
 *   node --import tsx scripts/landmarks/olympisch-stadion-prepare.ts
 *
 * Reads both BAG outlines from PDOK BAG WFS in RD (CC0; cached in .cache/pand-reference) and writes
 * scripts/landmarks/olympisch-stadion-footprints.json in the native frame: x east, z south, y up from the ground,
 * metres, origin = vertex average of the stadium's outer BAG ring (RD).
 *
 *  - `outer`: the stadium's outer ring (the brick wall), with near-collinear vertices (< 0.12 m off the chord) merged;
 *  - `inner`: the ring's hole (the arena: track and field, open to the sky), same simplification;
 *  - `tower`: the Marathontoren's plinth outline.
 */
import fs from 'node:fs';
import {cachedJson} from '../pand-reference/core.ts';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

type V2 = [number, number];
const wfs = (id: string) => `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::28992&count=1&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${id}</Literal></PropertyIsEqualTo></Filter>`)}`;
const STADIUM = '0363100012076088', TOWER = '0363100012250984';
const stadium = (await cachedJson(wfs(STADIUM))).features[0], tower = (await cachedJson(wfs(TOWER))).features[0];
const open = (r: number[][]) => (r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r);
const outerRD = open(stadium.geometry.coordinates[0]), innerRD = open(stadium.geometry.coordinates[1]);
const ax = outerRD.reduce((s: number, p: number[]) => s + p[0], 0) / outerRD.length, ay = outerRD.reduce((s: number, p: number[]) => s + p[1], 0) / outerRD.length;
const r2 = (v: number) => Math.round(v * 100) / 100;
const nat = (p: number[]): V2 => [r2(p[0] - ax), r2(-(p[1] - ay))];
/** Douglas-Peucker on a closed ring. */
function simplify(ring: V2[], tol: number): V2[] {
  const keep = new Array(ring.length).fill(false);
  const dist = (p: V2, a: V2, b: V2) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1e-9; return Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / L; };
  const rec = (i: number, j: number) => {
    let best = -1, bi = -1;
    for (let k = i + 1; k < j; k++) { const d = dist(ring[k % ring.length], ring[i % ring.length], ring[j % ring.length]); if (d > best) { best = d; bi = k; } }
    if (best > tol) { keep[bi % ring.length] = true; rec(i, bi); rec(bi, j); }
  };
  // split at the vertex farthest from vertex 0
  let far = 0, fd = 0; ring.forEach((p, k) => { const d = Math.hypot(p[0] - ring[0][0], p[1] - ring[0][1]); if (d > fd) { fd = d; far = k; } });
  keep[0] = keep[far] = true; rec(0, far); rec(far, ring.length);
  return ring.filter((_, k) => keep[k]);
}
const outer = simplify(outerRD.map(nat), 0.12), inner = simplify(innerRD.map(nat), 0.12);
const towerRing = open(tower.geometry.coordinates[0]).map(nat);
const out = {
  id: 'olympisch-stadion',
  pands: {stadium: STADIUM, tower: TOWER},
  frame: 'x east, z south, y up from the ground; metres; origin = vertex average of the stadium outer BAG ring (RD)',
  anchorRD: [r2(ax), r2(ay)],
  anchor: rdToLngLat(ax, ay).map(v => Math.round(v * 1e7) / 1e7),
  sources: {
    bag: [STADIUM, TOWER].map(id => `https://service.pdok.nl/lv/bag/wfs/v2_0 identificatie=${id} (BAG, CC0, fetched 2026-11-01)`),
    heights: '3DBAG (CC BY 4.0): roof max 19.5 m, ridge 18.8 m, 70th pct 14.0 m above 0.9 m NAP ground (scripts/landmarks/olympisch-stadion-brief.md); wall and band heights measured on the rectified panorama crops (scripts/landmarks/olympisch-stadion-elevations.json)',
  },
  counts: {outerBag: outerRD.length, outer: outer.length, innerBag: innerRD.length, inner: inner.length},
  outer, inner, tower: towerRing,
};
fs.writeFileSync('scripts/landmarks/olympisch-stadion-footprints.json', JSON.stringify(out) + '\n');
console.log(out.anchor, out.counts, towerRing);
