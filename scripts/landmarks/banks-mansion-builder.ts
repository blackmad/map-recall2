import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {letters, ringFrame, setSink, getSink, slab, type Frame} from './nearbar-kit';
import source from './banks-mansion-footprints.json';

/**
 * BANKS MANSION, Herengracht 519-525 / Vijzelstraat (BAG pand 0363100012165078, bouwjaar 1923): a sandstone former bank on
 * the Herengracht-Vijzelstraat corner, a hotel since 2006 (wikidata Q111410255). Massing: the 3DBAG LoD2.2 shell
 * (banks-mansion-footprints.json, written by bag-shell-prepare.ts) with its mansard (17.3-21.8 m); every detail is read from
 * rectified Gemeente Amsterdam panoramas (CC BY 4.0) at 50 px/m, per wall in banks-mansion-inventory.json:
 *  - Vijzelstraat front (ring edge 3, 16.3 m, TMX7316010203-002619_pano_0015_000187): a rendered ground floor of large
 *    windows between engaged columns under an entablature, a wrought-iron balcony along the first floor and another along the
 *    third, five bays of architraved windows, the modillion cornice and five dormers.
 *  - Herengracht front (ring edge 5, 17.9 m, TMX7316010203-000355_pano_0000_000753): the same orders in six bays.
 *  - the chamfered corner (ring edge 4, 6.7 m, recording_2025-06-16_06-42-40_01641): the entrance between two columns with
 *    two lanterns and the BANKS letters, two windows a floor, three on the third, and the large central dormer.
 */
