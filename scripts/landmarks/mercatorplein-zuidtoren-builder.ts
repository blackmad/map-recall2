/**
 * Mercatorplein south gatehouse and tower (BAG 0363100012073289, 1927; Berlage; rijksmonument 527135: "poortgebouw met
 * hoge toren"). A hybrid builder:
 *
 *  - the east bay through the large tier (the 3DBAG shell east of the gatehouse, kit windows and shopfronts), its
 *    erker and hoist beam drawn here;
 *  - drawn here from the measured crops (artifacts/mercatorplein/grids/s-north-low.jpg, the tall crops of w01/w02, the
 *    Commons photo Mercatorplein 1-17 (1).jpg; docs/mercatorplein-20261014.md): the eight-storey tower (three small
 *    windows per storey below, four big four-light windows above with the stepped corbel under the lowest, grooved
 *    corners, the east face's small windows and diaper frieze), its narrower rear shaft with paired windows and the
 *    balconies in its angles, and the gatehouse over the Van Spilbergenstraat underpass (stepped render frame, erkers,
 *    steep tiled roof with its glazed eaves strip and the low three-light dormer).
 *
 * Frame: the square's axes (mercatorplein-kit.ts); origin the BAG footprint vertex average, as in the large tier.
 */
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {compileLargeBuilding} from '../../src/canalRecall/buildingRecipe/largeCompile';
import {validateLargeIntent} from '../../src/canalRecall/buildingRecipe/largeIntent';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts';
import intentJson from './mercatorplein-zuidtoren-intent.json';
import factsJson from './mercatorplein-zuidtoren-facts.json';
import {Hand, assemble, block, boxBalcony, erker, gatehouse, hoistBeam, nFace, panelFace, plinthWithDoors, rect, uFace, type Assembled, type BlockWin} from './mercatorplein-kit';

const FACTS = factsJson as unknown as BuildingFacts;

const M = {
  tower: {u0: -13.3, u1: -6.6, n0: -2.7, n1: 3.6, top: 29.2},
  /** the full-width rear base stops under the lowest balcony; above it the narrower shaft (tall-w01-164-1: u -12.3..-7.6) */
  rear: {n0: -5.3, top: 15.0},
  shaft: {u0: -12.3, u1: -7.6, top: 35.4},
  /** balcony slabs read on tall-w01-164-1 (white soffits at 19.4 and 23.6; the third, lowest, at the base top) */
  balconies: [15.6, 19.6, 23.7],
  gateRoof: 16.9,
};

/** Kit triangles in the hand-built tower and gatehouse (everything west of the east bay, and the gate roof above it). */
const inHand = (u: number, n: number, h: number) => u < 3.45 || (u < 4.75 && n < 3.6 && h > 14.3);

export function compileZuidtoren() {
  const built = compileLargeBuilding(validateLargeIntent(intentJson), FACTS, {budget: 40000, skipCell: (_p, floor, bay, _bays, g) => g?.index === 0 && floor >= 1 && bay === 1});
  const H = new Hand();
  drawTower(H);
  drawGate(H);
  // east bay (w03-344): the erker over storeys 1-3 in the middle bay and a hoist beam over it
  const g = built.recipe.groups[0], p = built.panels[g.mainPanel!], f = panelFace(p), L = g.lines, top = g.eavesM, c = (p.uMin + p.uMax) / 2;
  erker(H, f, {s0: c - 1.2, s1: c + 1.2, front: 1.1, depth: 0.6, h0: L[1] + 0.3, h1: top - 0.55,
    storeys: [1, 2, 3].map(s => ({h0: L[s] + 0.7, h1: Math.min(L[s + 1] ?? top, top - 0.55) - 0.3, rows: [0.7]})), cap: {t: 0.16, over: 0.08}, lightsFront: 3});
  // the bay's 3DBAG wall top runs 13.9-14.1 m: coping strip and beam kept under its lower end
  H.boxF('dark', f, p.uMin, p.uMax, top - 0.45, top - 0.25, 0, 0.08);
  hoistBeam(H, f, c, top - 1.0);  // the scroll kept on the wall face: the audit counts iron standing over this panel edge as an overhang
  return {built, H};
}

