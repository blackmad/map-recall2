/**
 * Mercatorplein north wall with the north tower (BAG 0363100012107349; Berlage 1925-27, the tower demolished 1961 and
 * rebuilt 1995-98 by Kolmas after the original). A hybrid builder:
 *
 *  - the 3DBAG LoD2.2 shell of the block through the large tier, its square front with the kit's ground `arcade`
 *    (seven chamfered openings between dark piers, the walk cut 2.4 m deep, shopfronts at the back, the render band);
 *  - drawn here from the measured crops (artifacts/mercatorplein/grids/n-gate.jpg, the w01-165 arcade crop at 35.9 px/m,
 *    aimed views artifacts/mercatorplein/aim/, Commons photos; docs/mercatorplein-20261014.md): the tower (shaft with
 *    three clock dials, a slit, paired windows and curved balconies in its angles; main block with the big rear
 *    windows), the gatehouse over the Mercatorstraat underpass (stepped render frame, erkers, steep tiled roof with its
 *    glazed eaves strip), the arcade front's erkers, flank windows, soldier course, coping and eight hoist beams with
 *    double scrolls.
 *
 * Frame: the square's axes (mercatorplein-kit.ts); origin the BAG footprint vertex average, as in the large tier.
 */
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {compileLargeBuilding} from '../../src/canalRecall/buildingRecipe/largeCompile';
import {validateLargeIntent} from '../../src/canalRecall/buildingRecipe/largeIntent';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts';
import intentJson from './mercatorplein-noordtoren-intent.json';
import factsJson from './mercatorplein-noordtoren-facts.json';
import {Hand, assemble, block, clockDial, cornerBalcony, erker, gatehouse, hoistBeam, nFace, panelFace, proudWindow, rect, uFace, BAND_OUT, PLINTH_OUT, type Assembled} from './mercatorplein-kit';

const FACTS = factsJson as unknown as BuildingFacts;

/** Measured (u, n, h) of the hand-built parts. */
const M = {
  base: {u0: 20.35, u1: 25.0, n0: -10.9, n1: -1.9, top: 13.9},
  main: {u0: 18.1, u1: 25.1, n0: -8.2, n1: -1.9, top: 32.4},
  core: {u0: 19.0, u1: 25.0, n0: -10.2, n1: -8.2, top: 37.4},
  pier: {u0: 20.4, u1: 23.9, n0: -10.9, n1: -10.2},
  dial: {h: 35.55, r: 0.95},
  /** balcony slabs in the angles, read in profile on tall-w02-165-0 (slab 19.3-19.4, parapet to 20.5; then 3.6 m up) */
  balconies: [19.4, 23.0, 26.6],
  plinth: 2.95, band: [2.95, 4.95] as [number, number],
};

/** Kit triangles inside the hand-built tower and gatehouse are dropped (centroid test in the square's axes). */
function inHand(u: number, n: number, h: number) {
  if (u > 20.0 && u < 37.1 && n > -11.3 && n < -1.8) return true;               // tower base, gatehouse
  if (u > 18.0 && u < 20.45 && n > -13 && n < -1.8 && h > 13.95) return true;  // tower above the arcade roof
  if (u > 20.25 && u < 20.45 && n > -12.8 && n < -10.85) return true;          // the 3DBAG wall from the arcade return to the tower
  return false;
}

export function compileNoordtoren() {
  const built = compileLargeBuilding(validateLargeIntent(intentJson), FACTS, {budget: 40000, skipCell: (_p, floor, _bay, _bays, g) => g?.index === 0 && floor >= 1});
  const H = new Hand();
  drawArcadeFront(H, built);
  drawTower(H);
  drawGate(H);
  hoistBeam(H, uFace(19.75, 1).f, 3.7, 15.35);                                  // w07: the rear wing's east face
  return {built, H};
}

