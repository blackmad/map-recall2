// The own ground in the game's riding view (`?ownGround=1`, implies
// `?sharedFrame=1`). docs/research/own-ground-20261009.md, "what remains".
//
// - Streaming: elevation-v1 1 km cells around the rider, built in the ground
//   worker (groundWorker.ts), LOD 0 within NEAR_M of the rider's cell edge,
//   LOD 1 to RADIUS_M, evicted beyond; installed one cell per frame.
// - Detail (CANAL-RECALL-7, touch devices): a cell beyond the rider's own and
//   its neighbours builds at `touch` detail (groundCell CellDetail): coarser
//   drapes, no bollards or park furniture, the same footprints. A cell that
//   becomes near again rebuilds at `full` through the ordinary LOD swap. Desktop
//   is always `full`; the level comes from `pointer: coarse`, and
//   `?groundDetail=full|touch` / `?groundNear=block|cell|all` override it.
// - Touch ring and tiles (CANAL-RECALL-7, 2026-10-29): a touch device fits the
//   resident ring to its own viewport plus a speed margin ahead (residency.ts,
//   `?groundRing=steps|view`) and cuts each heavy layer of a cell into 3×3
//   tiles that three.js frustum-culls (cellTiles.ts, `?groundTiles=1..4`).
//   iPad Westerkerk pitch 60: own-ground 875 k → ~320 k drawn triangles, the
//   picture unchanged. Desktop keeps the stepped ring and, since the same
//   day, also draws 3×3 tiles (desktop Westerkerk 1065 k → 466 k, identical).
// - Drawn as one participant of the shared three.js frame (order −10, under
//   the facades), lit and shadowed by its rig.
// - Overlays are draped ribbons on the same surface: the route line, the
//   question street's highlight (centreline geometry only, never a name),
//   and the destination's ground ring.
// - The riding surface (relief + measured decks) is also sampled here on the
//   main thread for the rider's pose and for model bases (buildings, trees,
//   landmarks), with the same data and frame the worker builds from.
// - The far ring (farRing.ts): from the air, when the view reaches past the
//   capped resident ring, 2 km blocks of flat-coloured land, water, green and
//   street bands out to FAR_MAX_M; a block's 1 km part hides while the
//   resident ring draws that cell.
//
// Renderer-agnostic on purpose: nothing here calls MapLibre. The shared frame
// supplies the camera; `GroundHost` is the thin adapter the page implements
// (repaint, hiding the basemap's own ground). THREE is injected.

import { groundFixFlags, groundFixOptions } from './groundFixes.js';
import { clampToDrawLimit, currentDrawLimit } from '../engine/drawLimit';
import { HIGH_ANISOTROPY, pageTextureParams } from '../look/texturePolicy.js';
import { farRailDrapeFlag, farRailFlag, installRailStripes, railMinPxFlag, railStripesFlag } from './railStripes.js';
import { GroundStore, httpFetchBytes, toLocal, WATER_Z, type ReliefTileLoader, type Rect } from './groundStore.js';
import { BuildRetries, groundRequeueFlag, railRetryFlag } from './groundResidency.js';
import { readGroundTile } from './heightField.js';
import { poolReliefLoader } from './reliefDecode.js';
import { poolWorkerUrl, sharedWorkerPool } from '../engine/workerPool.js';
/** The page's worker pool runs the building worker bundle next to this one (engine/workerPool.ts). */
const POOL_WORKER_URL = typeof document !== 'undefined' ? poolWorkerUrl((document.currentScript as HTMLScriptElement | null)?.src ?? '') : '';
import { boundingSphereOf } from '../geometryBounds.js';
import { compileWithinBudget, precompileBudget, precompileStepDue } from '../rendererShared/compileBudget.js';
import { GROUND_LAYERS, PARK_RANK, type BuiltCell, type CellDetail, type GroundLayer } from './groundCell.js';
import { gpuMeshBytes, isCompact, type GpuMesh } from './compactMesh.js';
import { groundParticipant, GROUND_ORDER, ndcOf } from './sharedFrameGround.js';
import { footprintBase } from './placement.js';
import { cutMesh, disposeTiles, setTileReach } from '../rendererShared/tiledGeometry.js';
import { cellTileGrid, type CellTile } from './cellTiles.js';
import { inTouchRing, residentRadius, touchAheadMarginM, touchResidentRadius, viewCornerReachM, viewReachM } from '../engine/worldStreamer.js';
import { farBlockCells, farBlocksWithin, farHorizonEnabled, farRadiusM, horizonReachM, FAR_KEEP_M, FAR_STEP_M, type BuiltFar } from './farRing.js';
import { routeRibbon } from './streets.js';
import { disc, emptyMesh, merge, type MeshArrays } from './drape.js';
import { riderPose as surfaceRiderPose, type Vec2 } from './surface.js';
import { gardenTone, GROUND_LOOK_DEFAULT, groundPalette, isRoadLookId, roadLookTones, type GroundLook, type RoadLookId } from './groundLook.js';
import { asphaltGrain, herringboneBricks, KLINKER_TONES } from './streetTextures.js';
import { paintNoise } from './groundNoise.js';
import { FLAT_GROUND_GAIN } from './groundLight.js';
import { RAIL_STRIPE, RAIL_TONES, railStripes, SLEEPER_TILE_M } from './railTracks.js';
import { OverviewBlend, presenceOf, transitionOn } from '../overviewTransition/blend.js';
import { groundPrefetchFlag, prefetchStep, PREFETCH_MAX_MS, PREFETCH_POLL_MS, type StartView } from './groundPrefetch.js';
import { groundShareFlag, groundShareMB } from './groundShare.js';
import { defaultGroundWorkers, FOCUS_RANK_BASE, AFFINITY_WINDOW, groundAffinityFlag, groundAffinityLodFlag, groundBlockFirstFlag, dispatchTier, groundFocusFlag, groundPullFlag, groundQuickFlag, groundWorkersFlag, inFocusBlock, nextDispatch, pickWorker, PULL_DEPTH, sharedNeighbours } from './groundWorkers.js';
import { cutClone, fadeClone, groundProgram, type GroundMarking } from './groundMaterial.js';
import { MARKING_FADE_STRENGTH } from '../look/markingFade.js';
import { flatLayerTones } from '../overviewTiles/layerColours.js';
import { MotionEstimate, aheadRankXY, lookAheadEnabled } from '../streamingLookAhead.js';

export interface GroundHost {
  /** Ask for another frame. */
  repaint(): void;
  /** Hide (true) or restore (false) the basemap's own ground fills and lines. */
  setBasemapGroundHidden(hidden: boolean): void;
  /** The camera's pose now (groundPrefetch.ts): followed until the game's first `update`, so the start builds during the hold. */
  startView?(): StartView | null;
}

export interface OwnGroundOptions {
  workerUrl: string;
  /** Ground workers building cells side by side (groundWorkers.ts; `?groundWorkers=` else 3 on desktop, 1 on touch; 0 = that default). */
  workers?: number;
  /** Resident radius from the rider to a cell's nearest edge, metres. */
  radiusM?: number;
  /** Largest resident radius from the air (zoomed out), metres: the radius grows from `radiusM` as the view reaches further (residency.ts viewReachM). */
  aerialRadiusM?: number;
  /** Arrival dissolve of a new cell, ms (0 = pop in). */
  fadeMs?: number;
  /** LOD 0 within this distance of a cell's nearest edge. */
  nearM?: number;
  /** Below this map zoom the ground is not drawn (overview, minimap: flat cartography). */
  minZoom?: number;
  /** Park surfaces and furniture from parks-v1 (default on; `?parks=0` or `window.__canalRecallParks = false` turns them off). */
  parks?: boolean;
  /** Railway tracks from rail-v1 (railTracks.ts; default on; `?rails=0` or `window.__canalRecallRails = false` turns them off). */
  rails?: boolean;
  /** The far ring beyond the resident cells from the air (default on). */
  far?: boolean;
  /**
   * Free each vertex/index array once three has uploaded it (default off; the
   * ride turns it on for phones). A resident cell's typed arrays (~12 MB) lived
   * on beside their GPU copy; only `layersAt`, a diagnostics walk, reads them.
   */
  releaseArrays?: boolean;
  /**
   * Draw the cut layers through their tiles only and drop the whole-mesh index (phones). Defaults to
   * `releaseArrays`; `?engine=own` on desktop releases the arrays but keeps the whole draw (spans there rewrite the
   * index once before upload and need no CPU copy after it).
   */
  tilesOnly?: boolean;
  /** Ground palette (groundLook.ts; GROUND_LOOK_DEFAULT unless given). Colour only. */
  groundLook?: GroundLook;
  /** The surveyed road partition from roads-v1 (roadSurfaces.ts). On by default (2026-10-16); `?roads=0` draws the OSM bands. */
  roads?: boolean;
  /**
   * The overview → city blend (overviewTransition/blend.ts; default on, `?transition=0` off): the ground dissolves in
   * from zoom 14 to 15.6 instead of appearing at `minZoom`.
   */
  transition?: boolean;
  /**
   * Far cells' detail level (default: from the device, `detailFlag()` above). `touch` builds every resident cell the
   * rider is not in (or beside) at the coarse level; `full` builds the desktop city everywhere. Display only.
   */
  detail?: CellDetail;
  /**
   * Which cells keep `full` detail on a touch device (default: from the page, `groundNearFlag()` above): the rider's
   * cell and its 8 neighbours, the rider's cell alone, or none.
   */
  groundNear?: 'block' | 'cell' | 'all';
  /**
   * How the resident ring follows the view (default: from the page, `groundRingFlag()` below). `steps` is the desktop
   * rule (a 900 px view, 400 m steps). `view` fits the ring to this device's viewport (its farthest visible corner,
   * 100 m steps) and reaches further only ahead of a moving rider (residency.ts, CANAL-RECALL-7). Display only.
   */
  ring?: 'steps' | 'view';
  /**
   * Cut each heavy layer of a cell into `tiles`×`tiles` sub-meshes so the ones off screen are culled (cellTiles.ts;
   * default: from the page, `groundTilesFlag()` below, 3; 1 = one mesh per layer). Display only.
   */
  tiles?: number;
  /** Tiles per side for a LOD 0, full-detail cell (cellTiles.ts cellTileGrid; default `groundNearTilesFlag()`, 6). */
  nearTiles?: number;
  /**
   * New programs the ground warm-up links per frame (rendererShared/compileBudget.ts; default: from the page,
   * `precompileBudget()`: 2 on a touch device, `Infinity` = all in the first frame on a desktop). CANAL-RECALL-7/-N.
   */
  precompilePerFrame?: number;
}

/**
 * Cell tiles per side: 3×3 on every device. Touch since 2026-10-29 (#100); desktop since the same day, after the
 * in-page before/after (scripts/gpu-load-ipad.mjs RETILE) came out pixel-identical at the Westerkerk, Damrak, Dam and
 * Leidseplein with drawn ground triangles 1.04–1.44 M → 0.35–0.47 M. `?groundTiles=1..4` (or
 * `window.__canalRecallGroundTiles`) overrides it; `?groundTiles=1` is the one-mesh-per-layer opt-out.
 */
/**
 * Tiles per side for a cell built at LOD 0 and full detail (cellTiles.ts cellTileGrid): 6, so the rider's own cell on
 * a touch device (its 1 km of kerbs, paving and bollards was ~190 k of ~285 k ground triangles per iPad frame, #129)
 * draws only the sixth-of-a-cell strips on screen. Pure culling: same pixels. `?groundNearTiles=1..8` (or
 * `window.__canalRecallGroundNearTiles`) overrides it; `?groundNearTiles=3` is the old grid (the A/B).
 */
export const NEAR_CELL_TILES = 6;
export function groundNearTilesFlag(): number {
  const g = globalThis as { __canalRecallGroundNearTiles?: number | string; location?: { search?: string } };
  const asked = Number(g.__canalRecallGroundNearTiles ?? (g.location?.search ? new URLSearchParams(g.location.search).get('groundNearTiles') : NaN));
  if (Number.isInteger(asked) && asked >= 1 && asked <= 8) return asked;
  return NEAR_CELL_TILES;
}

/**
 * Small raised detail of the full-detail cell drawn only near the rider (#129): kerbs and bollards ~150 m off are a
 * pixel or less at ride zoom, yet were a fifth of the ground triangles drawn. Tiles wholly beyond `REACH_M` (+25 m
 * hysteresis) of the rider are not drawn. `?groundReach=0` (or `window.__canalRecallGroundReach = 0`) turns it off;
 * `?groundReach=<m>` moves it.
 */
export const REACH_LAYERS: ReadonlySet<string> = new Set(['kerb', 'bollard']);
export const REACH_M = 150;
export function groundReachFlag(): number {
  const g = globalThis as { __canalRecallGroundReach?: number | string; location?: { search?: string } };
  const raw = g.__canalRecallGroundReach ?? (g.location?.search ? new URLSearchParams(g.location.search).get('groundReach') : null);
  // A query without the key gives null, and Number(null) is 0 (off): only an explicit value counts.
  const asked = raw === null || raw === undefined || raw === '' ? NaN : Number(raw);
  if (Number.isFinite(asked) && asked >= 0) return asked;
  return REACH_M;
}

function groundTilesFlag(): number {
  const g = globalThis as { __canalRecallGroundTiles?: number | string; matchMedia?: (query: string) => { matches: boolean }; location?: { search?: string } };
  const asked = Number(g.__canalRecallGroundTiles ?? (g.location?.search ? new URLSearchParams(g.location.search).get('groundTiles') : NaN));
  if (Number.isInteger(asked) && asked >= 1 && asked <= 4) return asked;
  return CELL_TILES;
}

/**
 * The ring fit on this device: `view` on a touch device (the same `pointer: coarse` test as `detailFlag()`), `steps`
 * on a desktop, unchanged. `?groundRing=steps|view` (or `window.__canalRecallGroundRing`) overrides it.
 */
function groundRingFlag(): 'steps' | 'view' {
  const g = globalThis as { __canalRecallGroundRing?: string; matchMedia?: (query: string) => { matches: boolean }; location?: { search?: string } };
  const asked = g.__canalRecallGroundRing ?? (g.location?.search ? new URLSearchParams(g.location.search).get('groundRing') : null);
  if (asked === 'steps' || asked === 'view') return asked;
  return g.matchMedia?.('(pointer: coarse)')?.matches ? 'view' : 'steps';
}

