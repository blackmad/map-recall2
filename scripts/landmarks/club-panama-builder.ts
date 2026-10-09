import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {wallsOf} from './worship-walls';
import {archBand, archSlab, archWindows, awning, disc, faceOut, frameOf, letters, poly, put, ringSlab, roofHeightAt, segBand, slab} from './nearbar-kit';
import source from './club-panama-footprints.json';

/**
 * Panama (Oostelijke Handelskade 4): the 1885 machine house and boiler house of the former Oostelijke
 * Handelskade power station (B. de Greef), a club since 2001. Massing is the 3DBAG LoD2.2 shell in native
 * east/south metres. Detail follows the 2021/2022 municipal panoramas of three fronts:
 *  - quay front (south, 27 m): six round-arched bays between brick piers, cream impost blocks and string
 *    courses, black quarter-dome awnings, corbel frieze and cornice;
 *  - north front (34 m): central gabled entrance bay with a tripartite fan window over the glazed door,
 *    three pairs of arched windows each side under shallow arches, tiled hip roof, black entrance awning
 *    at the west end;
 *  - machine-house gable (south and north ends): wheel window, three blind arches and tall blind arcade;
 *  - the glazed clerestory ridge with its silver roof and the red rooftop PANAMA sign on legs.
 * Window positions are measured off the rectified fronts to about 0.2 m.
 */