function drawArcadeFront(H: Hand, built: ReturnType<typeof compileLargeBuilding>) {
  const g = built.recipe.groups[0], p = built.panels[g.mainPanel!], f = panelFace(p), L = g.lines, top = g.eavesM;
  const bays = g.bays, pitch = (p.uMax - p.uMin) / bays;
  for (let k = 0; k < bays; k++) {
    const c = p.uMin + pitch * (k + 0.5);
    // the erker over storeys 1-3, three lights in front and one per cheek, a stone cap
    erker(H, f, {s0: c - 1.25, s1: c + 1.25, front: 1.15, depth: 0.62, h0: L[1] + 0.3, h1: top - 0.55,
      storeys: [1, 2, 3].map(s => ({h0: L[s] + 0.75, h1: Math.min(L[s + 1] ?? top, top - 0.55) - 0.3, rows: [0.7]})), cap: {t: 0.16, over: 0.08}, lightsFront: 3});
    for (const s of [1, 2, 3]) for (const side of [-1, 1]) {
      const x = c + side * 2.05;
      proudWindow(H, f, {s0: x - 0.5, s1: x + 0.5, h0: L[s] + 0.75, h1: (L[s + 1] ?? top) - 0.45, mull: [0.5], rows: [0.7]});
    }
  }
  // soldier course over the render band, coping, a hoist beam over every pier axis
  H.boxF('dark', f, p.uMin, p.uMax, L[1], L[1] + 0.13, 0, 0.06);
  H.boxF('dark', f, p.uMin, p.uMax, top - 0.2, top, 0, 0.08);
  for (let k = 0; k <= bays; k++) hoistBeam(H, f, Math.min(p.uMax - 0.45, Math.max(p.uMin + 0.45, p.uMin + pitch * k)), top - 0.16);
}

function drawTower(H: Hand) {
  const {base, main, core, pier, dial} = M;
  // storey sills read on the rectified crops (tall-w02-165-0, tall-w03-345-2; 16.4 px/m): the tower's upper storeys are ~4 m
  const pair = (h: number, a: number, b: number, c: number, d: number, tall = 1.2) => [{a, b, h0: h, h1: h + tall, rows: [0.5]}, {a: c, b: d, h0: h, h1: h + tall, rows: [0.5]}];
  // base below the arcade roof: the square side (lower windows, plinth and band), the rear (two window columns, a door)
  block(H, {u0: base.u0, u1: base.u1, n0: base.n0, n1: base.n1, h0: 0, h1: base.top, sides: ['S', 'N'],
    wins: {S: [5.6, 8.2, 11.0].map(h => ({a: 22.6, b: 23.3, h0: h, h1: h + 1.2, rows: [0.5]})),
      N: [...[4.5, 7.3, 9.9, 12.4].flatMap(h => pair(h, 21.2, 21.95, 23.3, 24.05)), {a: 22.2, b: 23.1, h0: 0.06, h1: 2.4, door: true}]}});
  for (const [n, side, u0, u1] of [[base.n0, -1, base.u0, base.u1]] as [number, 1 | -1, number, number][]) {
    const {f, s} = nFace(n, side);
    H.plate('greyBrick', f, rect(s(u0), s(u1), 0, M.plinth), [], 0, PLINTH_OUT);
    H.plate('concrete', f, rect(s(u0), s(u1), M.band[0], M.band[1]), [], 0, BAND_OUT);
  }
  // the wall from the arcade's east return to the tower front (faces the forecourt)
  { const {f, s} = uFace(20.33, 1); H.wall('brick', f, rect(s(-12.75), s(-10.9), 0, base.top)); H.plate('greyBrick', f, rect(s(-12.75), s(-10.9), 0, M.plinth), [], 0, PLINTH_OUT); H.plate('concrete', f, rect(s(-12.75), s(-10.9), M.band[0], M.band[1]), [], 0, BAND_OUT); }
  // main block: big four-light windows on the rear's upper storeys, small ones below; a window column on each side
  block(H, {u0: main.u0, u1: main.u1, n0: main.n0, n1: main.n1, h0: base.top, h1: main.top, coping: true, from: {W: 16.75, E: 17.4},
    wins: {N: [...pair(14.4, 21.2, 21.95, 23.3, 24.05),
      ...[16.4, 20.9, 25.0, 29.4].map(h => ({a: 20.55, b: 22.65, h0: h, h1: h + 2.45, mull: [0.25, 0.5, 0.75], rows: [0.3, 0.62]}))],
    W: [16.9, 20.9, 25.0, 29.4].map(h => ({a: -5.6, b: -4.6, h0: h, h1: h + 1.3, rows: [0.5]})),
    E: [20.9, 25.0, 29.4].flatMap(h => pair(h, -6.0, -5.3, -4.8, -4.1, 1.3))}});
  // shaft: the core with a dial high on each side face, the pier on the square side with paired windows, the slit and the south dial
  block(H, {u0: core.u0, u1: core.u1, n0: core.n0, n1: core.n1, h0: base.top, h1: core.top, roof: false, from: {E: 17.4, N: main.top},
    wins: {W: [17.2, 21.1, 25.1, 29.0].map(h => ({a: -9.6, b: -8.8, h0: h, h1: h + 1.3, rows: [0.5]})), E: [21.1, 25.1, 29.0].map(h => ({a: -9.6, b: -8.8, h0: h, h1: h + 1.3, rows: [0.5]}))}});
  block(H, {u0: pier.u0, u1: pier.u1, n0: pier.n0, n1: pier.n1, h0: base.top, h1: core.top, roof: false, sides: ['S', 'W', 'E'],
    wins: {S: [...[14.0, 17.2, 21.1, 25.1].flatMap(h => pair(h, 21.25, 21.95, 22.35, 23.05)), {a: 22.0, b: 22.3, h0: 28.9, h1: 33.9, door: true}]}});
  H.prism('stone', [[core.u0 - 0.05, core.n1 + 0.05], [core.u0 - 0.05, core.n0], [pier.u0, core.n0], [pier.u0, pier.n0 - 0.05], [pier.u1, pier.n0 - 0.05], [pier.u1, core.n0], [core.u1 + 0.05, core.n0], [core.u1 + 0.05, core.n1 + 0.05]], core.top, core.top + 0.2);
  clockDial(H, nFace(pier.n0, -1).f, nFace(pier.n0, -1).s((pier.u0 + pier.u1) / 2), dial.h, dial.r);
  clockDial(H, uFace(core.u0, -1).f, uFace(core.u0, -1).s((core.n0 + core.n1) / 2), dial.h, dial.r);
  clockDial(H, uFace(core.u1, 1).f, uFace(core.u1, 1).s((core.n0 + core.n1) / 2), dial.h, dial.r);
  // curved balconies in the angles either side of the pier
  for (const h of M.balconies) { cornerBalcony(H, pier.u0, core.n0, -1, -1, 1.3, h); cornerBalcony(H, pier.u1, core.n0, 1, -1, 1.3, h); }
}

