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
// Not wired into the game: vector-map.js and the shared frame belong to other
// lanes. Wiring is `frame.add('own-ground', groundParticipant(root), { order: GROUND_ORDER })`.

import { ORIGIN } from '../threeBuildingFeatures.js';
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
export function groundParticipant(root: any, opts: { visible?: (zoom: number) => boolean } = {}): FrameParticipant {
  const m: Mat4 = groundMercatorFromLocal();
  return {
    root,
    mercatorFromLocal: () => m,
    beforeRender: ctx => (opts.visible ? opts.visible(ctx.zoom) : ctx.pass === 'main'),
  };
}
