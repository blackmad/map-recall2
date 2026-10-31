/**
 * Kalvertoren / Kalverpassage (Singel 451-463, Kalverstraat 218-222, Heiligeweg passage; BAG 0363100012165086, 1997)
 * plan source.
 *
 *   node --import tsx scripts/landmarks/kalvertoren-prepare.ts
 *
 * Reads the BAG ring and the 3DBAG LoD2.2 walls and roofs cached in
 * scripts/building-recipes/houses/singel-457-165086/facts.json (BAG CC0, 3DBAG CC BY 4.0, fetched 2026-10-14) and writes
 * scripts/landmarks/kalvertoren-footprints.json in the native frame: x east, z south, y up from the 3DBAG ground
 * (0.40 m NAP), metres, origin = vertex average of the BAG ring (RD).
 *
 *  - the street fronts the builder draws by hand, each as a line through two BAG vertices (t from the first vertex,
 *    n out of the block): the two Singel brick ranges (w04, w01), the Singel stone block (w03), the Kalverstraat blocks
 *    (w06 + w02), the narrow Kalverstraat glass front (w05) and the Heiligeweg passage mouth (w07);
 *  - the glass tower (3DBAG roofs 547/550/571/578/596, 29-31 m) as a circle fit on their outline;
 *  - the 3DBAG walls and roofs kept as the shell, each with a material class: everything except the hand fronts, the
 *    tower and the stone block's attic (roofs 557/564/586/607/608/629), which the builder redraws. Sawtooth roof
 *    strips behind the colonnade are glass in the panoramas (w01-192, w01-192L), the saddle roofs behind the two
 *    gables are red tile (tower-singel-even-e).
 */
import fs from 'node:fs';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

type V2 = [number, number];
const facts = JSON.parse(fs.readFileSync('scripts/building-recipes/houses/singel-457-165086/facts.json', 'utf8'));
const g: number = facts.heights.groundNAP;
const ringRD0: number[][] = facts.bagFootprintRD[0];
const ringRD = ringRD0[0][0] === ringRD0.at(-1)![0] && ringRD0[0][1] === ringRD0.at(-1)![1] ? ringRD0.slice(0, -1) : ringRD0;
const ax = ringRD.reduce((s, p) => s + p[0], 0) / ringRD.length, ay = ringRD.reduce((s, p) => s + p[1], 0) / ringRD.length;
const r2 = (v: number) => Math.round(v * 100) / 100;
const L = (p: number[]): V2 => [p[0] - ax, -(p[1] - ay)];
/** Shell vertices are clamped to the ground: 3DBAG has a 2.6 m deep ramp roof that would hang below the street. */
const L3 = (p: number[]) => [r2(p[0] - ax), r2(Math.max(0, p[2] - g)), r2(-(p[1] - ay))];
const ring = ringRD.map(L);
const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;

/** A front line from BAG vertex i to vertex j; n points out of the block (away from the ring's interior side). */
function line(i: number, j: number) {
  const A = ring[i], B = ring[j], l = Math.hypot(B[0] - A[0], B[1] - A[1]), d: V2 = [(B[0] - A[0]) / l, (B[1] - A[1]) / l];
  let n: V2 = [d[1], -d[0]];
  // outward = the side of the line away from a point just inside the ring; use the polygon orientation
  let area = 0; for (let k = 0; k < ring.length; k++) { const p = ring[k], q = ring[(k + 1) % ring.length]; area += p[0] * q[1] - q[0] * p[1]; }
  // for a ring with signed area > 0 (counter-clockwise in x/z), the outward normal of edge d is (d.z, -d.x)
  if (area < 0) n = [-n[0], -n[1]];
  return {P: [r2(A[0]), r2(A[1])] as V2, d: [+d[0].toFixed(5), +d[1].toFixed(5)] as V2, n: [+n[0].toFixed(5), +n[1].toFixed(5)] as V2, len: r2(l)};
}
const faces = {
  singelW: line(36, 37), singelE: line(38, 39), stone: line(41, 52),
  kalverS: line(57, 58), kalver: line(58, 0), kalverN: line(7, 10), heilige: line(18, 19),
};
// sanity: Singel fronts face south (+z), Kalverstraat fronts north-east (+x, -z)
for (const [k, f] of Object.entries(faces)) console.log(k, 'len', f.len, 'n', f.n);

