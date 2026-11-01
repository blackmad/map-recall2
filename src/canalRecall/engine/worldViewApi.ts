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
//   `resizeToViewport` is called).
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
  toggleLabels(): boolean;
  _spoils?(name: string): boolean;
}

/**
 * Spec oracles both implementations answer under the same names (#129 oracle migration round 3): not game API, read
 * only by specs and review scripts through `canalRecallGame.vectorMap`. The label DOM root is `.cr-map-labels` under
 * either engine (labels/labelOverlay.ts; engine/overlays/labelLayer.ts `root`).
 */
export interface WorldViewOracles {
  /** True from the first streamed building collection on (vector-map.js sets it in `_completeCity.attach`). */
  readonly _completeCityHasBuildings: boolean;
  /** The facade layer draws (the three.js buildings with the facades library loaded). */
  _facadesActive(): boolean;
  /** Building ids the shown signature-landmark models hide (covers.json pands under `?bagTiles=1`). */
  _signatureSuppressOsmIds(): string[];
  /** covers.json once loaded under `?bagTiles=1` on the live tile path, else null. */
  readonly _bagCovers: unknown;
}

/** Narrow a value to the world view's camera (both implementations). */
export function hasWorldCamera(view: unknown): view is WorldView & { camera: WorldCamera } {
  const c = (view as { camera?: Partial<WorldCamera> } | null)?.camera;
  return !!c && typeof c.project === 'function' && typeof c.center === 'function';
}

/**
 * The extract files the own engine cannot run without, per city (`public/data/extracts/<city>/`): the own map's
 * overview and the routing roads binary. The flip is Amsterdam-only (user 2026-11-01: Utrecht, Rotterdam and Den Haag
 * keep MapLibre, even where both files exist); engine.test.ts checks every listed city has both files.
 */
export const OWN_ENGINE_FILES = ['own-map-v1/overview.json.gz', 'roads-v2/streets-routing.bin.gz'] as const;
export const OWN_ENGINE_CITIES: ReadonlySet<string> = new Set(['amsterdam']);

/** The value that keeps MapLibre once the own engine is the default (`?engine=maplibre`); anything else asks for own. */
export const ENGINE_ROLLBACK = 'maplibre';

/** The engine a city can run: what was asked, except that a city without the own engine's extracts stays on MapLibre. */
export function engineForCity(asked: 'own' | 'maplibre', cityId: string | null | undefined): 'own' | 'maplibre' {
  return asked === 'own' && OWN_ENGINE_CITIES.has(cityId || 'amsterdam') ? 'own' : 'maplibre';
}

/**
 * `game.js`'s choice for the city being loaded (default Amsterdam, the game's only city since 2026-10-22). The own
 * engine is the default (the Amsterdam flip, #129); `?engine=maplibre` (or `window.__canalRecallEngine =
 * 'maplibre'`, the specs' ENGINE=maplibre lane) keeps MapLibre: the per-player rollback. Any other value, `?engine=own`
 * included, asks for the own engine. A city without the own engine's extracts is MapLibre. mapLibreLoader.ts
 * `wantsMapLibre` must agree on every query (mapLibreLoader.test.ts pins both on one table).
 */
export function engineFlag(search = (globalThis as { location?: { search?: string } }).location?.search ?? '', cityId?: string | null): 'own' | 'maplibre' {
  const g = globalThis as { __canalRecallEngine?: string };
  const asked = g.__canalRecallEngine ?? new URLSearchParams(search).get('engine');
  return engineForCity(asked === ENGINE_ROLLBACK ? 'maplibre' : 'own', cityId);
}

/** The building looks a world view draws (vector-map.js setBuildingLook); 'default' is MapLibre's retired pattern layer. */
export const BUILDING_LOOK_IDS = ['default', 'procedural', 'storybook', 'cartoon', 'photo', 'untextured'] as const;
export type BuildingLookId = typeof BUILDING_LOOK_IDS[number];

/**
 * The look a URL or global asks for (`?buildings3d=` or `window.__canalRecallBuildings3d`), or null: the same values
 * vector-map.js `canalRecallBuildings3dLook` reads, so both engines honour the same links. A URL look beats the saved
 * preference (building-look.spec "a URL look is not overridden").
 */
export function urlBuildingLook(raw: unknown): BuildingLookId | null {
  if (raw === true || raw === '1' || raw === 'true' || raw === 'on' || raw === 'procedural') return 'procedural';
  if (raw === 'cartoon' || raw === 'photo' || raw === 'storybook' || raw === 'untextured') return raw;
  if (raw === 'off' || raw === 'default') return 'default';
  return null;
}
