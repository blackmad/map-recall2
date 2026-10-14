import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {memorialFrame} from './memorial-frame';

/**
 * Westermoskee, Mosveld (BAG pand 0363100012241498, built 2015): a pink-brown brick mosque on a 28 x 35 m plan with a two-storey arcade of white
 * columns and arches along its north-east and south-east fronts, striped brown and ochre brick behind the columns, a terrace of small lead cupolas with
 * gilt crescents on the arcade roof, a chamfered upper hall under a dentil cornice and a shallow lead dome, and a brick minaret with two balconies at the east corner.
 *
 * Frame (u, v): u along bearing 38 deg (north-east), v along bearing 128 deg (south-east); the model frame is x east, z south from the 3DBAG vertex mean
 * (anchor), the builder works in the local frame of `memorialFrame(b, 128)` (local x = u, local z = v). The BAG/3DBAG footprint is an axis-aligned rectangle
 * in this frame, u -16..12.3 and v -18.8..15.9, with the minaret base at the east corner (u 15.5..16.7) (a 3.3 m deep box at u -3.6..0.1, v to 19.2 on the south-east front is in the footprint but no panorama shows a porch there, so it is not modelled). Heights are metres above the 3DBAG ground (NAP 0.61): arcade cornice 8.9, upper hall 17.8, dome apex 25.8, minaret 32.6.
 * Panoramas (Gemeente Amsterdam, CC BY 4.0): recording_2025-07-31_11-43-48_00010..00017, TMX7316010203-002378_pano_0007_000070/72/74, _0008_000220,
 * TMX7316010203-002554_pano_0000_000901. The north-west and south-west fronts are not photographed (unseen annex walls, inferred from 3DBAG heights).
 */
type Colour = Parameters<BuildingTools['add']>[1];
const FACING = 128;
const ARCH_SPRING = 6.0, CORNICE_Y = 8.4, TERRACE_Y = 8.9, HALL_TOP = 17.2, HALL_ROOF = 17.75;
// wall planes of the lower block and of the upper hall (u, v)
const CORE = {u0: -16, u1: 8.7, v0: -18.8, v1: 12.3};
const COL_U = 11.95, COL_V = 15.55;                      // outer column lines of the two arcades
const HALL = {u0: -12, u1: 7.3, v0: -13, v1: 10.8, chamfer: 2.5};

