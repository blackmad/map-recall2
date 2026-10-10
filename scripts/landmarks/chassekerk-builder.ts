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
    {t0: -2.3, t1: 0.7, d0: -2.3, d1: -0.3, cap: 23.55, clock: true},
    {t0: 12.4, t1: 15.1, d0: -3.0, d1: -0.3, cap: 23.55, clock: false},
  ];
  const Y0 = 17.6, YB = 22.0;
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
    put(b, Fc, new T.BoxGeometry(w + 0.2, 0.2, dep + 0.2).translate(0, 0.1, -(dep + 0.2) / 2), tc, Y0 - 0.2, tw.d1 + 0.1, 'stone');
    // dark eaves board under the cap overhang
    put(b, Fc, new T.BoxGeometry(w + 0.3, 0.2, dep + 0.3).translate(0, 0.1, -(dep + 0.3) / 2), tc, YB - 0.2, tw.d1 + 0.15, 'dark');
    // hipped tile cap (ridge along the longer side), 0.3 m overhang
    const o = 0.15, W = w + 2 * o, D = dep + 2 * o, ya = YB, yb = tw.cap;
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
      {f: frameAt(P(tw.t0, tw.d1), N), n: tw.clock ? 2 : 1, c: w / 2},                       // front
      {f: frameAt(P(tw.t1, tw.d0), [-N[0], -N[1]]), n: tw.clock ? 2 : 1, c: w / 2},           // back, t' from the south corner
      {f: frameAt(P(tw.t1, tw.d1), U), n: tw.clock ? 2 : 1, c: dep / 2},                      // south face, t' from front corner backwards
      {f: frameAt(P(tw.t0, tw.d0), [-U[0], -U[1]]), n: tw.clock ? 2 : 1, c: dep / 2},         // north face, t' from back corner forwards
    ];
    for (const {f, n, c} of faces) {
      for (let k = 0; k < n; k++) {
        const t = c + (k - (n - 1) / 2) * (c > 1.2 ? 1.0 : 0.8);
        const aw = n === 1 ? 0.95 : 0.62;
        archBand(b, f, t, 18.6, aw + 0.2, 2.9, 0.1, 0.1, 'stone');
        archSlab(b, f, t, 18.7, aw, 2.7, 0.1, 'dark');
        if (n === 1) slab(b, f, t, 18.7, 0.08, 1.7, 0.12, 'stone');
      }
    }
    // slender slits up the shaft on the front and south faces
    for (const y of [8.9, 11.7, 14.5, 17.0]) {
      slab(b, Ft, tc, y, 0.17, 0.9, 0.12, 'dark');
      slab(b, frameAt(P(tw.t1 - 0.15, tw.d1), U), dep / 2, y, 0.17, 0.9, 0.12, 'dark');
    }
    if (tw.clock) {
      const f = faces[2].f;
      disc(b, f, dep / 2, 16.4, 0.8, 0.12, 'white');
      bar(b, f, dep / 2, 16.4, dep / 2 + 0.3, 16.75, 0.1, 0.16, 'dark');
      bar(b, f, dep / 2, 16.4, dep / 2 - 0.45, 16.2, 0.09, 0.16, 'dark');
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
  // ---- South-east wing: the long strip that runs SSW from the nave (3DBAG walls 14.3 m, 5.2 m at the copper-block end) ----
  // Photos 2025-07-31 (panoramas 00169 and 00172, ref-wing-*.jpg): the ESE wall has a brick base with grouped square windows and
  // plank doors between stepped brick piers, a stone string course at 2.9 m, a terrace slab with iron railing at 5.3 m and a
  // round-headed arcade above it. At its north-east end sits a copper-clad block (three window columns) over a brick base with
  // three tall arched windows, on the footprint's NNE-facing notch at (7.5, 31.2)..(13.4, 34.1).
  const wingBays = (f: Frame, len: number, bayTarget: number, doors: number[], low = false) => {
    const n = Math.max(1, Math.round(len / bayTarget)), bay = len / n, top = low ? 5.0 : 14.0;
    slab(b, f, len / 2, 2.9, len, 0.22, 0.14, 'stone');                // string course under the windows
    slab(b, f, len / 2, 5.3, len, 0.3, 0.5, 'stone');                  // terrace slab / cornice
    if (!low) slab(b, f, len / 2, 14.0, len, 0.3, 0.3, 'stone');       // coping at the head of the wall
    for (let k = 0; k <= n; k++) {                                     // brick piers
      const t = Math.min(Math.max(k * bay, 0.35), len - 0.35);
      slab(b, f, t, 0, 0.7, top, 0.28, 'brick');
      slab(b, f, t, 5.3, 0.9, 0.3, 0.6, 'stone');
    }
    for (let k = 0; k < n; k++) {
      const c = (k + 0.5) * bay;
      for (const [dt, w] of [[-1.25, 0.6], [0, 1.2], [1.25, 0.6]] as [number, number][]) {
        if (Math.abs(dt) + w / 2 > bay / 2 - 0.45) continue;
        slab(b, f, c + dt, 3.0, w + 0.3, 0.12, 0.2, 'stone');           // sill
        slab(b, f, c + dt, 3.1, w, 1.15, 0.1, 'dark');                  // reveal
        slab(b, f, c + dt, 3.18, w - 0.1, 1.0, 0.14, 'glass');
        slab(b, f, c + dt, 4.25, w + 0.2, 0.12, 0.2, 'stone');          // lintel
      }
      if (doors.includes(k)) slab(b, f, c, 0, 1.1, 2.3, 0.14, 'ochre');
      // terrace railing (rail plus balusters)
      bar(b, f, c - bay / 2 + 0.45, 6.4, c + bay / 2 - 0.45, 6.4, 0.06, 0.12, 'dark', 0.42);
      for (let t = c - bay / 2 + 0.5; t < c + bay / 2 - 0.4; t += 0.5) slab(b, f, t, 5.6, 0.04, 0.8, 0.04, 'dark', 0.4);
      if (low) continue;
      for (const dt of [-1.1, 0, 1.1]) {                                // round-headed arcade
        archBand(b, f, c + dt, 5.6, 0.95, 1.7, 0.1, 0.1, 'stone');
        archSlab(b, f, c + dt, 5.6, 0.75, 1.6, 0.1, 'dark');
        archSlab(b, f, c + dt, 5.7, 0.6, 1.4, 0.14, 'glass');
      }
    }
  };
  // long ESE wall: origin at its SSW end (13.521, 33.913), t runs NNE; the first 5.6 m are the 5.2 m high terrace-level part
  const wt: [number, number] = [0.4488, -0.8936];
  wingBays(frameAt([13.521, 33.913], [0.8936, 0.4488]), 5.6, 2.8, [0], true);
  wingBays(frameAt([13.521 + wt[0] * 5.6, 33.913 + wt[1] * 5.6], [0.8936, 0.4488]), 32.94, 4.1, [1, 4, 6]);
  // copper block and arched base facing NNE; t runs west from the east corner (13.521, 33.913)
  {
    const Fe = frameAt([13.521, 33.913], [0.44, -0.898]);
    const len = 6.503;
    slab(b, Fe, 4.3, 5.7, 4.3, 0.28, 0.4, 'stone');                 // cornice under the copper block
    for (const t of [5.9, 4.5, 3.1]) {
      archBand(b, Fe, t, 2.2, 1.0, 3.2, 0.12, 0.1, 'stone');
      archSlab(b, Fe, t, 2.2, 0.76, 3.0, 0.1, 'dark');
      archSlab(b, Fe, t, 2.3, 0.6, 2.8, 0.14, 'glass');
      slab(b, Fe, t, 2.3, 0.05, 1.8, 0.16, 'frame');
    }
    slab(b, Fe, 4.5, 2.1, 4.3, 0.12, 0.2, 'stone', 0);              // sill band under the arches
    // copper cladding (5.7 m up to the roof) with standing seams, three columns of windows in three rows
    slab(b, Fe, len / 2, 5.98, len, 9.3, 0.1, 'copper');
    for (let t = 0.6; t < len; t += 0.72) slab(b, Fe, t, 5.98, 0.04, 9.3, 0.14, 'dark');
    for (const t of [1.15, 3.25, 5.35]) {
      for (const y of [7.2, 10.0, 12.8]) {
        slab(b, Fe, t, y, 1.0, 1.6, 0.16, 'dark');
        slab(b, Fe, t, y + 0.08, 0.84, 1.44, 0.2, 'glass');
      }
    }
  }
  // Copper-clad south block (walls 32 and 89, 15.3 m): copper over a brick base, four rows of paired-pane windows (2025 panorama 00105).
  const copperFace = (f: Frame, len: number) => {
    slab(b, f, len / 2, 5.5, len, 9.7, 0.1, 'copper');
    for (let t = 0.65; t < len; t += 0.72) slab(b, f, t, 5.5, 0.04, 9.7, 0.14, 'dark');
    const cols = Math.max(2, Math.round(len / 2.1)), pitch = len / cols;
    for (let k = 0; k < cols; k++) {
      for (const y of [6.3, 8.7, 11.1, 13.4]) {
        slab(b, f, (k + 0.5) * pitch, y, 1.05, 1.6, 0.16, 'dark');
        slab(b, f, (k + 0.5) * pitch, y + 0.08, 0.9, 1.44, 0.2, 'glass');
      }
    }
    slab(b, f, len / 2, 5.3, len, 0.25, 0.3, 'stone');
  };
  copperFace(frameAt([1.366, 43.163], [-0.461, 0.887]), 6.506);
  copperFace(frameAt([7.715, 30.984], [-0.887, -0.4624]), 13.73);
  setSink(0);
}
