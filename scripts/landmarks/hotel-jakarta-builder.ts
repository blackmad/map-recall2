import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {letters, roofHeightAt, setSink, slab, wallProbe, type Frame} from './nearbar-kit';
import source from './hotel-jakarta-footprints.json';

/**
 * Hotel Jakarta (SeARCH, 2018), Javakade 766, west tip of Java-eiland. Massing is the 3DBAG LoD2.2 shell of BAG pand
 * 0363100012247056 (native east/south metres from the BAG centroid): a wedge that narrows to a glazed prow in the
 * west, 32 m tall west of x = 27 and 20 m tall in the east block. The BAG ring also holds open garden, so details are
 * placed only where a ray probe finds the real shell wall (the north and west ring edges are not walls).
 * Measured by eye from Commons photographs (2022, 2023) and municipal panoramas (2024, 2025):
 *  - two glazed storeys (7.4 m) along the IJ side and the east end; on the north front a 5.6 m glass ground floor under
 *    a perforated copper spandrel;
 *  - above, dark cladding with a timber-lined loggia (timber frame, glass balustrade) in about half the bays, flat
 *    windows and louvre panels in the rest, on a 3.05 m storey pitch: 4 storeys in the 20 m block, 8 in the 32 m part;
 *  - north front: rotating-door drum (about x = 31) in the low block, then the full-height copper perforated wall with
 *    the vertical HOTEL JAKARTA lettering and the ghosted VOC-ship silhouette, then the glazed prow;
 *  - the prow roof is a timber-ribbed glass roof over the subtropical garden. (The free-standing corten planters and umbrellas
 *    of the quay terrace are street furniture, not part of the building, and are left out.)
 */
const ring = (source as {nativeRing: number[][]}).nativeRing;
const surfaces = (source as {surfaces: never[]}).surfaces;
const Y0 = 7.4, PITCH = 3.05, TALL = 31.8, LOW = 20.1;

const unit = (a: number[], c: number[]) => { const l = Math.hypot(c[0] - a[0], c[1] - a[1]); return [(c[0] - a[0]) / l, (c[1] - a[1]) / l, l]; };
/** Frame on the line a->c with the outward normal on the left of travel (z positive = south). */
function lineFrame(a: number[], c: number[], flip = false) {
  const [tx, tz, len] = unit(a, c);
  const n: [number, number] = flip ? [tz, -tx] : [-tz, tx];
  return {f: {origin: [a[0], a[1]], tangent: [tx, tz], n} as Frame, len};
}
const hash = (k: number, r: number, s: number) => { let h = (k * 73856093) ^ (r * 19349663) ^ (s * 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) % 100; };

