/**
 * The ride's nearest landmark models load under the loading screen, at the pose the first racing frame draws (#268).
 *
 * Measured (headed Chrome 1512x982 @2, cold, Free Ride on the own engine, 2026-11-08): the curated landmark models are
 * suspended from construction until the first racing `sync` (cityExtras.ts `suspended: true`; only a sync with
 * `introFlat === 0` resumes them, and the game's sync does not run under the loading screen). So the first model
 * request went out ~20 ms before the reveal and the nearest model landed 200-280 ms after it: at the Museumplein start
 * the Rijksmuseum replaced its block shell in one frame, 7.8 % of the pixels, in 4/4 runs there. Not a level-of-detail
 * swap: no lod1/lod2 load or swap ran in the window, and the Rijksmuseum's level is `full` at the hold's zoom 17 and
 * the ride's 18.05 alike.
 *
 * The rule (pure): when the game hands the basemap its ride camera under the loading screen (`aimAtWorld` from
 * `_setupRace`, the aim point equal to the game camera's position, no start flight, not panned off), the view solves
 * the first racing frame's pose from the game camera on a scratch solver (zoom with the chase offset, bearing, pitch,
 * the sightline lead) and hands it to the landmark models with a budget: the models nearest that pose's centre and
 * inside its view load now, each at the level that pose picks, at most `budget` of them (8 desktop, 4 touch). The loading-screen hold already
 * waits for landmark requests in flight (settle.ts `landmarks`), so the bounded set lands before the reveal; the rest
 * load after the reveal as today. `?revealSwap=0` (or `window.__canalRecallRevealSwap = false`) hands nothing over:
 * today's start, byte for byte. `?revealSwapN=` sets the budget.
 */
import { EngineCamera, boundsObject } from './cameraMap';
import type { Viewport } from '../ownMap/mapCamera';
import { GameCameraSolver, type GameCamera, type LoaderFrame, type SolveDeps, type ViewRequest } from './gameCamera';

/**
 * Models loaded under the loading screen. Two load at a time (signature-landmarks `_pending`), ~250-300 ms each cold on
 * desktop, counted over the nearest models in the first frame's view, so the big ones beside the start come first.
 * Desktop 8: at the Rembrandt House start the Stopera (stadhuis) is the 5th nearest and popped 3.9 % at +262/+297 ms
 * with 4; the eight land ~2 s before the hold ends (its own-ground and facade checks stay busy ~1.2 s longer, measured
 * per 100 ms). Touch 4: four times slower loads under a 4 s hold.
 */
export const REVEAL_LANDMARK_BUDGET_DESKTOP = 8;
export const REVEAL_LANDMARK_BUDGET_TOUCH = 4;
export function revealLandmarkBudget(touch: boolean): number {
  return touch ? REVEAL_LANDMARK_BUDGET_TOUCH : REVEAL_LANDMARK_BUDGET_DESKTOP;
}

export function revealSwapEnabled(value: unknown): boolean {
  if (value === false) return false;
  if (value === true || value == null) return true;
  return !/^(0|false|off)$/i.test(String(value));
}

/** `?revealSwapN=`: a non-negative integer, else the default. */
export function revealSwapBudget(value: unknown, fallback: number): number {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export interface RevealAim {
  /** The game's loading screen covers the world (GameState.LOADING). */
  covered: boolean;
  /** The world point aimAtWorld was asked for (game px). */
  worldX: number;
  worldY: number;
  /** The game camera, when the page exposes the game. */
  camera: (GameCamera & { introOverview?: number }) | null | undefined;
}

/**
 * Whether this aim is the game handing over its ride camera: covered, the camera at the aim point (within 3 px, 1 m),
 * no start flight, not panned off. The route's first aim (game-route.js, the spawn before `_setupRace`) is at the start
 * while the camera is still wherever the menu left it, so it does not count.
 */
export function isRideAim(a: RevealAim): boolean {
  const c = a.camera;
  if (!a.covered || !c) return false;
  if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || !Number.isFinite(c.zoom) || !(c.zoom > 0)) return false;
  if ((c.introOverview || 0) > 0 || c.detached) return false;
  return Math.hypot(c.x - a.worldX, c.y - a.worldY) <= 3;
}

/**
 * The first racing frame's pose from the game camera, on a scratch solver seeded with the view's eased pitch, so the
 * view's own solver (its pitch ease and clearance clock) is untouched.
 */
export function revealPose(camera: GameCamera, loader: LoaderFrame, deps: SolveDeps, pitchSmoothed: number | null): ViewRequest {
  const scratch = new GameCameraSolver();
  scratch.pitchSmoothed = pitchSmoothed;
  return scratch.request(camera, loader, deps);
}

/** What the landmark models read of a camera (signature-landmarks `this.camera`), for a fixed pose. */
export interface PoseCamera {
  center(): { lng: number; lat: number; toArray(): [number, number] };
  zoom(): number;
  pitch(): number;
  bearing(): number;
  bounds(): ReturnType<typeof boundsObject>;
}

/** A read-only camera at `pose` over the page's viewport. */
export function poseCamera(viewport: () => Viewport, pose: Pick<ViewRequest, 'lngLat' | 'zoom' | 'bearing' | 'pitch'>, elevation = 0, maxPitch?: number): PoseCamera {
  const cam = new EngineCamera(viewport, { center: pose.lngLat, zoom: pose.zoom, bearing: pose.bearing, pitch: pose.pitch, elevation, ...(maxPitch != null ? { maxPitch } : {}) });
  return {
    center: () => { const lng = cam.lng, lat = cam.lat; return { lng, lat, toArray: () => [lng, lat] }; },
    zoom: () => cam.zoom,
    pitch: () => cam.pitch,
    bearing: () => cam.bearing,
    bounds: () => boundsObject(cam.bounds()),
  };
}
