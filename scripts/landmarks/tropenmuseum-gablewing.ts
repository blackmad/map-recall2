import * as T from 'three';
import type {PanelCtx} from '../../src/canalRecall/blockBuilding/compose';
import {extrude, FRAME, geom, GLASS, KitStats, opening, proudWindow, shapeOf, solid, STONE} from './tropenmuseum-kit';
import facades from './tropenmuseum-facades.json';

/**
 * The south gable wing's Linnaeusstraat face (inventory w11-61, panel 152; the 2020 panorama, tall-w11-61-0.jpg, rectified at 50 px/m):
 * first-floor windows with small hoods, three round-arched three-light windows over carved relief fields, string courses, the gable's
 * window grid, an oval cartouche, a pediment and ball finials. The ground floor and the banner field stay as the kit/3DBAG have them.
 * The gable's swung outline is 3DBAG's (a stepped triangle); only the pieces standing on it are drawn.
 */
type Pair = [number, number];
export interface GableWing {
  what: string; panel: number; surfaces: number[]; sToU: number; skipFrom: number;
  floor1: {windows: Pair[]; lower: Pair; upper: Pair; hoodTop: number; lights: number[]};
  string: {y: Pair; out: number}[];
  reliefs: {s: Pair[]; y: Pair}; arched: {s: Pair[]; y: Pair};
  gable: {grid: {cols: Pair[]; rows: Pair[]}; singles: Pair[]; singleRows: Pair[]; cartouche: {s: number; y: number; rx: number; ry: number}; pediment: {s: Pair; y: Pair}; balls: Pair[]};
}
export const GABLE_WINGS = Object.values((facades as unknown as {gableWings: Record<string, GableWing>}).gableWings);
export const gableWingOf = (surfaces: number[]) => GABLE_WINGS.find(g => g.surfaces.some(s => surfaces.includes(s)));

const WIN = {frame: FRAME, glass: GLASS, frameW: 0.05, sillOnWall: true};

export function gableWingFace(c: PanelCtx, stats: KitStats, g: GableWing) {
  const U = (s: number) => s + g.sToU, part = c.part(), t0 = c.mesh.triangles;
  const lo = (s: number) => Math.max(U(s), c.p.uMin + 0.04), hi = (s: number) => Math.min(U(s), c.p.uMax - 0.04);
  const slab = (s0: number, s1: number, y0: number, y1: number, out: number) => solid(c, STONE, lo(s0), hi(s1), y0, y1, 0, out, part);
  const F = g.floor1;
  F.windows.forEach(([a, b], i) => {
    const n = F.lights[i], mull = n > 1 ? Array.from({length: n - 1}, (_, k) => (k + 1) / n) : [0.5];
    opening(c, stats, 'gable wing floor-1 window', U(a), U(b), F.lower[0], F.lower[1], {...WIN, mullAt: mull, rowsAt: [0.3]});
    opening(c, stats, 'gable wing floor-1 upper window', U(a), U(b), F.upper[0], F.upper[1], {...WIN, mullAt: mull});
    slab(a - 0.12, b + 0.12, F.lower[1] + 0.04, F.upper[0] - 0.04, 0.1);
    slab(a - 0.15, b + 0.15, F.hoodTop - 0.28, F.hoodTop - 0.08, 0.12);
  });
  for (const s of g.string) slab(-1, 99, s.y[0], s.y[1], s.out);
  // round-arched windows over relief fields
  g.arched.s.forEach(([a, b]) => {
    opening(c, stats, 'gable wing arched window', U(a), U(b), g.arched.y[0], g.arched.y[1], {
      ...WIN, mullAt: [1 / 3, 2 / 3], rowsAt: [0.4], arch: {kind: 'round', segments: 6, band: {slot: STONE, t: 0.14, out: 0.07, imposts: STONE, keystone: STONE}},
    });
  });
  g.reliefs.s.forEach(([a, b]) => { slab(a - 0.05, b + 0.05, g.reliefs.y[0] - 0.12, g.reliefs.y[0], 0.12); slab(a, b, g.reliefs.y[0], g.reliefs.y[1], 0.08); });
  // gable: window grid in three columns, side windows, cartouche, pediment, balls
  const G = g.gable;
  // windows cut into this gable's upper wall left coplanar glass/brick patches (audit zfight) that the lower floors do not show: applied windows
  for (const [y0, y1] of G.grid.rows) proudWindow(c, U(G.grid.cols[0][0]), U(G.grid.cols[2][1]), y0, y1, 2, false, part);
  for (const [a, b] of G.singles) for (const [y0, y1] of G.singleRows) proudWindow(c, U(a), U(b), y0, y1, 1, false, part);
  slab(G.grid.cols[0][0] - 0.12, G.grid.cols[2][1] + 0.12, G.grid.rows[2][1] + 0.05, G.grid.rows[2][1] + 0.2, 0.1);
  geom(c, STONE, new T.CylinderGeometry(1, 1, 0.14, 10).rotateX(Math.PI / 2).scale(G.cartouche.rx, G.cartouche.ry, 1), U(G.cartouche.s), G.cartouche.y, 0.07, part);
  geom(c, STONE, extrude(shapeOf([[U(G.pediment.s[0]), G.pediment.y[0]], [U(G.pediment.s[1]), G.pediment.y[0]], [U((G.pediment.s[0] + G.pediment.s[1]) / 2), G.pediment.y[1]]]), 0.22), 0, 0, 0, part);
  for (const [s, y] of G.balls) geom(c, STONE, new T.SphereGeometry(0.25, 5, 3), U(s), y, 0.2, part);
  stats.drawn.push(`gable wing ${g.what.slice(0, 40)}: ${c.mesh.triangles - t0} triangles`);
}