// ---- the glass tower: Kasa circle fit on the outline vertices of its five 3DBAG roofs (29-31 m)
const TOWER_IDS = ['547', '550', '571', '578', '596'];
const towerPts: V2[] = [];
for (const s of facts.roofsRD) if (TOWER_IDS.includes(s.surfaceId.split(':').pop())) for (const p of s.ringsRD[0]) towerPts.push(L(p));
function fitCircle(pts: V2[]) {
  const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (const p of pts) { const u = p[0] - mx, v = p[1] - my; suu += u * u; svv += v * v; suv += u * v; suuu += u ** 3; svvv += v ** 3; suvv += u * v * v; svuu += v * u * u; }
  const det = suu * svv - suv * suv, b0 = (suuu + suvv) / 2, b1 = (svvv + svuu) / 2, uc = (b0 * svv - b1 * suv) / det, vc = (suu * b1 - suv * b0) / det;
  const c: V2 = [mx + uc, my + vc], r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n);
  return {c: [r2(c[0]), r2(c[1])] as V2, r: r2(r)};
}
// The outline is the union of five roof facets, not a clean circle (a Kasa fit lands 0.9 m off and 1 m small): take the
// bounding-box centre and the median of the 12-sector maximum radius about it.
const xs = towerPts.map(p => p[0]), zs = towerPts.map(p => p[1]);
const tc: V2 = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
const bins = Array(12).fill(0);
for (const p of towerPts) { const a = Math.atan2(p[1] - tc[1], p[0] - tc[0]), k = Math.floor((a + Math.PI) / (2 * Math.PI) * 12) % 12; bins[k] = Math.max(bins[k], Math.hypot(p[0] - tc[0], p[1] - tc[1])); }
const tower = {c: [r2(tc[0]), r2(tc[1])] as V2, r: r2([...bins].sort((a, b) => a - b)[6]), kasa: fitCircle(towerPts)};
const towerTop = r2(Math.max(...facts.roofsRD.filter((s: {surfaceId: string}) => TOWER_IDS.includes(s.surfaceId.split(':').pop()!)).flatMap((s: {ringsRD: number[][][]}) => s.ringsRD[0].map(p => p[2] - g))));

// ---- shell: drop what the builder draws by hand
const off = (f: {P: V2; n: V2; d: V2}, p: V2) => ({t: (p[0] - f.P[0]) * f.d[0] + (p[1] - f.P[1]) * f.d[1], v: (p[0] - f.P[0]) * f.n[0] + (p[1] - f.P[1]) * f.n[1]});
function onFront(p: V2, inside: number, outside = 1.4) {
  for (const [k, f] of Object.entries(faces)) { const {t, v} = off(f, p); if (t > -0.6 && t < f.len + 0.6 && v > -inside && v < outside) return k; }
  return null;
}
const RD = (x: number, y: number): V2 => L([121000 + x, 486000 + y]);
const inTower = (p: V2, pad = 1.5) => Math.hypot(p[0] - tower.c[0], p[1] - tower.c[1]) < tower.r + pad;
/** The stone block's roof area (BAG x 233-284, y 699-722, south of the atrium). */
const stoneA = RD(233, 699), stoneB = RD(284, 722);
const inStone = (p: V2) => p[0] > Math.min(stoneA[0], stoneB[0]) && p[0] < Math.max(stoneA[0], stoneB[0]) && p[1] < Math.max(stoneA[1], stoneB[1]) + 1 && p[1] > Math.min(stoneA[1], stoneB[1]) - 0.5;
const brickA = RD(183, 0), brickB = RD(233.5, 0), brickN = RD(0, 731);
const inBrick = (p: V2) => p[0] > brickA[0] && p[0] < brickB[0] && p[1] > brickN[1];
const STONE_ATTIC = ['544', '557', '564', '585', '586', '607', '608', '627', '629'];
const GLASS_ROOFS = ['568', '570', '582', '609', '621'];
const TILE_ROOFS = ['587', '622', '625'];
/** The Heiligeweg passage strip under the diamond-lattice glass canopy (w07-331, 2023). */
const CANOPY_ROOFS = ['572', '573'];

