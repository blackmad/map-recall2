import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {archSlab, put, setSink, slab} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import {facePoly} from './worship-kit';
import source from './waag-footprints.json';

/**
 * De Waag (Sint-Antoniespoort, 1488), Nieuwmarkt. One BAG pand: a steep-roofed central block 22.8 m long (bearing 154) with a
 * round corner turret at each end of both short sides, and a big round tower in the middle of each long side. Massing and the
 * roofs are the 3DBAG LoD2.2 shell; the turret cones (the shell lacks the south-west one and trims the west one) are rebuilt.
 * Local frame (u, v) from the centre c0: u along bearing 154 (towards the Nieuwmarkt front), v along bearing 64.
 * Detail is measured by eye from the 2020-2025 municipal panoramas:
 *  - SSE front (u = 11.26): between the two front turrets, a zinc canopy over the terrace (in the shell), three openings at street
 *    level (a glazed entrance flanked by two red leaf doors), three four-light mullioned windows with red shutters above, a pale cornice;
 *  - NNW rear (u = -11.28): the stone gate arch (3 m span) with red leaf doors, a big eight-light window with shutters above it, a
 *    window each side, the two rear turrets on the corners;
 *  - ENE and WSW long sides: the big tower in the middle (stone bands, windows with shutters, a cream cornice and a slate cone), a stone
 *    gate arch on the north-west side of it, windows with shutters;
 *  - turrets: stone bands, a corbelled arcade of round arches under a cream cornice, narrow slit windows, slate cones.
 */
const C0: [number, number] = [-2.565, -4.815];
const rad = (d: number) => d * Math.PI / 180;
const EU: [number, number] = [Math.sin(rad(154)), -Math.cos(rad(154))];
const EV: [number, number] = [Math.sin(rad(64)), -Math.cos(rad(64))];
const world = (u: number, v: number): [number, number] => [C0[0] + EU[0] * u + EV[0] * v, C0[1] + EU[1] * u + EV[1] * v];
const frame = (n: [number, number], u: number, v: number): Frame => ({origin: world(u, v), tangent: [n[1], -n[0]], n});
const neg = (a: [number, number]): [number, number] => [-a[0], -a[1]];

// The four corner turrets (centre u, v, radius) and the two big towers.
const TURRETS: {u: number; v: number; r: number; top: number; apex: number; name: string}[] = [
  {name: 'S', u: 11.39, v: -5.92, r: 1.8, top: 10.7, apex: 16.9},
  {name: 'E', u: 11.37, v: 6.2, r: 1.74, top: 10.7, apex: 16.9},
  {name: 'N', u: -11.43, v: 6.47, r: 1.92, top: 12.9, apex: 17.3},
  {name: 'W', u: -11.33, v: -6.75, r: 1.87, top: 12.9, apex: 17.3},
];
const BIG = [{name: 'A', u: 1.64, v: -7.55, r: 3.57, top: 11.6}, {name: 'B', u: 1.52, v: 7.77, r: 3.71, top: 11.6}];