export function buildWestermoskee(_w: number, _d: number, b: BuildingTools) {
  const {put, box} = memorialFrame(b, FACING);
  const add = (g: T.BufferGeometry, x: number, y: number, z: number, c: Colour) => put(g, x, y, z, c);

  // ---- face frames: shapes are authored in (t along the face, y up, d out of the face), extruded along +d, then turned onto the face plane
  type Face = 'se' | 'ne' | 'nw' | 'sw';
  const ROT: Record<Face, number> = {se: 0, ne: Math.PI / 2, nw: Math.PI, sw: -Math.PI / 2};
  const origin = (f: Face, plane: number): [number, number] => f === 'se' || f === 'nw' ? [0, plane] : [plane, 0];
  const place = (f: Face, plane: number, g: T.BufferGeometry, c: Colour) => { g.rotateY(ROT[f]); const [x, z] = origin(f, plane); add(g, x, 0, z, c); };
  /** Box on a face: tangent t, base y0, from d0 outward with size w x h x depth. */
  const fbox = (f: Face, plane: number, t: number, y0: number, d0: number, w: number, h: number, depth: number, c: Colour) => {
    const g = new T.BoxGeometry(w, h, depth); g.translate(t, y0 + h / 2, d0 + depth / 2); place(f, plane, g, c);
  };
  const shapeOf = (pts: [number, number][], holes: [number, number][][] = []) => {
    const s = new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])));
    for (const h of holes) s.holes.push(new T.Path(h.map(p => new T.Vector2(p[0], p[1]))));
    return s;
  };
  const fext = (f: Face, plane: number, pts: [number, number][], d0: number, depth: number, c: Colour, holes: [number, number][][] = []) => {
    const g = new T.ExtrudeGeometry(shapeOf(pts, holes), {depth, bevelEnabled: false}); g.translate(0, 0, d0); place(f, plane, g, c);
  };
  /** Arch outline: legs at ys, semicircle of radius r about (t0, ys). */
  const arc = (t0: number, ys: number, r: number, from: number, to: number, n = 10): [number, number][] => {
    const p: [number, number][] = [];
    for (let i = 0; i <= n; i++) { const th = from + (to - from) * i / n; p.push([t0 + r * Math.cos(th), ys + r * Math.sin(th)]); }
    return p;
  };
  const cyl = (rt: number, rb: number, h: number, seg: number, x: number, y: number, z: number, c: Colour) => add(new T.CylinderGeometry(rt, rb, h, seg), x, y + h / 2, z, c);
  /** World (u, v) of a point on a face. */
  const onFace = (f: Face, t: number, d: number, plane: number): [number, number] =>
    f === 'se' ? [t, plane + d] : f === 'ne' ? [plane + d, -t] : f === 'nw' ? [-t, plane - d] : [plane - d, t];

  // ---- lower block: striped walls, ochre bands 4.5 cm proud, then the terrace slab
  {
    // striped wall: stacked layers, dark brown 0.5 m and ochre 0.4 m alternating to 5.7 m, plain red brick above (no overlay bands to fight the wall)
    const cu = (CORE.u0 + CORE.u1) / 2, cv = (CORE.v0 + CORE.v1) / 2, lu = CORE.u1 - CORE.u0, lv = CORE.v1 - CORE.v0;
    let y = 0, k = 0;
    while (y < 5.7 - 1e-6) {
      const h = Math.min(k % 2 === 0 ? 0.5 : 0.4, 5.7 - y);
      box(cu, y, cv, lu, h, lv, k % 2 === 0 ? 'greyBrick' : 'ochre');
      y += h; k++;
    }
    box(cu, 5.7, cv, lu, CORNICE_Y - 5.7, lv, 'brick');
  }
  // annex wings on the unphotographed north-west and south-west sides carry the arcade-height cornice only; the arcades' ceilings close the open bays
  const slab = (u0: number, u1: number, v0: number, v1: number, y0: number, h: number, c: Colour) => box((u0 + u1) / 2, y0, (v0 + v1) / 2, u1 - u0, h, v1 - v0, c);
  slab(CORE.u1, COL_U + 0.2, -18.5, 15.9, 7.9, 0.5, 'stone');                                              // NE arcade ceiling
  slab(CORE.u0 + 0.3, CORE.u1, CORE.v1, COL_V + 0.2, 7.9, 0.5, 'stone');                                         // SE arcade ceiling
  slab(-16.1, 12.55, -18.9, 16.2, CORNICE_Y, TERRACE_Y - CORNICE_Y, 'slate');                              // lead terrace roof
  // stone cornice rim along the two plain fronts (the arcades carry their own)
  slab(-16.3, 12.55, -19.15, -18.8, CORNICE_Y, TERRACE_Y - CORNICE_Y + 0.1, 'stone');
  slab(-16.3, -15.95, -18.8, 16.2, CORNICE_Y, TERRACE_Y - CORNICE_Y + 0.1, 'stone');

  // ---- arcades: columns, arch rings, keystones, brick spandrels, windows behind
  const arcade = (f: Face, wallPlane: number, outer: number, t0: number, t1: number, n: number, wallT0: number, wallT1: number) => {
    const pitch = (t1 - t0) / n, dOut = outer - wallPlane;
    for (let i = 0; i <= n; i++) {
      const t = t0 + i * pitch, [u, v] = onFace(f, t, dOut, wallPlane);
      if (f === 'se' && i === n) continue;                                                                   // the corner column belongs to the north-east run
      box(u, 0, v, 0.8, 0.2, 0.8, 'stone');                                                                  // base block
      cyl(0.31, 0.34, ARCH_SPRING - 0.55, 10, u, 0.2, v, 'stone');
      box(u, ARCH_SPRING - 0.35, v, 0.85, 0.15, 0.85, 'stone');                                              // necking and capital
      box(u, ARCH_SPRING - 0.2, v, 1.0, 0.2, 1.0, 'stone');
    }
    for (let i = 0; i < n; i++) {
      const tc = t0 + (i + 0.5) * pitch, R = pitch / 2, r = R - 0.47;
      const ring = [...arc(tc, ARCH_SPRING, R, Math.PI, 0), ...arc(tc, ARCH_SPRING, r, 0, Math.PI)];
      fext(f, wallPlane, ring, dOut - 0.37, 0.74, 'stone');
      const sp = [...arc(tc, ARCH_SPRING, R, Math.PI, 0), [tc + R, CORNICE_Y], [tc - R, CORNICE_Y]] as [number, number][];
      fext(f, wallPlane, sp, dOut - 0.28, 0.56, 'brick');
      fbox(f, wallPlane, tc, ARCH_SPRING + R - 0.2, dOut - 0.45, 0.5, 0.8, 0.9, 'stone');                    // keystone
      // wall behind: one tall window and one small arched window per bay
      if (tc > wallT0 + 1 && tc < wallT1 - 1) { win(f, wallPlane, tc, 0.9, 1.1, 2.3, 'rect'); win(f, wallPlane, tc, 3.9, 0.8, 1.5, 'arch'); }
    }
    // cornice over the arcade, projecting past the columns
    fbox(f, wallPlane, (t0 + t1) / 2, CORNICE_Y, dOut - 0.55, t1 - t0 + 2.2, 0.65, 1.3, 'stone');
  };
  /** Window on a wall: white surround ring 10 cm proud, glass 4 cm proud, mullions and transoms 7 cm proud. */
  const win = (f: Face, plane: number, t: number, y0: number, w: number, h: number, kind: 'rect' | 'arch') => {
    const outline = (m: number): [number, number][] => kind === 'rect'
      ? [[t - w / 2 - m, y0 - m], [t + w / 2 + m, y0 - m], [t + w / 2 + m, y0 + h + m], [t - w / 2 - m, y0 + h + m]]
      : [[t - w / 2 - m, y0 - m], [t + w / 2 + m, y0 - m], ...arc(t, y0 + h - w / 2, w / 2 + m, 0, Math.PI, 8)];
    fext(f, plane, outline(0.18), 0, 0.12, 'white', [outline(0).slice().reverse()]);
    fext(f, plane, outline(0), 0, 0.075, 'glass');
    fbox(f, plane, t, y0, 0.075, 0.05, h - (kind === 'arch' ? 0.05 : 0), 0.045, 'white');
    for (let k = 1; k < 3; k++) if (kind === 'rect') fbox(f, plane, t, y0 + k * h / 3 - 0.025, 0.075, w, 0.05, 0.045, 'white');
  };
  arcade('se', CORE.v1, COL_V, CORE.u0 + 0.35, COL_U, 9, CORE.u0, CORE.u1);
  arcade('ne', CORE.u1, COL_U, -(COL_V), -(CORE.v0 + 0.35), 11, -CORE.v1, -CORE.v0);
  // plain annex fronts on the other two sides: windows only
  for (let u = -14.4; u < 8; u += 3.1) win('nw', CORE.v0, -u, 1.0, 1.0, 2.2, 'rect');
  for (let v = -16.8; v < 12; v += 3.2) win('sw', CORE.u0, v, 1.0, 1.0, 2.2, 'rect');

  // ---- terrace of cupolas on the arcade roofs
  const cupola = (u: number, v: number) => {
    box(u, TERRACE_Y, v, 1.9, 0.9, 1.9, 'brick');
    box(u, TERRACE_Y + 0.9, v, 2.5, 0.35, 2.5, 'stone');
    box(u, TERRACE_Y + 1.25, v, 2.0, 0.3, 2.0, 'stone');
    const g = new T.SphereGeometry(0.88, 10, 6); g.scale(1, 0.85, 1); add(g, u, TERRACE_Y + 1.55, v, 'slate');
    cyl(0.03, 0.03, 0.55, 5, u, TERRACE_Y + 2.25, v, 'gold');
    const c = new T.TorusGeometry(0.17, 0.03, 4, 9, Math.PI * 1.5); c.rotateZ(Math.PI * 0.25); add(c, u, TERRACE_Y + 2.95, v, 'gold');
  };
  for (let i = 0; i < 10; i++) cupola(9.9, -18.45 + 3.09 * (i + 0.5));
  for (let i = 0; i < 9; i++) cupola(-15.65 + 3.067 * (i + 0.5), 13.7);

  // ---- upper hall: chamfered block, round-arched windows, dentil cornice, dome
  {
    const {u0, u1, v0, v1, chamfer: c} = HALL;
    const outline: [number, number][] = [[u0 + c, v0], [u1 - c, v0], [u1, v0 + c], [u1, v1 - c], [u1 - c, v1], [u0 + c, v1], [u0, v1 - c], [u0, v0 + c]];
    const prism = (pts: [number, number][], y0: number, h: number, colour: Colour) => {
      const s = new T.Shape(pts.map(p => new T.Vector2(p[0], -p[1])));
      const g = new T.ExtrudeGeometry(s, {depth: h, bevelEnabled: false}); g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); add(g, 0, 0, 0, colour);
    };
    prism(outline, TERRACE_Y, HALL_TOP - TERRACE_Y, 'brick');
    const grow = (m: number): [number, number][] => [[u0 + c - m * 0.41, v0 - m], [u1 - c + m * 0.41, v0 - m], [u1 + m, v0 + c - m * 0.41], [u1 + m, v1 - c + m * 0.41], [u1 - c + m * 0.41, v1 + m], [u0 + c - m * 0.41, v1 + m], [u0 - m, v1 - c + m * 0.41], [u0 - m, v0 + c - m * 0.41]];
    prism(grow(0.4), HALL_TOP, HALL_ROOF - HALL_TOP, 'stone');                                              // cornice slab
    // dentils under the cornice, windows on the four long faces
    const faces: [Face, number, number, number][] = [['se', v1, u0 + c, u1 - c], ['ne', u1, -(v1 - c), -(v0 + c)], ['nw', v0, -(u1 - c), -(u0 + c)], ['sw', u0, v0 + c, v1 - c]];
    for (const [f, plane, ta, tb] of faces) {
      for (let t = ta + 0.35; t < tb - 0.2; t += 0.62) fbox(f, plane, t, HALL_TOP - 0.3, 0, 0.3, 0.3, 0.3, 'stone');
      const n = Math.max(2, Math.round((tb - ta) / 3.3));
      for (let i = 0; i < n; i++) {
        const t = ta + (i + 0.5) * (tb - ta) / n;
        win(f, plane, t, TERRACE_Y + 3.6, 1.15, 3.2, 'arch');
        fext(f, plane, [[t - 0.8, TERRACE_Y + 2.5], [t + 0.8, TERRACE_Y + 2.5], [t + 0.8, TERRACE_Y + 2.7], [t - 0.8, TERRACE_Y + 2.7]], 0, 0.14, 'stone');   // sill
        const oc = new T.TorusGeometry(0.35, 0.05, 4, 10); oc.translate(t, TERRACE_Y + 7.3, 0.06); oc.rotateY(ROT[f]); { const [x, z] = origin(f, plane); add(oc, x, 0, z, 'stone'); }
      }
    }
    // shallow lead dome on the hall roof, gilt finial
    const dome = new T.SphereGeometry(1, 28, 12); dome.scale(8.9, 8.8, 8.9);
    add(dome, -2.3, 17.0, -1.3, 'slate');
    cyl(0.07, 0.07, 1.4, 6, -2.3, 25.7, -1.3, 'gold');
    const crescent = new T.TorusGeometry(0.4, 0.06, 5, 12, Math.PI * 1.5); crescent.rotateZ(Math.PI * 0.25); add(crescent, -2.3, 27.2, -1.3, 'gold');
  }

  // ---- minaret at the east corner: brick turret base, white ring, tapering shaft, two balconies, lead spire
  {
    const mu = 14.95, mv = 13.8;
    cyl(1.9, 1.95, 8.6, 14, mu, 0, mv, 'brick');
    cyl(2.2, 2.2, 0.6, 14, mu, 8.4, mv, 'stone');
    slab(12.5, 14.4, 12.8, 15.6, CORNICE_Y, TERRACE_Y - CORNICE_Y + 0.1, 'stone');                                 // the terrace slab reaches the turret
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; box(mu + Math.cos(a) * 1.98, 8.2, mv + Math.sin(a) * 1.98, 0.28, 0.35, 0.28, 'stone'); }
    cyl(0.98, 1.2, 15.0, 14, mu, 9.0, mv, 'brick');
    cyl(1.3, 1.3, 0.3, 14, mu, 14.0, mv, 'stone');
    cyl(1.55, 1.55, 0.3, 16, mu, 23.7, mv, 'stone');                                                          // first balcony floor
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; box(mu + Math.cos(a) * 1.45, 24.0, mv + Math.sin(a) * 1.45, 0.1, 0.85, 0.1, 'stone'); }
    cyl(1.55, 1.55, 0.12, 16, mu, 24.85, mv, 'stone');                                                        // rail
    cyl(0.82, 0.96, 4.6, 12, mu, 24.0, mv, 'brick');
    cyl(1.3, 1.3, 0.3, 16, mu, 28.3, mv, 'stone');                                                            // second balcony floor
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; box(mu + Math.cos(a) * 1.2, 28.6, mv + Math.sin(a) * 1.2, 0.1, 0.8, 0.1, 'stone'); }
    cyl(1.3, 1.3, 0.12, 16, mu, 29.4, mv, 'stone');
    cyl(0.68, 0.8, 1.2, 12, mu, 28.6, mv, 'brick');
    cyl(0.01, 0.78, 3.0, 12, mu, 29.6, mv, 'slate');                                                          // spire
    add(new T.SphereGeometry(0.12, 6, 5), mu, 32.75, mv, 'gold');
  }
}
