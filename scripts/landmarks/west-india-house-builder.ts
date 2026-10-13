import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {surveyShell} from './museums2-shared';
import {wallTop} from './historic-shared';
import {archBand, archSlab, poly, put, ringFrame, sashWindows, setSink, slab, wallProbe} from './nearbar-kit';
import {splitCourses} from './nearbar-roof';
import raw from './west-india-house-footprints.json';

/**
 * West-Indisch Huis, Herenmarkt 99: BAG pand 0363100012167535 (1617, enlarged by the West India Company
 * around a courtyard), 3DBAG LoD2.2 roofs. Rectified 2021-25 panoramas of three fronts:
 *  - north front (18.8 m): grey-plastered, seven bays of tall white sashes in two storeys, an arched door in
 *    a stone surround under a flat hood, full cornice and a pedimented centre with a garland in the tympanum;
 *  - west front (24.7 m): brown brick, two storeys of tall white sashes on a 2.65 m pitch (a blank bay where
 *    the downpipe runs), white cornice band, dormer roof;
 *  - south and east ranges and the open courtyard: the same sash rhythm, with a cobbled court floor and the
 *    Peter Stuyvesant statue on its plinth.
 * 3DBAG slivers (a 17.1 m and an 18.4 m roof spike) are removed; roofs are tessellated into slate courses.
 */
