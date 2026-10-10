import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {archBand, archSlab, disc, put, ringSlab, setSink, slab} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import {bar, frameAt} from './gothic-kit';
import {carveBox} from './shell-carve';
import {facePoly} from './worship-kit';
import source from './chassekerk-footprints.json';

/**
 * Chassékerk, Chasséstraat (K.P. Tholens, 1924-26; now Chassé Dance Studios). The pand is the whole church complex: a broad
 * nave and aisles under one steep roof, entered from the west front (bearing 297 degrees, over the Chasséstraat plaza) with a
 * low porch of three round arches between two slender brick towers, a recessed gable with a tracery rose, and set-back
 * wings with round (porthole) windows. Massing is the 3DBAG LoD2.2 shell in native east/south metres; 3DBAG turns both tower
 * tops into needles, so the parts above 17.6 m are cut out and rebuilt as brick belfries with hipped tile caps. The north
 * tower is the taller and carries the white clock. Positions are measured from the 2025 municipal panorama of the front
 * (about 0.0226 m per pixel across the porch) and a 2025 view of the towers; the long nave walls, rear and the south wing
 * are inferred from the shell alone.
 *
 * Front frame: t runs along the front from the north tower's corner (viewer's right when facing the front, i.e. south),
 * depth is measured outward from the plane d = 23.7 (distance along the front normal from the footprint centroid).
 */
const O: [number, number] = [-15.92, -20.91];
const N: [number, number] = [-0.891, -0.454];
const U: [number, number] = [-0.454, 0.891];

