import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, letters, poly, ringFrame, setSink, getSink, slab, type Frame} from './nearbar-kit';
import source from './schiller-rembrandtplein-footprints.json';

/**
 * HOTEL SCHILLER, Rembrandtplein 26 (BAG pand 0363100012178854): the Art Nouveau hotel front on the Rembrandtplein whose
 * bar, Cafe Schiller, opened just after 1920 (nl.wikipedia Schiller (cafe), CC BY-SA 4.0). Massing: the 3DBAG LoD2.2 shell
 * (schiller-rembrandtplein-footprints.json, bag-shell-prepare.ts): brick to the 21.6 m eave, a 45-degree mansard to 25.6 m.
 * Every detail is read from the rectified Gemeente Amsterdam panorama TMX7316010203-001900_pano_0005_000734 (2020, CC BY 4.0,
 * 45.8 px/m across the 32.5 m front, ring edge 1, t from the east corner) and b_20241203_1333_Track15_Sphere_00354 (2024):
 *  - three stone oriels (t 5.3, 11.5, 17.6) from the string course to the eave, red balconettes on their second floor;
 *    window columns between them (t 2.4, 8.6, 14.6, 20.6) with stone lintels and sills;
 *  - the first floor: eight round-arched windows under stone voussoirs behind a terrace with a red railing and lanterns;
 *  - the stone corner tower (t 23.0-28.6) with its curved bay and the scrolled crown above the roof;
 *  - the top storey in the mansard with red balconettes under a deep bracketed eave;
 *  - the ground floor: shop glazing, navy awning fascias and the cream entrance canopy lettered NH SCHILLER.
 */
