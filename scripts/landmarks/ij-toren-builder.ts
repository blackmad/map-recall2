import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {frameOf, slab} from './nearbar-kit';
import {curtainOnWall, frameFromBearing, wallAwayFrom, windowRow} from './modern-kit';
import source from './ij-toren-footprints.json';

/**
 * IJ-toren / UP Office Building (Piet Heinkade, 2002) on the podium of the Passenger Terminal Amsterdam,
 * one BAG pand. Massing is the merged 3DBAG LoD2.2 shell (native east/south metres from the anchor).
 *  - tower: a 57 x 15.7 m slab (long axis bearing 106 deg) rising 80 m, teal curtain wall with a pale
 *    spandrel and a dark vision band per floor (17 floors from the 12 m podium level), 1.8 m mullions, a two
 *    storey dark framed base with piers on the IJ side, stepped crown with a lattice mast;
 *  - terminal: red-brick quay front, glazed barrel hall at the west end, long glass-block canopy east.
 */
const THETA = 15.9;                      // slab axis angle from the x axis (deg)
const P1: [number, number] = [47.8, -14.0], SLAB_LEN = 57.2, SLAB_DEPTH = 15.7;
const Y0 = 11.3, FH = 3.12, BAY = 2.0;

const bbox = (s: Surface) => {
  const p = s.rings[0];
  return {x0: Math.min(...p.map(v => v[0])), x1: Math.max(...p.map(v => v[0])), z0: Math.min(...p.map(v => v[2])), z1: Math.max(...p.map(v => v[2])), y0: Math.min(...p.map(v => v[1])), y1: Math.max(...p.map(v => v[1]))};
};
const COS = Math.cos(THETA * Math.PI / 180), SIN = Math.sin(THETA * Math.PI / 180);
/** Slab coordinates: a along the long axis from the west end of the north edge, d south of the north edge. */
const slabCoords = (x: number, z: number) => { const rx = x - -7.2, rz = z - -29.7; return {a: rx * COS + rz * SIN, d: -(rx * SIN - rz * COS)}; };
const isTower = (s: Surface) => {
  const b = bbox(s), c = slabCoords((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
  return b.y1 > 15 && c.a > -9 && c.a < 62 && c.d > -1.5 && c.d < 22;
};
const isWing = (s: Surface) => { const b = bbox(s), cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; return cx > 3 && cx < 33 && cz > 2 && cz < 38 && b.y1 > 28 && b.y1 < 33; };
const isVault = (s: Surface) => { const b = bbox(s); return b.y1 > 14 && b.y1 < 26 && (b.x0 + b.x1) / 2 < -12 && b.x1 < -10; };

const isSpike = (s: Surface) => { const b = bbox(s); return b.x1 < -83 && b.z1 < -45 && b.y1 > 14; };   // sliver of the neighbouring hotel inside the BAG ring
const isCanopy = (s: Surface) => { const b = bbox(s); return (b.x0 + b.x1) / 2 > 52 && b.y1 <= 11.4; };
const CENTRE: [number, number] = [18.15, -14.3], WING_CENTRE: [number, number] = [17.5, 20];

export function buildIjToren(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const src = source as unknown as {surfaces: Surface[]; nativeRing: number[][]};
  const other = (s: Surface) => isSpike(s) || isTower(s) || isWing(s) || isVault(s) || isCanopy(s);
  addShell(b, src as never, {wall: 'brick', roof: 'concrete', skip: other});
  addShell(b, src as never, {wall: 'white', roof: 'concrete', skip: s => isSpike(s) || !isCanopy(s)});
  addShell(b, src as never, {wall: 'glass', roof: 'dark', skip: s => isSpike(s) || !(isTower(s) || isWing(s))});
  addShell(b, src as never, {wall: 'glass', roof: 'glass', skip: s => isSpike(s) || !isVault(s)});
  b.mark?.('shell');

  // Tower curtain wall on every tower wall that is big enough to carry bays.
  src.surfaces.forEach((s, i) => {
    const wing = isWing(s);
    if (s.type !== 'WallSurface' || isSpike(s) || !(isTower(s) || wing)) return;
    const w = wallAwayFrom(s, i, wing ? WING_CENTRE : CENTRE);
    if (!w || w.length < 2.2) return;
    curtainOnWall(b, w, {y0: wing ? 2 * FH : Y0, floorH: FH, spandrelH: 1.2, bayW: BAY, spandrel: 'frame', mullion: 'dark', depth: 0.12, cap: 'dark'});
  });
  // IJ-side base: two dark framed storeys of big bays over the quay gallery (north wall 354).
  {
    const w = wallAwayFrom(src.surfaces[354], 354, CENTRE)!, f = frameOf(w);
    const y = Y0 + 0.2, h = 2 * FH - 0.4;
    slab(b, f, (11 + w.length - 0.4) / 2, y, w.length - 11.4, h, 0.2, 'dark');
    const n = 6, pitch = (w.length - 11.4) / n;
    for (let i = 0; i < n; i++) {
      const t = 11 + pitch * (i + 0.5);
      slab(b, f, t, y + 0.5, pitch - 1.0, h - 1.6, 0.26, 'glass');
      for (let k = 1; k < 4; k++) slab(b, f, t - (pitch - 1.0) / 2 + (pitch - 1.0) * k / 4, y + 0.5, 0.07, h - 1.6, 0.3, 'dark');
      slab(b, f, t, y + 0.5 + (h - 1.6) * 0.55, pitch - 1.0, 0.1, 0.3, 'dark');
    }
  }
  b.box(17.5, 87.2, -11, 0.5, 1.0, 0.5, 'frame');
  b.box(17.5, 88.1, -11, 0.18, 7, 0.18, 'frame');
  // Terminal head building on Piet Heinkade (brick, two storeys): storefront glazing below, window row above.
  for (const [wi, n] of [[371, 5], [86, 2]] as const) {
    const w = wallAwayFrom(src.surfaces[wi], wi, [-10, -10]);
    if (!w) continue;
    windowRow(b, w, {n, y: 0.35, h: 3.3, wd: 3.6, glass: 'glass', frame: 'dark'});
    windowRow(b, w, {n, y: 6.1, h: 1.8, wd: 2.5, glass: 'glass', frame: 'frame'});
  }
  void T; void frameFromBearing; void slab;
}
