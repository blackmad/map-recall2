/**
 * Hirschgebouw (Leidseplein / Kleine-Gartmanplantsoen, BAG 0363100012165488, Rijksmonument 518447) plan source.
 *
 *   node --import tsx scripts/landmarks/hirschgebouw-prepare.ts
 *
 * Reads the BAG ring and the 3DBAG LoD2.2 walls and roofs cached in
 * scripts/building-recipes/houses/hirschpassage-2-165488/facts.json (BAG CC0, 3DBAG CC BY 4.0, fetched 2026-10-14) and writes
 * scripts/landmarks/hirschgebouw-footprints.json in the native frame: x east, z south, y up from the 3DBAG ground
 * (0.55 m NAP), metres, origin = vertex average of the BAG ring (RD), the large tier's frame.
 *
 *  - three facade lines (the bay walls between the giant half-columns, fitted on the BAG facets) and the rounded corner
 *    (circle fit on the BAG arc vertices);
 *  - the 3DBAG walls and roofs the builder keeps as the rear shell: every surface except the street fronts, their
 *    mansard band and the domed corner, which the builder draws by hand.
 */
import fs from 'node:fs';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

type V2 = [number, number];
const facts = JSON.parse(fs.readFileSync('scripts/building-recipes/houses/hirschpassage-2-165488/facts.json', 'utf8'));
const g: number = facts.heights.groundNAP;
const ringRD: number[][] = facts.bagFootprintRD[0].slice(0, -1);
const ax = ringRD.reduce((s, p) => s + p[0], 0) / ringRD.length, ay = ringRD.reduce((s, p) => s + p[1], 0) / ringRD.length;
const r2 = (v: number) => Math.round(v * 100) / 100;
const L = (p: number[]): V2 => [p[0] - ax, -(p[1] - ay)];
const L3 = (p: number[]) => [r2(p[0] - ax), r2(p[2] - g), r2(-(p[1] - ay))];
const ring = ringRD.map(L);
const near = (q: V2) => ring.reduce((b, p) => Math.hypot(p[0] - q[0], p[1] - q[1]) < Math.hypot(b[0] - q[0], b[1] - q[1]) ? p : b);

/** A facade line through two BAG bay-facet vertices; t runs from `a` towards `b`, n points out of the block. */
function line(a: V2, b: V2) {
  const A = near(a), B = near(b), l = Math.hypot(B[0] - A[0], B[1] - A[1]), d: V2 = [(B[0] - A[0]) / l, (B[1] - A[1]) / l];
  let n: V2 = [d[1], -d[0]]; if (n[0] * -A[0] + n[1] * -A[1] > 0) n = [-n[0], -n[1]];
  return {P: [r2(A[0]), r2(A[1])] as V2, d: [+d[0].toFixed(5), +d[1].toFixed(5)] as V2, n: [+n[0].toFixed(5), +n[1].toFixed(5)] as V2};
}
// Bay walls: NW (Leidseplein) from the corner pilaster towards the west end, NE (Kleine-Gartmanplantsoen) from the
// corner pilaster towards the east corner, SE (Hirschpassage) from the east corner towards the south-west.
const faces = {nw: line([-3.8, -21.6], [-39.8, 5.9]), ne: line([6.6, -20.2], [20.7, -1.6]), se: line([30.1, 13.2], [3.4, 33.5])};

// Rounded corner: Kasa circle fit on the BAG vertices between the two corner pilaster fronts.
const iA = ring.indexOf(near([5.8, -22.1])), iB = ring.indexOf(near([-2.5, -23.2]));
const arcPts = ring.slice(Math.min(iA, iB), Math.max(iA, iB) + 1);
function fitCircle(pts: V2[]) {
  const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (const p of pts) { const u = p[0] - mx, v = p[1] - my; suu += u * u; svv += v * v; suv += u * v; suuu += u ** 3; svvv += v ** 3; suvv += u * v * v; svuu += v * u * u; }
  const det = suu * svv - suv * suv, b0 = (suuu + suvv) / 2, b1 = (svvv + svuu) / 2, uc = (b0 * svv - b1 * suv) / det, vc = (suu * b1 - suv * b0) / det;
  const c: V2 = [mx + uc, my + vc], r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n);
  return {c: [r2(c[0]), r2(c[1])] as V2, r: r2(r), worst: r2(Math.max(...pts.map(p => Math.abs(Math.hypot(p[0] - c[0], p[1] - c[1]) - r)))), n};
}
const arc = fitCircle(arcPts);

