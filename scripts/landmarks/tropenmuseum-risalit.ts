import * as T from 'three';
import type {PanelCtx} from '../../src/canalRecall/blockBuilding/compose';
import {archHead, archRing, DARK, extrude, geom, GLASS, KitStats, proudWindow, reclining, shapeOf, solid, STONE, WALL} from './tropenmuseum-kit';
import facades from './tropenmuseum-facades.json';

/**
 * The east risalit with the side entrance (inventory w13-61, panel 138; Commons "Tropenmuseum, Linnaeusstraat foto 2.jpg", public
 * domain, Alf van Beem): a stair up to an arched door in a stone surround, an oval window with two reclining figures over it, tall
 * ground-floor windows either side, three first-floor windows under triangular hoods and a gable window grid. The 3DBAG wall of this
 * panel is skewed (a stepped member pair), so every window is applied to a brick plate on the face (proudWindow) rather than cut into it.
 */
type Pair = [number, number];
export interface Risalit {
  what: string; panel: number; surfaces: number[]; sToU: number;
  stair: {s: Pair; steps: number; rise: number; tread: number};
  door: {s: Pair; y: Pair}; surround: {half: number; top: number; pilaster: number};
  oval: {s: number; y: number; rx: number; ry: number}; figures: {y: number; dx: number};
  string: {y: Pair; out: number}[]; flank: {s: Pair[]; y: Pair};
  floor1: {s: Pair[]; y: Pair; hoodTop: number}; grid: {s: Pair; rows: Pair[]; mulls: number};
}
export const RISALITS = Object.values((facades as unknown as {risalits: Record<string, Risalit>}).risalits);
export const risalitOf = (surfaces: number[]) => RISALITS.find(r => r.surfaces.some(s => surfaces.includes(s)));

export function risalitFace(c: PanelCtx, stats: KitStats, r: Risalit) {
  const U = (s: number) => s + r.sToU, part = c.part(), t0 = c.mesh.triangles;
  const lo = (s: number) => Math.max(U(s), c.p.uMin + 0.04), hi = (s: number) => Math.min(U(s), c.p.uMax - 0.04);
  const slab = (s0: number, s1: number, y0: number, y1: number, out: number) => solid(c, STONE, lo(s0), hi(s1), y0, y1, 0, out, part);
  const mid = (r.door.s[0] + r.door.s[1]) / 2;
  // stair: steps up to the door sill
  for (let k = 0; k < r.stair.steps; k++) solid(c, STONE, U(r.stair.s[0]), U(r.stair.s[1]), 0, r.door.y[0] - k * r.stair.rise, k * r.stair.tread, (k + 1) * r.stair.tread, part);
  // door: dark leaf in an arched stone surround, pilasters either side
  const [d0, d1] = r.door.s, spring = r.door.y[1] - (d1 - d0) / 2;
  solid(c, DARK, U(d0), U(d1), r.door.y[0], spring, 0, 0.06, part);
  geom(c, DARK, extrude(shapeOf([[U(d0), spring], [U(d1), spring], ...archHead(U(d0), U(d1), spring, (d1 - d0) / 2, 6).reverse()]), 0.06), 0, 0, 0, part);
  archRing(c, STONE, U(d0), U(d1), spring, (d1 - d0) / 2, 0.22, 0.2, 0, 6);
  for (const side of [-1, 1]) { const x = mid + side * (r.surround.half - r.surround.pilaster / 2); slab(x - r.surround.pilaster / 2, x + r.surround.pilaster / 2, r.door.y[0], r.surround.top - 0.4, 0.22); }
  slab(mid - r.surround.half - 0.1, mid + r.surround.half + 0.1, r.surround.top - 0.4, r.surround.top, 0.3);
  // oval window with a stone ring, two reclining figures on the pediment line
  const O = r.oval;
  geom(c, STONE, new T.CylinderGeometry(1, 1, 0.16, 10).rotateX(Math.PI / 2).scale(O.rx + 0.15, O.ry + 0.15, 1), U(O.s), O.y, 0.1, part);
  geom(c, GLASS, new T.CylinderGeometry(1, 1, 0.06, 10).rotateX(Math.PI / 2).scale(O.rx, O.ry, 1), U(O.s), O.y, 0.2, part);
  reclining(c, STONE, U(O.s - r.figures.dx), r.figures.y, 0.14, 0.9, 1); reclining(c, STONE, U(O.s + r.figures.dx), r.figures.y, 0.14, 0.9, -1);
  for (const s of r.string) slab(-1, 99, s.y[0], s.y[1], s.out);
  // Windows are applied to 9 cm brick plates: this panel's skewed 3DBAG wall takes no cut openings (their glass came out coplanar with the
  // wall) and a window floating on it reads as hanging off the wall edge in the audit; a plate gives them a clean face of their own.
  const P = 0.09;
  const plate = (a: number, b: number, y0: number, y1: number) => solid(c, WALL, lo(a), hi(b), y0, y1, 0, P, part);
  const win = (a: number, b: number, y0: number, y1: number, mulls: number, rows: boolean) => { plate(a - 0.12, b + 0.12, y0 - 0.12, y1 + 0.12); proudWindow(c, U(a), U(b), y0, y1, mulls, rows, part, P); };
  for (const [a, b] of r.flank.s) { win(a, b, r.flank.y[0], r.flank.y[1], 1, true); slab(a - 0.1, b + 0.1, r.flank.y[1] + 0.15, r.flank.y[1] + 0.35, 0.16); }
  for (const [a, b] of r.floor1.s) {
    win(a, b, r.floor1.y[0], r.floor1.y[1], 1, true);
    const base = r.floor1.y[1] + 0.2;
    geom(c, STONE, extrude(shapeOf([[U(a - 0.15), base], [U(b + 0.15), base], [U((a + b) / 2), r.floor1.hoodTop]]), 0.12), 0, 0, P, part);
  }
  const g0 = r.grid.rows[0][0], g1 = r.grid.rows[r.grid.rows.length - 1][1];
  plate(r.grid.s[0] - 0.12, r.grid.s[1] + 0.12, g0 - 0.12, g1 + 0.12);
  for (const [y0, y1] of r.grid.rows) proudWindow(c, U(r.grid.s[0]), U(r.grid.s[1]), y0, y1, r.grid.mulls, false, part, P);
  stats.drawn.push(`risalit ${r.what.slice(0, 30)}: ${c.mesh.triangles - t0} triangles`);
}