export function buildBanksMansion(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as {facadeRing: number[][]; surfaces: Surface[]; nativeRing: number[][]};
  const ring = src.facadeRing;
  // 3DBAG reads the two balconies as 7.2 m roofs and sets its upper walls back behind them, so the street zone (3 m behind the
  // BAG fronts, ring edges 3-5, up to the cornice at 17.3 m) is drawn here as solid stone and the shell keeps the mansard,
  // the rear and the party walls
  const FRONTS = [3, 4, 5], ZONE = 3.0, CORNICE = 17.3;
  const segDist = (x: number, z: number, i: number) => {
    const a = ring[i], c = ring[(i + 1) % ring.length], dx = c[0] - a[0], dz = c[1] - a[1], L2 = dx * dx + dz * dz;
    const u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
    return Math.hypot(x - a[0] - u * dx, z - a[1] - u * dz);
  };
  const inZone = (x: number, z: number) => FRONTS.some(i => segDist(x, z, i) < ZONE + 0.3);
  addShell(b, src as never, {
    wall: 'sandstone', roof: 'slate',
    skip: s => {
      const r = s.rings[0];
      if (!r.every(p => inZone(p[0], p[2]))) return false;
      return s.type === 'WallSurface' || Math.min(...r.map(p => p[1])) < 19;
    },
  });
  const ext: Record<number, [number, number]> = {3: [-0.06, 0], 4: [0, 0], 5: [0, -0.06]}; // clear of the party-wall planes
  for (const i of FRONTS) {
    const {f, len} = ringFrame(ring, i), [e0, e1] = ext[i];
    const p = (t: number, back: number) => new T.Vector2(f.origin[0] + f.tangent[0] * t - f.n[0] * back, f.origin[1] + f.tangent[1] * t - f.n[1] * back);
    // corner pieces reach past the edge ends so the three prisms close the chamfer corners (overlap stays inside)
    const g = new T.ExtrudeGeometry(new T.Shape([p(-e0, 0), p(len + e1, 0), p(len + e1, ZONE), p(-e0, ZONE)]), {depth: CORNICE, bevelEnabled: false});
    g.rotateX(Math.PI / 2).translate(0, CORNICE, 0);
    b.add(g, 'sandstone' as never);
    // mansard over the street zone (the 3DBAG one there is skipped with its walls): a closed wedge from the cornice line to the
    // flat top at 21.75 m, 2.6 m back
    const prof = new T.Shape([new T.Vector2(-0.05, CORNICE), new T.Vector2(ZONE - 0.4, 21.75), new T.Vector2(ZONE - 0.4, CORNICE)]);
    const m = new T.ExtrudeGeometry(prof, {depth: len + e0 + e1, bevelEnabled: false});
    const pos = m.getAttribute('position');
    for (let k = 0; k < pos.count; k++) { const v = p(-e0 + pos.getZ(k), pos.getX(k)); pos.setXYZ(k, v.x, pos.getY(k), v.y); }
    // the (back, y, along) -> world map can mirror the solid: keep the faces outward
    m.computeBoundingBox();
    const cen = new T.Vector3(); m.boundingBox!.getCenter(cen);
    const A = new T.Vector3().fromBufferAttribute(pos, 0), B = new T.Vector3().fromBufferAttribute(pos, 1), C = new T.Vector3().fromBufferAttribute(pos, 2);
    if (B.clone().sub(A).cross(C.clone().sub(A)).dot(A.clone().add(B).add(C).divideScalar(3).sub(cen)) < 0) {
      const a = pos.array as Float32Array; for (let k = 0; k < a.length; k += 9) for (let j = 0; j < 3; j++) [a[k + 3 + j], a[k + 6 + j]] = [a[k + 6 + j], a[k + 3 + j]];
    }
    m.computeVertexNormals();
    m.userData.role = 'roof';
    b.add(m, 'slate' as never);
  }
  const sink0 = getSink();
  setSink(0.05);

  /** Window with an architrave, glass, white frame, a mullion and a transom (casement over a fanlight). */
  const win = (f: Frame, t: number, y0: number, y1: number, w: number, arch = true, o = 0) => {
    // architrave as four thin strips: a whole stone panel behind the window would read as its host wall in the openings gate
    // layers 4 cm apart (2-3 cm reads as z-fighting in audit:glb): strips 0.06, frame 0.10, glass 0.14, bars 0.18
    if (arch) {
      for (const sd of [-1, 1]) slab(b, f, t + sd * (w / 2 + 0.12), y0 - 0.15, 0.16, y1 - y0 + 0.3, 0.06, 'stone', o);
      slab(b, f, t, y1 + 0.04, w + 0.4, 0.14, 0.06, 'stone', o);
    }
    slab(b, f, t, y0 - 0.04, w + 0.1, y1 - y0 + 0.08, 0.1, 'frame', o);
    slab(b, f, t, y0, w, y1 - y0, 0.14, 'glass', o);
    slab(b, f, t, y0, 0.06, y1 - y0, 0.18, 'frame', o);
    slab(b, f, t, y1 - Math.min(0.75, (y1 - y0) * 0.3), w, 0.06, 0.18, 'frame', o);
    slab(b, f, t, y0 - 0.12, w + 0.3, 0.1, 0.16, 'stone', o);
  };
  /** Large ground-floor window with small panes (cols x rows). */
  const shopWin = (f: Frame, t: number, y0: number, y1: number, w: number, cols = 3, rows = 4) => {
    slab(b, f, t, y0 - 0.05, w + 0.12, y1 - y0 + 0.1, 0.1, 'frame');
    slab(b, f, t, y0, w, y1 - y0, 0.14, 'glass');
    for (let k = 1; k < cols; k++) slab(b, f, t - w / 2 + (w * k) / cols, y0, 0.05, y1 - y0, 0.18, 'frame');
    for (let r = 1; r < rows; r++) slab(b, f, t, y0 + ((y1 - y0) * r) / rows, w, 0.05, 0.18, 'frame');
  };
  /** Engaged column (half-round shaft) with base and capital, t on the wall. */
  const column = (f: Frame, t: number, y0: number, y1: number, r = 0.38) => {
    const g = new T.CylinderGeometry(r, r * 1.05, y1 - y0 - 0.5, 12, 1, false, -Math.PI / 2, Math.PI);
    g.translate(0, (y1 - y0 - 0.5) / 2 + 0.25, 0);
    putIn(b, f, g, t, y0, 0.0, 'white');
    slab(b, f, t, y0, 2 * r + 0.16, 0.25, r + 0.08, 'white', -0.02);
    slab(b, f, t, y1 - 0.25, 2 * r + 0.24, 0.25, r + 0.12, 'white', -0.02);
  };
  /** Wrought-iron balcony: stone slab on the cornice, railing of bars with scroll rings simplified as a mid rail. */
  const balcony = (f: Frame, t0: number, t1: number, y: number, depth: number) => {
    slab(b, f, (t0 + t1) / 2, y - 0.18, t1 - t0, 0.18, depth + 0.05, 'stone');
    const out = depth - 0.04, mid = (t0 + t1) / 2, w = t1 - t0;
    slab(b, f, mid, y + 0.86, w, 0.05, 0.05, 'bronze', out);
    slab(b, f, mid, y + 0.05, w, 0.04, 0.04, 'bronze', out);
    slab(b, f, mid, y + 0.42, w, 0.03, 0.03, 'bronze', out);
    for (let u = t0 + 0.06; u <= t1 - 0.04; u += 0.16) slab(b, f, u, y, 0.022, 0.9, 0.022, 'bronze', out);
  };
  /** Dormer in the mansard: stone cheeks and front, window, flat cornice cap. */
  const dormer = (f: Frame, t: number, w: number, y0: number, y1: number, ww: number, wy0: number, wy1: number) => {
    // the dormer face stands on the front plane (stone aedicula on the cornice line, blind review); flush, so the openings gate
    // reads the front and the dormer as one host silhouette. Its window sits on that face with a shallow sink.
    slab(b, f, t, y0, w, y1 - y0, 2.0, 'sandstone', -2.0);
    const s0 = getSink(); setSink(0.04);
    win(f, t, wy0, wy1, ww, false, 0);
    setSink(s0);
    slab(b, f, t, y1, w + 0.3, 0.28, 2.25, 'stone', -2.1);
    // (a projecting cap or pilaster strips in front of the face are read as the window's host wall by the openings gate)
  };
  /** Shared storeys above the ground floor, for bay centres `ts` (windows w wide). */
  const upper = (f: Frame, len: number, ts: number[], w = 1.2, top: [number, number][] = ts.map(t => [t, w])) => {
    slab(b, f, len / 2, 4.6, len, 1.2, 0.14, 'sandstone');          // entablature
    slab(b, f, len / 2, 5.0, len, 0.08, 0.18, 'stone');
    balcony(f, 0, len, 6.1, 0.55);
    for (const t of ts) {
      win(f, t, 6.4, 9.0, w);
      slab(b, f, t, 9.25, w + 0.6, 0.12, 0.22, 'stone');               // hood cornice
      slab(b, f, t, 9.15, w + 0.4, 0.12, 0.12, 'stone');
      win(f, t, 10.4, 12.9, w);
    }
    for (const [t, ww] of top) win(f, t, 14.3, 16.3, ww);
    slab(b, f, len / 2, 13.55, len, 0.3, 0.22, 'stone');
    balcony(f, 0, len, 14.1, 0.45);
    slab(b, f, len / 2, 16.55, len, 0.65, 0.08, 'stone');               // frieze
    for (let u = 0.25; u < len - 0.1; u += 0.5) slab(b, f, u, 17.2, 0.14, 0.18, 0.45, 'stone');
    slab(b, f, len / 2, 17.38, len + 0.2, 0.32, 0.65, 'stone');          // modillion cornice
  };
  /** Rendered ground floor with columns and windows. */
  const ground = (f: Frame, len: number, cols: number[], wins: number[]) => {
    slab(b, f, len / 2, 0, len, 0.6, 0.1, 'stone');
    slab(b, f, len / 2, 0.6, len, 4.0, 0.06, 'white');
    for (const t of wins) shopWin(f, t, 1.6, 4.4, 1.4);
    for (const t of cols) column(f, t, 0.6, 4.6);
  };

  // ---------- Vijzelstraat front (ring edge 3; t from the north end) ----------
  {
    const {f, len} = ringFrame(ring, 3);
    ground(f, len, [2.3, 5.1, 8.0, 10.8, 13.7], [3.9, 6.6, 9.34, 12.07]);
    win(f, 15.6, 1.6, 3.2, 0.8, false);
    upper(f, len, [3.8, 6.56, 9.34, 12.14, 14.96]);
    for (const t of [3.9, 6.6, 9.2, 11.9, 14.6]) dormer(f, t, 1.8, 17.6, 20.2, 1.0, 18.0, 19.8);
  }
  // ---------- Herengracht front (ring edge 5; t from the west end) ----------
  {
    const {f, len} = ringFrame(ring, 5);
    ground(f, len, [2.8, 5.6, 8.44, 11.3, 14.1, 16.96], [4.3, 7.1, 9.84, 12.64, 15.4]);
    upper(f, len, [1.46, 4.26, 7.04, 9.84, 12.64, 15.44]);
    for (const t of [1.46, 4.26, 7.04, 9.84, 12.64, 15.44]) dormer(f, t, 1.8, 17.6, 20.2, 1.0, 18.0, 19.8);
  }
  // ---------- chamfered corner (ring edge 4; t from the Vijzelstraat side) ----------
  {
    const {f, len} = ringFrame(ring, 4);
    slab(b, f, len / 2, 0, len, 0.6, 0.1, 'stone');
    slab(b, f, len / 2, 0.6, len, 4.0, 0.06, 'white');
    // entrance: glazed timber doors and transom set back in a deep stone reveal, between two columns (w03 crop, blind review)
    for (const s of [-1, 1]) slab(b, f, 3.4 + s * 1.14, 0.1, 0.22, 4.0, 0.34, 'sandstone');
    slab(b, f, 3.4, 3.9, 2.5, 0.25, 0.34, 'sandstone');
    slab(b, f, 3.4, 0.1, 2.05, 3.85, 0.1, 'frame');
    slab(b, f, 3.4, 0.15, 1.85, 3.0, 0.14, 'glass');
    slab(b, f, 3.4, 3.2, 1.85, 0.65, 0.14, 'glass');
    slab(b, f, 3.4, 3.12, 1.85, 0.08, 0.18, 'frame');
    for (const t of [2.53, 3.4, 4.27]) slab(b, f, t, 0.15, 0.12, 2.97, 0.18, 'frame');
    slab(b, f, 3.4, 0.15, 1.85, 0.45, 0.18, 'frame');
    for (const t of [1.9, 5.0]) column(f, t, 0.6, 4.6);
    // lanterns and the BANKS letters on the two render panels
    for (const t of [0.95, 5.75]) {
      slab(b, f, t, 3.25, 0.06, 0.2, 0.3, 'bronze');
      slab(b, f, t, 2.75, 0.26, 0.5, 0.26, 'bronze', 0.18);
      slab(b, f, t, 2.82, 0.18, 0.34, 0.27, 'gold', 0.17);
      letters(b, f, 'BANKS', t, 1.85, 0.08, 0.034, 0.03, 'dark');
    }
    // third floor of the corner: three windows (0.8, 1.1, 0.8 m) instead of the pair below
    upper(f, len, [2.3, 4.55], 1.15, [[1.8, 0.8], [3.4, 1.1], [5.1, 0.8]]);
    dormer(f, 3.4, 2.9, 17.6, 20.8, 1.0, 18.1, 19.95);
  }
  setSink(sink0);
}

/** Place a frame-space geometry (x along the wall, y up, z out) at (t, y, out). */
function putIn(b: BuildingTools, f: Frame, g: T.BufferGeometry, t: number, y: number, out: number, colour: string) {
  g.rotateY(Math.atan2(f.n[0], f.n[1]));
  g.translate(f.origin[0] + f.tangent[0] * t + f.n[0] * out, y, f.origin[1] + f.tangent[1] * t + f.n[1] * out);
  b.add(g, colour as never);
}