export function buildChassekerk(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  setSink(0.2);
  const P = (t: number, d: number): [number, number] => [O[0] + U[0] * t + N[0] * d, O[1] + U[1] * t + N[1] * d];
  const world = (t: number, y: number, d: number) => { const p = P(t, d); return [p[0], y, p[1]]; };
  const Fc = frameAt(P(0, 0), N);            // reference plane d = 23.7
  const Fp = frameAt(P(0, 0.2), N);          // porch front
  const Fr = frameAt(P(0, -2.3), N);         // recessed gable wall above the porch
  const Fw = frameAt(P(0, -4.1), N);         // set-back wing fronts
  const Ft = frameAt(P(0, -0.3), N);         // tower fronts

  // The two tower tops: north t -2.3..0.7 / depth -2.3..-0.3, south t 12.4..15.1 / depth -3.0..-0.3.
  const towers = [
    {t0: -2.3, t1: 0.7, d0: -2.3, d1: -0.3, cap: 23.5, clock: true},
    {t0: 12.4, t1: 15.1, d0: -3.0, d1: -0.3, cap: 23.5, clock: false},
  ];
  const Y0 = 17.6, YB = 21.0;
  let shell = source as never;
  for (const tw of towers) shell = carveBox(shell, Fc, {t0: tw.t0 - 0.1, t1: tw.t1 + 0.1, d0: tw.d0 - 0.1, d1: tw.d1 + 0.3, y0: Y0}) as never;
  addShell(b, shell, {wall: 'brick', roof: 'slate', roofFor: () => 'red'});
  b.mark?.('shell');

  const roundWin = (f: Frame, t: number, y: number, r: number) => {
    ringSlab(b, f, t, y, r, r + 0.17, 0.1, 'stone');
    disc(b, f, t, y, r, 0.08, 'dark');
    disc(b, f, t, y, r * 0.9, 0.1, 'glass');
    bar(b, f, t - r, y, t + r, y, 0.05, 0.13, 'frame');
    bar(b, f, t, y - r, t, y + r, 0.05, 0.13, 'frame');
  };

  for (const tw of towers) {
    const tc = (tw.t0 + tw.t1) / 2, dc = (tw.d0 + tw.d1) / 2, w = tw.t1 - tw.t0, dep = tw.d1 - tw.d0;
    // Brick belfry shaft from the cut line up to the eaves, in front of the cut-open shell, with a stone cornice below it.
    put(b, Fc, new T.BoxGeometry(w, YB - Y0, dep).translate(0, (YB - Y0) / 2, -dep / 2), tc, Y0, tw.d1, 'brick');
    void dc;
    // cornice
    put(b, Fc, new T.BoxGeometry(w + 0.5, 0.3, dep + 0.5).translate(0, 0.15, -(dep + 0.5) / 2), tc, Y0 - 0.3, tw.d1 + 0.25, 'stone');
    // dark eaves board under the cap overhang
    put(b, Fc, new T.BoxGeometry(w + 0.6, 0.3, dep + 0.6).translate(0, 0.15, -(dep + 0.6) / 2), tc, YB - 0.28, tw.d1 + 0.3, 'dark');
    // hipped tile cap (ridge along the longer side), 0.3 m overhang
    const o = 0.3, W = w + 2 * o, D = dep + 2 * o, ya = YB, yb = tw.cap;
    const tm = tc, dm = (tw.d0 + tw.d1) / 2;
    const longT = W >= D, half = Math.min(W, D) / 2, rl = Math.abs(W - D) / 2;
    const ridgeA = longT ? [tm - rl, dm] : [tm, dm - rl], ridgeB = longT ? [tm + rl, dm] : [tm, dm + rl];
    const corners: [number, number][] = [[tm - W / 2, dm - D / 2], [tm + W / 2, dm - D / 2], [tm + W / 2, dm + D / 2], [tm - W / 2, dm + D / 2]];
    void half;
    const hipFace = (pts: [number, number, number][], outward: number[]) => {
      const q = pts.filter((p, i) => { const r = pts[(i + 1) % pts.length]; return Math.hypot(p[0] - r[0], p[2] - r[2], p[1] - r[1]) > 0.02; });
      if (q.length >= 3) facePoly(b, q.map(([t, y, d]) => world(t, y, d)), 'red', outward, 'roof');
    };
    const dirT = [U[0], 0, U[1]], dirD = [N[0], 0, N[1]];
    // four roof planes: two long slopes (trapezoids) and two hip ends (triangles)
    if (longT) {
      hipFace([[corners[0][0], ya, corners[0][1]], [corners[1][0], ya, corners[1][1]], [ridgeB[0], yb, ridgeB[1]], [ridgeA[0], yb, ridgeA[1]]], [-dirD[0], 1, -dirD[2]]);
      hipFace([[corners[2][0], ya, corners[2][1]], [corners[3][0], ya, corners[3][1]], [ridgeA[0], yb, ridgeA[1]], [ridgeB[0], yb, ridgeB[1]]], [dirD[0], 1, dirD[2]]);
      hipFace([[corners[1][0], ya, corners[1][1]], [corners[2][0], ya, corners[2][1]], [ridgeB[0], yb, ridgeB[1]]], [dirT[0], 1, dirT[2]]);
      hipFace([[corners[3][0], ya, corners[3][1]], [corners[0][0], ya, corners[0][1]], [ridgeA[0], yb, ridgeA[1]]], [-dirT[0], 1, -dirT[2]]);
    } else {
      hipFace([[corners[3][0], ya, corners[3][1]], [corners[0][0], ya, corners[0][1]], [ridgeA[0], yb, ridgeA[1]], [ridgeB[0], yb, ridgeB[1]]], [-dirT[0], 1, -dirT[2]]);
      hipFace([[corners[1][0], ya, corners[1][1]], [corners[2][0], ya, corners[2][1]], [ridgeB[0], yb, ridgeB[1]], [ridgeA[0], yb, ridgeA[1]]], [dirT[0], 1, dirT[2]]);
      hipFace([[corners[0][0], ya, corners[0][1]], [corners[1][0], ya, corners[1][1]], [ridgeA[0], yb, ridgeA[1]]], [-dirD[0], 1, -dirD[2]]);
      hipFace([[corners[2][0], ya, corners[2][1]], [corners[3][0], ya, corners[3][1]], [ridgeB[0], yb, ridgeB[1]]], [dirD[0], 1, dirD[2]]);
    }
    // belfry openings: two round-headed louvre arches on each face
    const faces: {f: Frame; n: number; c: number}[] = [
      {f: frameAt(P(tw.t0, tw.d1), N), n: 2, c: w / 2},                       // front
      {f: frameAt(P(tw.t1, tw.d0), [-N[0], -N[1]]), n: 2, c: w / 2},           // back, t' from the south corner
      {f: frameAt(P(tw.t1, tw.d1), U), n: 2, c: dep / 2},                      // south face, t' from front corner backwards
      {f: frameAt(P(tw.t0, tw.d0), [-U[0], -U[1]]), n: 2, c: dep / 2},         // north face, t' from back corner forwards
    ];
    for (const {f, n, c} of faces) {
      for (let k = 0; k < n; k++) {
        const t = c + (k - (n - 1) / 2) * (c > 1.2 ? 1.0 : 0.8);
        archBand(b, f, t, 18.1, 0.78, 2.3, 0.1, 0.1, 'stone');
        archSlab(b, f, t, 18.2, 0.58, 2.1, 0.1, 'dark');
      }
    }
    // slender slits up the shaft on the front and south faces
    for (const y of [7.8, 10.6, 13.2]) {
      slab(b, Ft, tc, y, 0.17, 0.9, 0.12, 'dark');
      slab(b, frameAt(P(tw.t1 - 0.15, tw.d1), U), dep / 2, y, 0.17, 0.9, 0.12, 'dark');
    }
    if (tw.clock) {
      const f = faces[2].f;
      disc(b, f, dep / 2, 19.0, 0.85, 0.12, 'white');
      bar(b, f, dep / 2, 19.0, dep / 2 + 0.3, 19.35, 0.1, 0.16, 'dark');
      bar(b, f, dep / 2, 19.0, dep / 2 - 0.45, 18.8, 0.09, 0.16, 'dark');
    }
    // string course where the shaft leaves the porch roof
    slab(b, Ft, tc, 6.9, w + 0.3, 0.25, 0.2, 'stone', 0);
  }

  // ---- Porch: stone cornice with merlons, three round arches, impost blocks ----
  {
    slab(b, Fp, 6.8, 4.3, 9.9, 0.4, 0.3, 'stone');
    for (let k = 0; k < 11; k++) slab(b, Fp, 2.2 + k * 0.9, 4.7, 0.5, 0.3, 0.22, 'stone');
    for (const tc of [4.05, 6.8, 9.55]) {
      archBand(b, Fp, tc, 0.3, 2.35, 3.1, 0.24, 0.14, 'stone');
      archSlab(b, Fp, tc, 0.3, 1.9, 2.6, 0.1, 'dark');
      archSlab(b, Fp, tc, 0.4, 1.55, 2.3, 0.14, 'glass');
      slab(b, Fp, tc, 0.4, 0.06, 1.7, 0.17, 'frame');
      slab(b, Fp, tc, 1.4, 1.55, 0.06, 0.17, 'frame');
    }
    for (const t of [5.4, 8.2]) slab(b, Fp, t, 2.0, 0.7, 0.2, 0.2, 'stone');
    // stone copings on the two corner blocks that flank the porch
    slab(b, Fp, 1.6, 6.85, 2.0, 0.2, 0.3, 'stone');
    slab(b, Fp, 11.6, 6.85, 2.4, 0.2, 0.3, 'stone');
  }
  // ---- Recessed gable wall: round-headed window with tracery rose ----
  {
    archBand(b, Fr, 6.8, 4.4, 4.3, 3.9, 0.25, 0.12, 'stone');
    archSlab(b, Fr, 6.8, 4.5, 3.8, 3.6, 0.1, 'glass');
    ringSlab(b, Fr, 6.8, 6.3, 1.2, 1.5, 0.14, 'stone');
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      bar(b, Fr, 6.8, 6.3, 6.8 + Math.cos(a) * 1.4, 6.3 + Math.sin(a) * 1.4, 0.09, 0.14, 'white');
    }
    disc(b, Fr, 6.8, 6.3, 0.35, 0.14, 'stone');
  }
  // ---- Set-back wings: portholes in brick surrounds ----
  roundWin(Fw, -6.2, 2.0, 0.42);
  roundWin(Fw, -2.4, 2.0, 0.42);
  roundWin(frameAt(P(0, -4.2), N), 18.1, 2.0, 0.42);
  setSink(0);
}
