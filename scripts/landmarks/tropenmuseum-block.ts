import type {PanelCtx} from '../../src/canalRecall/blockBuilding/compose';
import {archHead, archRing, extrude, FRAME, geom, GLASS, KitStats, proudWindow, shapeOf, solid, STONE, WALL} from './tropenmuseum-kit';
import {pavilionStage, type PavilionWall} from './tropenmuseum-pavilion';

/**
 * The connecting block between the two museum pavilions (inventory w16-61, panel 156): 3DBAG carries its face only to 12 m, then a slate
 * roof, and the stage over the 16.4 m cornice on another plane 3 m back. The panorama shows one flush face (tall-w16-61-0.jpg), so a
 * brick slab is stood on the panel's plane from 12 m to the top of the big cornice, burying that roof, and carries the third floor
 * (arched triple head over two tiers, side windows), the console cornice and the pavilion's stage at 0.7 scale. The windows are applied
 * to the slab's face (proudWindow): the host wall has nothing there to cut.
 */
export interface BlockSpec {
  what: string;
  slab: {y: [number, number]; depth: number; inset: number};
  third: {sideLower: [number, number]; sideUpper: [number, number]; cLower: [number, number]; cUpper: [number, number]; arch: {spring: number; top: number}; hoodRise: number};
  cornice: {y: [number, number]; out: number};
  stage: {yc: number; k: number};
}

export function connectingBlock(c: PanelCtx, stats: KitStats, w: PavilionWall & {block: BlockSpec}) {
  const B = w.block, part = c.part(), U = (s: number) => s + w.sToU;
  const u0 = c.p.uMin + B.slab.inset, u1 = c.p.uMax - B.slab.inset, t0 = c.mesh.triangles;
  solid(c, WALL, u0, u1, B.slab.y[0], B.slab.y[1], -B.slab.depth, 0, part);
  const stone = (s0: number, s1: number, y0: number, y1: number, out: number) => solid(c, STONE, Math.max(U(s0), u0), Math.min(U(s1), u1), y0, y1, 0, out, part);
  const T = B.third, [f0, f1] = w.faceS, lights = w.centre.lights, L0 = lights[0][0], L1 = lights[lights.length - 1][1];
  // the third floor: the lower floors' bay pattern with the arched head over the centre
  for (const [a, b] of w.side.s) {
    proudWindow(c, U(a), U(b), T.sideLower[0], T.sideLower[1], 1, true, part);
    proudWindow(c, U(a), U(b), T.sideUpper[0], T.sideUpper[1], 1, false, part);
    stone(a - 0.1, b + 0.1, T.sideLower[1] + 0.05, T.sideUpper[0] - 0.05, 0.1);
    stone(a - 0.12, b + 0.12, T.sideUpper[1] + 0.08, T.sideUpper[1] + 0.3, 0.1);
    archRing(c, STONE, U(a - 0.02), U(b + 0.02), T.sideUpper[1] + 0.3, T.hoodRise, 0.06, 0.05, 0, 4);
  }
  proudWindow(c, U(L0), U(L1), T.cLower[0], T.cLower[1], lights.length - 1, true, part);
  proudWindow(c, U(L0), U(L1), T.cUpper[0], T.cUpper[1], lights.length - 1, true, part);
  stone(w.centre.surround[0], w.centre.surround[1], T.cLower[1] + 0.03, T.cUpper[0] - 0.03, 0.1);
  for (const [a, b] of [[w.centre.surround[0], L0 - 0.03], [L1 + 0.03, w.centre.surround[1]]]) stone(a, b, T.cLower[0] - 0.1, T.arch.spring, 0.08);
  // arched head: a glass fan in a stone ring
  const head = archHead(U(L0), U(L1), T.arch.spring, T.arch.top - T.arch.spring, 8);
  geom(c, GLASS, extrude(shapeOf([[U(L0), T.arch.spring], [U(L1), T.arch.spring], ...[...head].reverse()]), 0.02), 0, 0, 0.04, part);
  for (const f of [0.25, 0.5, 0.75]) solid(c, FRAME, U(L0 + (L1 - L0) * f) - 0.025, U(L0 + (L1 - L0) * f) + 0.025, T.arch.spring, T.arch.top - 0.3, 0.04, 0.07, part);
  archRing(c, STONE, U(L0), U(L1), T.arch.spring, T.arch.top - T.arch.spring, 0.12, 0.08, 0, 8);
  // cornice with consoles, then the stage
  const C = B.cornice, h = C.y[1] - C.y[0];
  stone(f0, f1, C.y[0], C.y[0] + h * 0.3, C.out * 0.6);
  for (let s = f0 + 0.2; s + 0.35 < f1; s += 0.8) stone(s, s + 0.35, C.y[0] + h * 0.3, C.y[0] + h * 0.7, C.out);
  stone(f0 - 0.05, f1 + 0.05, C.y[0] + h * 0.7, C.y[1], C.out + 0.1);
  pavilionStage(c, stats, w, B.stage.yc, {k: B.stage.k, proud: true, clock: false});
  stats.drawn.push(`connecting block slab: third floor, cornice, stage (${c.mesh.triangles - t0} triangles)`);
}