/** The page's viewport in CSS pixels (the map canvas fills it), or the iPad landscape profile outside a page. */
function viewportPx(): [number, number] {
  const g = globalThis as { innerWidth?: number; innerHeight?: number };
  return g.innerWidth && g.innerHeight ? [g.innerWidth, g.innerHeight] : [1180, 734];
}

/** bridgeGaps step 3, dry way decks over land (issue #178): off by default; `?dryWayDecks=1` or `window.__canalRecallDryWayDecks = true` turns it on. */
function dryWayDecksFlag(): boolean {
  const g = globalThis as { __canalRecallDryWayDecks?: boolean; location?: { search?: string } };
  if (typeof g.__canalRecallDryWayDecks === 'boolean') return g.__canalRecallDryWayDecks;
  return /[?&]dryWayDecks=(1|true|on)\b/.test(g.location?.search ?? '');
}
/** BGT open ground (open-ground-v1, groundSurface.ts; lane open-ground-look 2026-11-10): on by default; `?openGround=0` or `window.__canalRecallOpenGround = false` draws it as the land again (the before). */
export function openGroundFlag(): boolean {
  const g = globalThis as { __canalRecallOpenGround?: boolean; location?: { search?: string } };
  if (typeof g.__canalRecallOpenGround === 'boolean') return g.__canalRecallOpenGround;
  return !/[?&]openGround=(0|false|off)\b/.test(g.location?.search ?? '');
}
/** Road surfaces carried across bridges (deckCarry.ts, lane R5-C1 issue #262): on by default; `?bridgeCarry=0` or `window.__canalRecallBridgeCarry = false` builds as before. */
function bridgeCarryFlag(): boolean {
  const g = globalThis as { __canalRecallBridgeCarry?: boolean; location?: { search?: string } };
  if (typeof g.__canalRecallBridgeCarry === 'boolean') return g.__canalRecallBridgeCarry;
  return !/[?&]bridgeCarry=(0|false|off)\b/.test(g.location?.search ?? '');
}
/** One red owner per junction mouth and the red on its own plane (lane R5-C1 issue #262): on by default; `?redDedupe=0` or `window.__canalRecallRedDedupe = false` restores. */
export function redDedupeFlag(): boolean {
  const g = globalThis as { __canalRecallRedDedupe?: boolean; location?: { search?: string } };
  if (typeof g.__canalRecallRedDedupe === 'boolean') return g.__canalRecallRedDedupe;
  return !/[?&]redDedupe=(0|false|off)\b/.test(g.location?.search ?? '');
}
/** Ground triangles clipped at the tunnel walls (tunnels.ts clipMeshAtCuts, R5-C2 #263): on by default; `?portalClip=0` or `window.__canalRecallPortalClip = false` restores the drape across the wall line. */
function portalClipFlag(): boolean {
  const g = globalThis as { __canalRecallPortalClip?: boolean; location?: { search?: string } };
  if (typeof g.__canalRecallPortalClip === 'boolean') return g.__canalRecallPortalClip;
  return !/[?&]portalClip=(0|false|off)\b/.test(g.location?.search ?? '');
}
/** The portal clip across a tunnel mouth's end line and along the walls up to it (tunnels.ts PortalClipOptions.ends, #269): on by default; `?portalEnds=0` or `window.__canalRecallPortalEnds = false` restores R5-C2's clip. */
function portalEndsFlag(): boolean {
  const g = globalThis as { __canalRecallPortalEnds?: boolean; location?: { search?: string } };
  if (typeof g.__canalRecallPortalEnds === 'boolean') return g.__canalRecallPortalEnds;
  return !/[?&]portalEnds=(0|false|off)\b/.test(g.location?.search ?? '');
}
/** The water tests on the banded edge index (groundStore.ts bandedWaterTest, exact; lane R5-A #260 step 4): on by default; `?groundPlanShare=0` or `window.__canalRecallGroundPlanShare = false` restores the plain test. */
export function groundPlanShareFlag(): boolean {
  const g = globalThis as { __canalRecallGroundPlanShare?: boolean; location?: { search?: string } };
  if (typeof g.__canalRecallGroundPlanShare === 'boolean') return g.__canalRecallGroundPlanShare;
  return !/[?&]groundPlanShare=(0|false|off)\b/.test(g.location?.search ?? '');
}
/** Ground determinism (groundStore.ts `deterministic`, #260 follow-up): a cell's mesh does not depend on which cells its store prepared first; on by default; `?groundDeterministic=0` or `window.__canalRecallGroundDeterministic = false` restores first-arrival planning. */
export function groundDeterministicFlag(): boolean {
  const g = globalThis as { __canalRecallGroundDeterministic?: boolean; location?: { search?: string } };
  if (typeof g.__canalRecallGroundDeterministic === 'boolean') return g.__canalRecallGroundDeterministic;
  return !/[?&]groundDeterministic=(0|false|off)\b/.test(g.location?.search ?? '');
}
/** A long same-side wall gap in a tunnel ramp bridged where the bank carries on (tunnels.ts bridgeBankGaps, #270): on by default; `?rampGaps=0` or `window.__canalRecallRampGaps = false` restores the split ramp. */
function rampGapsFlag(): boolean {
  const g = globalThis as { __canalRecallRampGaps?: boolean; location?: { search?: string } };
  if (typeof g.__canalRecallRampGaps === 'boolean') return g.__canalRecallRampGaps;
  return !/[?&]rampGaps=(0|false|off)\b/.test(g.location?.search ?? '');
}
/** roads-v1 cells with the junction slivers merged (roadSlivers.ts, cell version 3, R5-C2 #263): on by default where the manifest publishes them; `?roadSlivers=0` or `window.__canalRecallRoadSlivers = false` reads the version-2 cells. */
function roadSliversFlag(): boolean {
  const g = globalThis as { __canalRecallRoadSlivers?: boolean; location?: { search?: string } };
  if (typeof g.__canalRecallRoadSlivers === 'boolean') return g.__canalRecallRoadSlivers;
  return !/[?&]roadSlivers=(0|false|off)\b/.test(g.location?.search ?? '');
}
/** Road surfaces across bridges without gaps (issue #178): on by default; `?bridgeGaps=0` or `window.__canalRecallBridgeGaps = false` builds the decks as before (the A/B). */
function bridgeGapsFlag(): boolean {
  const g = globalThis as { __canalRecallBridgeGaps?: boolean; location?: { search?: string } };
  if (typeof g.__canalRecallBridgeGaps === 'boolean') return g.__canalRecallBridgeGaps;
  return !/[?&]bridgeGaps=(0|false|off)\b/.test(g.location?.search ?? '');
}

/** The roads flag from the page: the BGT road surfaces are on by default since 2026-10-16 (user: "if BGT is the fix,
 *  then make it the default"); `?roads=0` or `window.__canalRecallRoads = false` draws the OSM bands. Cells without
 *  the roads-v1 extract keep the bands either way. */
function roadsFlag(): boolean {
  const g = globalThis as { __canalRecallRoads?: boolean; location?: { search?: string } };
  if (typeof g.__canalRecallRoads === 'boolean') return g.__canalRecallRoads;
  return !/[?&]roads=(0|false|off|bands)\b/.test(g.location?.search ?? '');
}

/**
 * Compact ground meshes (compactMesh.ts), on every device: desktop at the 22 road spots holds the same cells in half
 * the ground bytes (3,257 → 1,628 MB summed over 18 like-for-like spots) at the same frame time. `window.__canalRecallCompactGround = false` draws the float arrays (A/B).
 */
function compactFlag(): boolean {
  const g = globalThis as { __canalRecallCompactGround?: boolean };
  return g.__canalRecallCompactGround !== false;
}

/** The rails flag from the page: `?rails=0` or `window.__canalRecallRails = false` turns the railway tracks off. */
function railsFlag(): boolean {
  const g = globalThis as { __canalRecallRails?: boolean; location?: { search?: string } };
  if (g.__canalRecallRails === false) return false;
  return !/[?&]rails=0\b/.test(g.location?.search ?? '');
}

/**
 * The road look under review (lane road-look-continuity 2026-10-29, round 2): `?roadLook=A|B|C` (or
 * `window.__canalRecallRoadLook`) draws groundLook ROAD_LOOK_OPTIONS' tones, so the user can pick on the strip.
 * The user picked B on 2026-10-30 (issue #108), so B is the default; `?roadLook=round1` draws round 1's palette
 * (null) for before/after strips.
 */
export const ROAD_LOOK_DEFAULT: RoadLookId = 'B';
function roadLookFlag(): RoadLookId | null {
  const g = globalThis as { __canalRecallRoadLook?: string; location?: { search?: string } };
  const asked = g.__canalRecallRoadLook ?? (g.location?.search ? new URLSearchParams(g.location.search).get('roadLook') : null);
  if (asked === 'round1') return null;
  return isRoadLookId(asked) ? asked : ROAD_LOOK_DEFAULT;
}

/** The parks flag from the page: `?parks=0` or `window.__canalRecallParks = false` turns parks off. */
function parksFlag(): boolean {
  const g = globalThis as { __canalRecallParks?: boolean; location?: { search?: string } };
  if (g.__canalRecallParks === false) return false;
  return !/[?&]parks=0\b/.test(g.location?.search ?? '');
}

/**
 * The far cells' detail level on this device (CANAL-RECALL-7). A touch device (iPad, phone: `pointer: coarse`, the
 * test the page itself uses for the phone pixel ratio and the 400 m ground ring) builds the cells away from the rider
 * at `touch` detail; a desktop builds every cell at `full`, unchanged. `?groundDetail=full|touch` (or
 * `window.__canalRecallGroundDetail` before load) overrides it, so one machine can show both paths.
 */
function detailFlag(): CellDetail {
  const g = globalThis as { __canalRecallGroundDetail?: string; matchMedia?: (query: string) => { matches: boolean }; location?: { search?: string } };
  const asked = g.__canalRecallGroundDetail ?? (g.location?.search ? new URLSearchParams(g.location.search).get('groundDetail') : null);
  if (asked === 'full' || asked === 'touch') return asked;
  return g.matchMedia?.('(pointer: coarse)')?.matches ? 'touch' : 'full';
}

/**
 * Which cells a `touch` device still builds at `full` detail: `block` = the cell the rider is in and its 8
 * neighbours; `cell` = the rider's own cell only; `all` = none (every cell at the coarse level, a measurement value:
 * the floor a touch device can reach). `?groundNear=cell|all` (or `window.__canalRecallGroundNear`) is the A/B: on a
 * touch ride the resident ring is 400–800 m (six 1 km cells at the Westerkerk, all of them inside the block), so
 * `block` gives the far level nothing to build and `cell` is the one that measures the coarser city.
 */
function groundNearFlag(): 'block' | 'cell' | 'all' {
  const g = globalThis as { __canalRecallGroundNear?: string; location?: { search?: string } };
  const asked = g.__canalRecallGroundNear ?? (g.location?.search ? new URLSearchParams(g.location.search).get('groundNear') : null);
  // Default `cell` (2026-10-28): the 800 m touch ring fits inside the 3×3 block, so `block` coarsened nothing; the
  // rider's own cell at full detail looked identical at the Westerkerk and cut own-ground 18 % (CANAL-RECALL-7).
  return asked === 'block' || asked === 'all' ? asked : 'cell';
}

type LngLat = [number, number];

/** `fade`: a cell that just arrived dissolves in over FADE_MS (screen-door dither on per-cell material clones); the clones go when it ends. */
interface Fade { start: number; uniform: { value: number }; meshes: { mesh: any; original: any; clone: any }[] }
/** A far block on screen: one mesh per 1 km part, keyed by the streamed cell it stands in for. */
interface FarResident { key: string; group: any; parts: Map<string, any>; triangles: number; bytes: number }
interface Resident { key: string; lod: 0 | 1; detail: CellDetail; group: any; materials: any[]; textures: any[]; triangles: number; bytes: number; maskInfo: { x0: number; y0: number; res: number } | null; fade?: Fade }

const RADIUS_M = 1400;
/** Cell tiles per side (OwnGroundOptions.tiles), and the smallest layer worth cutting (fewer draw calls for the rest). */
const CELL_TILES = 3;
const TILE_MIN_TRIANGLES = 4000;
const AERIAL_RADIUS_M = 2000;
/** A cell arriving in the ring (not an LOD swap of a resident one) dissolves in over this long. */
export const FADE_MS = 400;
const NEAR_M = 350;
const RESIDENCY_STEP_M = 60;

/** Which mask channel cuts a layer: R = water (land, parks), G = water minus decks (street bands). */
const CUT: Partial<Record<GroundLayer, 'r' | 'g'>> = {
  land: 'r', park: 'r', garden: 'r', wood: 'r', square: 'r', parking: 'r',
  lawn: 'r', bed: 'r', shrub: 'r', bark: 'r', sand: 'r', parkGravel: 'r', parkPath: 'r', pond: 'r', bare: 'r',
  asphalt: 'g', klinker: 'g', brick: 'g', cycle: 'g', paving: 'g', gravel: 'g', kerb: 'g', paint: 'g', tram: 'g', bollard: 'g',
};
/** Polygon-offset rank of coplanar ground layers (later wins), as the prototype. */
/** Materials that are objects on the ground, not the ground: lit by the rig as is (no FLAT_GROUND_GAIN). */
const UNGAINED = new Set(['hedge', 'furniture', 'bollard', 'tram', 'track']);
const OFFSET: Partial<Record<GroundLayer, number>> = { deckTop: 1, park: 1, wood: 1, square: 1, parking: 1, ...PARK_RANK, klinker: 2, brick: 2, asphalt: 2, gravel: 3, cycle: 3, paving: 3, paint: 4, tram: 5 };
/** redDedupe (lane R5-C1, issue #262): the red on its own plane, two offset steps over the asphalt (paint and rails above it); `?redDedupe=0` keeps OFFSET. */
export const RED_OFFSET: Partial<Record<GroundLayer, number>> = { ...OFFSET, cycle: 4, paint: 5, tram: 6 };

/** three's `onUpload` callback (`this` is the attribute): drop the CPU copy. */
function releaseArray(this: { array: unknown }): void { this.array = null; }

