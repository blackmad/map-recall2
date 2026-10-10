import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {frameOf, put, slab} from './nearbar-kit';
import {curtainOnWall, frameFromBearing, wallAwayFrom, windowRow} from './modern-kit';
import * as TT from 'three';
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

// Slivers of the neighbouring Moevenpick hotel inside the BAG ring: its tower sliver and the 0.9 m footing strip beside it (no structure stands there in the 2016-2025 panoramas).
const isSpike = (s: Surface) => { const b = bbox(s); return (b.x1 < -83 && b.z1 < -45 && b.y1 > 14) || (b.x1 < -100 && b.z1 < -57 && b.y1 < 1.5); };
/** Glazed stair/lift pavilion of the car park below Piet Heinkade (3DBAG parts 566-571) and the three grey vent chimneys beside it (548-553). */
const isPavilion = (_s: Surface, i: number) => i >= 566 && i <= 571;
const isVent = (_s: Surface, i: number) => i >= 548 && i <= 553;
/** North quay front of the terminal (3DBAG wall 165 = the outer line of the quay colonnade and glazed gallery, not the brick wall). */
const FRONT = 165, RECESS = 3.7;
const isCanopy = (s: Surface) => { const b = bbox(s); return (b.x0 + b.x1) / 2 > 52 && b.y1 <= 11.4; };
/** Recessed dark-blue central strip of the south face above the lobby wing. */
const isCore = (s: Surface) => { const b = bbox(s), c = slabCoords((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2); return isTower(s) && !isWing(s) && b.y0 > 25 && c.a > 16 && c.a < 38 && c.d > 11; };
const CENTRE: [number, number] = [18.15, -14.3], WING_CENTRE: [number, number] = [17.5, 20];

export function buildIjToren(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const src = source as unknown as {surfaces: Surface[]; nativeRing: number[][]};
  const other = (s: Surface, i: number) => isSpike(s) || isTower(s) || isWing(s) || isVault(s) || isCanopy(s) || isPavilion(s, i) || isVent(s, i) || i === FRONT;
  addShell(b, src as never, {wall: 'brick', roof: 'concrete', skip: other});
  addShell(b, src as never, {wall: 'glass', roof: 'dark', skip: (_s, i) => !isPavilion(_s, i) && !isVent(_s, i)});
  addShell(b, src as never, {wall: 'white', roof: 'concrete', skip: s => isSpike(s) || !isCanopy(s)});
  addShell(b, src as never, {wall: 'glass', roof: 'dark', skip: s => isSpike(s) || !isTower(s) || isWing(s) || isCore(s)});
  addShell(b, src as never, {wall: 'slate', roof: 'dark', skip: s => isSpike(s) || !isCore(s)});
  addShell(b, src as never, {wall: 'copper', roof: 'dark', skip: s => isSpike(s) || !isWing(s)});
  addShell(b, src as never, {wall: 'glass', roof: 'glass', skip: s => isSpike(s) || !isVault(s)});
  b.mark?.('shell');

  // Tower curtain wall on every tower wall that is big enough to carry bays.
  src.surfaces.forEach((s, i) => {
    const wing = isWing(s);
    if (s.type !== 'WallSurface' || isSpike(s) || !(isTower(s) || wing)) return;
    const w = wallAwayFrom(s, i, wing ? WING_CENTRE : CENTRE);
    if (!w || w.length < 2.2) return;
    const core = isCore(s);
    curtainOnWall(b, w, {y0: wing ? 2 * FH : Y0, floorH: FH, spandrelH: core ? 0.9 : 1.3, bayW: core ? 1.0 : BAY, spandrel: core ? 'glass' : 'frame', mullion: core ? 'slate' : 'dark', depth: 0.12, cap: 'dark'});
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
  // Podium roof terrace: steel-and-glass gallery balustrade along the outer podium walls (reference: north and east views).
  src.surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface' || other(s, i)) return;
    const bb = bbox(s);
    if (bb.y0 > 1 || bb.y1 < 10.3 || bb.y1 > 11.5) return;
    const w = wallAwayFrom(s, i, [-20, -15]);
    if (!w || w.length < 6) return;
    const f = frameOf(w);
    slab(b, f, w.length / 2, bb.y1 - 0.05, w.length - 0.2, 1.2, 0.12, 'glass');
    slab(b, f, w.length / 2, bb.y1 + 1.15, w.length - 0.2, 0.1, 0.16, 'frame');
  });
  // Quay canopy east of the tower: glass-block wall (surveyed) with a steel canopy on white columns on the water side.
  {
    const w = wallAwayFrom(src.surfaces[211], 211, [115, 6])!, f = frameOf(w);
    const wide = 6.0;
    put(b, f, new TT.BoxGeometry(w.length, 0.35, wide).translate(0, 0, wide / 2), w.length / 2, 10.15, 0, 'concrete');
    for (let t = 2; t < w.length - 1; t += 8.6) put(b, f, new TT.BoxGeometry(0.4, 10.15, 0.4).translate(0, 5.075, 0), t, 0, wide - 0.6, 'white');
  }
  // Glass-block wall of the quay arcade (ref-east): pale block field with a 0.8 m joint grid over a plain plinth.
  {
    const w = wallAwayFrom(src.surfaces[211], 211, [115, 6])!, f = frameOf(w);
    const x0 = 1.0, x1 = w.length - 1.0, y0 = 0.7, y1 = 7.6;
    slab(b, f, (x0 + x1) / 2, y0, x1 - x0, y1 - y0, 0.14, 'frame');
    for (let y = y0 + 0.8; y < y1 - 0.2; y += 0.8) slab(b, f, (x0 + x1) / 2, y, x1 - x0, 0.06, 0.2, 'white');
    for (let t = x0 + 0.8; t < x1 - 0.2; t += 0.8) slab(b, f, t, y0, 0.06, y1 - y0, 0.2, 'white');
  }
  // North quay front: the brick wall with its dark plinth, window bays, portholes and sliding gates stands RECESS m
  // behind a white steel colonnade that carries the glazed gallery (ref q1/q3, panorama 2022-002584).
  {
    const w = wallAwayFrom(src.surfaces[FRONT], FRONT, [-20, -15])!, f = frameOf(w), L = w.length, H = 10.5;
    slab(b, f, L / 2, 0, L, H, 0.3, 'brick', -RECESS - 0.3);
    for (const t of [0, L]) {                      // gallery end caps (frame normal = away from the building end; tangent runs back along the gallery depth)
      const sgn = t ? 1 : -1;
      const fe = {origin: [f.origin[0] + f.tangent[0] * t, f.origin[1] + f.tangent[1] * t] as [number, number], tangent: [-sgn * f.n[0], -sgn * f.n[1]] as [number, number], n: [sgn * f.tangent[0], sgn * f.tangent[1]] as [number, number]};
      slab(b, fe, -sgn * RECESS / 2 * -1, 0, RECESS, H, 0.3, 'brick', -0.3);
    }
    // Soffit/floor of the gallery and fascia beam.
    slab(b, f, L / 2, 7.1, L, 0.4, RECESS, 'concrete', -RECESS);
    slab(b, f, L / 2, 6.9, L, 0.7, 0.25, 'white', -0.25);
    // Glazed gallery screen with white mullions.
    slab(b, f, L / 2, 7.6, L - 0.2, 2.9, 0.12, 'glass', -0.14);
    const nm = Math.round(L / 5.2);
    for (let i = 0; i <= nm; i++) slab(b, f, 0.1 + (L - 0.2) * i / nm, 7.6, 0.14, 2.9, 0.2, 'white', -0.2);
    slab(b, f, L / 2, 8.9, L - 0.2, 0.12, 0.2, 'white', -0.2);
    slab(b, f, L / 2, 10.35, L - 0.2, 0.2, 0.22, 'white', -0.22);
    // Colonnade.
    const bay = L / Math.round(L / 11.4);
    for (let t = bay / 2; t < L; t += bay) slab(b, f, t, 0, 0.38, 7.3, 0.38, 'white', -0.45);
    // Recessed wall: plinth, window bays, portholes, a sliding gate every fifth bay.
    const rf = {origin: [f.origin[0] - f.n[0] * RECESS, f.origin[1] - f.n[1] * RECESS] as [number, number], tangent: f.tangent, n: f.n};
    slab(b, rf, L / 2, 0, L, 2.5, 0.12, 'dark');
    let k = 0;
    for (let t0 = 0; t0 + bay <= L + 0.01; t0 += bay, k++) {
      const gate = k % 5 === 2;
      if (gate) {
        slab(b, rf, t0 + bay / 2, 0.15, 6.0, 4.9, 0.18, 'dark');
        slab(b, rf, t0 + bay / 2, 0.45, 5.6, 1.6, 0.24, 'stone');
        slab(b, rf, t0 + bay / 2, 2.2, 5.6, 2.5, 0.24, 'glass');
        slab(b, rf, t0 + bay / 2, 0.3, 0.1, 4.3, 0.26, 'dark');
      } else {
        const wd = bay - 3.4;
        slab(b, rf, t0 + bay / 2, 2.38, wd + 0.3, 3.74, 0.1, 'dark');
        slab(b, rf, t0 + bay / 2, 2.5, wd, 3.5, 0.18, 'glass');
        for (let m = 1; m < 4; m++) slab(b, rf, t0 + bay / 2 - wd / 2 + wd * m / 4, 2.5, 0.08, 3.5, 0.22, 'dark');
        slab(b, rf, t0 + bay / 2, 4.1, wd, 0.08, 0.22, 'dark');
      }
      for (let m = 0; m < 3; m++) {
        const t = t0 + bay * (0.18 + 0.32 * m);
        if (gate && Math.abs(t - (t0 + bay / 2)) < 3.3) continue;
        slab(b, rf, t, 0.6, 1.4, 1.4, 0.16, 'concrete');
        put(b, rf, new TT.CylinderGeometry(0.46, 0.46, 0.1, 10).rotateX(Math.PI / 2).translate(0, 0.7, 0.05), t, 0.6, 0.16, 'dark');
      }
    }
  }
  // Glass entrance pavilion of the car park (corner posts on the 3DBAG ground ring) and a glazed cabinet with three grey vent chimneys
  // standing against its long face (ref carpark-pavilion-1/2, panorama 2025-06-16).
  {
    const ground = src.surfaces.find((s, i) => isPavilion(s, i) && s.type === 'GroundSurface');
    if (ground) for (const p of ground.rings[0]) b.box(p[0], 1.75, p[2], 0.22, 3.5, 0.22, 'dark');
    // The block's north long face runs from A to B (wall 552); the pipes stand centred on it.
    const face = src.surfaces[552].rings[0], fa = face.reduce((m, p) => (p[2] < m[2] ? p : m), face[0]);
    const fb = face.filter(p => Math.abs(p[2] - fa[2]) > 0.3 || Math.abs(p[0] - fa[0]) > 0.3).reduce((m, p) => (Math.hypot(p[0] - fa[0], p[2] - fa[2]) > Math.hypot(m[0] - fa[0], m[2] - fa[2]) ? p : m));
    const len = Math.hypot(fb[0] - fa[0], fb[2] - fa[2]), ux = (fb[0] - fa[0]) / len, uz = (fb[2] - fa[2]) / len, nx = uz, nz = -ux;
    for (const t of [0.2 * len, 0.5 * len, 0.8 * len]) {
      const px = fa[0] + ux * t, pz = fa[2] + uz * t;
      b.add(new TT.CylinderGeometry(0.42, 0.42, 5.0, 12).translate(px, 2.5, pz), 'concrete' as never);
      b.add(new TT.CylinderGeometry(0.42, 0.42, 1.1, 12).rotateX(Math.PI / 2).rotateY(Math.atan2(nx, nz)).translate(px + nx * 0.45, 4.7, pz + nz * 0.45), 'concrete' as never);
    }
  }
  void T; void frameFromBearing; void slab;
}
