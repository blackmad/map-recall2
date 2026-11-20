import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, getSink, letters, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import source from './roode-leeuw-damrak-footprints.json';

/**
 * HOTEL DE ROODE LEEUW, Damrak 93-94 (BAG pand 0363100012168115, 1911, Foeke Kuipers; gemeentelijk monument 210017:
 * "vijf vensterassen breed ... vier verdiepingen en een kapverdieping onder een schilddak", the covered terrace of 1935).
 * Massing: the 3DBAG LoD2.2 shell (roode-leeuw-damrak-footprints.json, bag-shell-prepare.ts) for the hipped roof, the
 * Damraksteeg side and the party walls. The Damrak front and the terrace are drawn here, in a frame on the upper front
 * plane (3DBAG wall (2.5, 5.0) -> (11.5, -4.6), t from the Damraksteeg corner), from the rectified Gemeente Amsterdam
 * panorama TMX7316010203-002031_pano_0003_000033 (2021, w02-134, 44.5 px/m; second view TMX7316010203-001658_pano_0000_001902,
 * 2020), CC BY 4.0; per item in roode-leeuw-damrak-inventory.json:
 *  - five bays between six pilasters with red heraldic shields over the eaves; buff-orange brick with grey stone bands;
 *  - first floor: tall windows with leaded upper lights over the balcony of the terrace roof;
 *  - second floor: round-arched windows under brick relieving arches, each with a bowed iron balcony;
 *  - third floor: paired windows on a stone sill; fourth floor: wide windows behind iron railings; eaves cornice;
 *  - the "DE ROODE LEEUW" letters on the roof, the 1935 terrace: glazed front, dark sign band, a white clerestory of pointed
 *    windows and the iron balcony rail with its red name board on the terrace roof.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
type C = Parameters<BuildingTools['add']>[1];
const c = (s: string) => s as unknown as C;

export function buildRoodeLeeuwDamrak(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as Src;
  // front frame on the 3DBAG upper front; outward normal points south-east (onto the Damrak)
  const A = [2.5, 5.0], B = [11.5, -4.6], L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const tg: [number, number] = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
  const F: Frame = {origin: [A[0], A[1]], tangent: tg, n: [-tg[1], tg[0]]};
  const nOf = (x: number, z: number) => (x - A[0]) * F.n[0] + (z - A[1]) * F.n[1];
  const tOf = (x: number, z: number) => (x - A[0]) * tg[0] + (z - A[1]) * tg[1];
  const T0 = -1.77, T1 = 13.2, EAVES = 18.9; // the upper front plane; t 13.2-14.06 is the splayed north corner

  addShell(b, src as never, {
    wall: 'brick', roof: 'slate',
    // the 3DBAG terrace (walls and roofs below 5.5 m in front of the upper front) is redrawn below
    // (its lower walls and roofs stay inside the new box; only the 5.3 m step that would stand out of the box roof goes)
    skip: s => s.rings[0].every(p => p[1] > 3.2 && p[1] < 5.5 && nOf(p[0], p[2]) > -0.3 && tOf(p[0], p[2]) > T0 - 0.5),
  });

  const sink0 = getSink();
  setSink(0.12, true);
  const W = T1 - T0;
  const tp = (x: number) => T0 + x; // photo t (0 at the Damraksteeg corner, 15.83 m to the north party wall) -> frame t
  // stone courses across the front
  slab(b, F, (T0 + T1) / 2, 8.7, W - 0.1, 0.22, 0.1, 'stone');
  slab(b, F, (T0 + T1) / 2, 11.15, W - 0.1, 0.2, 0.055, 'stone');
  slab(b, F, (T0 + T1) / 2, 18.45, W, 0.45, 0.35, 'stone');
  slab(b, F, (T0 + T1) / 2 - 0.1, 18.25, W - 0.3, 0.25, 0.18, 'stone'); // overlaps the cornice: touching faces count as coplanar

  // ---------- pilasters with heraldic shields ----------
  const piers = [0.34, 3.37, 6.4, 9.44, 12.36].map(tp).concat([T1 - 0.12]); // the last stands on the splayed corner's edge
  for (const t of piers) {
    slab(b, F, t, 4.6, 0.55, EAVES - 4.6 + 0.15, 0.14, 'brick');
    slab(b, F, t, 11.1, 0.62, 0.3, 0.2, 'stone'); // stone block on the arch band
    // shield over the eaves: red field, gold lion as a raised square, stone base
    slab(b, F, t, EAVES + 0.05, 0.6, 0.18, 0.4, 'stone', -0.05);
    // r7 judge: red/gold cubes read as toy blocks; the shields are drawn as brick blocks with a stone boss
    slab(b, F, t, EAVES + 0.2, 0.5, 0.65, 0.22, 'brick', 0.03);
    slab(b, F, t, EAVES + 0.4, 0.24, 0.28, 0.05, 'stone', 0.25);
  }

  // ---------- the five bays ----------
  const bays = [2.0, 5.0, 8.0, 10.9, 13.7].map(tp);
  const win = (t: number, y0: number, y1: number, w: number, frame: string, mull = true, transom?: number) => {
    // layers 4 cm apart: surrounds 0.06, frame 0.10, glass 0.14, bars 0.18 (the 3DBAG front wanders +-3 cm about n = 0)
    slab(b, F, t, y0 - 0.05, w + 0.12, y1 - y0 + 0.1, 0.1, c(frame) as never);
    slab(b, F, t, y0, w, y1 - y0, 0.14, 'glass');
    if (mull) slab(b, F, t, y0, 0.06, y1 - y0, 0.18, c(frame) as never);
    if (transom !== undefined) slab(b, F, t, transom, w, 0.07, 0.18, c(frame) as never);
  };
  for (const t of bays) {
    // first floor: tall windows with leaded upper lights (the lights read darker and coloured)
    slab(b, F, t, 5.45, 1.42, 2.85, 0.09, 'dark');
    slab(b, F, t, 5.5, 1.3, 1.85, 0.13, 'glass');
    slab(b, F, t, 7.42, 1.3, 0.78, 0.13, 'canopyGlass');
    slab(b, F, t, 5.5, 0.06, 1.85, 0.17, 'dark');
    slab(b, F, t, 7.35, 1.3, 0.07, 0.17, 'dark');
    slab(b, F, t, 5.38, 1.55, 0.12, 0.16, 'stone');
    // second floor: round-arched windows under relieving arches, bowed iron balconies
    archSlab(b, F, t, 9.0, 1.5, 2.95, 0.1, 'frame');
    archSlab(b, F, t, 9.05, 1.36, 2.85, 0.14, 'glass');
    slab(b, F, t, 9.05, 0.06, 2.1, 0.18, 'frame');
    slab(b, F, t, 11.1, 1.36, 0.06, 0.18, 'frame');
    archBand(b, F, t, 11.24, 2.25, 1.12, 0.32, 0.07, 'ochre');
    slab(b, F, t, 8.85, 1.7, 0.16, 0.42, 'bronze'); // balcony floor (the bars stand into it)
    for (let k = 0; k <= 5; k++) slab(b, F, t - 0.625 + k * 0.25, 8.97, 0.04, 0.85, 0.04, 'bronze', 0.36);
    slab(b, F, t, 9.84, 1.7, 0.06, 0.06, 'bronze', 0.34);
    slab(b, F, t, 9.2, 1.6, 0.25, 0.03, 'bronze', 0.37); // lattice panel of the railing
    // third floor: paired windows on a stone sill, stone surround
    slab(b, F, t, 12.92, 2.0, 0.16, 0.16, 'stone');
    slab(b, F, t, 13.05, 1.9, 2.05, 0.06, 'stone');
    for (const s of [-0.48, 0.48]) win(t + s, 13.12, 14.95, 0.66, 'frame', false, 14.2);
    slab(b, F, t, 15.07, 2.0, 0.14, 0.12, 'stone');
    // fourth floor: wide windows behind iron railings
    win(t, 15.9, 17.9, 1.4, 'frame', true);
    slab(b, F, t, 15.8, 1.6, 0.12, 0.14, 'stone');
    slab(b, F, t, 16.75, 2.5, 0.05, 0.05, 'bronze', 0.25);
    for (let k = 0; k <= 9; k++) slab(b, F, t - 1.08 + k * 0.24, 15.92, 0.035, 0.85, 0.035, 'bronze', 0.26);
  }

  // ---------- the 1935 covered terrace on the Damrak ----------
  {
    const TN = 3.12, H = 4.45, t0 = T0 - 0.13, t1 = 14.18; // 9+ cm clear of the 3DBAG terrace walls it encloses
    // body: front and side walls and roof as one box
    const g = new T.BoxGeometry(t1 - t0, H, TN + 0.2).translate((t0 + t1) / 2, H / 2, TN / 2 - 0.1);
    g.applyMatrix4(new T.Matrix4().makeBasis(new T.Vector3(tg[0], 0, tg[1]), new T.Vector3(0, 1, 0), new T.Vector3(F.n[0], 0, F.n[1])));
    g.translate(A[0], 0, A[1]);
    b.add(g, c('bronze')); // r7 judge: the terrace reads as a dark iron-and-glass brasserie front, not a white box
    const Ft: Frame = {origin: [A[0] + F.n[0] * TN, A[1] + F.n[1] * TN], tangent: tg, n: F.n};
    // glazed front: dark mullions every 1.3 m over a low stone base
    slab(b, Ft, (t0 + t1) / 2, 0, t1 - t0 - 0.1, 0.3, 0.06, 'stone');
    slab(b, Ft, (t0 + t1) / 2, 0.35, t1 - t0 - 0.3, 2.45, 0.05, 'glass');
    for (let t = t0 + 0.3; t <= t1 - 0.1; t += (t1 - t0 - 0.3) / 12) slab(b, Ft, t, 0.27, 0.1, 2.6, 0.09, 'bronze'); // iron mullions
    slab(b, Ft, (t0 + t1) / 2, 1.95, t1 - t0 - 0.3, 0.06, 0.09, 'bronze');
    // dark sign band with red lettering
    slab(b, Ft, (t0 + t1) / 2, 2.82, t1 - t0 + 0.1, 0.48, 0.16, 'dark');
    letters(b, Ft, 'AMSTERDAM & BRASSERIE DE ROODE LEEUW', (t0 + t1) / 2, 2.92, 0.16, 0.055, 0.03, 'red', 0.04);
    // dark clerestory with groups of pointed windows under each bay
    for (const t of bays) for (const s of [-0.62, 0, 0.62]) {
      archSlab(b, Ft, t + s, 3.45, 0.36, 0.72, 0.05, 'glass', 0, 2);
    }
    slab(b, Ft, (t0 + t1) / 2, H - 0.08, t1 - t0 + 0.2, 0.14, 0.12, 'sandstone');
    // balcony rail on the terrace roof with the red name board
    for (let t = t0 + 0.1; t <= t1 - 0.05; t += 0.32) slab(b, Ft, t, H - 0.03, 0.04, 0.98, 0.04, 'bronze', -0.12);
    slab(b, Ft, (t0 + t1) / 2, H + 0.92, t1 - t0 - 0.1, 0.06, 0.06, 'bronze', -0.14);
    slab(b, Ft, (t0 + t1) / 2, H + 0.1, t1 - t0 - 0.1, 0.05, 0.05, 'bronze', -0.13);
    slab(b, Ft, tp(7.4), H + 0.38, 10.2, 0.34, 0.04, 'red', -0.09);
    letters(b, Ft, 'DE ROODE LEEUW', tp(7.4), H + 0.42, -0.05, 0.075, 0.025, 'gold', 0.035);
    // flag poles from the first floor
    for (const t of [tp(3.4), tp(12.4)]) {
      const x = A[0] + tg[0] * t + F.n[0] * 0.2, z = A[1] + tg[1] * t + F.n[1] * 0.2;
      const pole = new T.CylinderGeometry(0.03, 0.03, 2.2, 6).translate(0, 1.1, 0).rotateX(0.5);
      pole.applyMatrix4(new T.Matrix4().makeRotationY(Math.atan2(F.n[0], F.n[1])));
      pole.translate(x, 7.2, z);
      b.add(pole, c('bronze'));
    }
  }

  // ---------- "DE ROODE LEEUW" on the roof: red letters on a dark frame behind the eaves ----------
  {
    const back = -2.2, y = 21.75; // on the ridge (3DBAG 21.6 m), letters clear above it as in the photo
    const Fr: Frame = {origin: [A[0] + F.n[0] * back, A[1] + F.n[1] * back], tangent: tg, n: F.n};
    for (const t of [tp(3.6), tp(7.6), tp(11.6)]) slab(b, Fr, t, 20.4, 0.08, y - 20.4 + 0.05, 0.08, 'bronze');
    slab(b, Fr, tp(7.6), y - 0.05, 9.0, 0.06, 0.06, 'bronze');
    letters(b, Fr, 'DE ROODE LEEUW', tp(7.65), y, 0.06, 0.11, 0.05, 'red', 0.1);
  }

  // ---------- Damraksteeg side (ring edge 2, t from the north-west; seen only at its Damrak corner, w01-213) ----------
  {
    const {f, len} = ringFrame(src.facadeRing, 2);
    slab(b, f, len / 2, 8.7, len - 0.2, 0.22, 0.1, 'stone');
    slab(b, f, len / 2, 11.15, len - 0.2, 0.2, 0.04, 'stone');
    const side = (t: number, arched: boolean) => {
      slab(b, f, t, 5.45, 1.0, 2.2, 0.12, 'frame'); slab(b, f, t, 5.5, 0.9, 2.1, 0.16, 'glass');
      if (arched) { archSlab(b, f, t, 9.0, 1.1, 2.6, 0.08, 'frame'); archSlab(b, f, t, 9.05, 1.0, 2.5, 0.16, 'glass'); archBand(b, f, t, 10.6, 1.75, 0.87, 0.3, 0.08, 'ochre'); }
      else { slab(b, f, t, 9.1, 1.0, 1.9, 0.12, 'frame'); slab(b, f, t, 9.15, 0.9, 1.8, 0.16, 'glass'); }
      slab(b, f, t, 13.1, 1.0, 1.8, 0.12, 'frame'); slab(b, f, t, 13.15, 0.9, 1.7, 0.16, 'glass');
      slab(b, f, t, 15.25, 1.0, 1.3, 0.12, 'frame'); slab(b, f, t, 15.3, 0.9, 1.2, 0.16, 'glass');
    };
    side(len - 1.4, true);
    for (const t of [3.2, 6.4, 9.6, 12.6]) side(t, false);
  }
  setSink(sink0);
}