/** A cell's level as one value: the LOD and the detail it was (or should be) built at. */
const levelOf = (lod: 0 | 1, detail: CellDetail): string => `${lod}:${detail}`;

export class OwnGround {
  readonly root: any;
  store: GroundStore;
  enabled = true;
  ready = false;
  /** Bumped whenever more relief/decks are resident on the main thread (consumers re-query bases). */
  surfaceRevision = 0;
  private readonly THREE: any;
  private readonly frame: any;
  private readonly host: GroundHost;
  private readonly opts: Required<OwnGroundOptions>;
  private worker: Worker | null = null;
  /** Every ground worker (`worker` is the first; far blocks go there). Lane R5-A #260. */
  private workers: Worker[] = [];
  /** Lane R5-A #260 step 3: the share host (groundShare.ts), with more than one worker and `?groundShare` on. */
  private shareHost: Worker | null = null;
  private readonly lodAffinityOn = groundAffinityLodFlag();
  private readonly blockFirstOn = groundBlockFirstFlag();
  /** The worker each requested cell was sent to (groundWorkers.ts pickWorker). */
  private readonly workerOf = new Map<string, number>();
  /** Pull dispatch (groundWorkers.ts nextDispatch, `?groundPull=0` off): the cells each worker holds, the best-first order, what to ask per cell. */
  private readonly pullOn = groundPullFlag();
  private held: Set<string>[] = [];
  private readonly sentTo = new Map<string, number>();
  private wantedOrder: string[] = [];
  private readonly asks = new Map<string, { lod: 0 | 1; detail: CellDetail }>();
  /** `?groundQueuedInstall=0` off: a built cell waiting to install counts as asked (gameGround updateResidency). */
  private readonly queuedInstallOn = (() => { try { return new URLSearchParams((globalThis as { location?: { search?: string } }).location?.search ?? '').get('groundQueuedInstall') !== '0'; } catch { return true; } })();
  /** Affinity (groundWorkers.ts sharedNeighbours, `?groundAffinity=0` off): the cells whose data each worker has loaded. */
  private readonly affinityOn = groundAffinityFlag();
  private loadedBy: Set<string>[] = [];
  private workerReady = false;
  private readonly base: Record<string, any> = {};
  private readonly resident = new Map<string, Resident>();
  /** The keys `wantedCells` gave at the last residency update (coversRider). */
  private wantedKeys: ReadonlySet<string> = new Set();
  /** Keys of resident cells still dissolving in (empty when idle: no per-frame work). */
  private readonly fading = new Set<string>();
  /** Cell key → the level asked for (`levelOf`: LOD and detail) while its build is in flight. */
  private readonly pending = new Map<string, string>();
  private readonly installQueue: BuiltCell[] = [];
  private readonly prepared = new Set<string>();
  private readonly preparing = new Set<string>();
  private gen = 0;
  private centre: Vec2 | null = null;
  /** The view's look-at (local metres) and its cell: that cell and its neighbours build first (groundWorkers.ts). */
  private focus: Vec2 | null = null;
  private focusCell: string | null = null;
  private readonly focusOn = groundFocusFlag();
  /** Follow the camera's pose until the game's first update, asking this many cells (groundPrefetch.ts, `?groundPrefetch=0` off). */
  private readonly prefetchCells = groundPrefetchFlag();
  private gameUpdated = false;
  private prefetchTimer: ReturnType<typeof setInterval> | null = null;
  private prefetchKey: string | null = null;
  /** Quick first paint (opt-in `?groundQuick=1`) and the LOD the ring wants per cell (a quick install re-plans). */
  private readonly quickOn = groundQuickFlag();
  private wantedLod: ReadonlyMap<string, 0 | 1> = new Map();
  /** Meshes under the rider's distance limit (REACH_LAYERS of LOD 0 full-detail cells), by cell key. */
  private readonly reachMeshes = new Map<string, any[]>();
  private readonly reachM = groundReachFlag();
  private residencyAt: Vec2 | null = null;
  private zoom = 0;
  /** Current resident radius: `opts.radiusM`, grown from the air. */
  private radiusM = RADIUS_M;
  private unregister: (() => void) | null = null;
  private basemapHidden = false;
  /** clip ← local of the last main pass (for lifting canvas overlays onto the surface). */
  private clipFromLocal: Float64Array | null = null;
  private overlays: { route: any; casing: any; highlight: any; destination: any } = { route: null, casing: null, highlight: null, destination: null };
  private routeLine: Vec2[] | null = null;
  private highlightLines: Vec2[][] | null = null;
  private destination: Vec2 | null = null;
  private overlayRevision = -1;
  private overlayDirty = true;
  /** When each pending build was asked for (cell load latency: request → installed). */
  private readonly requestedAt = new Map<string, number>();
  /** The last build's stats per cell key (cost per park cell: triangles per layer, build ms). */
  private readonly cellBuilds = new Map<string, BuiltCell['stats'] & { lod: 0 | 1; detail: CellDetail; railFetch?: string }>();
  /** The worker store's rail manifest size (its `ready` message): main and worker each load cells.json. */
  private workerRailCells: number | null = null;
  /** Builds the main thread asked for and then threw away (install no longer wanted, a stale reply), by reason (#232). */
  private readonly discards = { install: 0, stale: 0, unwanted: 0, error: 0, requeued: 0 };
  /** `?groundRequeue=0` off (groundResidency.ts): a discarded install or a failed build asks again on the next frame. */
  private readonly requeueOn = groundRequeueFlag();
  /** `?railRetry=0` off (groundResidency.ts): rail fetches retried, the worker handed this store's rail manifest. */
  private readonly railRetryOn = railRetryFlag();
  private readonly retries = new BuildRetries();
  /** Far ring radius now (0: the resident ring reaches what the camera sees). */
  private farRadius = 0;
  private farHorizon: boolean | undefined;
  /** The far ring's radius now, metres (0: off at this view); the far building tier follows it (engine/farShells.ts). */
  get farRadiusM(): number { return this.farRadius; }
  /** A `view` ring's extra reach ahead of the moving rider, metres (residency.ts touchAheadMarginM). */
  private aheadM = 0;
  private readonly far = new Map<string, FarResident>();
  private readonly farPending = new Set<string>();
  /** Far blocks with nothing to draw (outside the extracts). */
  private readonly farEmpty = new Set<string>();
  private readonly farStats = { built: 0, buildMs: [] as number[] };
  /** The overview → city blend (transition on): drawn while `blend.active`, dithered by `blendUniform`. */
  readonly blend = new OverviewBlend();
  private readonly blendUniform = { value: 1 };
  private readonly presenceUniform = { value: 1 };
  /**
   * The ground's start, page-clock ms (lane R5-A #260): `load` called, the main-thread store's indexes in, the worker's
   * init posted, the worker ready (and its own init ms), the first cell installed. `cells`: each install's split
   * (worker queue wait / data in / build / tiles, the main thread's request → install latency and install ms), last 200.
   */
  readonly startup: { /** Ground workers created; each one's ready time (page ms). */ workers?: number; workerReady?: number[]; /** The hold's first camera-pose residency (groundPrefetch.ts) and its cell. */ prefetchAt?: number; prefetchKey?: string; loadAt?: number; storeReadyAt?: number; workerPostedAt?: number; workerReadyAt?: number; workerInitMs?: number; firstInstallAt?: number; cells: Record<string, unknown>[] } = { cells: [] };
  readonly stats = { cellsBuilt: 0, buildMs: [] as number[], installMs: [] as number[], latencyMs: [] as number[], errors: [] as string[], lastBuild: null as null | Record<string, unknown> };

  constructor(THREE: any, frame: any, host: GroundHost, options: OwnGroundOptions) {
    this.THREE = THREE;
    this.frame = frame;
    this.host = host;
    this.opts = { radiusM: RADIUS_M, aerialRadiusM: AERIAL_RADIUS_M, fadeMs: FADE_MS, nearM: NEAR_M, minZoom: 15, parks: parksFlag(), rails: railsFlag(), roads: roadsFlag(), groundLook: GROUND_LOOK_DEFAULT, transition: transitionOn(), far: true, releaseArrays: false, detail: detailFlag(), groundNear: groundNearFlag(), ring: groundRingFlag(), tiles: groundTilesFlag(), nearTiles: groundNearTilesFlag(), precompilePerFrame: precompileBudget(), workers: 0, ...options, tilesOnly: options.tilesOnly ?? !!options.releaseArrays };
    this.radiusM = this.opts.radiusM;
    this.root = new THREE.Group();
    this.root.name = 'own-ground';
    this.store = new GroundStore(httpFetchBytes(''));
    this.makeMaterials();
  }

  // ------------------------------------------------------------------ lifecycle

  /** Load the extract indexes (absolute extract root URL) and start the worker. */
  async load(root: string): Promise<void> {
    this.dispose(false);
    this.startup.loadAt ??= performance.now();
    this.store = new GroundStore(httpFetchBytes(root), { parks: this.opts.parks, rails: this.opts.rails, roads: this.opts.roads, reliefTile: this.reliefLoader(root), prepareOnly: true, ...(groundPlanShareFlag() ? {} : { planShare: false }), ...(groundDeterministicFlag() ? {} : { deterministic: false }), ...(this.railRetryOn ? {} : { railRetry: false }), ...(bridgeGapsFlag() ? {} : { bridgeGaps: false }), ...(dryWayDecksFlag() ? { dryWayDecks: true } : {}), ...(roadSliversFlag() ? {} : { roadSlivers: false }), ...(portalEndsFlag() ? {} : { portalEnds: false }), ...(rampGapsFlag() ? {} : { rampGaps: false }), ...groundFixOptions(groundFixFlags()) });
    this.ready = false;
    if (!/\/amsterdam\/?$/.test(root)) return;
    await this.store.init();
    this.startup.storeReadyAt ??= performance.now();
    try {
      const count = groundWorkersFlag(this.opts.workers || defaultGroundWorkers(this.opts.detail));
      const init = { type: 'init', root, planShare: groundPlanShareFlag(), deterministic: groundDeterministicFlag(), parks: this.opts.parks, rails: this.opts.rails, railRetry: this.railRetryOn, ...(this.railRetryOn && this.opts.rails ? { railManifest: [...this.store.railCells] } : {}), farRails: farRailFlag(), farRailDrape: farRailDrapeFlag(), roads: this.opts.roads, bridgeGaps: bridgeGapsFlag(), dryWayDecks: dryWayDecksFlag(), bridgeCarry: bridgeCarryFlag(), redDedupe: redDedupeFlag(), portalClip: portalClipFlag(), portalEnds: portalEndsFlag(), rampGaps: rampGapsFlag(), groundFixes: groundFixFlags(), roadSlivers: roadSliversFlag(), openGround: openGroundFlag(), groundLook: this.opts.groundLook, compact: compactFlag(), detail: this.opts.detail, roadLook: roadLookFlag(), tiles: this.opts.tiles, nearTiles: this.opts.nearTiles, tileMin: TILE_MIN_TRIANGLES };
      // One fetch + gunzip per file for every worker (groundShare.ts): a channel per worker to one more instance of the bundle.
      const channels = count > 1 && groundShareFlag() ? Array.from({ length: count }, () => new MessageChannel()) : [];
      if (channels.length) {
        this.shareHost = new Worker(this.opts.workerUrl);
        this.shareHost.onerror = event => { this.stats.errors.push(`share host: ${event.message}`); };
        const ports = channels.map(c => c.port2);
        this.shareHost.postMessage({ type: 'share-host', root, ports, capMB: groundShareMB() }, ports);
      }
      for (let i = 0; i < count; i++) {
        const worker = new Worker(this.opts.workerUrl);
        const wi = i;
        worker.onmessage = event => this.onWorker(event.data, wi);
        worker.onerror = event => { this.stats.errors.push(`worker: ${event.message}`); };
        // Compact meshes: the same geometry in ~half the bytes (compactMesh.ts).
        const sharePort = channels[i]?.port1;
        if (sharePort) worker.postMessage({ ...init, index: i, pageOrigin: performance.timeOrigin, sharePort }, [sharePort]);
        else worker.postMessage({ ...init, index: i, pageOrigin: performance.timeOrigin });
        this.workers.push(worker);
        this.held.push(new Set());
        this.loadedBy.push(new Set());
      }
      this.worker = this.workers[0] ?? null;
      this.startup.workerPostedAt ??= performance.now();
      this.startup.workers ??= count;
    } catch (error) {
      this.stats.errors.push(`worker unavailable: ${String(error)}`);
    }
    if (!this.unregister) {
      this.unregister = this.frame.register('own-ground', groundParticipant(this.root, {
        visible: (zoom: number) => this.beforeRender(zoom),
        onMainPass: (clip: Float64Array) => { this.clipFromLocal = clip; },
        onContextRestored: () => this.contextRestored(),
      }), { order: GROUND_ORDER });
    }
    this.ready = true;
    this.residencyAt = null;
    if (this.centre) this.updateResidency();
  }

  /**
   * Relief tiles for the main-thread surface (poses, building bases, overlays) are fetched and decoded in the page's
   * worker pool (engine/workerPool.ts, ownGround/reliefDecode.ts), not on the main thread and no longer in a second
   * own-ground worker. Falls back to the main thread without a pool.
   */
  private relief: { loader: ReliefTileLoader; dispose: () => void } | null = null;
  private reliefLoader(root: string): ReliefTileLoader | undefined {
    if (typeof Worker === 'undefined') return undefined;
    this.relief?.dispose();
    this.relief = poolReliefLoader(sharedWorkerPool(POOL_WORKER_URL), root);
    const relief = this.relief;
    if (!relief) return undefined;
    // A pool worker that dies mid-tile: that tile decodes here instead.
    return (path, index, entry) => relief.loader(path, index, entry)
      .catch(() => httpFetchBytes(root)(path).then(bytes => ({ heights: readGroundTile(index, entry, bytes), bytes: bytes.byteLength })));
  }