export function buildHotelJakarta(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const shell: T.BufferGeometry[] = [];
  addShell({...b, add: (g: T.BufferGeometry, c: never) => { b.add(g, c); shell.push(g.clone()); }} as never, source as never, {wall: 'slate', roof: 'concrete'});
  b.mark?.('shell');
  const probe = wallProbe(shell);
  setSink(2.2);

  // Frames. North: the real north wall is the sawtooth line (67.7,-15.7) -> (-22.4,1.2), 19 m inside the BAG north edge.
  const N = lineFrame([67.7, -15.7], [-22.4, 1.3], false);
  const S = lineFrame(ring[18], ring[20]);
  const E = lineFrame(ring[22], ring[23]);
  const E2 = lineFrame(ring[21], ring[22]);
  const at = (fr: {f: Frame}, t: number) => [fr.f.origin[0] + fr.f.tangent[0] * t, fr.f.origin[1] + fr.f.tangent[1] * t];
  /** Frame snapped onto the real wall at (t, y), or null where there is none (or it is far from the nominal line). */
  const wall = (f: Frame, t: number, y: number): Frame | null => {
    // Probe both ends and the middle of the element; sit on the outermost wall plane (the sunk back of each part reaches any recess behind it).
    let o = -Infinity;
    for (const dt of [-1.6, -1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2, 1.6]) {
      const q = probe.offset(f, t + dt, y);
      if (q === null || Math.abs(q) > 1.6) return null;
      o = Math.max(o, q);
    }
    return {...f, origin: [f.origin[0] + f.n[0] * o, f.origin[1] + f.n[1] * o]};
  };
  const tallAt = (name: string, t: number) => {
    const x = (name === 'N' ? at(N, t) : at(S, t))[0];
    return name === 'N' ? x < 27.3 : x < 21.5;
  };
  const roofTop = (fr: {f: Frame}, t: number, name: string) => name === 'E' ? LOW : tallAt(name, t) ? TALL : LOW;

  // ---- Glazed plinth ----
  const glazedPlinth = (fr: {f: Frame; len: number}, name: string, t0: number, t1: number, h: number, copperBand: boolean) => {
    for (let t = t0 + 1.2; t < t1 - 0.6; t += 2.1) {
      const g = wall(fr.f, t, 2);
      if (!g) continue;
      slab(b, g, t, 0.2, 2.05, h - 0.2, 0.14, 'glass', 0);
      slab(b, g, t - 1.05, 0.2, 0.1, Y0 - 0.2, 0.2, 'frame', 0);
      if (copperBand) slab(b, g, t, h, 2.15, Y0 - h, 0.2, 'copper', 0);
      else slab(b, g, t, 3.7, 2.15, 0.1, 0.2, 'frame', 0);
    }
  };
  // ---- Upper loggia grid ----
  const rowsGrid = (fr: {f: Frame; len: number}, name: string, t0: number, t1: number, seed: number) => {
    const pitch = 4.2;
    const n = Math.max(1, Math.floor((t1 - t0) / pitch)), start = t0 + ((t1 - t0) - (n - 1) * pitch) / 2;
    for (let k = 0; k < n; k++) {
      const t = start + k * pitch;
      for (let r = 0; r < 8; r++) {
        const y = Y0 + r * PITCH;
        if (y + PITCH > roofTop(fr, t, name) + 0.3) break;
        const g = wall(fr.f, t, y + 1.5);
        if (!g) continue;
        const kind = hash(k, r, seed), tl = t - 0.6;
        // louvred dark panel beside every opening
        slab(b, g, t + 1.55, y + 0.15, 1.1, 2.75, 0.1, 'frame', 0);
        if (kind < 72) {
          // loggia: timber ceiling above a dark window, glass balustrade below
          slab(b, g, tl, y + 0.15, 3.0, 2.75, 0.16, 'ochre', 0);
          slab(b, g, tl, y + 1.0, 2.76, 1.15, 0.2, 'dark', 0);
          slab(b, g, tl, y + 0.27, 2.76, 0.72, 0.2, 'glass', 0.04);
        } else {
          slab(b, g, tl, y + 0.35, 2.6, 2.3, 0.1, 'frame', 0);
          slab(b, g, tl, y + 0.45, 2.4, 2.1, 0.13, 'glass', 0);
        }
      }
    }
  };

  const PROW_S = 13.5; // the glazed prow continues round the west tip onto the first 13.5 m of the south front
  // South (IJ side): continuous glass plinth, then the grid; the 32 m part to x = 21.5.
  glazedPlinth(S, 'S', PROW_S, S.len, Y0, false);
  rowsGrid(S, 'S', PROW_S + 0.8, S.len - 1.5, 3);
  // East end.
  for (const fr of [E, E2]) { glazedPlinth(fr, 'E', 0, fr.len, Y0, false); rowsGrid(fr, 'E', 1.2, fr.len - 1.2, 5); }
  // North: low block east of the door, copper spandrel over the glass ground floor.
  const tDoor = 37.5, tWall0 = 41.0, tWall1 = 52.5;
  glazedPlinth(N, 'N', 0, tDoor - 2.4, 5.6, true);
  glazedPlinth(N, 'N', tDoor + 2.4, tWall0, 5.6, true);
  rowsGrid(N, 'N', 1.0, tDoor - 2.0, 9);
  rowsGrid(N, 'N', tDoor + 2.0, tWall0 - 0.4, 11);

  // Rotating-door drum.
  {
    const g = wall(N.f, tDoor, 2) ?? N.f;
    const c = [g.origin[0] + g.tangent[0] * tDoor + g.n[0] * 0.5, g.origin[1] + g.tangent[1] * tDoor + g.n[1] * 0.5];
    const drum = new T.CylinderGeometry(1.7, 1.7, 5.3, 16).translate(c[0], 2.75, c[1]); b.add(drum, 'glass');
    b.add(new T.CylinderGeometry(1.85, 1.85, 0.45, 16).translate(c[0], 5.55, c[1]), 'frame');
    b.add(new T.CylinderGeometry(1.8, 1.8, 0.1, 16).translate(c[0], 0.05, c[1]), 'frame');
    for (let a = 0; a < 4; a++) { const an = a * Math.PI / 2 + Math.atan2(g.n[0], g.n[1]); b.add(new T.BoxGeometry(0.1, 5.2, 0.1).translate(c[0] + Math.sin(an) * 1.7, 2.7, c[1] + Math.cos(an) * 1.7), 'frame'); }
  }

  // Full-height copper perforated wall with the vertical lettering and the VOC-ship silhouette.
  {
    const tc = (tWall0 + tWall1) / 2, g = wall(N.f, tc, 15);
    if (g) {
      slab(b, g, tc, 0.2, tWall1 - tWall0, TALL - 0.2, 0.14, 'copper', 0);
      const gu = wall(N.f, tWall0 - 1.9, 26);
      if (gu) slab(b, gu, tWall0 - 1.9, LOW + 0.2, 3.8, TALL - LOW - 0.2, 0.14, 'copper', 0);
      // ghosted ship: hull, three masts, square sails
      const sx = tWall0 + 1.0, sw = tWall1 - tWall0 - 2.0, base = 11.0;
      slab(b, g, sx + sw / 2, base, sw, 1.1, 0.05, 'greyBrick', 0.14);
      slab(b, g, sx + sw * 0.82, base + 1.1, sw * 0.28, 1.6, 0.05, 'greyBrick', 0.14);
      for (const [fx, h] of [[0.28, 17], [0.5, 20], [0.72, 15]] as [number, number][]) {
        slab(b, g, sx + sw * fx, base + 1.1, 0.08, h, 0.05, 'greyBrick', 0.14);
        for (const [fy, wd] of [[0.3, 2.6], [0.58, 2.1], [0.84, 1.4]] as [number, number][]) slab(b, g, sx + sw * fx, base + 1.1 + h * fy, wd, h * 0.2, 0.05, 'greyBrick', 0.14);
      }
      // vertical HOTEL JAKARTA, letters lying on their side and reading downwards
      const text = 'HOTEL JAKARTA', stride = 1.75, tl = tWall0 + 3.4, yTop = 29.6;
      const axis = new T.Vector3(g.n[0], 0, g.n[1]);
      [...text].forEach((ch, i) => {
        if (ch === ' ') return;
        const y = yTop - i * stride, px = 0.2;
        const cen = new T.Vector3(g.origin[0] + g.tangent[0] * tl + g.n[0] * 0.2, y + 3.5 * px, g.origin[1] + g.tangent[1] * tl + g.n[1] * 0.2);
        const wrap = {...b, add: (geo: T.BufferGeometry, c: never) => { geo.translate(-cen.x, -cen.y, -cen.z); geo.applyMatrix4(new T.Matrix4().makeRotationAxis(axis, -Math.PI / 2)); geo.translate(cen.x, cen.y, cen.z); b.add(geo, c); }} as BuildingTools;
        letters(wrap, g, ch, tl, y, 0.14, px, 0.1, 'white');
      });
    }
  }

  // ---- Glazed prow (north front west of the copper wall, and the nose) ----
  const prowBay = (fr: {f: Frame}, t: number, y: number) => {
    const g = wall(fr.f, t, y);
    if (!g) return;
    slab(b, g, t, 0.2, 2.25, TALL - 0.3, 0.14, 'glass', 0);
    slab(b, g, t - 1.15, 0.2, 0.12, TALL - 0.3, 0.2, 'frame', 0);
    for (let r = 1; r <= 8; r++) slab(b, g, t, r * PITCH + 4.4 - 3.05, 2.35, 0.1, 0.2, 'frame', 0);
  };
  for (let t = tWall1 + 1.2; t < N.len - 0.5; t += 2.4) prowBay(N, t, 15);
  for (let t = 1.2; t < PROW_S; t += 2.4) prowBay(S, t, 15);
  for (let i = 2; i < 18; i++) {
    const a = ring[i], c = ring[i + 1], [, , len] = unit(a, c);
    if (len < 1.2) continue;
    const fr = lineFrame(a, c, true), tm = len / 2, g = wall(fr.f, tm, 15);
    if (!g) continue;
    slab(b, g, tm, 0.2, len - 0.1, TALL - 0.3, 0.14, 'glass', 0);
    for (let r = 1; r <= 8; r++) slab(b, g, tm, r * PITCH + 1.35, len, 0.1, 0.2, 'frame', 0);
  }

  // ---- Timber-ribbed glass roof over the garden (prow) ----
  for (let x = -22; x < 24; x += 2.0) for (let z = -6; z < 10; z += 2.0) {
    const h = roofHeightAt(surfaces, x + 1, z + 1);
    if (h === null || h < 28) continue;
    b.add(new T.BoxGeometry(1.92, 0.08, 1.92).translate(x + 1, h + 0.1, z + 1), 'glass');
    b.add(new T.BoxGeometry(0.12, 0.2, 2.0).translate(x, h + 0.12, z + 1), 'ochre');
    b.add(new T.BoxGeometry(2.0, 0.2, 0.12).translate(x + 1, h + 0.12, z), 'ochre');
  }

  setSink(0);
}