export function buildSchillerRembrandtplein(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as {facadeRing: number[][]; surfaces: Surface[]; nativeRing: number[][]};
  const ring = src.facadeRing;
  addShell(b, src as never, {wall: 'brick', roof: 'slate'});
  const sink0 = getSink();
  setSink(0.05);
  const {f} = ringFrame(ring, 1);
  const P = (fr: Frame, t: number, out: number): [number, number] => [fr.origin[0] + fr.tangent[0] * t + fr.n[0] * out, fr.origin[1] + fr.tangent[1] * t + fr.n[1] * out];
  /** Vertical prism over a plan polygon given in frame (t, out) pairs, from y0 to y1. */
  const prism = (fr: Frame, pts: [number, number][], y0: number, y1: number, colour: string) => {
    const s = new T.Shape(pts.map(([t, o]) => { const p = P(fr, t, o); return new T.Vector2(p[0], -p[1]); }));
    const g = new T.ExtrudeGeometry(s, {depth: y1 - y0, bevelEnabled: false}).rotateX(-Math.PI / 2).translate(0, y0, 0);
    b.add(g, colour as never);
  };
  /** Frame on the segment p0-p1 (native x,z) with n pointing away from `centre`. */
  const segFrame = (p0: [number, number], p1: [number, number], centre: [number, number]): Frame => {
    const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), tg: [number, number] = [(p1[0] - p0[0]) / L, (p1[1] - p0[1]) / L];
    let n: [number, number] = [-tg[1], tg[0]];
    const m = [(p0[0] + p1[0]) / 2 - centre[0], (p0[1] + p1[1]) / 2 - centre[1]];
    if (n[0] * m[0] + n[1] * m[1] < 0) n = [tg[1], -tg[0]];
    // local +x of put() is (n.z, -n.x): start the frame at whichever end makes t run along it
    const lx: [number, number] = [n[1], -n[0]];
    const o = lx[0] * tg[0] + lx[1] * tg[1] > 0 ? p0 : p1;
    return {origin: o, tangent: lx, n};
  };
  // layers 4 cm apart: surrounds 0.05, frames 0.09, glass 0.13, glazing bars 0.17
  /** Square-headed window with a white frame, transom and mullion, stone lintel and sill strips. */
  const win = (fr: Frame, t: number, y0: number, y1: number, w: number, out = 0, surround = true) => {
    if (surround) {
      slab(b, fr, t, y1 + 0.05, w + 0.4, 0.25, 0.05, 'sandstone', out);
      slab(b, fr, t, y0 - 0.17, w + 0.3, 0.14, 0.1, 'sandstone', out);
    }
    slab(b, fr, t, y0 - 0.03, w + 0.1, y1 - y0 + 0.06, 0.09, 'white', out);
    slab(b, fr, t, y0, w - 0.08, y1 - y0 - 0.04, 0.13, 'glass', out);
    slab(b, fr, t, y0 + (y1 - y0) * 0.72, w - 0.08, 0.06, 0.17, 'white', out);
    if (w > 0.8) slab(b, fr, t, y0, 0.06, (y1 - y0) * 0.72, 0.17, 'white', out);
  };
  /** Red wrought-iron balconette on a stone floor: front rail, bars every 0.12 m. */
  const rail = (fr: Frame, t: number, y: number, w: number, h: number, out: number, deep: number) => {
    slab(b, fr, t, y - 0.08, w + 0.1, 0.08, deep + 0.06, 'stone', out);
    slab(b, fr, t, y + h - 0.05, w, 0.05, 0.05, 'red', out + deep - 0.05);
    slab(b, fr, t, y, w, 0.04, 0.05, 'red', out + deep - 0.05);
    const n = Math.max(2, Math.round(w / 0.12));
    for (let k = 0; k <= n; k++) slab(b, fr, t - w / 2 + (w * k) / n, y, 0.025, h, 0.025, 'red', out + deep - 0.04);
    for (const s of [-1, 1]) slab(b, fr, t + s * (w / 2 - 0.02), y, 0.04, h, deep, 'red', out);
  };

  const COLS = [2.4, 8.6, 14.6, 20.6], ORIELS = [5.3, 11.5, 17.6], ARCHES = [1.1, 4.1, 7.1, 10.1, 13.1, 16.1, 19.1, 22.1];
  const FLOORS: [number, number][] = [[11.4, 14.2], [15.2, 17.8], [18.9, 21.1]];
  const TW0 = 23.0, TW1 = 28.6; // stone corner tower

  // ---------- ground floor: plinth, shop glazing, awning fascias, entrance canopy ----------
  slab(b, f, 16.25, 0, 32.3, 0.35, 0.12, 'stone');
  for (let t0 = 0.2; t0 < 32.2; t0 += 2.35) {
    const t1 = Math.min(t0 + 2.35, 32.3);
    slab(b, f, (t0 + t1) / 2, 0.4, t1 - t0 - 0.14, 3.6, 0.13, 'glass');
    slab(b, f, t1, 0.35, 0.12, 3.8, 0.17, 'frame');
  }
  slab(b, f, 16.25, 4.0, 32.2, 0.14, 0.17, 'frame');
  slab(b, f, 3.7, 4.3, 7.2, 1.1, 0.9, 'blue');
  slab(b, f, 25.65, 4.3, 13.5, 1.1, 0.9, 'blue');
  for (const t of [7.8, 18.4]) slab(b, f, t, 0.35, 0.8, 3.95, 0.4, 'concrete');
  slab(b, f, 13.1, 4.3, 11.4, 2.4, 1.7, 'concrete');
  {
    const R = (5.7 * 5.7 + 0.7 * 0.7) / 1.4, pts: [number, number][] = [[-5.7, 0], [5.7, 0]];
    for (let k = 0; k <= 12; k++) { const x = 5.7 - (11.4 * k) / 12; pts.push([x, 0.1 + Math.sqrt(R * R - x * x) - (R - 0.7)]); }
    poly(b, f, 13.1, 6.6, pts, 0.3, 'concrete', 1.45);
  }
  letters(b, f, 'NH', 10.13, 5.1, 1.7, 0.11, 0.05, 'ochre', 0.085);
  letters(b, f, 'SCHILLER', 14.09, 5.1, 1.7, 0.11, 0.05, 'ochre', 0.085);

  // ---------- first floor: terrace, red railing, lanterns, round-arched windows ----------
  slab(b, f, 12.4, 6.75, 24.6, 0.25, 1.4, 'stone');
  {
    const t0 = 0.15, t1 = 24.65, w = t1 - t0, y = 7.0, h = 1.05, o = 1.28;
    slab(b, f, (t0 + t1) / 2, y + h - 0.07, w, 0.07, 0.06, 'red', o);
    slab(b, f, (t0 + t1) / 2, y + 0.06, w, 0.05, 0.06, 'red', o);
    const n = Math.round(w / 0.15);
    for (let k = 0; k <= n; k++) slab(b, f, t0 + (w * k) / n, y, 0.025, h, 0.025, 'red', o + 0.015);
    for (let t = t0 + 0.05; t < t1; t += 3.05) slab(b, f, t, y, 0.09, h + 0.05, 0.09, 'red', o - 0.01);
  }
  for (const t of ORIELS) {
    slab(b, f, t, 7.0, 0.1, 2.45, 0.1, 'bronze', 0.85);
    slab(b, f, t, 9.4, 0.62, 0.06, 0.1, 'bronze', 0.85);
    for (const s of [-1, 1]) slab(b, f, t + s * 0.26, 9.0, 0.2, 0.4, 0.2, 'bronze', 0.8);
  }
  for (const t of ARCHES) {
    archBand(b, f, t, 7.35, 2.3, 2.75, 0.3, 0.05, 'sandstone');
    archSlab(b, f, t, 7.35, 1.8, 2.45, 0.09, 'white');
    archSlab(b, f, t, 7.4, 1.66, 2.36, 0.13, 'glass');
    slab(b, f, t, 8.55, 1.66, 0.06, 0.17, 'white');
    slab(b, f, t, 7.4, 0.06, 1.15, 0.17, 'white');
  }
  slab(b, f, 11.55, 10.35, 23.0, 0.22, 0.08, 'sandstone');

  // ---------- upper floors: window columns, oriels, main cornice ----------
  for (const t of COLS) for (const [y0, y1] of FLOORS) win(f, t, y0, y1, 1.45);
  for (const t of ORIELS) {
    const pts: [number, number][] = [[t - 1.25, -0.05], [t - 0.85, 0.6], [t + 0.85, 0.6], [t + 1.25, -0.05]];
    prism(f, pts, 10.3, 21.5, 'sandstone');
    prism(f, [[t - 1.15, -0.05], [t - 0.75, 0.45], [t + 0.75, 0.45], [t + 1.15, -0.05]], 9.75, 10.3, 'sandstone'); // corbel
    const front = segFrame(P(f, t - 0.85, 0.6), P(f, t + 0.85, 0.6), P(f, t, -1));
    const cen = P(f, t, -1);
    const left = segFrame(P(f, t - 1.25, -0.05), P(f, t - 0.85, 0.6), cen), right = segFrame(P(f, t + 0.85, 0.6), P(f, t + 1.25, -0.05), cen);
    const sideLen = Math.hypot(0.4, 0.65);
    for (const [y0, y1] of FLOORS) {
      win(front, 0.85, y0, y1, 1.15, 0, false);
      win(left, sideLen / 2, y0 + 0.1, y1 - 0.1, 0.42, 0, false);
      win(right, sideLen / 2, y0 + 0.1, y1 - 0.1, 0.42, 0, false);
      slab(b, front, 0.85, y1 + 0.2, 1.7, 0.18, 0.06, 'stone');
    }
    rail(front, 0.85, 11.1, 1.3, 0.85, 0, 0.32);
  }
  slab(b, f, 11.55, 21.45, 23.0, 0.3, 0.8, 'stone', -0.05);
  for (let t = 0.6; t < 22.9; t += 1.0) slab(b, f, t, 21.0, 0.16, 0.45, 0.45, 'stone');

  // ---------- top storey in the mansard, flush with the front (the 3DBAG slope starts at the eave): brick face, windows with balconettes, deep bracketed eave ----------
  slab(b, f, 11.6, 21.7, 23.0, 2.75, 0.3, 'brick', -0.3);
  const fT = f;
  for (let k = 0; k < 7; k++) {
    const t = 1.4 + 3.05 * k;
    win(fT, t, 22.35, 24.0, 1.0, 0, false);
    rail(fT, t, 21.81, 1.15, 0.7, 0, 0.42);
  }
  slab(b, f, 11.6, 24.45, 23.2, 0.3, 1.3, 'stone', -0.35);
  for (let t = 0.4; t < 22.9; t += 0.9) slab(b, f, t, 24.0, 0.14, 0.45, 0.85, 'stone', -0.02);

  // ---------- stone corner tower: body, curved bay, windows, crown ----------
  prism(f, [[TW0, -2.0], [TW0, 0.35], [TW1, 0.35], [TW1, -2.0]], 6.95, 25.5, 'sandstone');
  slab(b, f, (TW0 + TW1) / 2, 25.4, TW1 - TW0 + 0.3, 0.3, 2.55, 'stone', -2.1);
  {
    const pts: [number, number][] = [[-2.7, 0], [2.7, 0], [2.7, 0.7], [2.2, 0.85], [1.9, 1.3], [1.4, 1.5], [1.1, 1.95], [0.6, 2.25], [0, 2.4], [-0.6, 2.25], [-1.1, 1.95], [-1.4, 1.5], [-1.9, 1.3], [-2.2, 0.85], [-2.7, 0.7]];
    poly(b, f, (TW0 + TW1) / 2, 25.6, pts, 0.45, 'sandstone', -0.1);
    poly(b, f, (TW0 + TW1) / 2, 26.05, [[-0.55, 0], [0.55, 0], [0.55, 0.9], [0, 1.45], [-0.55, 0.9]], 0.09, 'stone', 0.35);
  }
  const {f: fTw} = ringFrame(ring, 1, 0.35);
  for (const [y0, y1] of [[7.6, 10.2], [11.4, 14.2], [15.2, 17.8], [18.9, 21.1], [22.3, 24.6]] as [number, number][]) win(fTw, 26.6, y0, y1, 1.35);
  for (const y of [10.5, 14.6, 18.3, 21.55]) slab(b, fTw, (TW0 + TW1) / 2, y, TW1 - TW0 - 0.1, 0.2, 0.08, 'stone');
  {
    const c = 24.0, pts: [number, number][] = [[c - 1.0, 0.3], [c - 0.8, 0.75], [c - 0.3, 1.0], [c + 0.3, 1.0], [c + 0.8, 0.75], [c + 1.0, 0.3]];
    prism(f, pts, 10.6, 21.4, 'sandstone');
    prism(f, [[c - 0.9, 0.3], [c - 0.7, 0.65], [c + 0.7, 0.65], [c + 0.9, 0.3]], 10.0, 10.6, 'sandstone');
    slab(b, f, c, 21.4, 2.3, 0.22, 0.85, 'stone', 0.3);
    const front = segFrame(P(f, c - 0.3, 1.0), P(f, c + 0.3, 1.0), P(f, c, -1));
    for (const [y0, y1] of FLOORS) win(front, 0.3, y0, y1, 0.5, 0, false);
  }

  // ---------- the plainer west bay of the pand (t 29.0-32.5, 3DBAG eave 20.3) ----------
  for (const t of [30.1, 31.7]) for (const [y0, y1] of [[7.6, 9.8], [11.4, 13.6], [15.0, 17.2], [18.4, 19.9]] as [number, number][]) win(f, t, y0, y1, 0.85);
  slab(b, f, 30.75, 20.05, 3.4, 0.22, 0.3, 'stone', -0.05);
  setSink(sink0);
}