  dispose(full = true): void {
    for (const key of [...this.resident.keys()]) this.drop(key);
    for (const key of [...this.far.keys()]) this.dropFar(key);
    this.farPending.clear();
    this.farEmpty.clear();
    this.pending.clear();
    this.installQueue.length = 0;
    this.prepared.clear();
    for (const worker of this.workers) worker.terminate();
    this.workers = [];
    this.shareHost?.terminate();
    this.shareHost = null;
    this.workerOf.clear();
    this.held = [];
    this.loadedBy = [];
    this.sentTo.clear();
    this.asks.clear();
    this.wantedOrder = [];
    this.worker = null;
    this.relief?.dispose();
    this.relief = null;
    this.workerReady = false;
    this.stopPrefetch();
    this.gen++;
    if (full) { this.unregister?.(); this.unregister = null; this.setBasemapHidden(false); this.precompiled = false; this.precompileQueue = null; }
  }

  /**
   * A new renderer after a WebGL context loss. With `releaseArrays` (phones) the installed cells and far blocks
   * have no CPU copy to upload again: drop them and let residency ask the worker for them anew. Builds still in
   * flight or queued keep their arrays and install as usual. Otherwise three re-uploads what is resident.
   */
  private contextRestored(): void {
    this.precompiled = false;
    if (!this.opts.releaseArrays) { this.host.repaint(); return; }
    for (const key of [...this.resident.keys()]) this.drop(key);
    for (const key of [...this.far.keys()]) this.dropFar(key);
    this.residencyAt = null;
    if (this.centre && this.ready) this.updateResidency();
    this.host.repaint();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.setBasemapHidden(false);
    this.host.repaint();
  }

  /** The rider's position (lng/lat) and the map zoom; call once per camera sync. */
  update(lngLat: LngLat, zoom: number, pitchDeg = 60, focus?: LngLat | null): void {
    // The first game update plans the whole ring (the hold asked only the first few, groundPrefetch.ts).
    if (!this.gameUpdated) { this.gameUpdated = true; this.stopPrefetch(); this.residencyAt = null; }
    this.place(lngLat, zoom, pitchDeg, focus);
  }

  /**
   * Until the game's first update, follow the camera's pose (groundPrefetch.ts): the workers are ready ~2 s before the
   * ride is revealed and the camera already sits at the start pose, so the start neighbourhood builds during the hold.
   */
  private startPrefetch(): void {
    if (!this.prefetchCells || this.gameUpdated || this.prefetchTimer || typeof this.host.startView !== 'function') return;
    const until = performance.now() + PREFETCH_MAX_MS;
    this.prefetchTimer = setInterval(() => {
      if (this.gameUpdated || performance.now() > until) { this.stopPrefetch(); return; }
      if (!this.ready) return;
      let view: StartView | null = null;
      try { view = this.host.startView?.() ?? null; } catch { view = null; }
      const local = view ? toLocal(view.lngLat[0], view.lngLat[1]) : null;
      const key = local && Number.isFinite(local[0]) && Number.isFinite(local[1]) ? this.store.cellAt(local[0], local[1]) : null;
      const step = prefetchStep(view, key, this.prefetchKey, this.opts.minZoom);
      this.prefetchKey = step.nextKey;
      if (!step.use || !view) return;
      this.startup.prefetchAt ??= performance.now();
      this.startup.prefetchKey ??= key ?? undefined;
      this.place(view.lngLat, view.zoom, view.pitch, view.lngLat);
    }, PREFETCH_POLL_MS);
  }

  private stopPrefetch(): void {
    if (this.prefetchTimer) clearInterval(this.prefetchTimer);
    this.prefetchTimer = null;
  }

  private place(lngLat: LngLat, zoom: number, pitchDeg = 60, focus?: LngLat | null): void {
    this.zoom = zoom;
    this.centre = toLocal(lngLat[0], lngLat[1]);
    if (this.focusOn && focus && this.ready) {
      this.focus = toLocal(focus[0], focus[1]);
      const cell = this.store.cellAt(this.focus[0], this.focus[1]);
      if (cell !== this.focusCell) { this.focusCell = cell; this.residencyAt = null; }
    }
    if (this.lookAheadOn ??= lookAheadEnabled()) this.motion.update(lngLat[0], lngLat[1], performance.now());
    let reach: number, radius: number;
    if (this.opts.ring === 'view') {
      const [w, h] = viewportPx();
      reach = viewCornerReachM(zoom, pitchDeg, lngLat[1], w, h);
      radius = touchResidentRadius(reach, this.opts.radiusM, this.opts.aerialRadiusM);
      // The ahead margin follows the speed in steps, so a steady ride does not re-plan every frame.
      const ahead = this.lookAheadOn ? Math.round(touchAheadMarginM(this.motion.speed) / 50) * 50 : 0;
      if (ahead !== this.aheadM) { this.aheadM = ahead; this.residencyAt = null; }
    } else {
      reach = viewReachM(zoom, pitchDeg, lngLat[1]);
      radius = residentRadius(reach, this.opts.radiusM, this.opts.aerialRadiusM);
    }
    if (radius !== this.radiusM) { this.radiusM = radius; this.residencyAt = null; }
    // The far ring follows the horizon (farRing.ts farReachM, lane R2-B #229): a pitched view that shows it asks for the ring.
    let far = this.opts.far ? farRadiusM((this.farHorizon ??= farHorizonEnabled()) ? horizonReachM(reach, zoom, pitchDeg, lngLat[1]) : reach, radius) : 0;
    // `?drawLimit` (engine/drawLimit.ts, lane P2 #325): nothing past the opaque haze is built (the far shells follow).
    const limit = currentDrawLimit();
    if (far && limit) far = Math.max(radius, clampToDrawLimit(far, limit, limit.eyeToCentreM, FAR_STEP_M));
    if (far !== this.farRadius) { this.farRadius = far; this.residencyAt = null; }
    if (!this.ready) return;
    if (this.requeueOn && this.retries.size && this.retries.due(performance.now())) this.residencyAt = null;
    if (!this.residencyAt || Math.hypot(this.centre[0] - this.residencyAt[0], this.centre[1] - this.residencyAt[1]) >= RESIDENCY_STEP_M) this.updateResidency();
  }

  private visibleAtZoom(zoom: number): boolean {
    if (!this.enabled || !this.ready) return false;
    return this.opts.transition ? this.blend.active : zoom >= this.opts.minZoom;
  }

  /** Per frame, from the shared frame's main pass. */
  private beforeRender(zoom: number): boolean {
    this.zoom = zoom;
    // Not in the first moments after a covering card goes (sharedFrame.warmupDue, #109): the first draw compiles then.
    if (typeof this.frame?.warmupDue === 'function' && !this.frame.warmupDue()) { if (!this.precompiled || this.precompileQueue) this.host.repaint(); }
    else if (!this.precompiled) this.precompile();
    else if (this.precompileQueue) this.precompileStep();
    if (this.opts.transition) {
      this.blendUniform.value = this.blend.update(zoom);
      this.presenceUniform.value = presenceOf(this.blendUniform.value);
      this.setGroundTransparent(this.presenceUniform.value < 1);
    }
    const visible = this.visibleAtZoom(zoom);
    // One cell per frame: geometry upload is the cost, not the build (that is in the worker).
    const next = this.installQueue.shift();
    if (next) { this.install(next); if (this.installQueue.length) this.host.repaint(); }
    this.tickFades();
    if (this.reachMeshes.size) {
      const c = this.centre, reach = c ? { x: c[0], y: c[1], r: this.reachM, h: 25 } : null;
      for (const meshes of this.reachMeshes.values()) for (const m of meshes) setTileReach(m, reach);
    }
    if (visible && (this.overlayDirty || this.overlayRevision !== this.surfaceRevision)) this.rebuildOverlays();
    this.setBasemapHidden(visible && this.coversRider());
    return visible && this.resident.size > 0;
  }

  /**
   * The route, highlight and destination are drawn draped on the ground this frame. The game's flat canvas
   * lines (projected at z = 0, a frame behind the map) must not draw then: they read as a second, drifting line.
   */
  drapesOverlays(): boolean { return this.visibleAtZoom(this.zoom) && this.resident.size > 0 && this.coversRider(); }

  /**
   * Every ground cell under the local rect is resident and fully dissolved in, so whatever flat layer lies beneath
   * (the engine overview, engine/overviewLayer.ts) cannot show there. Sampled every 250 m (cells are ~1 km). False
   * while the ground is hidden at this zoom or a cell has no data.
   */
  /** Cells asked for and not yet installed; 0 when the ground has caught up with the view or is not drawn at this zoom. */
  get loadingCells(): number {
    // The hold's prefetch (groundPrefetch.ts) is not loading the game waits on: before the game's first update nothing
    // was asked, and settle.ts's ownGround check then held the loading screen for the prefetched cells (the reveal came
    // 1.7 s later, 3 of 3 runs, 2026-11-08).
    if (!this.gameUpdated && this.prefetchCells) return 0;
    return this.visibleAtZoom(this.zoom) ? this.pending.size + this.installQueue.length : 0;
  }