export function buildClubPanama(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'brick', roof: 'slate', roofFor: s => (s.rings[0].every(p => p[1] > 10.5) ? 'concrete' : 'slate')});
  b.mark?.('shell');
  const walls = new Map(wallsOf(source as never).map(w => [w.index, w]));
  const wall = (i: number) => walls.get(i)!;

  /** Corbel frieze plus cornice along [t0,t1] of a frame; skips the given t ranges. */
  const eave = (f: ReturnType<typeof frameOf>, t0: number, t1: number, yFrieze: number, yCornice: number, skip: [number, number][] = []) => {
    for (let t = t0 + 0.25; t < t1 - 0.2; t += 0.45) {
      if (skip.some(([a, c]) => t > a && t < c)) continue;
      slab(b, f, t, yFrieze, 0.2, 0.3, 0.1, 'stone');
    }
    slab(b, f, (t0 + t1) / 2, yFrieze + 0.34, t1 - t0, 0.06, 0.12, 'stone');
    slab(b, f, (t0 + t1) / 2, yCornice, t1 - t0, 0.32, 0.28, 'stone');
  };
  /** Round-arched quay bay: recess, brick arch ring, tall white-framed window, cream imposts and a black awning. */
  const quayBay = (f: ReturnType<typeof frameOf>, t: number) => {
    archSlab(b, f, t, 0.85, 2.5, 3.5, 0.05, 'greyBrick');
    archBand(b, f, t, 0.85, 2.9, 3.75, 0.2, 0.09, 'greyBrick');
    archWindows(b, f, [t], {y: 1.05, w: 1.9, h: 3.0, bars: 3, rows: 3, sill: 'stone'});
    awning(b, f, t, 2.55, 2.3, 1.65, 0.8, 'dark');
    for (const s of [-1, 1]) slab(b, f, t + s * 1.5, 3.95, 0.5, 0.22, 0.1, 'stone');
  };
  const pier = (f: ReturnType<typeof frameOf>, t: number, h: number) => {
    slab(b, f, t, 0, 0.55, h, 0.14, 'greyBrick');
    slab(b, f, t, h - 0.1, 0.75, 0.16, 0.2, 'stone');
  };

  // ---- Quay front (south), six bays on a 4.2 m pitch ----
  {
    const w = wall(4), f = frameOf(w);
    for (let k = 0; k < 6; k++) quayBay(f, 3.9 + 4.2 * k);
    for (let k = 0; k < 7; k++) pier(f, 1.8 + 4.2 * k, 5.2);
    slab(b, f, w.length / 2, 0.82, w.length, 0.1, 0.07, 'stone');
    slab(b, f, w.length / 2, 3.0, w.length, 0.1, 0.07, 'stone');
    eave(f, 0.2, w.length - 0.2, 5.25, 5.7);
  }
  // Returns of the quay front.
  {
    const w = wall(6), f = frameOf(w);
    for (const t of [2.2, 6.5]) quayBay(f, t);
    for (const t of [0.5, 4.35, 8.4]) pier(f, t, 5.2);
    slab(b, f, w.length / 2, 0.82, w.length, 0.1, 0.07, 'stone');
    eave(f, 0.2, w.length - 0.2, 5.25, 5.7);
  }
  {
    const w = wall(7), f = frameOf(w);
    for (const t of [3.0, 7.2]) quayBay(f, t);
    for (const t of [0.9, 5.1, 9.3]) pier(f, t, 5.2);
    slab(b, f, w.length / 2, 0.82, w.length, 0.1, 0.07, 'stone');
    eave(f, 0.2, w.length - 0.2, 5.25, 5.7);
  }
  // East end of the tall hall.
  {
    const w = wall(14), f = frameOf(w);
    archWindows(b, f, [2.2, 5.7], {y: 1.2, w: 1.5, h: 3.3, bars: 2, rows: 3, sill: 'stone'});
    archWindows(b, f, [2.2, 5.7], {y: 6.2, w: 1.5, h: 3.0, wall: w, bars: 2, rows: 2});
    slab(b, f, w.length / 2, 5.0, w.length, 0.12, 0.08, 'stone');
  }
  // West wall of the boiler-house range.
  {
    const w = wall(57), f = frameOf(w);
    archWindows(b, f, [2.2, 6.2, 10.2, 14.2, 18.2], {y: 1.0, w: 1.1, h: 2.5, bars: 1, rows: 2, sill: 'stone'});
    eave(f, 0.2, w.length - 0.2, 4.6, 5.35);
  }

  // ---- North front (34 m): wall 16 frame, t measured from the east end ----
  {
    const w = wall(16), f = frameOf(w), rc = 15.0, end = 33.4;
    for (const k of [-3, -2, -1, 1, 2, 3]) {
      const c = rc + 4.4 * k;
      archWindows(b, f, [c - 0.7, c + 0.7], {y: 1.0, w: 1.0, h: 2.4, bars: 1, rows: 2});
      slab(b, f, c, 0.88, 3.3, 0.12, 0.14, 'stone');
      segBand(b, f, c, 3.45, 3.3, 0.7, 0.24, 0.1, 'greyBrick');
      for (const s of [-1, 1]) slab(b, f, c + s * 1.75, 3.3, 0.5, 0.22, 0.1, 'stone');
    }
    // Piers between window pairs.
    for (const j of [6.6, 11.0, 15.4]) for (const sg of [-1, 1]) pier(f, rc + sg * j, 4.4);
    eave(f, 0.2, end, 4.55, 5.35, [[rc - 2.6, rc + 2.6]]);
    // Central entrance bay: pilasters, stepped gable plate, fan window, door with canopy.
    for (const s of [-1, 1]) {
      slab(b, f, rc + s * 2.4, 0, 0.6, 5.7, 0.32, 'greyBrick');
      slab(b, f, rc + s * 2.4, 3.2, 0.8, 0.14, 0.38, 'stone');
      slab(b, f, rc + s * 2.4, 5.6, 0.8, 0.16, 0.38, 'stone');
    }
    poly(b, f, rc, 5.7, [[-2.75, 0], [2.75, 0], [2.75, 0.55], [1.7, 1.45], [1.15, 1.9], [0.55, 2.75], [0, 3.05], [-0.55, 2.75], [-1.15, 1.9], [-1.7, 1.45], [-2.75, 0.55]], 0.3, 'brick');
    poly(b, f, rc, 5.7, [[-2.95, -0.1], [2.95, -0.1], [2.95, 0.12], [-2.95, 0.12]], 0.4, 'stone');
    archBand(b, f, rc, 3.75, 3.1, 2.75, 0.22, 0.12, 'stone', 0.0);
    archWindows(b, f, [rc], {y: 3.95, w: 2.3, h: 2.2, bars: 2, rows: 1});
    // Door, neon lettering and the entrance hood.
    slab(b, f, rc, 0, 2.2, 3.2, 0.1, 'dark');
    slab(b, f, rc, 0.1, 1.8, 2.9, 0.14, 'glass');
    slab(b, f, rc, 0.1, 0.05, 2.9, 0.15, 'dark');
    letters(b, f, 'PANAMA', rc, 2.15, 0.14, 0.05, 0.03, 'red');
    slab(b, f, rc, 3.25, 2.8, 0.12, 0.9, 'dark');
    // Black entrance awning at the west end.
    archSlab(b, f, end - 1.0, 0, 2.3, 3.0, 0.07, 'dark');
    awning(b, f, end - 1.0, 1.8, 2.5, 1.6, 0.85, 'dark');
  }

  // ---- Machine-house gables: wheel window, three blind arches, flanking blind arcade ----
  const gable = (wi: number, tc: number, yWheel: number, arches: number[], arcade: number[]) => {
    const w = wall(wi), f = frameOf(w);
    ringSlab(b, f, tc, yWheel, 0.72, 0.92, 0.14, 'stone');
    disc(b, f, tc, yWheel, 0.72, 0.08, 'glass');
    for (let k = 0; k < 4; k++) put(b, f, new T.BoxGeometry(1.44, 0.05, 0.12).rotateZ(k * Math.PI / 4).translate(0, 0, 0.06), tc, yWheel, 0.0, 'white');
    slab(b, f, tc, yWheel + 1.05, arches.length * 1.3, 0.13, 0.1, 'stone');
    for (const t of arches) archSlab(b, f, t, yWheel + 1.25, 0.55, 1.8, 0.06, 'greyBrick');
    for (const t of arcade) { archSlab(b, f, t, 3.4, 0.7, 2.6, 0.06, 'greyBrick'); archBand(b, f, t, 3.4, 0.95, 2.8, 0.12, 0.07, 'stone'); }
    slab(b, f, tc, 2.9, arcade.length ? 4.2 : 0.01, 0.12, 0.09, 'stone');
  };
  gable(2, 6.2, 7.5, [5.1, 6.2, 7.3], [5.0, 7.4]);
  {
    // west aisle end of the south gable: large arched window
    const f = frameOf(wall(2));
    archWindows(b, f, [2.3], {y: 1.0, w: 1.6, h: 3.4, bars: 2, rows: 3, sill: 'stone'});
  }
  gable(21, 1.65, 7.4, [0.75, 1.65, 2.55], []);

  // ---- Glazed clerestory along the ridge and the rooftop PANAMA sign ----
  const open = (i: number) => faceOut(wall(i), source.surfaces as never);
  {
    // North glazing (taller, 1.5 m) with white fins; the silver roof above it comes from the shell.
    const w = open(28), f = frameOf(w);
    slab(b, f, w.length / 2, 11.1, w.length - 0.3, 1.3, 0.06, 'glass');
    for (let t = 0.2; t < w.length; t += 1.0) slab(b, f, t, 11.05, 0.08, 1.4, 0.14, 'white');
    slab(b, f, w.length / 2, 12.38, w.length + 0.3, 0.12, 0.42, 'concrete');
  }
  {
    // South glazing, over the quay front, with the sign standing on the silver roof behind it.
    const w = open(1), f = frameOf(w);
    slab(b, f, w.length / 2, 10.55, w.length - 0.3, 0.7, 0.06, 'glass');
    for (let t = 0.2; t < w.length; t += 0.9) slab(b, f, t, 10.5, 0.07, 0.8, 0.1, 'white');
    slab(b, f, w.length / 2, 11.22, w.length + 0.3, 0.1, 0.4, 'concrete');
    const tc = w.length / 2 + 0.6, out = -0.9, px = 0.15;
    const x = w.origin[0] + w.tangent[0] * tc + w.n[0] * out, z = w.origin[1] + w.tangent[1] * tc + w.n[1] * out;
    const ry = roofHeightAt(source.surfaces as never, x, z) ?? 11.8, base = ry + 0.9;
    letters(b, f, 'PANAMA', tc, base, out + 0.05, px, 0.08, 'red');
    slab(b, f, tc, base - 0.12, 35 * px + 0.2, 0.1, 0.1, 'dark', out - 0.04);
    for (const dt of [-2.4, 0, 2.4]) {
      const lx = w.origin[0] + w.tangent[0] * (tc + dt) + w.n[0] * (out - 0.04), lz = w.origin[1] + w.tangent[1] * (tc + dt) + w.n[1] * (out - 0.04);
      const ly = (roofHeightAt(source.surfaces as never, lx, lz) ?? ry) - 0.5;   // sunk well below the roof slope
      slab(b, f, tc + dt, ly, 0.1, base - ly, 0.1, 'dark', out - 0.04);
    }
  }
  // Upper arched clerestory windows of the tall hall.
  {
    const w = open(18), f = frameOf(w);
    const ts: number[] = []; for (let t = 1.2; t < w.length - 0.8; t += 1.8) ts.push(t);
    archWindows(b, f, ts, {y: 9.3, w: 0.9, h: 1.25, wall: w, bars: 1, rows: 1});
    for (const i of [22, 40]) {
      const v = open(i), ts2: number[] = []; for (let t = 1.0; t < v.length - 0.6; t += 1.8) ts2.push(t);
      archWindows(b, frameOf(v), ts2, {y: v.base + 0.4, w: 0.9, h: 1.2, wall: v, bars: 1, rows: 1});
    }
    const v = open(48);
    archWindows(b, frameOf(v), [1.6, 3.5, 5.4], {y: 6.5, w: 1.0, h: 2.6, wall: v, bars: 1, rows: 2});
  }
}
