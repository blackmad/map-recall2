// Adapter: register the own ground as a participant of the shared three.js
// frame (src/canalRecall/rendererShared, `?sharedFrame=1`).
//
// The ground is built in the game's local frame — metres east/north of
// ORIGIN via galleryPipeline.toLocal, the same frame the facade chunks use —
// so it maps to Mercator with exactly the facades' transform (translate to
// ORIGIN, scale by metres-in-Mercator with the facades' north compensation).
// Scene z is metres above +1.37 m NAP (surface.ts): close enough to MapLibre's
// z = 0 street level in the canal belt that the two can coexist while the
// ground replaces MapLibre's fills inside the streaming radius.
//
// Wired into the game by gameGround.ts (`?ownGround=1`):
// `frame.register('own-ground', groundParticipant(root), { order: GROUND_ORDER })`.
// ORIGIN is the facades' (threeBuildingFeatures.ORIGIN), duplicated in
// groundStore.ts so the ground bundles do not pull in the building modules.

import { GAME_ORIGIN as ORIGIN } from './groundStore.js';
import { buildingProjectionScale } from '../buildingProjectionScale.js';
import { mercatorOfLngLat, mercatorUnitsPerMetre, type Mat4 } from '../rendererShared/frameMath.js';
import type { FrameParticipant } from '../rendererShared/sharedFrame.js';

/** Below the facades (0): the ground is drawn first so coplanar ties go to what stands on it. */
export const GROUND_ORDER = -10;

/** Column-major local (toLocal metres, z up) → Web Mercator, identical to the facade layer's transform. */
export function groundMercatorFromLocal(): number[] {
  const [mx, my, mz] = mercatorOfLngLat(ORIGIN.lng, ORIGIN.lat, 0);
  const [sx, sy, sz] = buildingProjectionScale(mercatorUnitsPerMetre(my));
  return [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, mx, my, mz, 1];
}

/**
 * The ground as a shared-frame participant. `root` is the three Group holding
 * the ground meshes (as built by ownGround/main.ts); `visible` lets the game
 * hide it (e.g. overview zoom, where MapLibre's flat cartography stays).
 */
export function groundParticipant(root: any, opts: { visible?: (zoom: number) => boolean; onMainPass?: (clipFromLocal: Float64Array) => void } = {}): FrameParticipant {
  const m: Mat4 = groundMercatorFromLocal();
  return {
    root,
    mercatorFromLocal: () => m,
    beforeRender: ctx => {
      if (ctx.pass === 'main' && opts.onMainPass) opts.onMainPass(mul4(mul4(ctx.clipFromWorld.elements, ctx.worldFromMercator.elements), m));
      return opts.visible ? opts.visible(ctx.zoom) : ctx.pass === 'main';
    },
  };
}

/** Column-major 4×4 product a·b (float64). */
export function mul4(a: ArrayLike<number>, b: ArrayLike<number>): Float64Array {
  const o = new Float64Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}

/** Normalised device x/y of a local point under a column-major clip ← local matrix (null behind the eye). */
export function ndcOf(clipFromLocal: ArrayLike<number>, x: number, y: number, z: number): [number, number] | null {
  const m = clipFromLocal, w = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (w <= 1e-9) return null;
  return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w];
}