  coversRect(x0: number, y0: number, x1: number, y1: number): boolean {
    if (!this.ready || !this.visibleAtZoom(this.zoom) || !this.resident.size) return false;
    // Dissolving in with the overview → city blend (presence < 1, a screen-door ground): what lies beneath still shows
    // through. Counting it as covered let the engine overview discard its flat fill under a ground that was 4 % drawn
    // (zoom 14.1 → 14.2: ΔE > 20 on 70 % of the view, mean luma −35; overview-transition.spec.ts under own).
    if (this.presenceUniform.value < 1) return false;
    const step = 250, nx = Math.max(1, Math.ceil((x1 - x0) / step)), ny = Math.max(1, Math.ceil((y1 - y0) / step));
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
      const key = this.store.cellAt(x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny);
      if (!this.resident.has(key) || this.fading.has(key)) return false;
    }
    return true;
  }

  /**
   * The rider's cell and those of its 8 neighbours the ring wants are drawn: the basemap's ground underneath is
   * redundant. With the 1400 m desktop ring that is all 8; the phone ring (a few hundred metres, the chase view's
   * reach) wants only the neighbours near the rider.
   */
  private coversRider(): boolean {
    if (!this.centre || !this.ready) return false;
    const key = this.store.cellAt(this.centre[0], this.centre[1]);
    return GroundStore.neighbours(key).every(k => this.resident.has(k) || !this.store.covers(k) || !this.wantedKeys.has(k)) && this.resident.has(key);
  }

  private setBasemapHidden(hidden: boolean): void {
    if (hidden === this.basemapHidden) return;
    this.basemapHidden = hidden;
    this.host.setBasemapGroundHidden(hidden);
  }

  // ------------------------------------------------------------------ residency

  private rectDistance(r: Rect, p: Vec2): number {
    const dx = Math.max(r[0] - p[0], 0, p[0] - r[2]), dy = Math.max(r[1] - p[1], 0, p[1] - r[3]);
    return Math.hypot(dx, dy);
  }

  /** The rider's motion (look-ahead), from the positions `update` is given. */
  private readonly motion = new MotionEstimate();
  private lookAheadOn: boolean | undefined;

  /**
   * Cells wanted now with their LOD and detail level, best first: nearest ahead of the rider (streamingLookAhead.ts
   * aheadRankXY on the cell's nearest point), so the cells the rider is riding into build before the ones it left
   * behind; nearest first while standing or with `?lookAhead=0`. The LOD still follows the plain distance. A `touch`
   * device wants the rider's cell and the cells beside it (the block, or only the rider's with `groundNear`) at `full`
   * detail, every other resident cell at `touch` (CANAL-RECALL-7): the ground around the rider stays exactly as it
   * looks on a desktop.
   */
  wantedCells(): { key: string; lod: 0 | 1; detail: CellDetail; d: number }[] {
    if (!this.centre || !this.ready) return [];
    const [x, y] = this.centre, R = this.radiusM, size = this.store.elevation.cellSizeM;
    const direction = this.lookAheadOn ? this.motion.direction : null;
    const out: { key: string; lod: 0 | 1; detail: CellDetail; d: number; rank: number }[] = [];
    const view = this.opts.ring === 'view', ahead = view && direction ? this.aheadM : 0;
    const span = Math.ceil((R + ahead) / size) + 1;
    const [cx, cy] = this.store.cellAt(x, y).split('_').map(Number);
    for (let dy = -span; dy <= span; dy++) for (let dx = -span; dx <= span; dx++) {
      const key = `${cx + dx}_${cy + dy}`;
      if (!this.store.covers(key)) continue;
      const rect = this.store.cellRect(key), d = this.rectDistance(rect, this.centre);
      const near: [number, number] = [Math.max(rect[0], Math.min(rect[2], x)), Math.max(rect[1], Math.min(rect[3], y))];
      if (view ? !inTouchRing(d, d > 1e-6 && direction ? ((near[0] - x) * direction[0] + (near[1] - y) * direction[1]) / d : 0, R, ahead) : d > R) continue;
      const own = dx === 0 && dy === 0, beside = Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
      const fine = this.opts.groundNear === 'all' ? false : own || (this.opts.groundNear === 'block' && beside);
      out.push({ key, lod: d <= this.opts.nearM ? 0 : 1, detail: this.opts.detail === 'touch' && !fine ? 'touch' : 'full', d, rank: this.focus && inFocusBlock(key, this.focusCell) ? FOCUS_RANK_BASE + this.rectDistance(rect, this.focus) : direction ? aheadRankXY(this.centre, near, direction) : d });
    }
    return out.sort((a, b) => a.rank - b.rank || a.d - b.d);
  }

  private updateResidency(): void {
    if (!this.centre) return;
    this.residencyAt = [this.centre[0], this.centre[1]];
    let wanted = this.wantedCells();
    // During the hold (groundPrefetch.ts) only the best-ranked few: the hold's own tiers load meanwhile.
    if (!this.gameUpdated && this.prefetchCells && wanted.length > this.prefetchCells) wanted = wanted.slice(0, this.prefetchCells);
    const keep = new Set(wanted.map(w => w.key));
    if (this.quickOn) this.wantedLod = new Map(wanted.map(w => [w.key, w.lod]));
    this.wantedKeys = keep;
    for (const key of [...this.resident.keys()]) if (!keep.has(key)) this.drop(key);
    for (const key of [...this.pending.keys()]) if (!keep.has(key)) { this.pending.delete(key); this.asks.delete(key); this.discards.unwanted++; this.retries.forget(key); }
    for (let i = this.installQueue.length - 1; i >= 0; i--) if (!keep.has(this.installQueue[i].key)) this.installQueue.splice(i, 1);
    for (const w of wanted) {
      // Main-thread surface for poses, bases and overlays: relief + decks of every wanted cell. Not during the hold
      // (groundPrefetch.ts): the page is still loading on this thread; the game's first update prepares them.
      if (this.gameUpdated || !this.prefetchCells) this.prepareMain(w.key);
      const have = this.resident.get(w.key);
      // Quick first paint (groundWorkers.ts groundQuickFlag): a near cell with nothing drawn yet is asked at LOD 1
      // first (~0.8 s against ~2–3 s for LOD 0); its install re-plans and the LOD 0 build follows.
      const lod = this.quickOn && w.lod === 0 && !have ? 1 : w.lod;
      const want = levelOf(lod, w.detail);
      if ((have && levelOf(have.lod, have.detail) === want) || this.pending.get(w.key) === want) continue;
      // Built and waiting its frame to install (no longer pending, not yet resident): not asked again (R5-A #260: the
      // hold's camera cell, arrived just as the game's first update re-planned, was built twice, 1.5 s of a worker).
      if (this.queuedInstallOn && this.installQueue.some(c => c.key === w.key && levelOf(c.lod, c.detail) === want)) continue;
      // A cell that becomes near again (or that the ring wants at another LOD) rebuilds through this same path: one
      // request, then the install swaps the whole cell, so two levels are never on screen together.
      // The worker already holding this cell's earlier request keeps it (its queue replaces the level); a new request
      // goes to the least busy worker (groundWorkers.ts).
      if (!this.pending.has(w.key)) this.workerOf.delete(w.key);
      this.pending.set(w.key, want);
      this.requestedAt.set(`${w.key}:${want}`, performance.now());
      // Pull: the cell waits here until a worker has room (dispatch below).
      if (this.pullOn) { this.asks.set(w.key, { lod, detail: w.detail }); continue; }
      const wi = pickWorker(w.key, this.workers.length, this.workerOf, this.pending.keys());
      this.workerOf.set(w.key, wi);
      this.workers[wi]?.postMessage({ type: 'build', key: w.key, lod, detail: w.detail, gen: this.gen });
    }
    if (this.pullOn) { this.wantedOrder = wanted.map(w => w.key); this.dispatch(); }
    // The worker builds its queue in this order and drops cells the rider has left (buildQueue.ts). Not with pull: a
    // worker holds at most PULL_DEPTH cells, and each one it holds must answer (a dropped job would hold its slot).
    else if (this.lookAheadOn) for (const worker of this.workers) worker.postMessage({ type: 'order', keys: wanted.map(w => w.key) });
    // Relief far behind is dropped on both sides (decks keep their placed heights).
    const keepM = this.radiusM + 2200;
    const evict = { type: 'evict', x: this.centre[0], y: this.centre[1], keepM, keep: [...keep].flatMap(k => GroundStore.neighbours(k)) };
    for (const worker of this.workers) worker.postMessage(evict);
    if (this.store.evictRelief(this.centre[0], this.centre[1], keepM)) {
      for (const key of [...this.prepared]) if (!keep.has(key)) this.prepared.delete(key);
    }
    const around = new Set([...keep].flatMap(k => GroundStore.neighbours(k)));
    this.store.forgetCells(around);
    // The workers forget the same cells (the evict message above).
    for (const loaded of this.loadedBy) for (const k of [...loaded]) if (!around.has(k)) loaded.delete(k);
    this.updateFar(keep);
  }

  /** Pull (groundWorkers.ts): hand the best-ranked waiting cells to the workers with room. */
  private dispatch(): void {
    if (!this.pullOn || !this.workers.length) return;
    const affinity = this.affinityOn ? (key: string, wi: number) => sharedNeighbours(key, this.loadedBy[wi]) : undefined;
    for (const [key, wi] of nextDispatch(this.wantedOrder, this.pending, this.sentTo, this.held.map(h => h.size), PULL_DEPTH, affinity ? AFFINITY_WINDOW : 1, affinity, this.lodAffinityOn ? key => dispatchTier(key, this.asks.get(key)?.lod, this.blockFirstOn ? this.focusCell : undefined) : undefined)) {
      const ask = this.asks.get(key);
      if (!ask) continue;
      this.asks.delete(key);
      for (const n of GroundStore.neighbours(key)) this.loadedBy[wi].add(n);
      this.held[wi].add(key);
      this.sentTo.set(key, wi);
      this.workerOf.set(key, wi);
      this.workers[wi].postMessage({ type: 'build', key, lod: ask.lod, detail: ask.detail, gen: this.gen });
    }
  }

  /** A worker answered for `key` (built, or failed): its slot is free. */
  private release(key: string | undefined, wi: number | undefined): void {
    if (!this.pullOn || key == null || wi == null) return;
    if (this.held[wi]?.delete(key) && this.sentTo.get(key) === wi) this.sentTo.delete(key);
  }

  /** Far blocks: ask for the ones the far radius reaches that the resident ring does not wholly draw; drop distant ones. */
  private updateFar(resident: ReadonlySet<string>): void {
    if (!this.centre) return;
    const cellRect = (k: string) => this.store.cellRect(k), centreCell = this.store.cellAt(this.centre[0], this.centre[1]), size = this.store.elevation.cellSizeM;
    const keepR = this.farRadius ? this.farRadius + FAR_KEEP_M : 0;
    const kept = new Set(farBlocksWithin(this.centre, centreCell, keepR, size, cellRect).map(b => b.key));
    for (const key of [...this.far.keys()]) if (!kept.has(key)) this.dropFar(key);
    for (const key of [...this.farPending]) if (!kept.has(key)) this.farPending.delete(key);
    for (const { key } of farBlocksWithin(this.centre, centreCell, this.farRadius, size, cellRect)) {
      if (this.far.has(key) || this.farPending.has(key) || this.farEmpty.has(key)) continue;
      const cells = farBlockCells(key).filter(k => this.store.covers(k));
      if (!cells.length) { this.farEmpty.add(key); continue; }
      if (cells.every(k => resident.has(k))) continue;
      this.farPending.add(key);
      this.worker?.postMessage({ type: 'far', key, gen: this.gen });
    }
  }

  private installFar(b: BuiltFar): void {
    const THREE = this.THREE, t0 = performance.now();
    this.dropFar(b.key);
    if (!this.base.far) { this.base.far = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }); this.base.far.color.multiplyScalar(FLAT_GROUND_GAIN); this.blendMaterial(this.base.far, 'vertex'); }
    const group = new THREE.Group(), parts = new Map<string, any>();
    group.name = `own-ground/far/${b.key}`;
    group.matrixAutoUpdate = false;
    for (const p of b.parts) {
      const mesh = new THREE.Mesh(this.geometry(p.mesh), this.base.far);
      mesh.name = `far/${p.key}`;
      mesh.matrixAutoUpdate = false;
      // Under the resident ring's ground (drawn first) and never in the shadow pass.
      mesh.renderOrder = -1;
      parts.set(p.key, mesh);
      group.add(mesh);
    }
    this.root.add(group);
    this.far.set(b.key, { key: b.key, group, parts, triangles: b.stats.triangles, bytes: b.stats.bytes });
    this.farStats.built++;
    this.farStats.buildMs.push(b.stats.buildMs);
    this.stats.installMs.push(performance.now() - t0);
    this.syncFar();
    this.host.repaint();
  }

  private dropFar(key: string): void {
    const f = this.far.get(key);
    if (!f) return;
    this.root.remove(f.group);
    for (const m of f.parts.values()) m.geometry.dispose();
    this.far.delete(key);
  }

  /**
   * Bumped on every residency change (a cell installed, dropped, or done dissolving: each ends in syncFar), so a
   * reader of coversRect (engine/overviewLayer.ts) knows when its answer may have changed.
   */
  coverRevision = 0;

  /** A far part hides once the resident ring draws its cell (after the cell's dissolve). */
  private syncFar(): void {
    this.coverRevision++;
    for (const f of this.far.values()) for (const [key, mesh] of f.parts) {
      const r = this.resident.get(key);
      mesh.visible = !r || !!r.fade;
    }
  }

  private prepareMain(key: string): void {
    if (this.prepared.has(key) || this.preparing.has(key)) return;
    this.preparing.add(key);
    this.store.prepareCell(key).then(() => {
      this.prepared.add(key);
      this.surfaceRevision++;
      this.host.repaint();
    }).catch(error => this.stats.errors.push(`prepare ${key}: ${String(error)}`)).finally(() => this.preparing.delete(key));
  }

  private onWorker(msg: any, wi?: number): void {
    if (this.pullOn && (msg.type === 'cell' || (msg.type === 'error' && msg.key))) {
      this.release(msg.type === 'cell' ? msg.cell?.key : msg.key, wi);
      // After this reply is handled (installed, failed or stale): the freed slot takes the next cell.
      queueMicrotask(() => this.dispatch());
    }
    if (msg.type === 'ready') { this.startup.workerReadyAt ??= performance.now(); (this.startup.workerReady ??= [])[msg.index ?? 0] = Math.round(performance.now()); this.startPrefetch(); if (typeof msg.initMs === 'number') this.startup.workerInitMs ??= msg.initMs; this.workerReady = true; this.workerRailCells = typeof msg.railCells === 'number' ? msg.railCells : null; return; }
    if (msg.type === 'error' && msg.far) { this.stats.errors.push(`far ${msg.far}: ${msg.message}`.slice(0, 400)); this.farPending.delete(msg.far); return; }
    if (msg.type === 'far') {
      if (msg.gen !== this.gen || !this.farPending.delete(msg.key)) return;
      if (msg.far) this.installFar(msg.far as BuiltFar); else this.farEmpty.add(msg.key);
      return;
    }
    if (msg.type === 'error') { this.stats.errors.push(`${msg.key ?? ''}: ${msg.message}`.slice(0, 400)); if (msg.key) { this.pending.delete(msg.key); this.discards.error++; if (this.requeueOn) this.retries.fail(msg.key, performance.now()); } return; }
    if (msg.type !== 'cell' || msg.gen !== this.gen) return;
    const cell = msg.cell as BuiltCell;
    if (this.pending.get(cell.key) !== levelOf(cell.lod, cell.detail)) { this.discards.stale++; return; }
    this.pending.delete(cell.key);
    this.retries.forget(cell.key);
    this.stats.cellsBuilt++;
    this.stats.buildMs.push(cell.stats.buildMs);
    this.stats.lastBuild = { key: cell.key, lod: cell.lod, detail: cell.detail, ...cell.stats };
    this.cellBuilds.set(cell.key, { ...cell.stats, lod: cell.lod, detail: cell.detail, ...(typeof msg.railFetch === 'string' ? { railFetch: msg.railFetch } : {}) });
    (cell as BuiltCell & { arrival?: unknown }).arrival = { at: performance.now(), ...(msg.timing && typeof msg.timing === 'object' ? msg.timing as object : {}) };
    this.installQueue.push(cell);
    this.host.repaint();
  }

  // ------------------------------------------------------------------ meshes

  private canvasTexture(size: number, metres: number, paint: (g: CanvasRenderingContext2D, s: number) => void): any {
    const THREE = this.THREE;
    const c = document.createElement('canvas'); c.width = c.height = size;
    paint(c.getContext('2d')!, size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    // Anisotropy from the one texture policy (look/texturePolicy.ts): 16 on desktop `high` (rails, kerbs and pavers at
    // the chase camera's grazing angle), 4 everywhere else and under `?texturePolicy=0`; three clamps it to the GPU's.
    t.anisotropy = pageTextureParams('ground', HIGH_ANISOTROPY).anisotropy; t.repeat.set(1 / metres, 1 / metres);
    return t;
  }

  /** `?railStripes=0` / `?railMinPx=0` (railStripes.ts): read once, when the materials are made. */
  private readonly railStripes = { stripes: railStripesFlag(), minPx: railMinPxFlag() };

  /** Base materials (as the prototype page); cut layers are cloned per cell with that cell's mask. */
  private makeMaterials(): void {
    const THREE = this.THREE;
    const { street: STREET_GROUND, tones: G } = groundPalette(this.opts.groundLook);
    const look = roadLookFlag(), lookTones = roadLookTones(STREET_GROUND, look), asphaltBase = lookTones.asphalt;
    let seed = 99;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    // One ImageData per texture, pixel for pixel the fillRect-per-block painter (groundNoise.ts).
    const noise = (g: CanvasRenderingContext2D, s: number, base: readonly number[], spread: number, grain = 2) => paintNoise(g, s, base, spread, grain, rnd);
    const pavers = (base: readonly number[], joint: string, metres: number, w: number, h: number) => this.canvasTexture(512, metres, (g, s) => {
      g.fillStyle = joint; g.fillRect(0, 0, s, s);
      const pw = s * w / metres, ph = s * h / metres;
      for (let row = 0, y = 0; y < s; row++, y += ph) for (let x = row % 2 ? -pw / 2 : 0; x < s; x += pw) {
        const v = (rnd() - 0.5) * 26;
        g.fillStyle = `rgb(${base[0] + v},${base[1] + v * 0.9},${base[2] + v * 0.8})`;
        g.fillRect(x + 1.5, y + 1.5, pw - 3, ph - 3);
      }
    });
    const grain = (g: CanvasRenderingContext2D, s: number, base: readonly number[], amp: { fine: number; stones: number; mottle: number }, seed: number) => {
      const off = asphaltGrain(s, amp, 8, seed), img = g.createImageData(s, s);
      for (let i = 0; i < off.length; i++) for (let c = 0; c < 3; c++) img.data[i * 4 + c] = Math.max(0, Math.min(255, Math.round(base[c] + off[i])));
      for (let i = 0; i < off.length; i++) img.data[i * 4 + 3] = 255;
      g.putImageData(img, 0, 0);
    };
    const std = (o: Record<string, unknown>) => new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, ...o });
    // Lawn: faint mowing stripes, 1.25 m wide (half the 5 m tile at 256 px).
    const stripes = (g: CanvasRenderingContext2D, s: number) => { g.fillStyle = 'rgba(255,255,255,0.05)'; for (let x = 0; x < s; x += s / 4) g.fillRect(x, 0, s / 8, s); };
    // Leaf dabs: `n` round clumps of `rgb`, radius rMin..rMax px, a little darker or lighter each.
    const dabs = (g: CanvasRenderingContext2D, s: number, rgb: readonly number[], n: number, rMin: number, rMax: number) => {
      for (let i = 0; i < n; i++) {
        const v = (rnd() - 0.5) * 30, r = rMin + rnd() * (rMax - rMin), x = rnd() * s, y = rnd() * s;
        g.fillStyle = `rgb(${rgb[0] + v},${rgb[1] + v},${rgb[2] + v})`;
        for (const [dx, dy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, Math.PI * 2); g.fill(); }
      }
    };
    // Shared by the layers drawn as one level (paving and the OSM squares; asphalt and the OSM car parks).
    const pavingMap = pavers(lookTones.pavement, lookTones.pavementJoint ?? STREET_GROUND.pavement.joint, 2.1, 0.21, 0.105);
    const asphaltMap = this.canvasTexture(512, 4, (g, s) => grain(g, s, asphaltBase, { fine: 16, stones: 26, mottle: 2.5 }, 1));
    const M: Record<string, any> = {
      // Under a road look option the bare land draws the pavement (groundLook ROAD_LOOK_OPTIONS: beside a lighter pavement
      // the land's own tone is the seam at a junction).
      land: std({ map: look ? pavingMap : pavers(G.land.base, G.land.joint, 3, 0.3, 0.3) }),
      // Klinker carriageways: herringbone in mixed tones (streetTextures.ts), so a brick street never reads as cycle-path red.
      klinker: std({ map: this.canvasTexture(512, 2, (g, s) => {
        const units = 20, px = s / units, base = lookTones.klinker;
        g.fillStyle = STREET_GROUND.klinker.joint; g.fillRect(0, 0, s, s);
        for (const b of herringboneBricks(units, KLINKER_TONES.length)) {
          const t = KLINKER_TONES[b.tone], v = (rnd() - 0.5) * 14;
          g.fillStyle = `rgb(${base[0] * t[0] + v},${base[1] * t[1] + v},${base[2] * t[2] + v})`;
          g.fillRect(b.x * px + 1.2, b.y * px + 1.2, b.w * px - 2.4, b.h * px - 2.4);
        }
      }), roughness: 0.9 }),
      // Inritten and parking bays of klinker (roads-v1 driveway / parking): the same herringbone, a muted grey brick
      // near the pavement, the tone mix halved (road look v2: the saturated klinker slabs read as wedges on the photo).
      brick: std({ map: this.canvasTexture(512, 2, (g, s) => {
        const units = 20, px = s / units, base = STREET_GROUND.brick.base;
        g.fillStyle = STREET_GROUND.brick.joint; g.fillRect(0, 0, s, s);
        for (const b of herringboneBricks(units, KLINKER_TONES.length)) {
          const t = KLINKER_TONES[b.tone].map(v => 1 + (v - 1) * 0.5), v = (rnd() - 0.5) * 12;
          g.fillStyle = `rgb(${base[0] * t[0] + v},${base[1] * t[1] + v},${base[2] * t[2] + v})`;
          g.fillRect(b.x * px + 1.2, b.y * px + 1.2, b.w * px - 2.4, b.h * px - 2.4);
        }
      }), roughness: 0.92 }),
      // Asphalt and the red cycle paths (issue #63): fine aggregate grain at ~8 mm a texel with sparse stones and a soft
      // 0.5 m mottle (streetTextures asphaltGrain, mean 0), mipmapped, so it is texture up close and the flat base at
      // chase distance (no shimmer: the mips average to the base). The red path's grain is subtler.
      asphalt: std({ map: asphaltMap }),
      cycle: std({ map: this.canvasTexture(512, 4, (g, s) => grain(g, s, [...STREET_GROUND.cycle.base], { fine: 10, stones: 14, mottle: 1.5 }, 2)), roughness: 0.85 }),
      // Pavements: grey-rose klinkers in stretcher bond (Amsterdam's gebakken klinker trottoir).
      paving: std({ map: pavingMap }),
      gravel: std({ map: this.canvasTexture(256, 4, (g, s) => noise(g, s, G.gravel, 30, 2)) }),
      // Vertex-tinted: white is the kerb tone, roadSurfaces KERB_SHADOW_TINT its shadow line (groundCell VERTEX_TINTED).
      kerb: std({ color: STREET_GROUND.kerb, roughness: 0.9, vertexColors: true }),
      paint: std({ color: STREET_GROUND.paint, roughness: 0.6 }),
      // Dark grooves (issue #52): the tram rails, matte (the kerbs' shadow lines take the same tone, roadSurfaces kerbShadowTint).
      tram: std({ color: look ? `rgb(${lookTones.rail.join(',')})` : STREET_GROUND.rail, roughness: 0.9 }),
      // Railway tracks (railTracks.ts, issue #124): grey-brown ballast with concrete sleepers every 0.6 m across the bed's
      // top (u across, v along the track, one SLEEPER_TILE_M tile), the shoulders sampling the gravel column at u ≈ 0.
      ballast: std({ map: this.canvasTexture(256, SLEEPER_TILE_M, (g, s) => {
        noise(g, s, RAIL_TONES.ballast, 30, 2);
        const px = s / SLEEPER_TILE_M, sl = RAIL_TONES.sleeper;
        for (let y = 0; y < SLEEPER_TILE_M - 0.01; y += SLEEPER_TILE_M / 5) {
          const v = (rnd() - 0.5) * 10;
          // Under the rail stripe layer (railStripes.ts) the shader draws the sleepers; the draw is skipped, not the
          // random number, so every texture painted after this one stays the same.
          if (this.railStripes.stripes) continue;
          g.fillStyle = `rgb(${sl[0] + v},${sl[1] + v},${sl[2] + v})`;
          g.fillRect(0.25 * px, (y + 0.17) * px, (SLEEPER_TILE_M - 0.5) * px, 0.26 * px);
        }
        if (this.railStripes.stripes) return;
        // The rails as dark stripes along the track (issue #145): continuous at chase distance, under the ridge rails up close.
        g.fillStyle = `rgb(${RAIL_STRIPE.tone.join(',')})`;
        for (const [u0, u1] of railStripes()) g.fillRect(u0 * px, 0, (u1 - u0) * px, s);
      }), roughness: 1 }),
      track: std({ color: `rgb(${RAIL_TONES.track.join(',')})`, roughness: 0.55, metalness: 0.2 }),
      bollard: std({ color: STREET_GROUND.bollard, roughness: 0.7 }),
      park: std({ map: this.canvasTexture(256, 6, (g, s) => noise(g, s, G.park, 30, 3)), roughness: 1 }),
      wood: std({ map: this.canvasTexture(256, 6, (g, s) => noise(g, s, G.wood, 34, 3)), roughness: 1 }),
      // One material per level (lane road-look-continuity 2026-10-29): the OSM squares and paved areas draw the
      // pavement's paving (they were a fourth pale grey, 198,187,169, against the pavement's 183,174,161), and the OSM
      // car parks the carriageway's asphalt (126,125,120 was a seventh grey, darker than the road beside it).
      square: std({ map: pavingMap }),
      parking: std({ map: asphaltMap }),
      quay: std({ vertexColors: true }),
      deckBody: std({ vertexColors: true, roughness: 0.85 }),
      deckTop: std({ vertexColors: true, roughness: 0.85 }),
      // Matte water (user 2026-10-13 'do not need this reflection'); the mood pass's bluer tone (GROUND_TONES.water).
      water: std({ color: G.water, roughness: 0.65, envMapIntensity: 0.5 }),
      // Parks (parks.ts): textured surfaces, ponds like the canals, one vertex-coloured mesh each for hedges and furniture.
      lawn: std({ map: this.canvasTexture(256, 5, (g, s) => { noise(g, s, G.lawn, 18, 2); stripes(g, s); }), roughness: 1 }),
      // Courtyard green (groundCell COURTYARD_ROAD_M): the muted garden tone, no mowing stripes.
      garden: std({ map: this.canvasTexture(256, 5, (g, s) => noise(g, s, gardenTone(G.lawn), 18, 2)), roughness: 1 }),
      bed: std({ map: this.canvasTexture(256, 3, (g, s) => { noise(g, s, G.bed.soil, 24, 2); dabs(g, s, G.bed.leaf, 260, 3, 7); }), roughness: 1 }),
      shrub: std({ map: this.canvasTexture(256, 6, (g, s) => { noise(g, s, G.shrub.base, 22, 3); dabs(g, s, G.shrub.leaf, 160, 6, 14); }), roughness: 1 }),
      bark: std({ map: this.canvasTexture(256, 2, (g, s) => noise(g, s, G.bark, 40, 3)), roughness: 1 }),
      sand: std({ map: this.canvasTexture(256, 3, (g, s) => noise(g, s, G.sand, 22, 2)), roughness: 1 }),
      parkGravel: std({ map: this.canvasTexture(256, 3, (g, s) => noise(g, s, G.parkGravel, 34, 2)), roughness: 1 }),
      parkPath: std({ map: this.canvasTexture(256, 4, (g, s) => noise(g, s, G.parkPath, 16)), roughness: 0.92 }),
      pond: std({ color: G.pond, roughness: 0.6, envMapIntensity: 0.5 }),
      hedge: std({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
      furniture: std({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }),
      // Bare unpaved ground (open-ground-v1, groundSurface.ts): earth and grit, painted last so every texture before it
      // keeps its random stream.
      bare: std({ map: this.canvasTexture(256, 4, (g, s) => { noise(g, s, G.bare.base, 26, 2); dabs(g, s, G.bare.grit, 220, 1, 3); }), roughness: 1 }),
    };
    for (const [layer, k] of Object.entries(redDedupeFlag() ? RED_OFFSET : OFFSET)) Object.assign(M[layer], { polygonOffset: true, polygonOffsetFactor: -k!, polygonOffsetUnits: -2 * k! });
    // Level sunlit ground draws its palette luminance (groundLight.ts); objects standing on it keep the rig's light as the buildings do.
    for (const [layer, m] of Object.entries(M)) if (!UNGAINED.has(layer)) m.color.multiplyScalar(FLAT_GROUND_GAIN);
    // The overview → city blend: every ground material (not the draped overlays below) is present early and takes its
    // colour from the flat palette tone the basemap draws (`flat`), so the shaded ground crossfades over the flat one.
    // The basemap's tones are look/sunny.ts `groundTokens` (basemapPalette.ts); the ground fades from the same strings.
    // One table with the overview tiles (overviewTiles/layerColours.ts), so the flat map and the fading ground agree.
    const flat = flatLayerTones(groundPalette(this.opts.groundLook)) as Record<string, readonly number[] | string | 'vertex'>;
    // Lever 2 of the #161 design note (look/markingFade.ts, `?markingFade=1`): far paint and cycle-path red fade into the
    // asphalt's albedo (its texture averages to the base tone; the material colour carries the ground gain).
    const asphaltAlbedo = new THREE.Color(`rgb(${asphaltBase.map(Math.round).join(',')})`).multiplyScalar(UNGAINED.has('asphalt') ? 1 : FLAT_GROUND_GAIN).toArray();
    const marking = (layer: string) => (layer in MARKING_FADE_STRENGTH ? { tone: asphaltAlbedo, strength: MARKING_FADE_STRENGTH[layer as keyof typeof MARKING_FADE_STRENGTH] } : null);
    for (const [layer, m] of Object.entries(M)) this.blendMaterial(m, flat[layer] ?? 'vertex', marking(layer));
    // Rails as their own layer on the bed (railStripes.ts, lane R1-B #224); off: the baked tile above, nothing installed.
    installRailStripes(M.ballast, this.railStripes);
    // Overlays: the game's own route / active-street colours (vector-map.js), draped.
    const overlay = (color: string, k: number, o: Record<string, unknown> = {}) => new THREE.MeshBasicMaterial({ color, polygonOffset: true, polygonOffsetFactor: -k, polygonOffsetUnits: -2 * k, ...o });
    M.routeCasing = overlay('#03121c', 5, { transparent: true, opacity: 0.75, depthWrite: false, fog: false });
    // The route band stays clear of the depth fade haze (look/depthFade.ts): the corridor is what the rider reads.
    M.route = overlay('#38BDF8', 6, { transparent: true, opacity: 0.9, depthWrite: false, fog: false });
    M.highlight = overlay('#38BDF8', 7, { transparent: true, opacity: 0.96, depthWrite: false });
    M.destination = overlay('#f97316', 7, { transparent: true, opacity: 0.85, depthWrite: false });
    Object.assign(this.base, M);
  }

  /**
   * Every ground program a cell can use (each layer's base; a cut or dissolving clone shares its program),
   * compiled once when the frame first draws (the base materials hold them for the session). Before this,
   * each arriving cell compiled its dissolve programs in the frame it first drew, and released them when
   * its dissolve ended, so the next cell compiled them again: ~90 program links in the first seconds of a
   * ride and three's first-use link waits inside MapLibre's frame (docs/perf-motion-stutter-20261016.md).
   * Same materials and cache keys as the cells', so the cells reuse these programs.
   */
  private precompiled = false;
  /** A touch device's warm-up still to compile (one mesh per material variant), and where it resumes. */
  private precompileQueue: { meshes: any[]; next: number; lastStep: number | null } | null = null;
  private precompile(): void {
    const renderer = this.frame?.renderer;
    if (!renderer || typeof this.frame.compile !== 'function') return;
    this.precompiled = true;
    const THREE = this.THREE;
    // The cells' attribute set (geometry()): normals and uvs are part of a program's key, colours where a layer uses them.
    const plain = new THREE.BufferGeometry();
    plain.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    plain.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(9), 3));
    plain.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6), 2));
    const coloured = plain.clone();
    coloured.setAttribute('color', new THREE.BufferAttribute(new Float32Array(9), 3));
    const group = new THREE.Group();
    for (const layer of GROUND_LAYERS) {
      const base = this.base[layer];
      if (!base) continue;
      // One per layer: a cut or dissolving clone shares its base's program (groundMaterial.ts).
      const mesh = new THREE.Mesh(base.vertexColors ? coloured : plain, base);
      mesh.receiveShadow = true;
      mesh.castShadow = layer === 'deckBody' || layer === 'hedge' || layer === 'furniture';
      group.add(mesh);
    }
    group.updateMatrixWorld(true);
    const budget = this.opts.precompilePerFrame ?? Infinity;
    if (!(budget < Infinity)) { this.frame.compile(group); return; }
    // Touch: a few new programs per frame instead of ~21 links in one task (the burst a Firefox Android GPU
    // process died in, twice, CANAL-RECALL-7/-N). A cell that arrives first compiles what it needs itself.
    this.precompileQueue = { meshes: [...group.children], next: 0, lastStep: null };
    this.precompileStep();
  }

  private precompileStep(): void {
    const q = this.precompileQueue, renderer = this.frame?.renderer;
    if (!q || !renderer) return;
    const now = performance.now();
    if (!precompileStepDue(now, q.lastStep)) { this.host.repaint(); return; }
    q.lastStep = now;
    q.next = compileWithinBudget(q.meshes, q.next, this.opts.precompilePerFrame ?? Infinity, mesh => this.frame.compile(mesh), () => renderer.info?.programs?.length ?? 0);
    if (q.next >= q.meshes.length) this.precompileQueue = null;
    else this.host.repaint();
  }

  /** A clone of a base material that discards fragments over water by this cell's mask (same program as the base). */
  private cutMaterial(layer: GroundLayer, uniforms: Record<string, { value: unknown }>): any {
    return cutClone(this.base[layer], uniforms as any, CUT[layer]!);
  }

  /**
   * While the ground is becoming present (presence < 1) its materials alpha-blend over the flat basemap (a smooth
   * crossfade: a screen-door dither re-randomised under the moving camera and read as sparkle, ~6 % of the view per
   * 0.1 zoom). Opaque again once present, so the ride itself draws exactly as before. Toggled only on the crossing.
   */
  private groundTransparent = false;
  private setGroundTransparent(on: boolean): void {
    if (on === this.groundTransparent) return;
    this.groundTransparent = on;
    const all = new Set<any>();
    for (const [layer, m] of Object.entries(this.base)) if (!['routeCasing', 'route', 'highlight', 'destination'].includes(layer)) all.add(m);
    for (const r of this.resident.values()) {
      for (const m of r.materials) all.add(m);
      for (const f of r.fade?.meshes ?? []) all.add(f.clone);
    }
    for (const m of all) { m.transparent = on; m.needsUpdate = true; }
  }

  /**
   * Patch a base ground material with the ground's shader edits (groundMaterial.ts): the dissolve always, and for the
   * overview blend (transition on) its alpha is the presence
   * (`presenceOf(b)`, blended only while `setGroundTransparent`), and its output colour mixes from `flat` (the palette tone the basemap draws, sRGB; 'vertex' =
   * its own vertex colour) to the lit, textured ground by `b`.
   */
  private blendMaterial(m: any, flat: readonly number[] | string | 'vertex', marking: GroundMarking | null = null): void {
    if (!this.opts.transition) { groundProgram(m, null, marking); return; }
    const rgb = flat === 'vertex' ? 'vertex' : typeof flat === 'string' ? new this.THREE.Color(flat).convertLinearToSRGB().toArray() : (flat as number[]).map(v => v / 255);
    groundProgram(m, { blend: this.blendUniform, presence: this.presenceUniform, flat: rgb }, marking);
  }

  /**
   * A per-cell clone of `source` that dissolves by `fade.value` (0 → 1): a screen-door dither discard, so no blending
   * (no sorting against the map's own layers) and no change to the depth buffer. The dissolve is compiled into every
   * ground program (groundMaterial.ts), so the clone shares the source's program and only swaps the uniform.
   */
  private fadeMaterial(source: any, fade: { value: number }): any {
    return fadeClone(source, fade);
  }

  /** Advance the dissolve of arriving cells; nothing runs (and nothing repaints) when no cell is fading. */
  private tickFades(): void {
    if (!this.fading.size) return;
    const now = performance.now();
    for (const key of [...this.fading]) {
      const r = this.resident.get(key), f = r?.fade;
      if (!r || !f) { this.fading.delete(key); continue; }
      const t = Math.min(1, (now - f.start) / this.opts.fadeMs);
      f.uniform.value = t;
      if (t >= 1) {
        for (const { mesh, original, clone } of f.meshes) { mesh.material = original; clone.dispose(); }
        r.fade = undefined;
        this.fading.delete(key);
        this.syncFar();
      }
    }
    this.host.repaint();
  }

  private geometry(p: GpuMesh): any {
    const g = this.packedGeometry(p);
    if (this.opts.releaseArrays) {
      // `count` stays; the bounding sphere is already set; nothing marks these
      // attributes for re-upload, so the CPU copy has no reader after this.
      for (const attribute of [...Object.values(g.attributes), g.index] as any[]) (attribute?.isInterleavedBufferAttribute ? attribute.data : attribute)?.onUpload(releaseArray);
    }
    return g;
  }

  /**
   * One layer's geometries: the whole mesh, or with `tiles` > 1 one per tile (cellTiles.ts) over the same vertex
   * buffers, each with its own index and bounding sphere so three.js culls the tiles off screen. A tile's fade clone
   * and material are the layer's; the dispose in drop() runs over every tile.
   */
  /**
   * Cut a layer mesh into `tiles`×`tiles` culled tiles over its own buffers (rendererShared/tiledGeometry.ts); the
   * shared frame draws it whole or through the tiles per frame. With `releaseArrays` (phones) the tiles are the only
   * draw: the mesh's own index is dropped instead of kept on the CPU for a whole draw.
   */
  private tile(mesh: any, tiles?: CellTile[] | null, n = this.opts.tiles): void {
    if (n <= 1) return;
    const tilesOnly = this.opts.tilesOnly;
    // A phone keeps no CPU copy of a whole index (`tilesOnly`); spans rewrite the index in place and need none.
    // `tiles`: cut in the worker (cellTiles.ts layerTiles, the same partition), so only the wrapping runs here.
    if (cutMesh(this.THREE, mesh, n, TILE_MIN_TRIANGLES, { release: !!this.opts.releaseArrays, tilesOnly, tiles }) && tilesOnly && mesh.userData.tiles?.length) mesh.geometry.setIndex(null);
  }

  private packedGeometry(p: GpuMesh): any {
    const THREE = this.THREE;
    const g = new THREE.BufferGeometry();
    if (isCompact(p)) {
      // The uv is the position's x, y (compactMesh.ts): one GPU buffer, two views. Normals and linear colours normalised.
      const shared = new THREE.InterleavedBuffer(p.positions, 3);
      g.setAttribute('position', new THREE.InterleavedBufferAttribute(shared, 3, 0));
      // A track's bed keeps its own uv (compactMesh UV_LAYERS: sleepers across, rails along the track).
      g.setAttribute('uv', p.uvs ? new THREE.BufferAttribute(p.uvs, 2) : new THREE.InterleavedBufferAttribute(shared, 2, 0));
      g.setAttribute('normal', new THREE.BufferAttribute(p.normals, 3, true));
      if (p.colors) g.setAttribute('color', new THREE.BufferAttribute(p.colors, 3, true));
      g.setIndex(new THREE.BufferAttribute(p.indices, 1));
      const sphere = boundingSphereOf(p.positions);
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(...sphere.center), sphere.radius);
      return g;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(p.normals, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(p.uvs, 2));
    if (p.colors) {
      // Vertex colours are authored in sRGB; three expects linear.
      const c = p.colors;
      for (let i = 0; i < c.length; i++) c[i] = Math.pow(c[i], 2.2);
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    g.setIndex(new THREE.BufferAttribute(p.indices, 1));
    // three's computeBoundingSphere, without its per-vertex attribute accessors (geometryBounds.ts).
    const sphere = boundingSphereOf(p.positions);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(...sphere.center), sphere.radius);
    return g;
  }

  private install(cell: BuiltCell): void {
    const quick = this.quickOn && cell.lod === 1 && !this.resident.has(cell.key);
    if (!this.wantedCells().some(w => w.key === cell.key && (w.lod === cell.lod || (quick && w.lod === 0)) && w.detail === cell.detail)) {
      this.discards.install++;
      // The ring changed between request and install (a cell crossed NEAR_M, the radius stepped): ask for what it wants
      // now on the next frame, not after the next 60 m move (a stationary rider kept the old LOD or no cell, #232).
      if (this.requeueOn) { this.residencyAt = null; this.discards.requeued++; this.host.repaint(); }
      return;
    }
    const t0 = performance.now();
    const THREE = this.THREE;
    // A cell swapping its LOD or its detail keeps the picture (same colours): only a cell new to the ring fades in.
    const arriving = !this.resident.has(cell.key) && this.opts.fadeMs > 0;
    this.drop(cell.key);
    const group = new THREE.Group();
    group.name = `own-ground/${cell.key}/lod${cell.lod}${cell.detail === 'touch' ? '-touch' : ''}`;
    const materials: any[] = [], textures: any[] = [];
    let uniforms: Record<string, { value: unknown }> | null = null;
    if (cell.mask) {
      const tex = new THREE.DataTexture(cell.mask.texels, cell.mask.width, cell.mask.height, THREE.RGFormat, THREE.UnsignedByteType);
      tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.unpackAlignment = 2; tex.needsUpdate = true;
      textures.push(tex);
      uniforms = { waterMask: { value: tex }, maskOrigin: { value: new THREE.Vector2(cell.mask.x0, cell.mask.y0) }, maskSize: { value: new THREE.Vector2(cell.mask.width * cell.mask.res, cell.mask.height * cell.mask.res) } };
    }
    let triangles = 0, bytes = 0;
    const fade: Fade | undefined = arriving ? { start: performance.now(), uniform: { value: 0 }, meshes: [] } : undefined;
    for (const layer of GROUND_LAYERS) {
      const p = cell.layers[layer];
      if (!p) continue;
      let material = this.base[layer];
      if (uniforms && CUT[layer]) { material = this.cutMaterial(layer, uniforms); materials.push(material); }
      const original = material;
      if (fade) material = this.fadeMaterial(original, fade.uniform);
      const mesh = new THREE.Mesh(this.geometry(p), material);
      if (fade) fade.meshes.push({ mesh, original, clone: material });
      mesh.name = layer;
      mesh.matrixAutoUpdate = false;
      mesh.receiveShadow = true;
      // Deck bodies, hedges and park furniture stand up; the rest is ground.
      mesh.castShadow = layer === 'deckBody' || layer === 'hedge' || layer === 'furniture';
      mesh.renderOrder = layer === 'water' || layer === 'quay' ? 0 : layer === 'land' ? 1 : 2;
      this.tile(mesh, cell.tiles ? cell.tiles[layer] ?? null : undefined, cellTileGrid(this.opts.tiles, this.opts.nearTiles, cell.lod, cell.detail));
      if (this.reachM > 0 && cell.lod === 0 && cell.detail === 'full' && REACH_LAYERS.has(layer)) this.reachMeshes.set(cell.key, [...(this.reachMeshes.get(cell.key) ?? []), mesh]);
      group.add(mesh);
      triangles += p.indices.length / 3;
      bytes += gpuMeshBytes(p as GpuMesh);
    }
    group.matrixAutoUpdate = false;
    this.root.add(group);
    this.resident.set(cell.key, { key: cell.key, lod: cell.lod, detail: cell.detail, group, materials, textures, triangles, bytes, maskInfo: cell.mask ? { x0: cell.mask.x0, y0: cell.mask.y0, res: cell.mask.res } : null, fade });
    if (fade) this.fading.add(cell.key);
    this.syncFar();
    this.stats.installMs.push(performance.now() - t0);
    const asked = this.requestedAt.get(`${cell.key}:${levelOf(cell.lod, cell.detail)}`);
    if (asked !== undefined) { this.stats.latencyMs.push(performance.now() - asked); this.requestedAt.delete(`${cell.key}:${levelOf(cell.lod, cell.detail)}`); }
    const now = performance.now(), arrival = (cell as BuiltCell & { arrival?: { at: number } }).arrival;
    this.startup.firstInstallAt ??= now;
    // A quick LOD 1 stand-in for a near cell: plan again, so its LOD 0 build is asked for on the next update.
    if (this.quickOn && cell.lod === 1 && this.wantedLod.get(cell.key) === 0) this.residencyAt = null;
    const { at: arrivedAt, ...timing } = arrival ?? { at: undefined };
    this.startup.cells.push({ key: cell.key, lod: cell.lod, detail: cell.detail, installedAt: Math.round(now), latencyMs: asked === undefined ? null : Math.round(now - asked), ...timing, queuedMs: arrivedAt == null ? null : Math.round(t0 - arrivedAt), installMs: Math.round(now - t0) });
    if (this.startup.cells.length > 200) this.startup.cells.shift();
    this.frame.invalidateShadows?.();
    this.host.repaint();
  }

  private drop(key: string): void {
    const r = this.resident.get(key);
    if (!r) return;
    this.root.remove(r.group);
    this.reachMeshes.delete(key);
    this.fading.delete(key);
    for (const f of r.fade?.meshes ?? []) f.clone.dispose();
    r.group.traverse((o: any) => { if (o.isMesh && !o.userData?.tile) o.geometry.dispose(); });
    for (const o of [...r.group.children]) disposeTiles(o);
    for (const m of r.materials) m.dispose();
    for (const t of r.textures) t.dispose();
    this.resident.delete(key);
    this.syncFar();
  }

  // ------------------------------------------------------------------ surface queries

  /** Riding-surface height (scene z, metres above +1.37 NAP ≈ the old street level) under a lng/lat. */
  heightAt(lngLat: LngLat): number {
    if (!this.ready) return 0;
    const [x, y] = toLocal(lngLat[0], lngLat[1]);
    return this.store.surface.height(x, y);
  }

  /** Relief only (no decks) under a lng/lat, or undefined while it is not resident. */
  groundAt(lngLat: LngLat): number | undefined {
    if (!this.ready) return undefined;
    const [x, y] = toLocal(lngLat[0], lngLat[1]);
    return this.store.hasRelief(x, y) ? this.store.surface.ground(x, y) : undefined;
  }

  /**
   * A footprint's base (the prototype's rule: the lowest relief along it, so
   * nothing floats), or undefined while the relief there is not resident.
   */
  footprintBase(ring: readonly LngLat[]): number | null | undefined {
    if (!this.ready || ring.length < 3) return undefined;
    const local = ring.map(p => toLocal(p[0], p[1]));
    // Outside the relief extract: street level for good (null), not "later".
    if (!this.store.reliefCovered(local[0][0], local[0][1])) return null;
    if (!local.every(p => this.store.hasRelief(p[0], p[1]))) return undefined;
    return footprintBase(local, this.store.surface.ground).base;
  }

  /** A point model's base: the lowest relief in a square of `halfM` around it (landmarks: 3 m). */
  pointBase(lngLat: LngLat, halfM = 0): number | undefined {
    if (!this.ready) return undefined;
    const [x, y] = toLocal(lngLat[0], lngLat[1]);
    if (!this.store.reliefCovered(x, y)) return 0;
    if (!this.store.hasRelief(x, y)) return undefined;
    if (!halfM) return this.store.surface.ground(x, y);
    let z = Infinity;
    for (const dx of [-halfM, 0, halfM]) for (const dy of [-halfM, 0, halfM]) z = Math.min(z, this.store.surface.ground(x + dx, y + dy));
    return z;
  }

  /**
   * A street-furniture base: the riding surface (a measured deck's top, a tunnel cut's floor), never below the relief.
   * The pavement planes' own lift over it (roadSurfaces SIDEWALK_TOP) is added by the furniture adapter
   * (streetFurniture/models.ts RIDE_BASE_LIFT_M, user 2026-11-07).
   */
  surfaceBase(lngLat: LngLat): number | undefined {
    if (!this.ready) return undefined;
    const [x, y] = toLocal(lngLat[0], lngLat[1]);
    if (!this.store.reliefCovered(x, y)) return 0;
    if (!this.store.hasRelief(x, y)) return undefined;
    return Math.max(this.store.surface.ground(x, y), this.store.surface.height(x, y));
  }

  // CanalElevation-compatible surface for vector-map.js's rider code.

  /** Height and pitch for a vehicle with rear/front contacts, facing the game's `angle` (east = 0, clockwise-negative north). */
  riderPose(lngLat: LngLat, angle: number, contacts?: [number, number]): { heightM: number; pitch: number } {
    if (!this.ready) return { heightM: 0, pitch: 0 };
    const [x, y] = toLocal(lngLat[0], lngLat[1]);
    const dir: Vec2 = [Math.cos(angle), -Math.sin(angle)];
    const wheelbase = contacts ? Math.abs(contacts[1] - contacts[0]) : 1.2;
    const mid = contacts ? (contacts[0] + contacts[1]) / 2 : 0;
    const pose = surfaceRiderPose(this.store.surface.height, x + dir[0] * mid, y + dir[1] * mid, dir, wheelbase || 1.2);
    return { heightM: pose.z, pitch: pose.pitch };
  }

  /**
   * Screen shift (normalised device units) that moves a flat (z = 0)
   * projection of a lng/lat onto the riding surface there: the canvas
   * overlays (destination pin, question-feature marker) project through
   * MapLibre at street level and add this. Both ends use the last main
   * pass's matrix, so a frame of lag moves only the small difference, not
   * the point. Null while the ground is hidden or the lift is negligible.
   */
  screenLift(lngLat: LngLat): [number, number] | null {
    if (!this.clipFromLocal || !this.visibleAtZoom(this.zoom) || !this.resident.size) return null;
    const [x, y] = toLocal(lngLat[0], lngLat[1]);
    if (!this.store.hasRelief(x, y)) return null;
    const z = this.store.surface.height(x, y);
    if (Math.abs(z) < 0.03) return null;
    const a = ndcOf(this.clipFromLocal, x, y, 0), b = ndcOf(this.clipFromLocal, x, y, z);
    return a && b ? [b[0] - a[0], b[1] - a[1]] : null;
  }

  /** Canal water level (scene z). */
  waterLevelM(): number { return this.ready ? WATER_Z : 0; }
  /** Water surface (scene z) at a point: the polder level on resident water, else the canal level. */
  waterLevelAt(lngLat: LngLat): number { if (!this.ready) return 0; const [x, y] = toLocal(lngLat[0], lngLat[1]); return this.store.waterZ(x, y); }
  applyTheme(): void { this.host.repaint(); }

  // ------------------------------------------------------------------ overlays

  /** The navigation route (lng/lat polyline), or null to hide it. */
  setRoute(line: readonly LngLat[] | null): void {
    this.routeLine = line && line.length > 1 ? line.map(p => toLocal(p[0], p[1])) : null;
    this.overlayDirty = true; this.host.repaint();
  }

  /**
   * The question street's centrelines (lng/lat), or null. Geometry only: the
   * ground never draws a street name, so this cannot reveal the answer's name.
   */
  setHighlight(lines: readonly (readonly LngLat[])[] | null): void {
    this.highlightLines = lines && lines.length ? lines.filter(l => l.length > 1).map(l => l.map(p => toLocal(p[0], p[1]))) : null;
    this.overlayDirty = true; this.host.repaint();
  }

  /** The destination's ground contact ring, or null. */
  setDestination(lngLat: LngLat | null): void {
    const next = lngLat ? toLocal(lngLat[0], lngLat[1]) : null;
    if (next && this.destination && Math.hypot(next[0] - this.destination[0], next[1] - this.destination[1]) < 0.1) return;
    this.destination = next;
    this.overlayDirty = true; this.host.repaint();
  }

  private rebuildOverlays(): void {
    this.overlayDirty = false;
    this.overlayRevision = this.surfaceRevision;
    const H = this.store.surface.height;
    const routeNear = this.routeLine ? this.clipToResident(this.routeLine) : [];
    this.setOverlay('casing', merge(routeNear.map(l => routeRibbon(l, H, 2.6, 0.06))), this.base.routeCasing, 3);
    this.setOverlay('route', merge(routeNear.map(l => routeRibbon(l, H, 1.6, 0.07))), this.base.route, 4);
    const lights = this.highlightLines ? this.highlightLines.flatMap(l => this.clipToResident(l)) : [];
    this.setOverlay('highlight', merge(lights.map(l => routeRibbon(l, H, 3.2, 0.075))), this.base.highlight, 5);
    let ring = emptyMesh();
    if (this.destination) {
      const m = emptyMesh();
      disc(m, this.destination, 3.2, H, 0.08, 28);
      ring = m;
    }
    this.setOverlay('destination', ring, this.base.destination, 6);
  }

  /** Polyline pieces within the resident radius (the rest is drawn when we get there). */
  private clipToResident(line: readonly Vec2[]): Vec2[][] {
    if (!this.centre) return [];
    const R = this.radiusM + 200, [cx, cy] = this.centre, out: Vec2[][] = [];
    let cur: Vec2[] = [];
    for (const p of line) {
      if (Math.hypot(p[0] - cx, p[1] - cy) <= R) cur.push(p);
      else if (cur.length) { if (cur.length > 1) out.push(cur); cur = []; }
    }
    if (cur.length > 1) out.push(cur);
    return out;
  }

  private setOverlay(name: keyof OwnGround['overlays'], data: MeshArrays, material: any, order: number): void {
    const THREE = this.THREE;
    const old = this.overlays[name];
    if (old) { this.root.remove(old); old.geometry.dispose(); this.overlays[name] = null; }
    if (!data.indices.length) return;
    const positions = Float32Array.from(data.positions), indices = Uint32Array.from(data.indices);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material);
    mesh.name = `overlay:${name}`;
    mesh.renderOrder = 10 + order;
    mesh.matrixAutoUpdate = false;
    this.root.add(mesh);
    this.overlays[name] = mesh;
  }

  // ------------------------------------------------------------------ diagnostics

  /**
   * What the camera sees from straight above at a game-frame point (default:
   * the rider): every resident ground triangle under it, with the water-mask
   * discard applied as the shader does, topmost first. Ties within 2 cm go to
   * the higher polygon-offset rank (the draw order of coplanar layers).
   * Diagnostics and named regressions only (walks every triangle).
   */
  layersAt(x?: number, y?: number): { top: string | null; hits: { layer: string; z: number; cut: boolean }[] } {
    if (x === undefined || y === undefined) { if (!this.centre) return { top: null, hits: [] }; [x, y] = this.centre; }
    const hits: { layer: string; z: number; cut: boolean; rank: number }[] = [];
    for (const r of this.resident.values()) {
      const mask = r.textures[0]?.image as { data: Uint8Array; width: number; height: number } | undefined;
      const uniforms = r.maskInfo;
      r.group.traverse((o: any) => {
        if (!o.isMesh || o.userData?.tile) return; // a tile repeats its owner's triangles
        const layer = o.name as GroundLayer, pos = o.geometry.attributes.position.array as Float32Array, idx = o.geometry.index.array as Uint32Array;
        if (!pos || !idx) return; // released after upload (releaseArrays)
        for (let t = 0; t < idx.length; t += 3) {
          const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
          const d = (pos[b + 1] - pos[c + 1]) * (pos[a] - pos[c]) + (pos[c] - pos[b]) * (pos[a + 1] - pos[c + 1]);
          if (Math.abs(d) < 1e-9) continue;
          const u = ((pos[b + 1] - pos[c + 1]) * (x! - pos[c]) + (pos[c] - pos[b]) * (y! - pos[c + 1])) / d;
          const v = ((pos[c + 1] - pos[a + 1]) * (x! - pos[c]) + (pos[a] - pos[c]) * (y! - pos[c + 1])) / d;
          if (u < 0 || v < 0 || u + v > 1) continue;
          const z = u * pos[a + 2] + v * pos[b + 2] + (1 - u - v) * pos[c + 2];
          let cut = false;
          const channel = CUT[layer];
          if (channel && mask && uniforms) {
            const i = Math.floor((x! - uniforms.x0) / uniforms.res), j = Math.floor((y! - uniforms.y0) / uniforms.res);
            if (i >= 0 && j >= 0 && i < mask.width && j < mask.height) cut = mask.data[(j * mask.width + i) * 2 + (channel === 'r' ? 0 : 1)] < 128;
          }
          hits.push({ layer, z, cut, rank: OFFSET[layer] ?? 0 });
        }
      });
    }
    hits.sort((p, q) => (Math.abs(p.z - q.z) > 0.02 ? q.z - p.z : q.rank - p.rank));
    const top = hits.find(h => !h.cut && h.layer !== 'water')?.layer ?? null;
    return { top, hits: hits.map(({ layer, z, cut }) => ({ layer, z: +z.toFixed(3), cut })) };
  }

  /** The streamed cell key under a lng/lat. */
  cellKeyAt(lngLat: LngLat): string | null {
    if (!this.ready) return null;
    const [x, y] = toLocal(lngLat[0], lngLat[1]);
    return this.store.cellAt(x, y);
  }

  /** One cell's last build: LOD, triangles (total and per layer), build ms, park stats. Diagnostics. */
  cellStats(key: string): Record<string, unknown> | null {
    const b = this.cellBuilds.get(key);
    if (!b) return null;
    return { lod: b.lod, detail: b.detail, triangles: b.triangles, byLayer: b.byLayer, buildMs: b.buildMs, bytes: b.bytes, parks: b.parks, hasParks: this.store.parkCells.has(key), roads: b.roads ?? null, hasRoads: this.store.roadCells.has(key), flatBridges: b.bridges.flat, hasRails: this.store.railCells.has(key), railFetch: b.railFetch ?? null, rails: b.rails ?? null };
  }

  status(): Record<string, unknown> {
    let triangles = 0, bytes = 0;
    const cells: Record<string, number> = {}, details: Record<string, CellDetail> = {};
    for (const r of this.resident.values()) { triangles += r.triangles; bytes += r.bytes; cells[r.key] = r.lod; details[r.key] = r.detail; }
    const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[s.length >> 1].toFixed(1) : null; };
    return {
      enabled: this.enabled, ready: this.ready, workerReady: this.workerReady, visible: this.visibleAtZoom(this.zoom), transition: this.opts.transition, blend: this.blend.value, basemapHidden: this.basemapHidden, radiusM: this.radiusM, zoom: this.zoom, roads: this.opts.roads ? this.store.roadCells.size : false, detail: this.opts.detail, groundNear: this.opts.groundNear, ring: this.opts.ring, aheadM: this.aheadM,
      cells, details, pending: Object.fromEntries(this.pending), queued: this.installQueue.length,
      // Lane R5-A #260 step 1: the ground workers and the cells pending on each (far blocks all go to worker 0).
      workers: this.workers.length, focusCell: this.focusCell, workerPending: this.pullOn ? this.held.map(h => [...h]) : this.workers.map((_, i) => [...this.pending.keys()].filter(k => this.workerOf.get(k) === i)), pull: this.pullOn, triangles, geometryMB: +(bytes / 1048576).toFixed(1),
      reliefTiles: this.store.reliefTileCount, decks: this.ready ? this.store.surface.decks.length : 0, surfaceRevision: this.surfaceRevision,
      built: this.stats.cellsBuilt, buildMsMedian: median(this.stats.buildMs), installMsMedian: median(this.stats.installMs),
      latencyMsMedian: median(this.stats.latencyMs), latencyMsMax: this.stats.latencyMs.length ? Math.round(Math.max(...this.stats.latencyMs)) : null, lastBuild: this.stats.lastBuild,
      downloadedKB: Object.fromEntries(Object.entries(this.store.loadedBytes).map(([k, v]) => [k, Math.round(v / 1024)])),
      overlays: Object.fromEntries(Object.entries(this.overlays).map(([k, m]) => [k, m ? m.geometry.index.count / 3 : 0])),
      far: {
        radiusM: this.farRadius, blocks: this.far.size, pending: this.farPending.size, built: this.farStats.built, buildMsMedian: median(this.farStats.buildMs),
        parts: [...this.far.values()].reduce((n, f) => n + f.parts.size, 0), partsShown: [...this.far.values()].reduce((n, f) => n + [...f.parts.values()].filter(m => m.visible).length, 0),
        triangles: [...this.far.values()].reduce((n, f) => n + f.triangles, 0), geometryMB: +([...this.far.values()].reduce((n, f) => n + f.bytes, 0) / 1048576).toFixed(1),
      },
      errors: this.stats.errors.slice(-5),
      // Lane R3-C #232: both rail manifests (main, worker) and the builds thrown away, by reason.
      rail: { manifest: this.store.railCells.size, workerManifest: this.workerRailCells, discards: { ...this.discards }, retrying: this.retries.size, loadErrors: this.store.loadErrors.slice(-5) },
    };
  }
}