export function buildWestIndiaHouse(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  // Clean the 3DBAG roofs: drop sliver faces and clamp the 18.4 m spike to the ridge height of the neighbours.
  const drop = new Set([3, 20, 14]);
  const roofs = (raw.roofs as {id: string; rings: number[][][]}[]).filter((_, i) => !drop.has(i)).map(f => ({...f, rings: f.rings.map(r => r.map(p => (p[1] > 16.95 ? [p[0], 16.7, p[2]] : p)))}));
  const data = {...raw, roofs};
  const shellGeoms: T.BufferGeometry[] = [];
  surveyShell({...b, add: (g, c, x, y, z, a) => {
    if (c === 'slate') {
      const [A, B] = splitCourses(g);
      for (const [geo, col] of [[A, 'slate'], [B, 'greyBrick']] as const) { b.add(geo, col as never, x, y, z, a); shellGeoms.push(geo.clone()); }
    } else { b.add(g, c, x, y, z, a); shellGeoms.push(g.clone()); }
  }} as BuildingTools, data, 'brick', 'slate');
  b.mark?.('shell');
  setSink(0.35);
  const probe = wallProbe(shellGeoms);
  const ring = raw.ring[0] as number[][], hole = raw.ring[1] as number[][];
  const topFn = wallTop(roofs);
  type F = ReturnType<typeof ringFrame>['f'];
  const eaveAt = (f: F, t: number) => topFn(f.origin[0] + f.tangent[0] * t - f.n[0] * 0.6, f.origin[1] + f.tangent[1] * t - f.n[1] * 0.6);
  const snap = (f: F, t: number, y: number) => { const o = probe.offset(f, t, y); return o === null || Math.abs(o) > 0.45 ? null : probe.snap(f, t, y); };

  /** Two storeys of tall sashes under the eave; `ts` are centres along the wall. */
  const rows = (f: F, ts: number[], opts: {sill?: string; lintel?: string} = {}) => {
    for (const t of ts) {
      const E = eaveAt(f, t);
      if (!Number.isFinite(E) || E < 6) continue;
      const lowH = Math.min(3.3, (E - 1.0 - 1.4) * 0.5), upSill = 0.95 + lowH + 1.0, upH = Math.min(2.9, E - 0.9 - upSill);
      if (upH < 1.4) continue;
      sashWindows(b, f, [t], {y: 0.95, w: 1.1, h: lowH, cols: 2, rows: 4, sill: opts.sill ?? 'white', lintel: opts.lintel, snap});
      sashWindows(b, f, [t], {y: upSill, w: 1.1, h: upH, cols: 2, rows: 4, sill: opts.sill ?? 'white', lintel: opts.lintel, snap});
    }
  };
  const even = (len: number, pitch = 2.7, margin = 1.5) => {
    const n = Math.max(1, Math.floor((len - 2 * margin) / pitch) + 1), start = len / 2 - (n - 1) * pitch / 2;
    return Array.from({length: n}, (_, k) => start + k * pitch);
  };
  const cornice = (f: F, len: number, color = 'white') => {
    const E = Math.min(...[0.3, len / 2, len - 0.3].map(t => eaveAt(f, t)).filter(Number.isFinite));
    slab(b, f, len / 2, E - 0.75, len, 0.3, 0.16, color);
    slab(b, f, len / 2, E - 0.42, len, 0.38, 0.34, color);
  };

  // ---- North front (edge 28): grey stucco, seven bays, arched door, pediment ----
  {
    const {f, len} = ringFrame(ring, 28), E = 9.3, c = 10.1;
    slab(b, f, len / 2, 0, len, E - 0.1, 0.03, 'concrete');
    slab(b, f, len / 2, 0, len, 0.45, 0.07, 'stone');                                  // plinth
    const ts = [0, 1, 2, 3, 4, 5, 6].map(k => 2.0 + 2.7 * k);
    for (const t of ts) {
      if (t === 2.0 + 2.7 * 3) {   // door bay
        archSlab(b, f, t, 0, 2.15, 3.55, 0.09, 'dark');
        archBand(b, f, t, 0, 2.75, 3.95, 0.24, 0.14, 'white');
        for (const s of [-1, 1]) { slab(b, f, t + s * 1.45, 0, 0.5, 4.3, 0.28, 'stone'); slab(b, f, t + s * 1.45, 3.9, 0.7, 0.2, 0.34, 'stone'); }
        slab(b, f, t, 4.3, 4.0, 0.45, 0.62, 'stone');                                    // flat hood
        slab(b, f, t, 4.75, 3.6, 0.12, 0.5, 'stone');
        sashWindows(b, f, [t], {y: 5.3, w: 1.1, h: 2.15, cols: 2, rows: 4, sill: 'white', snap});
        continue;
      }
      sashWindows(b, f, [t], {y: 0.95, w: 1.2, h: 3.3, cols: 2, rows: 4, sill: 'stone', snap});
      sashWindows(b, f, [t], {y: 5.3, w: 1.2, h: 2.15, cols: 2, rows: 4, sill: 'stone', snap});
    }
    slab(b, f, len / 2, E - 0.75, len, 0.3, 0.16, 'white');                             // architrave
    slab(b, f, len / 2, E - 0.42, len, 0.38, 0.4, 'white');                             // cornice
    // pediment over the centre, with a plaster garland in the tympanum
    poly(b, f, c, E - 0.04, [[-5.3, 0], [5.3, 0], [0, 2.25]], 0.3, 'concrete');
    for (const s of [-1, 1]) poly(b, f, c, E - 0.04, [[0, 2.25], [s * 5.3, 0], [s * 5.3, 0.3], [0, 2.55]], 0.42, 'white');   // raking cornices
    for (let k = -3; k <= 3; k++) slab(b, f, c + k * 0.7, E + 0.35 + 0.45 * (1 - Math.abs(k) / 3.6), 0.5, 0.28, 0.14, 'white');   // garland
    slab(b, f, c, E + 0.55, 0.9, 0.9, 0.16, 'white');                                        // central cartouche
  }

  // ---- West front (edge 35): brown brick, sashes with a blank bay at the downpipe ----
  {
    const {f, len} = ringFrame(ring, 35);
    rows(f, [3.1, 5.8, 8.4, 12.3, 14.9, 19.2, 21.6], {sill: 'white'});
    cornice(f, len);
    slab(b, f, len / 2, 0, len, 0.3, 0.06, 'stone');
  }
  // ---- South front (edge 3) and the remaining street ranges ----
  for (let i = 0; i < ring.length - 1; i++) {
    if (i === 28 || i === 35) continue;
    const {f, len} = ringFrame(ring, i);
    if (len < 3.4) continue;
    rows(f, even(len), {sill: 'white'});
    if (len > 6) cornice(f, len);
  }
  // ---- Courtyard: sash ranges on the inner walls, cobbled floor and the Stuyvesant statue ----
  for (let i = 0; i < hole.length - 1; i++) {
    const {f, len} = ringFrame(hole, i, 0, true);
    if (len < 3.4) continue;
    rows(f, even(len, 2.7, 1.7), {sill: 'white'});
    if (len > 6) cornice(f, len);
  }
  {
    const pts = hole.slice(0, -1), shape = new T.Shape(pts.map(p => new T.Vector2(p[0], -p[1])));
    const floor = new T.ShapeGeometry(shape).rotateX(-Math.PI / 2).translate(0, 0.02, 0);
    b.add(floor, 'ochre' as never);
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    // Peter Stuyvesant: bronze figure with hat and peg leg on a stone plinth, centre of the court
    b.add(new T.BoxGeometry(1.0, 0.3, 1.0).translate(0, 0.15, 0), 'stone' as never, cx, 0, cz);
    b.add(new T.BoxGeometry(0.75, 1.1, 0.75).translate(0, 0.85, 0), 'stone' as never, cx, 0, cz);
    b.add(new T.CylinderGeometry(0.2, 0.26, 0.9, 10).translate(0, 1.85, 0), 'bronze' as never, cx, 0, cz);       // coat
    b.add(new T.BoxGeometry(0.1, 0.55, 0.1).translate(0.12, 1.7, 0.18), 'bronze' as never, cx, 0, cz);            // peg leg
    b.add(new T.SphereGeometry(0.17, 10, 8).translate(0, 2.45, 0), 'bronze' as never, cx, 0, cz);                 // head
    b.add(new T.CylinderGeometry(0.28, 0.28, 0.05, 12).translate(0, 2.58, 0), 'bronze' as never, cx, 0, cz);     // hat brim
    b.add(new T.CylinderGeometry(0.15, 0.17, 0.2, 10).translate(0, 2.7, 0), 'bronze' as never, cx, 0, cz);
    void put; void archBand;
  }
}
