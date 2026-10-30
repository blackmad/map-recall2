// The world view: everything the game asks of the 3D map, typed once so two
// implementations can stand behind it (engine programme P0/P1,
// docs/handoffs/engine-programme-20261030.md):
//
//   - `public/canal-drive/js/vector-map.js` (MapLibre + the shared three.js
//     frame as a custom layer) — frozen to fixes; conforms by JSDoc
//     `@implements`.
//   - `engine/ownWorldView.ts` (`?engine=own`): three.js owns the canvas and the
//     frame (engine/frameHost.ts); `maplibregl` is never constructed.
//
// The surface is what the game's call sites use (grepped 2026-10-30 in
// game.js, game-route.js, ferry-travel.js, hud.js, presentationRuntime.ts,
// recallRuntime.ts, landmarkRuntime.ts, freeRideRuntime.ts, feedback/browser.ts,
// analytics/*). It extends the structural `VectorMap` the typed runtimes
// already declare (game/collaborators.ts), adding the members game.js and
// game-route.js reach that the runtimes do not.
//
// Left out on purpose (no call site outside vector-map.js itself, or a debug
// hook read only by specs through `canalRecallGame.vectorMap._*`):
//   `_sharedFrame`, `_ownGround`, `_threeBuildings`, `_completeCity`, every
//   `_ensure*` / `_sync*` loader, `appearanceRenderStatus`,
//   `whenAppearanceRenderReady`, `elevationStatus`, `ownGroundStatus`,
//   `setBuildingLook`/`setBuildingsLook` (specs only), `worldToLngLat`
//   (internal; `camera.project` replaces its spec uses), `resize` (only
//   `resizeToViewport` is called), `setGoogleTilesEnabled` (deleted in P0 by
//   lane L2; optional here until then).
// Private fields the game still reads, kept as optional readonly members until
// the game stops reading them: `_cameraTilt` (game-route.js preferences),
// `_pitchSmoothed` (written by game-route.js after `aimAtWorld`; folded into
// `aimAtWorld` here), `_renderGovernor` (analytics/rideTracker.ts perf tier),
// `_spoils` (landmarkRuntime.ts).

import type { Camera, OsmLoader, Track, VectorMap } from '../game/collaborators';
import type { RenderGovernor } from '../renderGovernor';

export type LngLat = { lng: number; lat: number };
export type LngLatLike = LngLat | readonly [number, number];
export type ScreenPoint = { x: number; y: number };
/** Plain view box in degrees (MapLibre's `getBounds()` reduced to numbers). */
export type ViewBounds = { west: number; south: number; east: number; north: number };

/**
 * The camera both implementations expose as `vectorMap.camera`: the oracle
 * the specs read (lane L2 migrates them from `vectorMap.map.*`) and the only
 * camera maths the game may call. CSS px of the world canvas.
 */
export interface WorldCamera {
  /** lng/lat (ground, z = 0) → CSS px of the map canvas. */
  project(lngLat: LngLatLike): ScreenPoint;
  /** CSS px → the ground point under it (above the horizon both clamp to the far ground). */
  unproject(point: ScreenPoint | readonly [number, number]): LngLat | null;
  /** MapLibre's LngLat shape: `toArray()` too (migrated specs use it). */
  center(): LngLat & { toArray?(): [number, number] };
  zoom(): number;
  /** Plain numbers and MapLibre's `getWest()`… accessors. */
  bounds(): (ViewBounds & { getWest?(): number; getEast?(): number; getSouth?(): number; getNorth?(): number }) | null;
  /** Degrees from straight down. */
  pitch(): number;
  /** Degrees clockwise from north. */
  bearing(): number;
  /** Called once after every rendered frame; returns an unsubscribe. */
  onFrame(callback: () => void): () => void;
  /** Resolves when nothing is loading and no frame is pending. */
  whenIdle(): Promise<void>;
}

export type JumpOptions = { center: LngLatLike; zoom: number; bearing?: number; pitch?: number };

export type ViewMode = 'north' | 'heading' | 'chase' | 'cockpit' | string;

export interface WorldView extends VectorMap {
  ready?: boolean;
  readonly camera?: WorldCamera;

  // ---- frame / camera (new in P0; replaces the `vectorMap.map` leaks) ----
  /** Resolve with the world canvas right after a freshly rendered frame, while its drawing buffer is readable. */
  captureFrame(): Promise<HTMLCanvasElement | null>;
  /** The canvas the world draws into (feedback compares and composites it). */
  frameCanvas(): HTMLCanvasElement | null;
  /** Show a lng/lat directly (the briefing's city centre before a loader exists). */
  jumpToLngLat(options: JumpOptions): void;

  // ---- camera from the game ----
  /** `options.pitch` also resets the eased pitch (game-route.js used to poke `_pitchSmoothed`). */
  aimAtWorld(worldX: number, worldY: number, loader: OsmLoader, options?: { zoom?: number; bearing?: number; pitch?: number }): void;
  pitchForViewMode(viewMode: ViewMode): number;
  zoomOffsetForViewMode?(viewMode: ViewMode): number;
  setCameraTilt(degrees: number): void;
  readonly _cameraTilt?: number;
  _pitchSmoothed?: number | null;
  readonly _renderGovernor?: RenderGovernor | null;
  projectWorld?(worldX: number, worldY: number, loader: OsmLoader, canvas: HTMLCanvasElement): ScreenPoint;
  resizeToViewport(viewport?: unknown): void;
  sync(camera: Camera, loader: OsmLoader, canvas: HTMLCanvasElement): void;

  // ---- content the game hands over ----
  setExtractRoot?(path: string): void;
  applyTheme(theme: string): void;
  setCycleTracks?(ways: readonly unknown[]): void;
  setStreetFronts?(ways: readonly unknown[]): void;
  setTransitNetwork?(load: unknown, visible: boolean): void;
  setTreesVisible(visible: boolean): void;
  setDetailedBuildingsVisible(visible: boolean): void;
  setMeasuredColoursOnly(enabled: boolean): void;
  setBuildingLookPreference?(look: string): void;
  buildingLook?(): string;
  setGoogleTilesEnabled?(enabled: boolean): void;
  toggleLabels(): boolean;
  _spoils?(name: string): boolean;
}

/** Narrow a value to the world view's camera (both implementations). */
export function hasWorldCamera(view: unknown): view is WorldView & { camera: WorldCamera } {
  const c = (view as { camera?: Partial<WorldCamera> } | null)?.camera;
  return !!c && typeof c.project === 'function' && typeof c.center === 'function';
}

/** `game.js`'s choice: `?engine=own` (or `window.__canalRecallEngine = 'own'`). */
export function engineFlag(search = (globalThis as { location?: { search?: string } }).location?.search ?? ''): 'own' | 'maplibre' {
  const g = globalThis as { __canalRecallEngine?: string };
  const asked = g.__canalRecallEngine ?? new URLSearchParams(search).get('engine');
  return asked === 'own' ? 'own' : 'maplibre';
}