// ---- rear shell from 3DBAG: drop what the builder draws by hand
const off = (f: {P: V2; n: V2; d: V2}, p: V2) => ({t: (p[0] - f.P[0]) * f.d[0] + (p[1] - f.P[1]) * f.d[1], v: (p[0] - f.P[0]) * f.n[0] + (p[1] - f.P[1]) * f.n[1]});
const SPAN = {nw: [-2.5, 47.6], ne: [-2.5, 42], se: [-2.5, 36]} as const;
/** On a street front (within its span and `inside` m behind the bay line, `outside` in front) or in the domed corner. */
function hand(p: V2, inside: number, outside = 1.4) {
  for (const k of ['nw', 'ne', 'se'] as const) { const {t, v} = off(faces[k], p); if (t > SPAN[k][0] && t < SPAN[k][1] && v > -inside && v < outside) return k; }
  if (Math.hypot(p[0] - arc.c[0], p[1] - arc.c[1]) < arc.r + 1.4) return 'corner';
  return null;
}
const walls: {ring: number[][]; top: number}[] = []; let dropW = 0;
for (const w of facts.wallsRD) {
  const r = w.ringsRD[0], mid: V2 = L([r.reduce((s: number, p: number[]) => s + p[0], 0) / r.length, r.reduce((s: number, p: number[]) => s + p[1], 0) / r.length]);
  if (hand(mid, 3.6)) { dropW++; continue; }
  walls.push({ring: r.map(L3), top: r2(w.topM)});
}
const roofs: {rings: number[][][]; h: number}[] = []; let dropR = 0;
for (const s of facts.roofsRD) {
  const r = s.ringsRD[0], hs = r.map((p: number[]) => p[2] - g), h = hs.reduce((a: number, b: number) => a + b, 0) / hs.length;
  const mid: V2 = L([r.reduce((a: number, p: number[]) => a + p[0], 0) / r.length, r.reduce((a: number, p: number[]) => a + p[1], 0) / r.length]);
  const big = s.surfaceId.endsWith(':491');
  if (big || (h > 20 && hand(mid, 3.6))) { dropR++; continue; } // 491 (the 27.4 m flat) is redrawn by the builder, spliced to the mansards
  roofs.push({rings: s.ringsRD.map((rr: number[][]) => rr.map(L3)), h: r2(h)});
}
const flat = facts.roofsRD.find((s: {surfaceId: string}) => s.surfaceId.endsWith(':491'));
const out = {
  id: 'hirschgebouw', pand: '0363100012165488',
  frame: 'x east, z south, y up from the 3DBAG ground (0.55 m NAP); origin = vertex average of the BAG ring (RD)',
  anchorRD: [r2(ax), r2(ay)], anchor: rdToLngLat(ax, ay).map(v => +v.toFixed(7)),
  sources: {bag: 'https://api.data.amsterdam.nl/v1/bag/panden/0363100012165488/ (CC0)', threeDBag: facts.source.threeDBag + ' (CC BY 4.0, fetched ' + facts.source.fetchedAt + ')'},
  ring: ring.map(p => [r2(p[0]), r2(p[1])]),
  ringLngLat: ringRD.map(p => rdToLngLat(p[0], p[1]).map(v => +v.toFixed(7))),
  faces, arc,
  flatRoof: {h: r2(flat.ringsRD[0].reduce((a: number, p: number[]) => a + p[2], 0) / flat.ringsRD[0].length - g), outer: flat.ringsRD[0].map(L3), holes: flat.ringsRD.slice(1).map((rr: number[][]) => rr.map(L3))},
  walls, roofs,
};
fs.writeFileSync('scripts/landmarks/hirschgebouw-footprints.json', JSON.stringify(out));
console.log('anchor', out.anchor, 'faces', JSON.stringify(faces), 'arc', JSON.stringify(arc));
console.log(`walls kept ${walls.length} dropped ${dropW}; roofs kept ${roofs.length} dropped ${dropR}; flat ${out.flatRoof.h} m holes ${out.flatRoof.holes.length}`);
// corner geometry: east corner = intersection of the NE and SE bay lines
const {ne, se} = faces, den = ne.d[0] * se.d[1] - ne.d[1] * se.d[0];
const tNE = ((se.P[0] - ne.P[0]) * se.d[1] - (se.P[1] - ne.P[1]) * se.d[0]) / den, sSE = ((se.P[0] - ne.P[0]) * ne.d[1] - (se.P[1] - ne.P[1]) * ne.d[0]) / den;
console.log('E corner: NE t', tNE.toFixed(2), 'SE s', sSE.toFixed(2));
for (const k of ['nw', 'ne'] as const) { const o = off(faces[k], arc.c); console.log(k, 'arc centre t', o.t.toFixed(2), 'v', o.v.toFixed(2)); }