function drawTower(H: Hand) {
  const {tower: t, rear, shaft} = M;
  // read on tall-w02-344-0 (s-w02-ortho grid, the tower's east edge put on the 3DBAG -6.6; heights scaled to the 29.2 m roof)
  const lowerU: [number, number][] = [[-8.9, -8.0], [-10.2, -9.3], [-11.4, -10.5]];
  const front: BlockWin[] = [
    ...[4.1, 7.0, 9.75].flatMap(h => lowerU.map(([a, b]) => ({a, b, h0: h, h1: h + 1.35, rows: [0.5]}))),
    ...[12.85, 16.75, 20.85, 24.9].map(h => ({a: -11.1, b: -8.8, h0: h, h1: h + 2.3, mull: [0.25, 0.5, 0.75], rows: [0.22, 0.5, 0.76]})),
    {a: -11.4, b: -9.8, h0: 0.06, h1: 2.55, door: true},
    {a: -11.4, b: -9.8, h0: 2.68, h1: 3.08, mull: [1 / 3, 2 / 3]},
  ];
  const side = (n0: number, n1: number): BlockWin[] => [19.5, 22.5, 25.5].map(h => ({a: n0, b: n1, h0: h, h1: h + 0.6, mull: [0.25, 0.5, 0.75]}));
  block(H, {u0: t.u0, u1: t.u1, n0: t.n0, n1: t.n1, h0: 0, h1: t.top, coping: true, from: {E: M.gateRoof, S: rear.top},
    wins: {N: front, E: side(-0.5, 1.4), W: side(-0.5, 1.4)}});
  const {f: nf, s: ns} = nFace(t.n1, 1), {f: ef, s: es} = uFace(t.u1, 1);
  // plinth on the front; the stepped corbel under the lowest big window; grooved corners above the gate roof
  plinthWithDoors(H, nf, ns(t.u1), ns(t.u0), 2.5, [{s0: ns(-9.8), s1: ns(-11.4), h0: 0.06, h1: 2.55}]);
  [[2.4, 11.8, 12.15, 0.05], [2.8, 12.15, 12.5, 0.1], [3.2, 12.5, 12.82, 0.15]].forEach(([w, h0, h1, d]) => H.boxF('brick', nf, ns(-9.95) - w / 2, ns(-9.95) + w / 2, h0, h1, 0, d));
  for (const u of [-13.18, -13.04, -12.9, -6.72, -6.86, -7.0]) H.boxF('greyBrick', nf, ns(u) - 0.025, ns(u) + 0.025, M.gateRoof, t.top - 1.6, 0, 0.05);
  // diaper frieze under the coping on the east face: a lighter band with a row of raised lozenges
  const f0 = es(t.n0) + 0.2, f1 = es(t.n1) - 0.2, part = H.plate('red', ef, rect(f0, f1, t.top - 1.5, t.top - 0.25), [], 0, 0.05);
  for (let s = f0 + 0.35; s < f1 - 0.3; s += 0.6) H.plate('red', ef, [[s, t.top - 1.15], [s + 0.25, t.top - 0.875], [s, t.top - 0.6], [s - 0.25, t.top - 0.875]], [], 0.05, 0.1, part);
  // rear base (full width below the angles): two window columns and a door on the rear
  block(H, {u0: t.u0, u1: t.u1, n0: rear.n0, n1: t.n0, h0: 0, h1: rear.top, sides: ['S', 'W'],
    wins: {S: [...[3.5, 6.5, 9.8].flatMap(h => [{a: -12.4, b: -11.3, h0: h, h1: h + 1.4, rows: [0.5]}, {a: -9.8, b: -8.7, h0: h, h1: h + 1.4, rows: [0.5]}]), {a: -9.6, b: -7.8, h0: 0.06, h1: 2.1, door: true}]}});
  plinthWithDoors(H, nFace(rear.n0, -1).f, t.u0, t.u1, 2.5, [{s0: -9.6, s1: -7.8, h0: 0.06, h1: 2.1}]);
  // the rear shaft with four pairs of tall narrow windows, the balconies in its angles
  block(H, {u0: shaft.u0, u1: shaft.u1, n0: rear.n0, n1: t.n0, h0: rear.top, h1: shaft.top, coping: true, sides: ['S', 'W', 'E', 'N'], from: {N: t.top},
    // four pairs of tall narrow small-paned windows, left of the shaft's centre line (tall-w01-164-1)
    wins: {S: [16.2, 20.6, 25.0, 29.5].flatMap(h => [{a: -11.3, b: -10.85, h0: h, h1: h + 2.2, rows: [0.25, 0.5, 0.75]}, {a: -10.65, b: -10.2, h0: h, h1: h + 2.2, rows: [0.25, 0.5, 0.75]}])}});
  for (const h of M.balconies) {
    boxBalcony(H, t.u0, shaft.u0, rear.n0 - 0.25, t.n0, h, {n: 0, u: 0});
    boxBalcony(H, shaft.u1, t.u1, rear.n0 - 0.25, t.n0, h, {n: 0, u: 1});
  }
}

function drawGate(H: Hand) {
  gatehouse(H, {
    // the mean of the front (tall-w02-344-0) and rear (tall-w01-164-1) readings, which agree to 0.5 m
    u0: -6.6, u1: 3.55, nFront: 3.5, nRear: -5.4, side: 1, eavesFront: 11.5, eavesRear: 11.6, ridge: M.gateRoof, ridgeFront: 0.55, ridgeRear: -2.0,
    portal: {u0: -6.1, u1: -0.95, spring: 3.7, head: 5.0, chamfer: 1.3},
    frame: {reach: 0.9, shoulder: 5.2, inset: 0.5, crown: 6.1, uMin: -6.55, uMax: 3.5},
    plinth: 3.2, band: [3.2, 4.9],
    erker: {u0: -5.15, u1: -1.8, front: 2.0, depth: 0.7, h0: 6.4, h1: 10.15, win: [6.95, 9.75], capT: 0.3},
    windows: [{u0: -6.45, u1: -5.5, h0: 6.95, h1: 9.75}, {u0: -1.6, u1: -0.6, h0: 6.95, h1: 9.75}, {u0: 2.0, u1: 3.0, h0: 6.5, h1: 8.0}],
    doors: [{u0: 0.6, u1: 1.6, h1: 2.5}],
    dormer: {u0: -4.5, u1: -2.7, h0: 13.9, h1: 15.0, nFace: 2.3},
    ends: ['E'],
  });
}

export let lastZuidtorenStats: Assembled | null = null;
export function buildMercatorpleinZuidtoren(_w: number, _d: number, b: BuildingTools) {
  const {built, H} = compileZuidtoren();
  lastZuidtorenStats = assemble(built, H, inHand, (g: T.BufferGeometry, c: string) => b.add(g, c as never));
}