/** Clip a 3D ring (x, y, z) to y <= ymax (Sutherland-Hodgman against one plane). */
function clipBelow(r: number[][], ymax: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i], c = r[(i + 1) % r.length], ia = a[1] <= ymax, ic = c[1] <= ymax;
    if (ia) out.push(a);
    if (ia !== ic) { const u = (ymax - a[1]) / (c[1] - a[1]); out.push([r2(a[0] + (c[0] - a[0]) * u), ymax, r2(a[2] + (c[2] - a[2]) * u)]); }
  }
  return out.length >= 3 ? out : [];
}
/** Tower walls are kept up to the deck of the glass shaft, stone-block walls up to the attic deck. */
const TOWER_BASE = 14.4, ATTIC_DECK = 17.5, TILE_MAX = 20.4;
const walls: {ring: number[][]; top: number; c: string}[] = []; const dropW: Record<string, number> = {};
for (const w of facts.wallsRD) {
  const r = w.ringsRD[0], mid: V2 = L([r.reduce((s: number, p: number[]) => s + p[0], 0) / r.length, r.reduce((s: number, p: number[]) => s + p[1], 0) / r.length]);
  const fr = onFront(mid, 3.6, 3.0);
  let why: string | null = fr;
  // keep the glass sawtooth gable ends above the brick cornice (bottom >= 13.6 m), except inside the two masonry gables
  if ((fr === 'singelW' || fr === 'singelE') && w.bottomM >= 13.6) {
    const t = off(faces[fr], mid).t, gs = fr === 'singelW' ? [1.8, 12.5] : [20.7, 31.4];
    if (t < gs[0] || t > gs[1]) why = null;
  }
  let clip = Infinity;
  if (!why && inTower(mid) && w.topM > TOWER_BASE) { if (w.bottomM >= TOWER_BASE - 0.05) why = 'tower'; else clip = TOWER_BASE; }
  if (!why && inStone(mid) && w.topM > ATTIC_DECK) { if (w.bottomM >= ATTIC_DECK - 0.05) why = 'stone-attic'; else clip = Math.min(clip, ATTIC_DECK); }
  if (why) { dropW[why] = (dropW[why] ?? 0) + 1; continue; }
  const c = inBrick(mid) ? (w.bottomM >= 13.4 ? 'glass' : 'brick') : inStone(mid) ? 'stone' : 'greyBrick';
  const ring3 = clip < Infinity ? clipBelow(r.map(L3), clip) : r.map(L3);
  if (!ring3.length) { dropW.clipped = (dropW.clipped ?? 0) + 1; continue; }
  walls.push({ring: ring3, top: r2(Math.min(w.topM, clip)), c});
}
const roofs: {rings: number[][][]; h: number; c: string; id: string}[] = []; const towerDeck: number[][][] = []; const dropR: string[] = []; const atticDeck: number[][][] = [];
for (const s of facts.roofsRD) {
  const id = s.surfaceId.split(':').pop();
  const r = s.ringsRD[0], hs = r.map((p: number[]) => p[2] - g), h = hs.reduce((a: number, b: number) => a + b, 0) / hs.length;
  if (TOWER_IDS.includes(id)) { dropR.push(id); towerDeck.push(r.map(L3).map(p => [p[0], TOWER_BASE, p[2]])); continue; }
  if (STONE_ATTIC.includes(id)) { dropR.push(id); atticDeck.push(r.map(L3)); continue; }
  const c = GLASS_ROOFS.includes(id) ? 'glass' : TILE_ROOFS.includes(id) ? 'red' : CANOPY_ROOFS.includes(id) ? 'canopyGlass' : 'slate';
  const rings = s.ringsRD.map((rr: number[][]) => rr.map(L3).map(p => c === 'red' ? [p[0], Math.min(p[1], TILE_MAX), p[2]] : p));
  roofs.push({rings, h: r2(h), c, id});
}
// ---- party-wall fill: on footprint edges that are not hand fronts, 3DBAG has no wall below the neighbour's height
// (e.g. the SE party edge 53-54 starts at 10.5 m); close it from the ground to the lowest kept wall bottom on that edge.
const FRONT_EDGES = new Set(['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51', '57', '58', '7', '8', '9', '18']);
const partyFill: {a: V2; b: V2; h: number}[] = [];
for (let i = 0; i < ring.length; i++) {
  if (FRONT_EDGES.has(String(i))) continue;
  const A = ring[i], B = ring[(i + 1) % ring.length], len = Math.hypot(B[0] - A[0], B[1] - A[1]);
  if (len < 1) continue;
  const d: V2 = [(B[0] - A[0]) / len, (B[1] - A[1]) / len];
  let h = Infinity, any = false;
  for (const w of walls) {
    const xs = w.ring.map(p => p[0]), zs = w.ring.map(p => p[2]), m: V2 = [xs.reduce((a, b) => a + b, 0) / xs.length, zs.reduce((a, b) => a + b, 0) / zs.length];
    const t = (m[0] - A[0]) * d[0] + (m[1] - A[1]) * d[1], v = Math.abs((m[0] - A[0]) * d[1] - (m[1] - A[1]) * d[0]);
    if (t < -0.2 || t > len + 0.2 || v > 0.4) continue;
    any = true; h = Math.min(h, ...w.ring.map(p => p[1]));
  }
  if (any && h > 0.3) partyFill.push({a: [r2(A[0]), r2(A[1])], b: [r2(B[0]), r2(B[1])], h: r2(h)});
}
console.log('party fill', partyFill.length, 'edges', JSON.stringify(partyFill.map(p => p.h)));
const out = {
  id: 'kalvertoren', pand: '0363100012165086',
  frame: 'x east, z south, y up from the 3DBAG ground (0.40 m NAP); origin = vertex average of the BAG ring (RD)',
  anchorRD: [r2(ax), r2(ay)], anchor: rdToLngLat(ax, ay).map(v => +v.toFixed(7)),
  sources: {bag: 'https://api.data.amsterdam.nl/v1/bag/panden/0363100012165086/ (CC0)', threeDBag: facts.source.threeDBag + ' (CC BY 4.0, fetched ' + facts.source.fetchedAt + ')'},
  ring: ring.map(p => [r2(p[0]), r2(p[1])]),
  ringLngLat: ringRD.map(p => rdToLngLat(p[0], p[1]).map(v => +v.toFixed(7))),
  centroid: [r2(cx), r2(cz)],
  faces, tower: {...tower, top: towerTop},
  partyFill, atticDeck, towerDeck, towerBase: TOWER_BASE, atticDeckY: ATTIC_DECK, walls, roofs,
};
fs.writeFileSync('scripts/landmarks/kalvertoren-footprints.json', JSON.stringify(out));
console.log('anchor', out.anchor, 'tower', JSON.stringify(out.tower));
console.log(`walls kept ${walls.length} dropped ${JSON.stringify(dropW)}; roofs kept ${roofs.length} dropped ${dropR.length} (${dropR.join(',')})`);
const cls = (xs: {c: string}[]) => xs.reduce((m: Record<string, number>, x) => (m[x.c] = (m[x.c] ?? 0) + 1, m), {});
console.log('wall classes', JSON.stringify(cls(walls)), 'roof classes', JSON.stringify(cls(roofs)));
