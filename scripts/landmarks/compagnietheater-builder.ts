import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {surveyShell} from './museums2-shared';
import {wallProbe, setSink, archBand, archSlab, archWindows, eaveOffset, poly, put, ringFrame, slab} from './nearbar-kit';
import {wallTop} from './historic-shared';
import data from './compagnietheater-footprints.json';

/**
 * Compagnietheater, Kloveniersburgwal 50: the 1792-93 Lutheran church by Abraham van der Hart (BAG pand
 * 0363100012171200), 3DBAG LoD2.2 roofs. The canal front (ring edge 16, 14.3 m, rectified 2021 panorama)
 * is a Hollands-Classicist temple front: rusticated pale-stone ground floor with three white sash windows,
 * a string course, three tall round-headed windows in brick reveals between pilasters (doubled at the
 * ends), a full entablature and the pediment with Anthonie Ziesenis's seated allegory flanked by two
 * putti above the dated plaque (MDCCXCIII). The flanking canal wings and the long side flanks repeat the
 * rustication and tall arched windows. Positions are scaled off the rectified front to about 0.2 m.
 */
export function buildCompagnietheater(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const shellGeoms: T.BufferGeometry[] = [];
  surveyShell({...b, add: (g, c, x, y, z, a) => { b.add(g, c, x, y, z, a); shellGeoms.push(g.clone()); }} as BuildingTools, data, 'stone', 'slate');
  b.mark?.('shell');
  const probe = wallProbe(shellGeoms);
  setSink(0.35);
  const ring = data.ring[0] as number[][], roofs = data.roofs as {rings: number[][][]}[];
  const topFn = wallTop(roofs);
  /** Keep only window centres whose head fits under the local eave (3DBAG roof) with 0.3 m to spare. */
  const fits = (f: ReturnType<typeof ringFrame>['f'], ts: number[], head: number) => ts.filter(t => topFn(f.origin[0] + f.tangent[0] * t - f.n[0] * 0.6, f.origin[1] + f.tangent[1] * t - f.n[1] * 0.6) >= head + 0.3);
  const fr = (i: number) => ringFrame(ring, i, eaveOffset(ring, roofs, i));

  /** Rustication lines, string course and cornice shared by the front and its wings. */
  const storeys = (f: ReturnType<typeof fr>['f'], len: number, o: {belt?: boolean} = {}) => {
    for (let y = 0.9; y < 6.0; y += 0.95) slab(b, f, len / 2, y, len - 0.1, 0.035, 0.03, 'concrete');
    slab(b, f, len / 2, 0, len - 0.1, 0.5, 0.1, 'concrete');                       // plinth
    if (o.belt !== false) slab(b, f, len / 2, 5.85, len - 0.1, 0.4, 0.2, 'greyBrick');   // string course
    slab(b, f, len / 2, 13.4, len - 0.1, 0.35, 0.12, 'white');                    // architrave
    slab(b, f, len / 2, 14.4, len - 0.1, 0.5, 0.36, 'white');                     // cornice
    for (let t = 0.3; t < len - 0.2; t += 0.38) slab(b, f, t, 14.1, 0.18, 0.28, 0.14, 'white');   // dentils
  };

  // ---- Canal front: ring edge 16 ----
  {
    const {f, len} = fr(16);
    storeys(f, len);
    const cs = [3.4, 6.9, 10.4];
    // ground floor: three sashes
    archWindowsRect(b, f, cs, 2.6, 2.1, 2.5);
    for (const t of cs) {
      archSlab(b, f, t, 6.55, 3.3, 6.6, 0.05, 'brick');                           // brick reveal panel
      archBand(b, f, t, 6.55, 3.3, 6.6, 0.12, 0.09, 'white');
      archWindows(b, f, [t], {y: 7.05, w: 2.1, h: 5.55, bars: 3, rows: 4, sill: 'stone'});
    }
    // pilasters between the windows and doubled at the ends, with capitals and bases
    for (const t of [0.35, 1.45, 5.15, 8.65, 12.85, 13.95]) {
      slab(b, f, t, 5.9, 0.75, 7.1, 0.22, 'white');
      slab(b, f, t, 13.0, 0.95, 0.4, 0.28, 'white');
      slab(b, f, t, 5.9, 0.95, 0.3, 0.28, 'white');
    }
    // frieze under the cornice, tympanum group, raking cornices
    slab(b, f, len / 2, 13.75, len - 0.1, 0.65, 0.05, 'white');
    const raking: [number, number][] = [[-0.4, 14.92], [7.22, 17.76], [14.1, 14.92], [14.1, 14.5], [7.22, 17.34], [-0.4, 14.5]];
    poly(b, f, 0, 0, raking, 0.32, 'white');
    // Ziesenis group: dated plaque, seated allegory with a book, two putti
    const c = 7.22;
    slab(b, f, c, 15.0, 5.0, 0.34, 0.14, 'white');                                  // MDCCXCIII plaque
    for (let k = 0; k < 9; k++) slab(b, f, c - 1.6 + k * 0.4, 15.1, 0.2, 0.14, 0.16, 'concrete');
    slab(b, f, c, 15.34, 2.0, 0.3, 0.36, 'white');                                  // seat / plinth
    put(b, f, new T.CylinderGeometry(0.3, 0.62, 1.5, 10).translate(0, 0.75, 0.3), c, 15.64, 0, 'white');   // seated figure
    put(b, f, new T.SphereGeometry(0.3, 10, 8).translate(0, 0, 0.3), c, 17.35, 0, 'white');                 // head
    for (const s of [-1, 1]) {
      put(b, f, new T.CylinderGeometry(0.22, 0.34, 0.75, 8).translate(0, 0.375, 0.2), c + s * 1.6, 15.34, 0, 'white');   // putto bodies
      put(b, f, new T.SphereGeometry(0.24, 10, 8).translate(0, 0, 0.2), c + s * 1.6, 16.35, 0, 'white');
    }
    slab(b, f, c + 0.95, 15.64, 0.8, 0.6, 0.2, 'stone');                               // open book on the knee
  }
  // ---- Canal wings (edges 14 and 18): same rustication and arched windows on the 3.5 m pitch ----
  for (const i of [14, 18]) {
    const {f, len} = fr(i);
    storeys(f, len);
    const cs: number[] = []; for (let t = 1.8; t < len - 1.0; t += 3.5) cs.push(t);
    archWindowsRect(b, f, cs, 2.6, 2.1, 2.5);
    for (const t of cs) {
      archSlab(b, f, t, 6.55, 3.0, 6.6, 0.05, 'brick');
      archWindows(b, f, [t], {y: 7.05, w: 2.0, h: 5.5, bars: 3, rows: 4, sill: 'stone'});
    }
  }
  // ---- Long flanks (south 13, west 11) and west end (12): ground sashes and tall arched upper windows ----
  for (const i of [13, 11, 12]) {
    const {f, len} = fr(i);
    storeys(f, len, {belt: true});
    const cs: number[] = []; for (let t = 2.0; t < len - 1.4; t += 3.3) cs.push(t);
    for (const t of fits(f, cs, 5.0)) archWindowsRect(b, probe.snap(f, t, 3.7), [t], 2.4, 1.5, 2.6);
    for (const t of fits(f, cs, 12.1)) archWindows(b, probe.snap(f, t, 9.5), [t], {y: 6.9, w: 1.5, h: 5.2, bars: 2, rows: 4});
  }
}

/** Rectangular white-framed sash windows (3 x 2 panes) with a stone sill. */
function archWindowsRect(b: BuildingTools, f: import('./nearbar-kit').Frame, ts: number[], y: number, w: number, h: number) {
  for (const t of ts) {
    slab(b, f, t, y - 0.06, w + 0.24, h + 0.12, 0.08, 'white');
    slab(b, f, t, y, w, h, 0.11, 'glass');
    for (const k of [1, 2]) slab(b, f, t - w / 2 + w * k / 3, y, 0.05, h, 0.14, 'white');
    slab(b, f, t, y + h / 2, w, 0.05, 0.14, 'white');
    slab(b, f, t, y - 0.16, w + 0.5, 0.1, 0.2, 'stone');
  }
}