export function buildWaag(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  setSink(0.2);
  addShell(b, source as never, {wall: 'brick', roof: 'slate'});
  b.mark?.('shell');

  const quad = (f: Frame, t: number, y: number, w: number, h: number, out: number, colour: string) =>
    put(b, f, new T.PlaneGeometry(w, h).translate(0, h / 2, 0), t, y, out, colour);
  const archQuad = (f: Frame, t: number, y: number, w: number, h: number, out: number, colour: string) => {
    const s = new T.Shape(), r = w / 2;
    s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r); s.absarc(0, h - r, r, 0, Math.PI, false); s.lineTo(-r, 0);
    put(b, f, new T.ShapeGeometry(s, 6), t, y, out, colour);
  };
  /** Mullioned window: cream frame, glass, a centre post and a transom, red shutters either side, stone sill. */
  const win = (f: Frame, t: number, y: number, w: number, h: number, shutters: boolean | -1 | 1 = true, lights = 2) => {
    slab(b, f, t, y - 0.1, w + 0.3, h + 0.2, 0.06, 'frame');
    quad(f, t, y, w, h, 0.09, 'glass');
    for (let k = 1; k < lights; k++) quad(f, t - w / 2 + w * k / lights, y, 0.06, h, 0.12, 'frame');
    quad(f, t, y + h * 0.5 - 0.03, w, 0.06, 0.12, 'frame');
    slab(b, f, t, y - 0.2, w + 0.5, 0.1, 0.16, 'stone');
    if (shutters) for (const s of shutters === true ? [-1, 1] : [shutters]) slab(b, f, t + s * (w / 2 + 0.3), y - 0.05, 0.42, h + 0.1, 0.07, 'red', 0.02);
  };
  /** Round-headed stone gate: stone surround, dark opening and two red leaf doors folded back against the wall. */
  const gate = (f: Frame, t: number, w: number, h: number, leaves = true) => {
    archQuad(f, t, 0, w + 1.0, h + 0.5, 0.06, 'sandstone');
    archQuad(f, t, 0, w, h, 0.1, 'dark');
    quad(f, t, 0, w - 0.5, h * 0.55, 0.13, 'glass');
    if (leaves) for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 + 0.85), 0.2, 1.3, h - 0.9, 0.07, 'red', 0.04);
  };
  const band = (cx: number, cz: number, r: number, y: number, h: number, colour: string, over = 0.12) =>
    b.add(new T.CylinderGeometry(r + over, r + over, h, 28).translate(cx, y + h / 2, cz), colour as never);

  // ---- turrets ----
  for (const t of TURRETS) {
    const [cx, cz] = world(t.u, t.v);
    for (const y of [2.2, 4.8, 7.4]) band(cx, cz, t.r, y, 0.3, 'sandstone');
    band(cx, cz, t.r, t.top - 1.7, 0.35, 'sandstone', 0.2);
    // corbelled arcade of round arches under the cornice
    const n = 10;
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2, nx = Math.sin(a), nz = Math.cos(a);
      const f: Frame = {origin: [cx + nx * (t.r + 0.01), cz + nz * (t.r + 0.01)], tangent: [nz, -nx], n: [nx, nz]};
      archQuad(f, 0, t.top - 1.35, 0.5, 0.8, 0.02, 'greyBrick');
    }
    // cream cornice and the slate cone with a gilt finial
    b.add(new T.CylinderGeometry(t.r + 0.5, t.r + 0.5, 0.45, 28).translate(cx, t.top - 0.2, cz), 'stone' as never);
    b.add(new T.ConeGeometry(t.r + 0.45, t.apex - t.top - 0.1, 28).translate(cx, t.top + 0.25 + (t.apex - t.top - 0.1) / 2, cz), 'slate' as never);
    b.add(new T.SphereGeometry(0.16, 8, 6).translate(cx, t.apex + 0.1, cz), 'gold' as never);
    // slit windows
    for (const a of t.name === 'S' || t.name === 'E' ? [rad(154)] : [rad(334)]) {
      const nx = Math.sin(a), nz = -Math.cos(a), f: Frame = {origin: [cx + nx * t.r, cz + nz * t.r], tangent: [nz, -nx], n: [nx, nz]};
      archSlab(b, f, 0, 6.2, 0.45, 1.1, 0.05, 'dark');
    }
  }

  // ---- big towers: bands, a cream cornice below the cone, windows with shutters on the outward half ----
  for (const t of BIG) {
    const [cx, cz] = world(t.u, t.v), s = Math.sign(t.v);
    setSink(0.5);   // flat frames on a round wall: the chord edges stand off the cylinder, so the backs go deeper
    for (const y of [1.9, 4.3, 6.7, 9.1]) band(cx, cz, t.r, y, 0.3, 'sandstone');
    band(cx, cz, t.r, t.top - 0.3, 0.5, 'stone', 0.3);
    for (const [da, y] of [[-0.5, 4.8], [0.5, 4.8], [-0.55, 7.4], [0.55, 7.4]] as [number, number][]) {
      const a = rad(s > 0 ? 64 : 244) + da, nx = Math.sin(a), nz = -Math.cos(a);
      const f: Frame = {origin: [cx + nx * t.r, cz + nz * t.r], tangent: [nz, -nx], n: [nx, nz]};
      win(f, 0, y, 0.8, 1.3, true, 2);
    }
    setSink(0.2);
  }

  // ---- SSE front: u = 11.26, t = v ----
  {
    const f = frame(EU, 11.26, 0);
    for (const t of [-2.7, 0, 2.7]) win(f, t + 0.1, 5.9, 1.55, 2.1, true, 4);
    for (const t of [-2.3, 2.3]) slab(b, f, t + 0.1, 0.0, 1.35, 2.6, 0.08, 'red', 0.03);
    archSlab(b, f, 0.1, 0.0, 1.8, 2.7, 0.09, 'dark', 0.03);
    quad(f, 0.1, 0.1, 1.4, 2.0, 0.14, 'glass');
    slab(b, f, 0.1, 9.45, 8.9, 0.5, 0.45, 'stone');
    // zinc canopy of the terrace: a sloping plane from the wall (5.1 m) out to a lip 2.7 m in front (3.4 m), with two hip triangles
    const P = (t: number, y: number, out: number) => [f.origin[0] + f.tangent[0] * t + f.n[0] * out, y, f.origin[1] + f.tangent[1] * t + f.n[1] * out];
    const t0 = -4.4, t1 = 4.5;
    facePoly(b, [P(t0, 5.1, 0), P(t1, 5.1, 0), P(t1 + 0.6, 3.4, 2.7), P(t0 - 0.6, 3.4, 2.7)], 'concrete', [f.n[0], 1, f.n[1]], 'roof');
    facePoly(b, [P(t0, 5.1, 0), P(t0 - 0.6, 3.4, 2.7), P(t0, 3.4, 0)], 'concrete', [-f.tangent[0], 0, -f.tangent[1]]);
    facePoly(b, [P(t1, 5.1, 0), P(t1, 3.4, 0), P(t1 + 0.6, 3.4, 2.7)], 'concrete', [f.tangent[0], 0, f.tangent[1]]);
    slab(b, f, 0, 3.15, 10.2, 0.25, 0.2, 'sandstone', 2.55);
  }
  // ---- NNW rear: u = -11.28, t = -v ----
  {
    const f = frame(neg(EU), -11.28, 0);
    gate(f, 0, 1.9, 3.5);
    win(f, 0, 5.9, 2.2, 1.6, true, 4);
    for (const t of [-3.9, 3.9]) { win(f, t, 1.2, 1.0, 1.5, true, 2); win(f, t, 3.8, 1.0, 1.5, true, 2); win(f, t, 6.4, 1.0, 1.6, true, 2); }
    slab(b, f, 0, 12.3, 10.2, 0.5, 0.45, 'stone');
  }
  // ---- ENE long side (v = +): north segment u -9.9..-3.7 at v = 7.33, south segment u 4.7..9.6 at v = 6.67; t = -u ----
  {
    const fn = frame(EV, 0, 7.33), fs = frame(EV, 0, 6.67);
    gate(fn, 6.7, 2.0, 3.6, true);
    win(fn, 6.0, 5.6, 1.0, 1.7, -1, 2); win(fn, 7.4, 5.6, 1.0, 1.7, 1, 2);
    win(fs, -7.1, 2.6, 1.0, 1.7, true, 2);
    win(fs, -7.1, 6.3, 1.3, 1.9, true, 2);
    slab(b, fn, 6.8, 10.8, 6.2, 0.5, 0.4, 'stone');
    slab(b, fs, -7.1, 9.9, 4.9, 0.5, 0.4, 'stone');
  }
  // ---- WSW long side (v = -): north segment u -9.9..-2.8 at v = -6.77, south segment u 4.7..9.4 at v = -5.75; t = u ----
  {
    const fn = frame(neg(EV), 0, -6.77), fs = frame(neg(EV), 0, -5.75);
    gate(fn, -6.4, 2.0, 3.6, true);
    win(fn, -7.1, 5.6, 1.0, 1.7, -1, 2); win(fn, -5.7, 5.6, 1.0, 1.7, 1, 2);
    win(fn, -3.5, 6.0, 1.0, 1.8, true, 2);
    win(fs, 7.0, 2.6, 1.0, 1.7, true, 2);
    win(fs, 7.0, 6.3, 1.3, 1.9, true, 2);
    slab(b, fn, -6.4, 11.0, 7.0, 0.5, 0.4, 'stone');
    slab(b, fs, 7.0, 9.8, 4.7, 0.5, 0.4, 'stone');
  }
  setSink(0);
  void facePoly;
}