function drawGate(H: Hand) {
  gatehouse(H, {
    u0: 25.0, u1: 37.1, nFront: -11.1, nRear: -2.0, side: -1, eavesFront: 12.2, eavesRear: 12.0, ridge: 17.3, ridgeFront: -7.9, ridgeRear: -5.1,
    // positions read on tall-w02-165-0 (crop x 0 = u 20.54, 16.4 px/m at the sheet's scale)
    portal: {u0: 25.35, u1: 31.2, spring: 3.9, head: 5.0, chamfer: 1.1},
    frame: {reach: 0.75, shoulder: 5.4, inset: 0.5, crown: 6.1, uMin: 25.02, uMax: 37.0},
    plinth: M.plinth, band: M.band,
    erker: {u0: 26.35, u1: 30.1, front: 2.2, depth: 0.7, h0: 6.4, h1: 10.6, win: [6.95, 10.0], capT: 0.3},
    windows: [{u0: 25.25, u1: 26.1, h0: 7.0, h1: 10.0}, {u0: 30.4, u1: 31.4, h0: 7.0, h1: 10.0}, {u0: 34.5, u1: 35.5, h0: 7.0, h1: 10.0}],
    doors: [{u0: 33.3, u1: 34.4, h1: 2.5}],
    ends: ['E'],
  });
}

export let lastNoordtorenStats: Assembled | null = null;
export function buildMercatorpleinNoordtoren(_w: number, _d: number, b: BuildingTools) {
  const {built, H} = compileNoordtoren();
  lastNoordtorenStats = assemble(built, H, inHand, (g: T.BufferGeometry, c: string) => b.add(g, c as never));
}
