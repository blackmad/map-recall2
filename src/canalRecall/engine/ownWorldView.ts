// The second world view (`?engine=own`, engine programme P1): three.js owns the
// canvas and the frame. No `maplibregl.Map` is ever constructed.
//
//   frameHost.ts   one canvas, one WebGLRenderer, one rAF loop
//   cameraMap.ts   mapCamera.ts's camera, MapLibre-exact, as `vectorMap.camera`
//   SharedFrame    driven by the host (`drive(clipFromMercator)`); every
//                  participant (facades, own ground, vehicles) renders unchanged
//   overviewLayer  the far field and the start flight's city (own-map overview)
//   waterIndex     `isWater` over the overview water
//   gameCamera     the game camera → map camera solve (lifted from `sync`)
//   cameraClearance / riderCover   lifted from vector-map.js, shared
//
// Participants built for a MapLibre map are handed the CameraMap (the slice
// they read) and `MERCATOR` (the one `maplibregl` member they use,
// `MercatorCoordinate`). The rest of VectorMap's surface is listed in
// `UNIMPLEMENTED` and answers as a no-op until its step lands (overlays,
// labels, landmarks, trees: steps 4–5, lane L5).

import { framePhases } from './framePhases';
import { chooseTier, TIER_SETTINGS, type QualityTier } from '../renderGovernor';
import { tierProbe } from './tierProbe';
import { GlCounters, GlResident, objectLabel } from './glCounters';
import { PerfHud, type PerfSnapshot } from './perfHud';
import { SharedFrame } from '../rendererShared/sharedFrame';
import { mapLibreSky } from '../look/sunny';
import { FrameHost, type FrameSimulation } from './frameHost';
import { guardFrameHost } from './frameGuards';
import { settleChecks } from './settle';
import { CameraMap, EngineCamera, unitsPerMetre, mercatorX, mercatorY } from './cameraMap';
import { GameCameraSolver, lngLatToWorld, worldToLngLat, type GameCamera, type LoaderFrame } from './gameCamera';
import { clearCamera, clearanceResidents, residentIndex } from './cameraClearance';
import { RiderCoverTracker } from './riderCover';
import { idleScheduler } from './idleBoxGrid';
import { coverRouteFlag, roadAheadPoints, routeAheadPoints, type LngLat as CoverLngLat } from '../coveredPassage';
import { decodeOverviewBytes, fetchOverviewBytes, OverviewLayer, overviewTileGrid, OVERVIEW_TILE_MIN_TRIANGLES } from './overviewLayer';
import { overviewFromPool } from '../ownMap/overviewPool';
import { awaitWorkerPool } from './workerPool';
import type { BuildingLookId, JumpOptions, ScreenPoint, WorldCamera, WorldViewOracles } from './worldViewApi';
import { BUILDING_LOOK_IDS, urlBuildingLook } from './worldViewApi';
import { FlatLines, type LngLatLine } from './overlays/flatLines';
import { FarShells, farCellOrigin, farShellsEnabled } from './farShells';
import { BakedCoarse, bakedCoarseEnabled } from './bakedCoarse';
import { arrivalPaceOption } from './arrivalPace';
import { isAerialView } from '../rendererShared/aerialView';
import { BASE_REFRESH_BUDGET_MS } from '../rendererShared/baseRefreshBudget';
import { ToonPost, toonLookFlag } from './toonLook';
import { SmaaPost, smaaFlag } from './postAA';
import { COVER_POLL_MS, isCoveredState } from '../labels/coveredState';
import { AERIAL_POI_MAX, LabelLayer, type PointLabel } from './overlays/labelLayer';
import { gameLabelContext, type LabelContext } from '../ownMap/labelPolicy';
import { buildSpoilerIndex, type SpoilerIndex } from '../orientationPois';
import { ownPoiFeatures, type OrientationPoiFile } from '../ownPois';
import { cameraFrame } from '../ownMap/mapCamera';
import { fromLocal, toLocal } from '../ownMap/frame';
import { placeAliases } from './placeNames';
import { CityExtras } from './cityExtras';
import { gameTileEnricher } from '../gameTileEnricher';
import { LandmarkHighlight } from './landmarkHighlight';
import { LabelOcclusion } from './labelOcclusion';
import { SpoilerSources } from './spoilerSources';
import { groundCentre, groundViewFlag } from '../ownGround/groundResidency';

declare const CANVAS_W: number;
declare const CANVAS_H: number;

const W = () => globalThis as any;
/** GameState.LOADING (game/utilityTuck.ts UTILITY_STATES). */
const LOADING_STATE = 2;
/**
 * Least ms between world renders while the loading screen covers them (FrameHost.coveredFrameMs): the GPU still
 * uploads and compiles behind it, once a second, and the chunk builds the settle hold waits for get the main thread.
 */
export const COVERED_FRAME_MS = 1000;
/** Candidates a full label placement takes from the air (labelLayer aerialCap): ~2x the most a ride frame collects. */
const AERIAL_LABEL_CAP = { count: 1200 };
/** A full label placement's per-frame budget from the air, ms (lane R3-F #241; `?labelBudget=0` off, `=N` sets it). */
export const LABEL_PLACE_BUDGET_MS = 4;
/** From the air while the camera moves: full label placements at most this often (with the budget), ms. */
const AERIAL_LABEL_CADENCE_MS = 800;
const flag = (param: string, global: string, fallback: boolean): boolean => {
  const g = W();
  if (typeof g[global] === 'boolean') return g[global];
  try {
    const v = new URLSearchParams(g.location?.search ?? '').get(param);
    if (v === '0' || v === 'false' || v === 'off') return false;
    if (v === '1' || v === 'true' || v === 'on') return true;
  } catch (_) { /* no window */ }
  return fallback;
};
/**
 * `?labelAerialPois=all` (or the global `true`): every POI from the air, as before lane R3-F; `=N` (or a number):
 * the aerial POI cap; absent or anything else: AERIAL_POI_MAX. (`=1` is a cap of one; it restored every POI before
 * the cap landed.)
 */
const parseAerialPois = (): 'all' | number => {
  const g = W();
  const v: unknown = g.__canalRecallLabelAerialPois;
  if (v === true) return 'all';
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.floor(v);
  try {
    const q = new URLSearchParams(g.location?.search ?? '').get('labelAerialPois');
    if (q === 'all') return 'all';
    const n = q === null || q === '' ? NaN : Number(q);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  } catch (_) { /* no window */ }
  return AERIAL_POI_MAX;
};
const coarse = () => !!W().matchMedia?.('(pointer: coarse)')?.matches;

const OWN_GROUND_BUNDLE = 'js/own-ground-game.bundle.js?v=20261030-rails-tunnels';
const OWN_GROUND_WORKER = 'js/own-ground-worker.bundle.js?v=20261030-rails-tunnels';

/** `maplibregl.MercatorCoordinate`, the one MapLibre member the participants use (MapLibre's earth). */
export class MercatorCoordinate {
  constructor(public x: number, public y: number, public z = 0) {}
  static fromLngLat(lngLat: any, altitude = 0): MercatorCoordinate {
    const lng = Array.isArray(lngLat) ? lngLat[0] : lngLat.lng ?? lngLat.lon;
    const lat = Array.isArray(lngLat) ? lngLat[1] : lngLat.lat;
    return new MercatorCoordinate(mercatorX(lng), mercatorY(lat), altitude * unitsPerMetre(lat));
  }
  meterInMercatorCoordinateUnits(): number {
    const lat = (360 / Math.PI) * Math.atan(Math.exp(((180 - this.y * 360) * Math.PI) / 180)) - 90;
    return unitsPerMetre(lat);
  }
  toLngLat() {
    const lat = (360 / Math.PI) * Math.atan(Math.exp(((180 - this.y * 360) * Math.PI) / 180)) - 90;
    return { lng: this.x * 360 - 180, lat };
  }
}
export const MERCATOR = { MercatorCoordinate };

/** VectorMap members that are no-ops under the flag (the hand-back's list; checked by the engine spec). */
export const UNIMPLEMENTED = [
  'park landscape (MapLibre style layers; the overview parks stand in)',
  'recipe tiles (?recipeTiles=1)', 'sculptures (?sculptures=1)', 'neighbourhood lines are solid (MapLibre drew them dashed)',
] as const;

type Vehicle = any;

export class OwnWorldView implements WorldViewOracles {
  readonly engine = 'own' as const;
  ready = false;
  readonly container: HTMLElement;
  readonly host: FrameHost;
  readonly map: null = null; // no MapLibre: anything still reading `vectorMap.map` must move to `camera`
  readonly cameraMap: CameraMap;
  readonly camera: WorldCamera;
  readonly _sharedFrame: SharedFrame;
  _renderGovernor: any = null;
  /** The quality tier chosen at start, its settings and the probe numbers (also on window.__canalPerf). */
  qualityTier: { tier: QualityTier; reasons: string[]; settings: Record<string, unknown>; probe: unknown } | null = null;
  _cameraTilt = 0;
  theme = 'clean';
  riderCovered = false;
  _labelsVisible = false;

  _ownGround: any = null;
  /** `?glCounters=1`: GL work counters (engine/glCounters.ts). */
  _glCounters: GlCounters | null = null;
  /** The perf HUD's GPU allocation tracker when `?glCounters` is off (engine/perfHud.ts). */
  private _gpuResident: GlResident | null = null;
  _perfHud: PerfHud | null = null;
  _threeBuildings: any = null;
  _completeCity: any = null;
  /** The far tier (engine/farShells.ts, lane R2-B #229; `?farShells=0`): baked SHL1 prisms out to the far ring. */
  _farShells: FarShells | null = null;
  private farShellsOn = farShellsEnabled();
  /** The baked coarse tier (engine/bakedCoarse.ts, lane R4-A #243; `?bakedCoarse=0`): one SHEL mesh per world cell instead of the runtime coarse chunks. */
  _bakedCoarse: BakedCoarse | null = null;
  /** The own ground revision the baked tier last re-based against (a new one restarts its lift pass). */
  private bakedGroundRevision: number | undefined;
  private bakedCoarseOn = bakedCoarseEnabled(coarse());
  /** Why the baked tier is off (diagnostics): flag, no-shel, layer-table, look. */
  bakedCoarseOff: string | null = null;
  /** `?groundView=0`: the own ground follows the rider also while the camera is panned off it (groundResidency.ts). */
  private readonly groundView = groundViewFlag();
  /** Landmark models, trees, detailed buildings, pyramidal roofs, ARTIS (cityExtras.ts). */
  readonly extras: CityExtras;
  get _signatureLandmarks(): any { return this.extras.signature; }

  // ---- spec oracles (worldViewApi.ts WorldViewOracles), the names vector-map.js answers to ----
  /** Set by the streamer's first-buildings callback (loadBuildings), as vector-map.js's `_completeCity.attach`. */
  _completeCityHasBuildings = false;
  /** The three.js buildings draw with the facades library loaded (no theme or detail switch under own). */
  _facadesActive(): boolean { return !!this.facadesLib() && !!this._threeBuildings && this.status.buildings === true; }
  /** The building ids the shown signature models hide (cityExtras.ts suppressedIds: covers.json under ?bagTiles=1). */
  _signatureSuppressOsmIds(): string[] { return this.extras.suppressedIds(); }
  /** covers.json under ?bagTiles=1 (vector-map.js `_bagCovers`; bag-tiles.spec reads it). */
  get _bagCovers(): unknown { return this.extras.covers; }
  get _inventoryTrees(): any { return this.extras.trees; }
  get _detailedBuildings(): any { return this.extras.detailed; }
  get _pyramidalRoofs(): any { return this.extras.roofs; }
  get _artisAnimals(): any { return this.extras.artis; }
  private activeLandmark: any = null;
  _overview: OverviewLayer | null = null;
  _playerBike: Vehicle = null;
  _playerBoat: Vehicle = null;
  _playerFerry: Vehicle = null;
  _playerTransit: Vehicle = null;
  /** Diagnostics for the engine spec: what loaded, what failed. */
  readonly status: Record<string, unknown> = { engine: 'own' };

  private readonly solver = new GameCameraSolver();
  private readonly cover = new RiderCoverTracker();
  private extractPath = '../data/extracts/amsterdam';
  private landmarkView: { pitchDeg: number; leadM: number } | null = null;
  private chasePitchBase: number | null | undefined;
  private riderSurfaceM = 0;
  private lastSubject: [number, number] | null = null;
  private pendingAim: { worldX: number; worldY: number; loader: LoaderFrame; options: { zoom?: number; bearing?: number; pitch?: number } } | null = null;
  private ownGroundState: { route?: any; highlight?: any; destination?: any } = {};
  private routeRef: unknown = null;
  private activeStreetKey = '';
  private activeStreetRoute: unknown = null;
  private destinationKey = '';
  private spoilerNames: string[] = [];
  private streetFronts: unknown = null;
  private groundHooked = new WeakSet<object>();
  private groundRevision: unknown = undefined;
  private groundRefreshAt = 0;
  /** `?stagedGroundHook=0` off: the ground consumers' hook and re-base spread over frames (lane E2, #215). */
  private readonly stagedGroundHook = flag('stagedGroundHook', '__canalRecallStagedGroundHook', true);
  /** The extras' re-base, due the frame after the buildings' one (stagedGroundHook). */
  private extrasRebaseDue = false;
  private introLanding = false;
  private measuredColoursOnly = false;
  /** The building look in force (worldViewApi BUILDING_LOOK_IDS); a URL/global look locks out the saved preference. */
  private buildingLookNow: BuildingLookId = 'photo';
  /** The toon look's palette pass (`?look=toon`, #161); null otherwise. */
  private toonPost: ToonPost | null = null;
  /** `?smaa=1` (lane R3-A #230): SMAA 1x over the resolved frame, before the toon remap. */
  private smaaPost: SmaaPost | null = null;
  private buildingLookLocked = false;
  /** Overlays (engine/overlays): flat lines over the ground, labels on a 2D canvas, the landmark marker. */
  readonly _lines: Record<'cycle' | 'transit' | 'hoods', FlatLines>;
  readonly _labels: LabelLayer;
  _highlightMarker: any = null;
  private readonly landmarkHighlight = new LandmarkHighlight();
  readonly labelOcclusion = new LabelOcclusion();
  /** `?labelOcclusion=0` (or flipping it at run time: specs compare on and off at one pose). */
  private _labelOcclusionOn = flag('labelOcclusion', '__canalRecallLabelOcclusion', true);
  /** From the air (rendererShared/aerialView.ts): no occlusion rounds, candidates capped (lane R2-B #229; `?labelAerialCap=0`). */
  private labelAerialCapOn = flag('labelAerialCap', '__canalRecallLabelAerialCap', true);
  /** `?labelSticky=0` off: from the air the last winners keep their places across full placements (labelLayer sticky). */
  private readonly labelStickyOn = flag('labelSticky', '__canalRecallLabelSticky', true);
  /**
   * From the air (lane R3-F #241): `?labelAerialPois=all` keeps every POI (the A/B of the aerial POI thinning);
   * `?labelAerialPois=N` admits the signature landmarks but caps them at N (default AERIAL_POI_MAX).
   */
  private readonly labelAerialPois: 'all' | number = parseAerialPois();
  /** `?labelClipTries=0` off: line labels try every centre along a run, also the ones projected far off screen. */
  private readonly labelClipTriesOn = flag('labelClipTries', '__canalRecallLabelClipTries', true);
  /** `?labelBudget=0` off, `?labelBudget=N` N ms: the aerial full placement's per-frame budget (labelLayer placeBudgetMs). */
  private readonly labelBudgetMs: number | null = (() => {
    if (!flag('labelBudget', '__canalRecallLabelBudget', true)) return null;
    let v: number | null = null;
    try { v = Number(new URLSearchParams(W().location?.search ?? '').get('labelBudget') ?? NaN); } catch (_) { /* no window */ }
    return v !== null && Number.isFinite(v) && v > 1 ? v : LABEL_PLACE_BUDGET_MS;
  })();
  /**
   * Building and extras bases held from the air (lane R3-F #241, `?groundBasesAerial=0` off): while the view is aerial
   * a new ground revision is only noted; when it leaves, one catch-up re-base runs in BASE_REFRESH_BUDGET_MS slices,
   * nearest chunk first (rendererShared/baseRefreshBudget.ts). Street-level rides keep the 400 ms throttled re-base.
   */
  private readonly groundBasesAerialOn = flag('groundBasesAerial', '__canalRecallGroundBasesAerial', true);
  /** A revision arrived while aerial and is not applied yet. */
  private groundBasesHeld = false;
  /** The catch-up re-base is under way (one slice per frame). */
  private groundBasesSlicing = false;
  /** Revisions and frames the hold skipped, and catch-up slices run (perf probe). */
  readonly groundBaseStats = { held: 0, heldFrames: 0, slices: 0, catchUps: 0 };
  labelAerial = false;
  /**
   * The label occlusion grid is (re)built in idle time when the resident list changes or the eye jumps, not inside the
   * first full placement after a ride start or route change (9-20 ms there on the iPhone profile; lane E6 #219).
   * `?labelIndexIdle=0`: built at the placement only, as before.
   */
  private readonly labelIndexIdle = flag('labelIndexIdle', '__canalRecallLabelIndexIdle', true);
  private labelIndexScheduled = false;
  /**
   * `landing`: during the start flight the eye is high over the city, so the grid is centred on where the ride lands
   * (the rider), which the chase eye stays well within REINDEX_M of; it also warms every footprint's box (featureBox),
   * which the first frame's camera clearance reads.
   */
  /**
   * The camera clearance's resident grid (cameraClearance.ts residentIndex, with every footprint's box) is built in
   * idle time when the resident list changes, not in the ride's first frame (`sync: camera solve and clearance` 21-25 ms
   * on the iPhone profile; lane E6 #219). `?clearanceIdle=0`: built at the first clearance walk, as before.
   */
  private readonly clearanceIdle = flag('clearanceIdle', '__canalRecallClearanceIdle', true);
  private clearanceWarmFor: unknown = null;
  private prewarmClearance(): void {
    const city = this._completeCity;
    if (!this.clearanceIdle || !city?.sampleFeatures || !city.residentFeatures) return;
    const list = city.residentFeatures();
    if (list === this.clearanceWarmFor) return;
    this.clearanceWarmFor = list;
    idleScheduler(() => {
      const c = this._completeCity;
      if (c?.sampleFeatures) residentIndex(clearanceResidents(c as { sampleFeatures(limit: number): any[] }));
    });
  }

  private prewarmLabelOcclusion(landing?: readonly [number, number]): void {
    const city = this._completeCity;
    if (!this.labelIndexIdle || this.labelIndexScheduled || !this.labelOcclusionOn || !city?.residentFeatures) return;
    const centre = (): [number, number] => { if (landing) return [landing[0], landing[1]]; const e = this.cameraMap.camera.eye(); return [e.lng, e.lat]; };
    if (!this.labelOcclusion.needsIndex(city.residentFeatures(), centre())) return;
    this.labelIndexScheduled = true;
    idleScheduler(() => {
      this.labelIndexScheduled = false;
      if (!this.labelOcclusionOn || !this._completeCity?.residentFeatures) return;
      this.labelOcclusion.index(this._completeCity.residentFeatures(), centre());
    });
  }
  get labelOcclusionOn(): boolean { return this._labelOcclusionOn; }
  /** The A/B switch: a still frame is not redrawn (render-on-change), so the switch asks for the frame that re-places the labels. */
  set labelOcclusionOn(on: boolean) { this._labelOcclusionOn = on; this.host?.triggerRepaint(); }
  private quizQuiet = false;
  private spoilersSuspended = false;
  private loader: LoaderFrame | null = null;
  private answeredKey = '';
  private ferryTrack: unknown = null;
  private poisLoading = false;
  private brandedPois: PointLabel[] = [];
  private placePois: PointLabel[] = [];
  private orientationPois: PointLabel[] = [];

  constructor(container: HTMLElement | null) {
    if (!container) throw new Error('OwnWorldView needs its container');
    this.container = container;
    const urlLook = urlBuildingLook(W().__canalRecallBuildings3d !== undefined ? W().__canalRecallBuildings3d : new URLSearchParams(W().location?.search ?? '').get('buildings3d'));
    if (urlLook) { this.buildingLookNow = urlLook; this.buildingLookLocked = true; }
    // The toon look (#161) starts from the Cartoon buildings look; an explicit ?buildings3d= still wins.
    const toon = toonLookFlag();
    if (toon && !urlLook) { this.buildingLookNow = 'cartoon'; this.buildingLookLocked = true; }
    const three = W().CanalRecallThree;
    if (!three?.THREE) throw new Error('OwnWorldView needs window.CanalRecallThree');
    const THREE = three.THREE;
    // MSAA unless the device reports ≤ 3 GB (vector-map.js canalRecallAntialias); phones cap at 1.25× (PHONE_PIXEL_RATIO).
    const memory = Number(W().navigator?.deviceMemory);
    const antialias = flag('msaa', '__canalRecallMsaa', !(Number.isFinite(memory) && memory > 0 && memory <= 3));
    const smaa = smaaFlag();
    const dpr = W().devicePixelRatio || 1;
    let cap = coarse() ? 1.25 : dpr;
    const askedDpr = Number(new URLSearchParams(W().location?.search ?? '').get('dpr'));
    if (Number.isFinite(askedDpr) && askedDpr > 0) cap = askedDpr;
    const sky = mapLibreSky() as Record<string, unknown> | null;
    const clear = typeof sky?.['sky-color'] === 'string' ? new THREE.Color(sky['sky-color']).getHex() : 0xbfd8ee;
    this.host = new FrameHost(THREE, container, {
      render: () => this.renderFrame(),
      // The game's loading screen (GameState.LOADING, presentationRuntime.ts) paints over the world opaquely.
      coveredFrameMs: () => (W().canalRecallGame?.state === LOADING_STATE ? COVERED_FRAME_MS : null),
      ...(toon || smaa ? { post: (renderer: any, width: number, height: number) => {
        if (smaa) (this.smaaPost ??= new SmaaPost(THREE)).apply(renderer, width, height);
        if (toon) (this.toonPost ??= new ToonPost(THREE)).apply(renderer, width, height);
      } } : {}),
    }, { antialias, pixelRatio: Math.min(dpr, cap), clearColor: clear, renderOnChange: flag('renderOnChange', '__canalRecallRenderOnChange', true), clearGuard: flag('skyClear', '__canalRecallSkyClear', true) });
    // GL work counters (engine/glCounters.ts, the P4 counters gate): opt-in, on window.__canalPerf.gl.
    if (flag('glCounters', '__canalRecallGlCounters', false)) {
      // three uploads geometry and links programs lazily inside its draw of an object: name that object as the owner.
      const renderer = this.host.renderer;
      let drawing: any = null, drawingMaterial: any = null;
      const renderBufferDirect = renderer.renderBufferDirect.bind(renderer);
      renderer.renderBufferDirect = (camera: any, scene: any, geometry: any, material: any, object: any, group: any) => {
        drawing = object; drawingMaterial = material;
        try { return renderBufferDirect(camera, scene, geometry, material, object, group); } finally { drawing = null; drawingMaterial = null; }
      };
      // Geometry is uploaded earlier, while three projects the scene (WebGLObjects.update), outside any draw. three
      // registers its dispose listener on a geometry the first time it sees it, just before that upload: the geometry
      // whose listener came last is the one uploading, and its mesh is found in the scene when an event needs a name.
      let seen: any = null;
      const geometryProto = THREE.BufferGeometry.prototype;
      const addEventListener = geometryProto.addEventListener;
      geometryProto.addEventListener = function (this: any, type: string, listener: any) {
        if (type === 'dispose') seen = this;
        return addEventListener.call(this, type, listener);
      };
      const meshOf = (geometry: any) => {
        let found: any = null;
        this._sharedFrame?.scene?.traverse?.((o: any) => { if (!found && o.geometry === geometry) found = o; });
        return found;
      };
      // The building chunk kind under a drawn object (coarse / near / extras / walls...), cached per object: the aerial
      // pan's draws per kind (lane R3-F #241).
      const kindOf = new WeakMap<object, string>();
      const chunkKind = (object: any): string => {
        let kind = kindOf.get(object);
        if (kind !== undefined) return kind;
        kind = '';
        const chunks: Map<string, any> | undefined = this._threeBuildings?.chunks;
        if (chunks) for (let o = object; o && !kind; o = o.parent) for (const [key, entry] of chunks) if (entry?.mesh === o) { kind = key.includes(':') ? key.slice(0, key.indexOf(':')) : 'walls'; break; }
        kindOf.set(object, kind);
        return kind;
      };
      const counters = new GlCounters({
        programNames: () => (renderer.info?.programs ?? []).map((p: any) => `${p.name}#${p.id}`),
        drawOwner: () => {
          if (!drawing) return 'outside a draw';
          const part = objectLabel(drawing).split(':')[0] || 'unnamed', kind = part === 'facades' ? chunkKind(drawing) : '';
          return `${part}${kind ? ` ${kind}` : ''}${drawingMaterial?.isMeshDepthMaterial || drawingMaterial?.isMeshDistanceMaterial ? ' (shadow)' : ''}`;
        },
        context: () => {
          if (drawing) return `${objectLabel(drawing)} [${drawingMaterial?.type ?? '?'}]`;
          const mesh = seen ? meshOf(seen) : null;
          return mesh ? `${objectLabel(mesh)} (new geometry)` : '';
        },
      });
      // Resident bytes by owner: the drawn object's label inside a draw, else (buffers) the geometry being uploaded,
      // named at report time from one scene walk (a WeakRef keeps a disposed geometry collectable).
      counters.resident.tagWith(kind => (drawing ? objectLabel(drawing).replace(/\d+/g, '#') : kind === 'buffer' && seen ? new WeakRef(seen) : `outside a draw (${kind === 'buffer' ? 'buffer' : 'render target or prewarm'})`), () => {
        const names = new Map<object, string>();
        this._sharedFrame?.scene?.traverse?.((o: any) => { if (o.geometry && !names.has(o.geometry)) names.set(o.geometry, objectLabel(o).replace(/\d+/g, '#')); });
        return (token: unknown) => typeof token === 'string' ? token : token instanceof WeakRef ? (g => (g ? names.get(g) ?? 'geometry not in the scene' : 'geometry collected'))(token.deref()) : String(token);
      });
      counters.install(renderer.getContext());
      this._glCounters = counters;
      W().__canalPerf = { ...(W().__canalPerf ?? {}), gl: { markWarm: () => counters.markWarm(), report: () => counters.report(), counters } };
    } else if (PerfHud.wantedAtStart(W())) {
      // The perf HUD's GPU MB (engine/perfHud.ts): the allocation tracker alone, only when the HUD is wanted at start.
      this._gpuResident = new GlResident();
      this._gpuResident.install(this.host.renderer.getContext());
    }
    // Quality tier (renderGovernor.ts): chosen once from a ~1 s fill probe and what the browser reports; it sets
    // the start and the ceiling of the knobs below, the governor steps inside it. `?tier=low|mid|high` forces one.
    const search = new URLSearchParams(W().location?.search ?? '');
    const asked = search.get('tier');
    const ratio = this.host.getPixelRatio();
    // The probe runs even when a tier is asked for: a forced tier then boots the same way as the tier it pins (the
    // probe's few frames shifted which coarse tiles stayed resident, auto vs `?tier=high` on the M4, 2026-11-01), and
    // specs that force a tier still report what this machine's probe measured.
    const probe = tierProbe(THREE, this.host.renderer, { deviceMemory: W().navigator?.deviceMemory, hardwareConcurrency: W().navigator?.hardwareConcurrency, dpr, coarse: coarse() },
      { width: Math.max(container.clientWidth, W().innerWidth || 0) * ratio, height: Math.max(container.clientHeight, W().innerHeight || 0) * ratio });
    const { tier, reasons } = chooseTier(probe, asked);
    const settings = TIER_SETTINGS[tier];
    const explicitDpr = Number.isFinite(askedDpr) && askedDpr > 0;
    if (!explicitDpr && this.host.getPixelRatio() > settings.dprCap) this.host.setPixelRatio(settings.dprCap);
    if (settings.facadeDetail && W().__canalRecallFacadeDetail === undefined && !search.has('facadeDetail')) W().__canalRecallFacadeDetail = settings.facadeDetail;
    // The ground reads these once, when it is built below; an explicit query or global still wins.
    if (settings.ground) {
      if (W().__canalRecallGroundDetail === undefined && !search.has('groundDetail')) W().__canalRecallGroundDetail = settings.ground.detail;
      if (W().__canalRecallGroundNear === undefined && !search.has('groundNear')) W().__canalRecallGroundNear = settings.ground.near;
      if (W().__canalRecallGroundRing === undefined && !search.has('groundRing')) W().__canalRecallGroundRing = settings.ground.ring;
    }
    this.qualityTier = { tier, reasons, settings: { ...settings, dprCap: Number.isFinite(settings.dprCap) ? settings.dprCap : null }, probe };
    W().__canalPerf = { ...(W().__canalPerf ?? {}), tier, tierReasons: reasons, tierSettings: this.qualityTier.settings, tierProbe: probe };
    console.info('[canal-recall] quality tier', tier, reasons.join(', ') || '-', probe ? `probe ${probe.frameMs} ms @${probe.fill.width}x${probe.fill.height}` : '');
    const prefs = W().CanalRecallPreferences;
    const maxPitch = prefs && Number.isFinite(prefs.MAP_MAX_PITCH) ? Math.max(60, prefs.MAP_MAX_PITCH) : 60;
    this.cameraMap = new CameraMap(this.host, { center: [4.9041, 52.3676], zoom: 17, maxPitch });
    // Settled (WorldCamera.whenIdle, game-route.js _waitForMapSettle) means every loader has caught up with the view.
    for (const [name, busy] of settleChecks(this)) this.cameraMap.addIdleCheck(name, busy);
    this.camera = this.cameraMap.api;
    const shadows = flag('shadows', '__canalRecallShadows', settings.shadows);
    this._sharedFrame = new SharedFrame(THREE, this.cameraMap, {
      host: { renderer: () => this.host.renderer },
      shadows,
      shadowMapSize: Math.min(coarse() ? 1024 : 2048, settings.shadowMapSize),
      shadowRamp: flag('transition', '__canalRecallTransition', true) && three.blendAtZoom ? (z: number) => three.blendAtZoom(z) : undefined,
    });
    this._sharedFrame.shadowStandIns = settings.standIns;
    (this.cameraMap as any)._canalSharedFrame = this._sharedFrame;
    this._sharedFrame.attach();
    const guards = guardFrameHost(this.host, {
      governor: flag('governor', '__canalRecallGovernor', true),
      fixedPixelRatio: new URLSearchParams(W().location?.search ?? '').has('dpr'),
      active: () => !!W().canalRecallGame && W().canalRecallGame.state === 4,
      setShadows: shadows ? on => this._sharedFrame.setShadows(on) : undefined,
      restoredOk: () => !!this._sharedFrame.renderer,
      probe: () => this.graphicsProbe(),
      maxPixelRatio: explicitDpr ? undefined : Math.min(dpr, cap, settings.dprCap),
    });
    this._renderGovernor = guards.governor;
    // Perf HUD (engine/perfHud.ts, lane R1-C #225): `?perfHud=1` or "Show performance"; `__canalPerf.snapshot()` is the
    // same numbers for the ride heartbeat and the stall report (rideHeartbeat.ts).
    W().__canalPerf = { ...(W().__canalPerf ?? {}), snapshot: (p99Ms: number | null = null) => this.perfSnapshot(p99Ms) };
    if (W().document?.body) { this._perfHud = new PerfHud(W(), { snapshot: p99 => this.perfSnapshot(p99) }); this._perfHud.start(); }
    const view = { center: () => this.camera.center(), zoom: () => this.camera.zoom() };
    this._lines = { cycle: new FlatLines('cycle-tracks', view), transit: new FlatLines('transit-network', view), hoods: new FlatLines('neighbourhoods', view) };
    this._sharedFrame.register('engine-hoods', this._lines.hoods, { order: -60 });
    this._sharedFrame.register('engine-transit', this._lines.transit, { order: -55 });
    this._sharedFrame.register('engine-cycle', this._lines.cycle, { order: -50 });
    // `?labelLazyPolicy=0`: the eager label rebuild (every named street re-tested in the frame the policy changes).
    this._labels = new LabelLayer(container, () => this.labelPolicy(), { lazyPolicy: flag('labelLazyPolicy', '__canalRecallLabelLazyPolicy', true) });
    // Paper over the map (menu, setup, loading) hides the labels without waiting for a repaint: a state change need
    // not move the map, so the check also runs on its own slow clock, as the MapLibre overlay's (labels/labelOverlay.ts).
    const syncCovered = () => { if (this._labels.setCovered(isCoveredState(W().canalRecallGame?.state))) this.host.triggerRepaint(); };
    syncCovered();
    W().setInterval(syncCovered, COVER_POLL_MS);
    if (three.HighlightMarker && three.highlightStyle?.() !== 'yellow') {
      try {
        this._highlightMarker = new three.HighlightMarker(THREE, this.cameraMap, {
          sharedFrame: this._sharedFrame,
          heightAt: (p: [number, number]) => (this._ownGround?.ready ? this._ownGround.heightAt(p) : 0),
          featuresById: (ids: string[]) => this._completeCity?.featuresById?.(ids) ?? null,
        });
      } catch (error) { this.fail('highlight marker', error); }
    }
    this.extras = new CityExtras({
      cameraMap: this.cameraMap, sharedFrame: this._sharedFrame, mercator: MERCATOR,
      extractPath: () => this.absoluteExtractRoot(),
      threeBuildings: () => this._threeBuildings,
      completeCity: () => this._completeCity,
      measuredColoursOnly: () => this.measuredColoursOnly,
      trees3d: flag('trees3d', '__canalRecallTrees3d', true),
      repaint: () => this.host.triggerRepaint(),
      relight: () => this.setActiveLandmark(this.activeLandmark),
      fail: (what, error) => this.fail(what, error),
    });
    this.host.start();
    void this.boot();
  }

  // ---- boot: participants ----
  private async boot(): Promise<void> {
    const vehicles = W().CanalRecallVehicles;
    if (vehicles) {
      const { PlayerBike3D, PlayerBoat3D, PlayerFerry3D, PlayerTransit3D } = vehicles;
      try {
        if (PlayerBike3D) this._playerBike = new PlayerBike3D(this.cameraMap, MERCATOR);
        if (PlayerFerry3D) this._playerFerry = new PlayerFerry3D(this.cameraMap, MERCATOR);
        if (PlayerBoat3D) this._playerBoat = new PlayerBoat3D(this.cameraMap, MERCATOR);
        if (PlayerTransit3D) this._playerTransit = new PlayerTransit3D(this.cameraMap, MERCATOR);
      } catch (error) { this.fail('vehicles', error); }
    }
    this.extras.start();
    this.ready = true;
    this.applyPendingAim();
    await Promise.all([this.loadOverview(), this.loadBuildings().then(() => this.extras.loadBagCovers()), this.loadOwnGround()]);
    this.status.booted = true;
  }

  private fail(what: string, error: unknown): void {
    console.warn(`[engine] ${what} unavailable`, error);
    (this.status.failed ??= [] as string[]) && (this.status.failed as string[]).push(`${what}: ${String((error as Error)?.message ?? error)}`);
  }

  private absoluteExtractRoot(): string {
    try { return new URL(this.extractPath, W().location.href).href.replace(/\/$/, ''); } catch (_) { return this.extractPath; }
  }

  private async loadOverview(): Promise<void> {
    try {
      // The geometry is built in the worker pool from a copy of the bytes while this thread decodes its own copy for
      // the water index and the labels (ownMap/overviewPool.ts, #129: 184 ms of boot -> submit); without a pool, or if
      // the worker fails, it is built here as before.
      const bytes = await fetchOverviewBytes(this.absoluteExtractRoot());
      // The facades layer owns the pool's stamped URL and loads in parallel: wait for its decision instead of racing it.
      const pooled = awaitWorkerPool().then(pool => overviewFromPool(pool, bytes, overviewTileGrid(), OVERVIEW_TILE_MIN_TRIANGLES));
      const data = await decodeOverviewBytes(bytes);
      const prebuilt = await pooled;
      this.status.overviewBuilt = prebuilt ? 'pool' : 'main';
      this._overview = new OverviewLayer(data, { center: () => this.camera.center(), zoom: () => this.camera.zoom(), rider: () => this.lastSubject, ground: () => (this._ownGround?.ready && this._ownGround.coversRect ? this._ownGround : null), repaint: () => this.host.triggerRepaint(), viewport: () => this.host.viewport() }, prebuilt);
      // First in the main pass, under every 3D participant.
      this._sharedFrame.register('engine-overview', this._overview, { order: -100 });
      this.status.overview = { water: data.water.length, parks: data.parks.length, streets: data.streets.length };
      this._labels.setOverview(data);
      this._overview.setTheme(this.theme);
      if (this._tileFeatures.length) this._overview.setFootprints(this._tileFeatures as never);
    } catch (error) { this.fail('overview', error); }
  }

  private facadesLib(): any {
    const lib = W().CanalRecallBuildings;
    return flag('facades', '__canalRecallFacades', true) && lib && lib.Facades ? lib.Facades : null;
  }

  private async loadBuildings(): Promise<void> {
    const runtime = W().CanalRecallBuildingTiles, api = W().CanalRecallThreeBuildings, Facades = this.facadesLib();
    if (!runtime?.BuildingTileStreamer || !api?.ThreeBuildings || !Facades) { this.fail('buildings', 'bundles missing'); return; }
    try {
      this._threeBuildings = new api.ThreeBuildings(this.cameraMap, MERCATOR, this.drawnLook());
      this._threeBuildings.attachToSharedFrame(this._sharedFrame);
      // The facade tier follows the pixel ratio the governor or tier sets (lane R1-B #224); `?cellTierFollow=0` keeps
      // the ratio the materials were created with.
      if (flag('cellTierFollow', '__canalRecallCellTierFollow', true) && this._threeBuildings.setCellTierPixelRatio) {
        const buildings = this._threeBuildings;
        this.host.on('resize', () => { if (this._threeBuildings === buildings) buildings.setCellTierPixelRatio(this.host.getPixelRatio()); });
      }
      if (this.streetFronts && this._threeBuildings.setStreets) this._threeBuildings.setStreets(this.streetFronts);
      this.streetFronts = null;
      this._threeBuildings.setVisible(true);
      if (this.buildingsRoute) this._threeBuildings.setRoute?.(this.buildingsRoute);
      const city = this._completeCity = new runtime.BuildingTileStreamer(this.cameraMap, 'osm-building-appearance', this.extractPath);
      // No MapLibre source to feed: the streamer answers featuresAt / sampleFeatures itself.
      city.setPublishing?.(false);
      // Years, roof facts, then the rail infrastructure table (viaduct pands dropped, platform canopies cut): the one
      // composition the world compiler bakes into world-v1 cells too (gameTileEnricher.ts).
      city.setTileEnricher(gameTileEnricher(Facades, this.extractPath) as any);
      this.decorateCity();
      void this.loadDecorationExtracts();
      if (!(await city.probe())) { this.fail('buildings', 'tiles not published'); return; }
      city.attach(() => { this._completeCityHasBuildings = true; this.status.firstBuildingsAt = performance.now(); }, (features: any[]) => {
        this._tileFeatures = features;
        this._overview?.setFootprints(features);
        this.extras.setBuildingFeatures(features);
        try { this._threeBuildings.setFeatures(features); } catch (error) { console.warn('[engine] facade sync failed', error); }
      });
      this.applyPendingAim();
      this.status.buildings = true;
    } catch (error) { this.fail('buildings', error); }
  }

  /** Monument gables, listed landmarks, landmark building ids: what the live tile path decorates with (vector-map.js). */
  private decoration: { gables: Map<string, unknown> | null; listed: Set<string> | undefined; landmarks: Set<string> } = { gables: null, listed: undefined, landmarks: new Set() };

  /**
   * The building decorator, as vector-map.js `_applyFeatureDecorator` builds it: facade, monument gable, roof, landmark
   * exceptions, kit roof, measured front, shopfront. Re-set when an extract arrives, which re-decorates the resident
   * tiles. Compiled world-v1 cells carry these already; the live tile path (`?world=live`) needs them here, or the
   * world A/B compared cells against undecorated tiles (every feature's `shopQuiet` differed, #129 round 22).
   */
  private decorateCity(): void {
    const api = W().CanalRecallThreeBuildings, Facades = this.facadesLib(), city = this._completeCity;
    if (!api || !Facades || !city) return;
    const { gables, listed, landmarks } = this.decoration;
    const named = gables?.size && api.withMonumentGable ? (f: any) => api.withMonumentGable(f, gables) : (f: any) => f;
    const decorate = api.decorateRoof ? (f: any) => api.decorateRoof(named(Facades.decorateFacade(f))) : Facades.decorateFacade;
    const base = api.exceptLandmarks ? api.exceptLandmarks(decorate, landmarks, listed) : decorate;
    city.setFeatureDecorator(api.decorateKitRoof ? (f: any) => api.decorateShopfront(api.decorateFront(api.decorateKitRoof(base(f)))) : base);
  }

  /** Shopfronts, monument gables and landmark building ids, fetched once each (as vector-map.js does); each re-decorates. */
  private async loadDecorationExtracts(): Promise<void> {
    const api = W().CanalRecallThreeBuildings;
    const json = async (file: string) => { try { const r = await fetch(`${this.extractPath}/${file}`); return r.ok ? await r.json() : null; } catch (_) { return null; } };
    await Promise.all([
      json('shopfronts.json').then(data => { if (data && api?.setShopfronts) { api.setShopfronts(data); this.decorateCity(); } }),
      json('monument-gables.json').then(data => {
        if (!data) return;
        this.decoration.gables = new Map(Object.entries(data.buildings || {}));
        this.decoration.listed = new Set(data.listedLandmarks || []);
        this.decorateCity();
      }),
      json('landmark-buildings.json').then(data => {
        if (!data) return;
        for (const list of Object.values<string[]>(data.buildings || {})) for (const id of list) this.decoration.landmarks.add(String(id));
        this.decorateCity();
      }),
    ]);
  }

  private async loadOwnGround(): Promise<void> {
    try {
      const three = W().CanalRecallThree;
      if (!W().CanalRecallOwnGround) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = OWN_GROUND_BUNDLE;
          script.onload = resolve;
          script.onerror = () => reject(new Error(`${OWN_GROUND_BUNDLE} failed to load`));
          document.head.appendChild(script);
        });
      }
      const api = W().CanalRecallOwnGround;
      // Every device frees the ground's CPU arrays once uploaded (81 MB on the desktop ride start, heap gate #130);
      // a lost context rebuilds the resident cells from the worker. Phones also draw through the tiles only.
      const budget: Record<string, unknown> = { releaseArrays: W().__canalRecallKeepGroundArrays !== true, tilesOnly: coarse() };
      if (coarse()) budget.radiusM = 400;
      this._ownGround = new api.OwnGround(three.THREE, this._sharedFrame, {
        repaint: () => this.host.triggerRepaint(),
        setBasemapGroundHidden: () => { /* no basemap */ },
      }, { workerUrl: new URL(OWN_GROUND_WORKER, W().location.href).href, ...budget });
      await this._ownGround.load(this.absoluteExtractRoot());
      if (this._threeBuildings?.setWaterLevel) this._threeBuildings.setWaterLevel(this._ownGround.waterLevelM());
      const s = this.ownGroundState;
      if (s.route !== undefined) this._ownGround.setRoute(s.route);
      if (s.highlight !== undefined) this._ownGround.setHighlight(s.highlight);
      if (s.destination !== undefined) this._ownGround.setDestination(s.destination);
      this.status.ownGround = true;
    } catch (error) { this.fail('ownGround', error); this._ownGround = null; }
  }

  /** Create the far tier once the facades and a compiled world (with far prisms) are up; feed it the far radius. */
  private updateFarShells(subject: [number, number], radiusM: number): void {
    if (!this.farShellsOn) return;
    if (!this._farShells) {
      const tb = this._threeBuildings, world = this._completeCity?.worldClient;
      if (!tb?.farShellHost || !world?.farCells || !tb.farShellHost()) return;
      const available = world.farCells();
      if (!available.size) { this.farShellsOn = false; return; } // an index compiled without --shell
      this._farShells = new FarShells({
        THREE: tb.farShellHost().THREE,
        scene: () => tb.farShellHost()?.scene ?? null,
        material: () => tb.farShellHost()?.material ?? null,
        fadeMaterial: (v: number) => tb.farShellHost()?.fadeMaterial(v) ?? null,
        coarseDrawn: (tile: string, cell?: string) => !!tb.farShellHost()?.coarseDrawn(tile, cell),
        origin: farCellOrigin,
        fetchFar: (key: string, signal: AbortSignal) => world.far(key, signal),
        available: () => available,
        repaint: () => this.host.triggerRepaint(),
      }, { touch: coarse() });
    }
    // The prisms carry the photo look's colours; another look (cartoon, plain) draws no far tier.
    this._farShells.setEnabled(this.drawnLook() === 'photo' && this._threeBuildings?.visible !== false);
    this.updateBakedCoarse(subject);
    this._farShells.update(subject[0], subject[1], radiusM);
    this._farShells.frame();
  }

  /**
   * The baked coarse tier (lane R4-A #243): created with the far tier once the facades and a compiled world with SHEL
   * are up, refused when the compile's layer table is not this build's (shellLayers.ts), off for a look other than the
   * baked one. Fed the camera subject; a slice per frame lifts buildings onto the own ground with the facade re-base's
   * budget (BASE_REFRESH_BUDGET_MS, R3-F #241), restarted from the nearest cell on each new ground revision; from the
   * air only the cells where the detail tier swaps in.
   */
  private updateBakedCoarse(subject: [number, number]): void {
    if (!this.bakedCoarseOn) { this.bakedCoarseOff ??= 'flag'; return; }
    const tb = this._threeBuildings, world = this._completeCity?.worldClient;
    if (!this._bakedCoarse) {
      const host = tb?.bakedCoarseHost?.();
      if (!host || !world?.shellCells) return;
      const available = world.shellCells(), shells = world.index?.shells;
      if (!available.size || !shells?.shel) { this.bakedCoarseOn = false; this.bakedCoarseOff = 'no-shel'; return; }
      if (shells.layers !== host.layerHash) { this.bakedCoarseOn = false; this.bakedCoarseOff = `layer-table ${shells.layers ?? 'none'} != ${host.layerHash}`; console.warn(`baked coarse: ${this.bakedCoarseOff}; runtime coarse shells`); return; }
      if (shells.look !== 'photo') { this.bakedCoarseOn = false; this.bakedCoarseOff = `look ${shells.look}`; return; }
      let base: string | undefined;
      try { const asked = new URLSearchParams(W().location?.search ?? '').get('worldShells'); if (asked) base = new URL(asked, W().location.href).href; } catch { /* no override */ }
      const baked: BakedCoarse = new BakedCoarse({
        THREE: host.THREE,
        scene: () => tb.bakedCoarseHost()?.scene ?? null,
        material: () => tb.bakedCoarseHost()?.material ?? null,
        fadeMaterial: (v: number) => tb.bakedCoarseHost()?.fadeMaterial(v) ?? null,
        attach: entry => tb.bakedCoarseHost()?.attach(entry),
        detach: entry => tb.bakedCoarseHost()?.detach(entry),
        swapSlots: () => !!tb.bakedCoarseHost()?.swapSlots(),
        fetchShell: (key: string, signal: AbortSignal, exact?: boolean) => world.shell(key, signal, base, exact),
        available: () => available,
        coverageChanged: () => tb.bakedCoarseHost()?.regroup(),
        groundBase: (id: string) => tb.bakedCoarseHost()?.groundBase(id),
        repaint: () => this.host.triggerRepaint(),
      }, { touch: coarse(), paceInstalls: !!arrivalPaceOption()?.baked });
      this._bakedCoarse = baked;
      host.setGate({ plan: (cells: ReadonlySet<string>) => baked.plan(cells), covers: (cell: string) => baked.covers(cell), drawn: (cell: string) => baked.drawn(cell), contextLost: () => baked.contextLost() });
      host.setFrame(() => baked.frame());
    }
    const baked = this._bakedCoarse;
    const photo = this.drawnLook() === 'photo';
    if (!photo && baked.isEnabled) this.bakedCoarseOff = `look ${this.drawnLook()}`;
    baked.setEnabled(photo);
    if (!photo) return;
    const cam = this.cameraMap.camera;
    const street = !isAerialView(cam.zoom, cam.pitch, cam.lat);
    baked.update(subject[0], subject[1], street);
    // Street level: cells within BAKED_LIFT_RADIUS_M; from the air only the detail tier's neighbourhood (bakedCoarse.ts).
    const revision = this._ownGround?.surfaceRevision;
    const restart = revision !== undefined && revision !== this.bakedGroundRevision;
    this.bakedGroundRevision = revision;
    baked.refreshShellBases({ ms: BASE_REFRESH_BUDGET_MS, restart });
    baked.frame();
  }

  private riderSurface(): any { return this._ownGround && this._ownGround.ready ? this._ownGround : null; }
  private easeRiderSurface(target: number): number {
    const v = Number.isFinite(target) ? target : 0, d = v - this.riderSurfaceM;
    this.riderSurfaceM = Math.abs(d) < 0.01 ? v : this.riderSurfaceM + d * 0.35;
    return this.riderSurfaceM;
  }

  private syncGroundConsumers(lap?: (name: string) => void, aerial = false, centre: readonly [number, number] = [0, 0]): void {
    const ground = this._ownGround;
    if (!ground || !ground.ready) return;
    const tb = this._threeBuildings;
    if (tb && !this.groundHooked.has(tb) && tb.setGroundBase) {
      this.groundHooked.add(tb);
      tb.setGroundBase((feature: any) => {
        const g = feature?.geometry;
        const ring = g?.type === 'Polygon' ? g.coordinates[0] : g?.type === 'MultiPolygon' ? g.coordinates[0]?.[0] : null;
        return ring && ring.length >= 3 ? ground.footprintBase(ring) : null;
      });
    }
    this.extras.hookGround(ground, this.stagedGroundHook);
    if (this.extrasRebaseDue) {
      lap?.('ground update: consumers');
      this.extrasRebaseDue = false;
      this.extras.refreshGroundBases();
      lap?.('ground update: extras bases');
      return;
    }
    if (this.groundBasesAerialOn && this.syncGroundBasesAerial(ground, tb, aerial, centre, lap)) return;
    if (ground.surfaceRevision === this.groundRevision) return;
    const now = performance.now();
    if (this.groundRefreshAt && now - this.groundRefreshAt < 400) return;
    this.groundRefreshAt = now;
    this.groundRevision = ground.surfaceRevision;
    lap?.('ground update: consumers');
    tb?.refreshGroundBases?.();
    lap?.('ground update: building bases');
    if (this.stagedGroundHook) { this.extrasRebaseDue = true; return; }
    this.extras.refreshGroundBases();
    lap?.('ground update: extras bases');
  }

  /**
   * `?groundBasesAerial` (default on): hold the re-base while aerial, then catch up in slices. True when this frame's
   * ground-base work is handled here (held, or a slice ran); false hands over to the street-level re-base.
   */
  private syncGroundBasesAerial(ground: any, tb: any, aerial: boolean, centre: readonly [number, number], lap?: (name: string) => void): boolean {
    if (aerial) {
      if (ground.surfaceRevision !== this.groundRevision) {
        if (!this.groundBasesHeld) this.groundBaseStats.held++;
        this.groundBasesHeld = true;
        this.groundBaseStats.heldFrames++;
      }
      return this.groundBasesHeld || this.groundBasesSlicing;
    }
    if (!this.groundBasesHeld && !this.groundBasesSlicing) return false;
    const now = performance.now();
    // A new revision restarts the pass from the nearest chunk, at most every 400 ms (the street-level throttle).
    const bumped = ground.surfaceRevision !== this.groundRevision && (!this.groundRefreshAt || now - this.groundRefreshAt >= 400);
    const restart = this.groundBasesHeld || bumped;
    if (restart) { this.groundRevision = ground.surfaceRevision; this.groundRefreshAt = now; }
    if (this.groundBasesHeld) this.groundBaseStats.catchUps++;
    this.groundBasesHeld = false;
    lap?.('ground update: consumers');
    const budget: { ms: number; centre: readonly [number, number]; restart: boolean; done?: boolean } = { ms: BASE_REFRESH_BUDGET_MS, centre, restart };
    tb?.refreshGroundBases?.(budget);
    this.groundBaseStats.slices++;
    lap?.('ground update: building bases (sliced)');
    // An older buildings bundle ignores the budget and re-bases everything at once: that is done too.
    if (budget.done === false) { this.groundBasesSlicing = true; return true; }
    this.groundBasesSlicing = false;
    // The extras (trees, furniture, landmarks) re-base on the next frame, as the staged hook does.
    if (this.stagedGroundHook) this.extrasRebaseDue = true;
    else { this.extras.refreshGroundBases(); lap?.('ground update: extras bases'); }
    return true;
  }

  // ---- the frame ----
  private renderFrame(): void {
    const phases = framePhases(), t0 = phases ? performance.now() : 0;
    const clip = this.cameraMap.camera.clipFromMercator();
    if (phases) phases.add('camera matrix', performance.now() - t0);
    this._sharedFrame.drive(clip);
    const t1 = phases ? performance.now() : 0;
    this.drawLabels();
    if (phases) phases.add('labels', performance.now() - t1);
    this._glCounters?.endFrame();
  }

  /**
   * The spoiler index of `names`, rebuilt only when the names change. The policy key also turns over when a street is
   * learned (names/known sizes); rebuilding the same index then cost 60-75 ms at 4x and emptied poiNameSpoils' memo,
   * so the label rebuild re-tested every POI (#129 hand-back 16). The index is a pure function of the names: exact.
   */
  private spoilerIndexCache: { names: string[]; index: SpoilerIndex } | null = null;
  private spoilerIndexFor(names: readonly string[]): SpoilerIndex {
    const c = this.spoilerIndexCache;
    if (c && c.names.length === names.length && c.names.every((n, i) => n === names[i])) return c.index;
    const index = buildSpoilerIndex(names);
    this.spoilerIndexCache = { names: names.slice(), index };
    return index;
  }

  /** The game's spoiler screen (labelPolicy.ts gameLabelContext) from the live game, cached by what it reads. */
  private policyCache: { key: string; ctx: LabelContext } | null = null;
  private labelPolicy(): LabelContext & { revision?: string } {
    const g = W().canalRecallGame || {};
    const names: ReadonlySet<string> = g._mapLabelNames instanceof Set ? g._mapLabelNames : new Set();
    const known: ReadonlyMap<string, any> = g._knownPlaces instanceof Map ? g._knownPlaces : new Map();
    const spoilers = this.spoilersSuspended ? [] : this.spoilerNames;
    const key = `${names.size}|${known.size}|${spoilers.length}|${g.quizPromptName || ''}|${g.quizCandidateName || ''}|${this.quizQuiet}|${this._labelsVisible}`;
    if (this.policyCache?.key !== key) {
      const loader = this.loader;
      const ctx = gameLabelContext({
        mapLabelNames: names, knownPlaces: known, knownRadius: 600 * 3,
        quizPromptName: g.quizPromptName, quizCandidateName: g.quizCandidateName,
        spoilerNames: spoilers, spoilerIndex: this.spoilerIndexFor(spoilers), quizQuiet: this.quizQuiet,
        toWorld: (x, y) => { const [lng, lat] = fromLocal(x, y); return loader && loader._lastCenterLat != null ? lngLatToWorld(lng, lat, loader) : { x: NaN, y: NaN }; },
      });
      // Street and water names on the map only with the labels toggle on (D), as the basemap's were.
      const labelsOn = this._labelsVisible;
      const isLabelled = ctx.isLabelled;
      this.policyCache = { key, ctx: { ...ctx, isLabelled: (t, x, y) => labelsOn && isLabelled(t, x, y), revision: key } as LabelContext };
    }
    return this.policyCache.ctx;
  }

  private drawLabels(): void {
    const cam = this.cameraMap.camera;
    const zoom = cam.zoom;
    if (zoom >= 16 && !this.poisLoading) { this.poisLoading = true; void this.loadPois(); }
    const [lx, ly] = toLocal(cam.lng, cam.lat);
    const frame = cameraFrame({ center: [lx, ly], zoom, bearing: cam.bearing, pitch: cam.pitch, fovDeg: cam.fovDeg, elevation: cam.elevation }, this.host.viewport(), cam.lat);
    const b = cam.bounds();
    const [x0, y0] = toLocal(b.west, b.south), [x1, y1] = toLocal(b.east, b.north);
    // POI labels behind nearer buildings are not drawn (engine/labelOcclusion.ts), tested against the resident
    // footprints at each full placement only (the grid is (re)built lazily there, not per frame). Every resident, not
    // sampleFeatures' first 20,000: the city holds ~36,000 and the cap dropped the blocks around the camera.
    // `?labelOcclusion=0` turns it off.
    const city = this._completeCity;
    const aerial = this.labelAerial = this.labelAerialCapOn && isAerialView(zoom, cam.pitch, cam.lat);
    this._labels.aerialCap = aerial ? AERIAL_LABEL_CAP : null;
    // From the air only (no occlusion there): full placements in slices, and at most every 800 ms while panning.
    this._labels.placeBudgetMs = aerial ? this.labelBudgetMs : null;
    this._labels.clipTries = this.labelClipTriesOn;
    // From the air only signature-landmark POIs keep their names (`?labelAerialPois=all`: every POI, as before).
    this._labels.aerialPoisOnly = this._labels.hoodsOnce = aerial && this.labelAerialPois !== 'all';
    // ... and only the AERIAL_POI_MAX of them nearest and most prominent (`?labelAerialPois=N`).
    this._labels.aerialPoiMax = aerial && this.labelAerialPois !== 'all' ? this.labelAerialPois : null;
    this._labels.sticky = aerial && this.labelStickyOn;
    this._labels.movingCadenceMs = aerial && this.labelBudgetMs !== null ? AERIAL_LABEL_CADENCE_MS : null;
    if (this.labelOcclusionOn && !aerial && city?.residentFeatures) {
      const eye = cam.eye();
      let indexed = false;
      this._labels.setOcclusion(c => {
        if (!indexed) { indexed = true; this.indexLabelOcclusion(city.residentFeatures(), [eye.lng, eye.lat]); }
        const [lng, lat] = fromLocal(c.at![0], c.at![1]);
        return this.labelOcclusion.occluded(c.id, [lng, lat], eye);
      }, id => { const f = this.labelOcclusion.front.get(id); return f ? toLocal(f[0], f[1]) : null; }, (id, anchors) => {
        if (!indexed) { indexed = true; this.indexLabelOcclusion(city.residentFeatures(), [eye.lng, eye.lat]); }
        // Any blocked point hides the name (the default engine's street-name rule, labels/streetLabelOcclusion.ts).
        let blocked = false;
        anchors.forEach((a, k) => { if (this.labelOcclusion.occluded(`${id}#${k}`, fromLocal(a[0], a[1]), eye)) blocked = true; });
        return blocked;
      });
    } else this._labels.setOcclusion(null);
    this._labels.draw(frame, [x0, y0, x1, y1], zoom, this.host.getPixelRatio(), p => { const [lng, lat] = fromLocal(p[0], p[1]); return cam.project([lng, lat]); }, [lx, ly, zoom, cam.bearing, cam.pitch]);
  }

  private indexLabelOcclusion(features: Parameters<LabelOcclusion['index']>[0], centre: [number, number]): void {
    const phases = framePhases(), t0 = phases ? performance.now() : 0;
    this.labelOcclusion.index(features, centre);
    if (phases) phases.add('labels: occlusion index (inside occlusion)', performance.now() - t0);
  }

  private async loadPois(): Promise<void> {
    try {
      const r = await fetch(`${this.absoluteExtractRoot()}/orientation-pois.json`);
      if (!r.ok) throw new Error(`orientation-pois: ${r.status}`);
      const b = new Uint8Array(await r.arrayBuffer());
      const text = b[0] === 0x1f && b[1] === 0x8b ? await new Response(new Blob([b as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))).text() : new TextDecoder().decode(b);
      // The spoiler screen runs per frame (labelPolicy); ownPoiFeatures only thins here.
      const fc = ownPoiFeatures(JSON.parse(text) as OrientationPoiFile, () => false);
      this.orientationPois = fc.features.map(f => ({ id: `own:${f.properties.name}:${(f.geometry.coordinates as number[])[0].toFixed(5)}`, text: f.properties.name, kind: 'poi' as const, priority: f.properties.rank, lngLat: f.geometry.coordinates as [number, number] }));
      this.pushPois();
    } catch (error) { this.fail('pois', error); }
  }
  private pushPois(): void { this._labels.setPois([...this.orientationPois, ...this.placePois, ...this.brandedPois]); }

  private graphicsProbe(): Record<string, unknown> {
    const r = this.host.renderer;
    return {
      engine: 'own', tier: this.qualityTier?.tier ?? null, zoom: Math.round(this.camera.zoom() * 10) / 10, pitch: Math.round(this.camera.pitch()),
      programs: r?.info?.programs?.length ?? null, geometries: r?.info?.memory?.geometries ?? null, textures: r?.info?.memory?.textures ?? null,
      lastFrameCalls: this._sharedFrame.stats.main.calls, lastFrameTriangles: this._sharedFrame.stats.main.triangles,
    };
  }

  // ---- WorldView: frame / camera ----
  frameCanvas(): HTMLCanvasElement { return this.host.canvas; }
  /** What the page holds now (engine/perfHud.ts PerfSnapshot): a few Map sizes and counters, cheap enough for 1 Hz. */
  perfSnapshot(p99Ms: number | null = null): PerfSnapshot {
    const size = (v: any): number | null => (v && typeof v.size === 'number' ? v.size : Array.isArray(v) ? v.length : null);
    const memory = W().performance?.memory, info = this.host.renderer?.info?.memory;
    const gpu = this._glCounters ? this._glCounters.resident.report().totalMB : this._gpuResident ? this._gpuResident.report().totalMB : null;
    return {
      tier: this.qualityTier?.tier ?? null, dpr: this.host.getPixelRatio(),
      heapMB: memory?.usedJSHeapSize ? Math.round(memory.usedJSHeapSize / 1048576) : null,
      gpuMB: gpu, geometries: info?.geometries ?? null, textures: info?.textures ?? null,
      cells: size(this._completeCity?.cache?.tiles), chunks: size(this._threeBuildings?.chunks), models: size(this.extras?.signature?._entries),
      p99Ms: p99Ms != null ? Math.round(p99Ms) : null,
    };
  }

  captureFrame(): Promise<HTMLCanvasElement | null> {
    return new Promise(resolve => { this.host.once('render', () => resolve(this.host.canvas)); this.host.triggerRepaint(); });
  }
  jumpToLngLat(options: JumpOptions): void { this.cameraMap.jumpTo(options); }

  /**
   * Held-camera harnesses (2026-11-07, user: "screenshot logic needs to wait for pop-in"): frame specs replace `sync`
   * to hold the camera, which also froze the far and baked coarse tiers (their fetch, dissolve and ground lift run
   * from `sync` via updateFarShells). The baked tier marks a cell covered (runtime coarse hidden) as soon as it is
   * planned, so a held frame showed empty blocks where cells sat mid-dissolve. This runs that tier work for the held
   * camera's centre; `worldSettled()` says when every tier has landed. Not called by the game.
   */
  settleTick(): void {
    const cam = this.cameraMap.camera, subject: [number, number] = [cam.lng, cam.lat];
    this._ownGround?.update(subject, cam.zoom, cam.pitch);
    this.updateFarShells(subject, this._ownGround?.farRadiusM ?? 0);
    this.host.triggerRepaint();
  }

  /** Every streaming tier landed for the current view: ground, city tiles, facades, far and baked coarse (dissolves included). */
  worldSettled(): { settled: boolean; ground: boolean; city: boolean; buildings: boolean; far: boolean; baked: boolean; detail: Record<string, unknown> } {
    const g: any = this._ownGround, c: any = this._completeCity?.status?.(), tb: any = this._threeBuildings;
    const fading = g ? [...(g.resident?.values?.() ?? [])].filter((r: any) => r.fade).length : 0;
    const ground = !g || (!!g.ready && (g.loadingCells ?? 0) === 0 && fading === 0);
    const city = !c || (!c.inFlight && !c.queued && !c.styling);
    const buildings = !tb || ((tb.pending?.length ?? 0) === 0 && !tb.cellRolloffPending);
    const fs = this._farShells?.stats?.(), bs = this._bakedCoarse?.stats?.();
    const far = !fs || fs.pending === 0;
    const baked = !bs || !bs.enabled || (bs.pending === 0 && bs.fading === 0 && bs.cells >= bs.covered);
    return { settled: ground && city && buildings && far && baked, ground, city, buildings, far, baked, detail: { groundFading: fading, city: c && { inFlight: c.inFlight, queued: c.queued, styling: !!c.styling }, buildingsPending: tb?.pending?.length ?? 0, far: fs && { pending: fs.pending }, baked: bs && { covered: bs.covered, cells: bs.cells, drawn: bs.drawn, fading: bs.fading, pending: bs.pending } } };
  }

  setExtractRoot(path: string): void { if (path) this.extractPath = path.replace(/\/$/, ''); }
  setCameraTilt(degrees: number): void {
    const prefs = W().CanalRecallPreferences;
    const min = prefs && Number.isFinite(prefs.CAMERA_TILT_MIN) ? prefs.CAMERA_TILT_MIN : -36;
    const max = prefs && Number.isFinite(prefs.CAMERA_TILT_MAX) ? prefs.CAMERA_TILT_MAX : 36;
    const v = Number(degrees);
    this._cameraTilt = Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : 0;
  }
  setLandmarkView(view: { pitchDeg: number; leadM: number } | null): void { this.landmarkView = view && (view.pitchDeg > 0 || view.leadM > 0) ? view : null; }
  highlightTarget(): { lngLat: [number, number]; heightM: number } | null { return this._highlightMarker?.target?.() || null; }

  /** vector-map.js pitchForViewMode, same constants (COCKPIT/CHASE/TOPDOWN globals, game/preferences.ts). */
  pitchForViewMode(viewMode: string): number {
    const g = W();
    const chase = viewMode === 'chase', cockpit = viewMode === 'cockpit';
    const base = cockpit ? globalNum('COCKPIT_PITCH_DEGREES', 84)
      : chase ? globalNum('CHASE_PITCH_DEGREES', 60) : globalNum('TOPDOWN_TILT_DEGREES', 14);
    if (!chase && !cockpit) return base;
    const prefs = g.CanalRecallPreferences;
    if (chase && prefs && typeof prefs.chasePitch === 'function') {
      if (this.chasePitchBase === undefined) {
        let asked = null;
        try { asked = typeof prefs.parseChasePitchBase === 'function' ? prefs.parseChasePitchBase(new URLSearchParams(g.location.search).get('chasePitch')) : null; } catch (_) { /* none */ }
        this.chasePitchBase = asked;
      }
      return this.chasePitchBase == null ? prefs.chasePitch(this._cameraTilt || 0) : prefs.chasePitch(this._cameraTilt || 0, this.chasePitchBase);
    }
    return Math.max(0, Math.min(60, base + (this._cameraTilt || 0)));
  }
  zoomOffsetForViewMode(viewMode: string): number {
    if (viewMode === 'cockpit') return globalNum('COCKPIT_ZOOM_OFFSET', 1.45);
    if (viewMode === 'chase') return globalNum('CHASE_ZOOM_OFFSET', 0.3);
    return 0;
  }
  get _pitchSmoothed(): number | null { return this.solver.pitchSmoothed; }
  set _pitchSmoothed(v: number | null) { this.solver.pitchSmoothed = v; }

  aimAtWorld(worldX: number, worldY: number, loader: LoaderFrame, options: { zoom?: number; bearing?: number; pitch?: number } = {}): void {
    this.pendingAim = { worldX, worldY, loader, options };
    if (Number.isFinite(options.pitch)) this.solver.pitchSmoothed = options.pitch!;
    this.applyPendingAim();
  }
  private applyPendingAim(): void {
    const p = this.pendingAim;
    if (!p || !this.ready || !p.loader || p.loader._lastCenterLat == null) return;
    const [lng, lat] = worldToLngLat(p.worldX, p.worldY, p.loader);
    this.cameraMap.jumpTo({ center: [lng, lat], zoom: Number.isFinite(p.options.zoom) ? p.options.zoom : this.camera.zoom() || 17, bearing: p.options.bearing ?? 0, pitch: p.options.pitch ?? globalNum('TOPDOWN_TILT_DEGREES', 14) });
    this._threeBuildings?.setDetailCentre?.(lng, lat);
    this._completeCity?.followCamera?.();
  }

  resizeToViewport(): void {
    this.container.style.width = '100%'; this.container.style.height = '100%';
    this.container.style.left = '0px'; this.container.style.top = '0px';
    this.host.resize();
  }
  resize(width: number, height: number): void {
    this.container.style.width = `${width}px`; this.container.style.height = `${height}px`;
    this.container.style.left = `${(W().innerWidth - width) / 2}px`; this.container.style.top = `${(W().innerHeight - height) / 2}px`;
    this.host.resize();
  }

  sync(camera: GameCamera & { projector?: unknown }, loader: LoaderFrame, canvas: HTMLCanvasElement): void {
    if (!this.ready || !camera || !loader || !canvas || loader._lastCenterLat == null) return;
    this.loader = loader;
    const phases = framePhases();
    let pt = phases ? performance.now() : 0;
    const lap = (name: string) => { if (!phases) return; const t = performance.now(); phases.add(`sync: ${name}`, t - pt); pt = t; };
    const view = this.solver.request(camera, loader, {
      pitchForViewMode: m => this.pitchForViewMode(m), zoomOffsetForViewMode: m => this.zoomOffsetForViewMode(m),
      landmarkView: this.landmarkView, displayScale: canvas.getBoundingClientRect().width / CANVAS_W, now: performance.now(),
    });
    const surface = this.riderSurface();
    const elevation = surface ? (view.detached || view.introFlat > 0 ? 0 : this.riderSurfaceM) : 0;
    if (view.needsClearance && this._completeCity?.sampleFeatures) {
      const result = clearCamera(view.pitch, view.lngLat, view.subject, pitch => {
        const probe = new EngineCamera(() => this.host.viewport(), { center: view.lngLat, zoom: view.zoom, bearing: view.bearing, pitch, elevation, maxPitch: this.cameraMap.camera.maxPitch });
        const e = probe.eye();
        return { lngLat: [e.lng, e.lat], altitude: e.altitudeM };
      }, () => clearanceResidents(this._completeCity as { sampleFeatures(limit: number): any[] }));
      if (result) this.solver.safePitch = result.safePitch;
      (this as any)._lastCameraClearance = result;
    }
    const pitch = this.solver.applyClearance(view, !!camera.reducedMotion);
    lap('camera solve and clearance');
    const city = this._completeCity;
    if (view.introFlat > 0 && city?.setSuspended) {
      city.setSuspended(true);
      if (!this.introLanding) { this.introLanding = true; city.preloadAt?.(view.subject[0], view.subject[1]); }
    }
    // Landmark models and trees hold what the driving view loaded: "visible" at city scale is all of Amsterdam.
    if (view.introFlat > 0) this.extras.setSuspended(true);
    if (view.introFlat === 0) this.introLanding = false;
    if (this._ownGround) {
      // Panned off the rider (RE-CENTER showing), the ground's ring follows the view, not the rider (#232: the user's
      // S4 corridor 2.8 km from the rider drew from the far ring, no ballast beds); `?groundView=0` follows the rider.
      this._ownGround.update(groundCentre(view, this.groundView), view.introFlat > 0 ? 0 : view.zoom, pitch);
      lap('ground update: own ground');
      const aerialGround = this.groundBasesAerialOn && view.introFlat === 0 && isAerialView(view.zoom, pitch, view.lngLat[1]);
      this.syncGroundConsumers(phases ? lap : undefined, aerialGround, view.lngLat);
    }
    lap('ground update');
    this.updateFarShells(view.subject, view.introFlat > 0 ? 0 : (this._ownGround?.farRadiusM ?? 0));
    lap('far shells');
    this.cameraMap.jumpTo({ center: view.lngLat, zoom: view.zoom, bearing: view.bearing, pitch, elevation });
    lap('jumpTo and move listeners');
    this.lastSubject = view.subject;
    // From the air the detail block keeps its last plan (detailRing.ts detailBlockFrozen, lane R3-G #242): panning at
    // ~150 m no longer builds and dissolves detail tiles at every z16 edge the subject crosses. Not during the intro.
    this._threeBuildings?.setDetailCentre?.(view.subject[0], view.subject[1], view.introFlat === 0 && isAerialView(view.zoom, pitch, view.lngLat[1]));
    lap('building detail centre');
    this.extras.tick();
    lap('extras tick');
    // The cover's footprint grid is indexed in idle time as the resident list changes, from the intro on, so the
    // ride's first frame does not build it (engine/idleBoxGrid.ts, lane E6 #219; `?coverGridIdle=0`).
    city?.prewarmFeaturesAt?.();
    this.prewarmLabelOcclusion(view.introFlat > 0 ? view.subject : undefined);
    this.prewarmClearance();
    this.updateRiderCover(view.subject, pitch > 0 && !view.detached && view.introFlat === 0);
    lap('rider cover');
    if (view.introFlat === 0) this.extras.setSuspended(false);
    if (view.introFlat === 0 && city) {
      city.setSuspended?.(false);
      if (!view.detached) city.setRider?.(view.subject[0], view.subject[1]);
      city.followCamera?.();
    }
    lap('city follow');
    camera.projector = pitch > 0 || view.introFlat > 0 ? (x: number, y: number) => this.projectWorld(x, y, loader, canvas) : null;
  }

  /**
   * Rider cover (coveredPassage.ts): the building over the rider draws see-through. Route-aware (lane E1 2026-11-05):
   * the route ahead (or, off the route, the centreline of the road underfoot) must run through the footprint too, so
   * a bump into a house front no longer counts. `?coverRoute=0` restores the point-only rule; `?coverDim=0` hides the
   * building outright as before instead of ghosting it.
   */
  private updateRiderCover(rider: [number, number], active: boolean): void {
    const city = this._completeCity;
    const ahead = this.coverRoute ? () => this.coverAhead(rider) : undefined;
    const r = this.cover.update(rider, active, performance.now() / 1000, () => city?.featuresAt ? city.featuresAt(rider[0], rider[1]) : [], ahead);
    if (!r.changed) return;
    const ids = r.covered && r.id ? [r.id] : [];
    const tb = this._threeBuildings;
    if (this.coverDim && tb?.setGhosted) tb.setGhosted('cover', ids);
    else tb?.setHidden?.('cover', ids);
    this.riderCovered = r.covered;
  }
  private readonly coverRoute = coverRouteFlag();
  private readonly coverDim = (() => { try { return new URLSearchParams(globalThis.location?.search ?? '').get('coverDim') !== '0'; } catch { return true; } })();
  /** The route as lng/lat for the cover rule (kept when the route line is not drawn), and its source array. */
  private coverRouteCoords: CoverLngLat[] | null = null;
  private coverRouteSource: unknown = null;
  /** The road network and frame the off-route rule reads (handed over with the street highlights) and the bike's heading. */
  private coverTrack: { getNearestRoad?(x: number, y: number, angle?: number | null): { x: number; y: number; angle: number } | null } | null = null;
  private coverLoader: LoaderFrame | null = null;
  private riderAngle: number | null = null;
  private coverAhead(rider: CoverLngLat): readonly CoverLngLat[] {
    const onRoute = routeAheadPoints(this.coverRouteCoords, rider);
    if (onRoute) return onRoute;
    const track = this.coverTrack, loader = this.coverLoader;
    if (!track?.getNearestRoad || !loader || loader._lastCenterLat == null) return [];
    const w = lngLatToWorld(rider[0], rider[1], loader);
    const road = track.getNearestRoad(w.x, w.y, this.riderAngle);
    if (!road || !Number.isFinite(road.angle)) return [];
    // World x east, y south: a world angle `a` is compass bearing a + π/2. Along the road, the way the bike faces.
    const forward = this.riderAngle == null || Math.cos(road.angle - this.riderAngle) >= 0 ? road.angle : road.angle + Math.PI;
    return roadAheadPoints(worldToLngLat(road.x, road.y, loader), forward + Math.PI / 2);
  }

  projectWorld(worldX: number, worldY: number, loader: LoaderFrame, canvas: HTMLCanvasElement): ScreenPoint {
    const lngLat = worldToLngLat(worldX, worldY, loader);
    // The engine's own camera (WorldCamera), not the MapLibre-shaped shim: the same projection (P5 B6, ~1,600 calls/s).
    const p = this.camera.project(lngLat);
    // Pins stand on the relief/deck there (own ground), not at z = 0.
    const lift = this._ownGround?.ready ? this._ownGround.screenLift(lngLat) : null;
    if (lift) { const vp = this.host.viewport(); p.x += lift[0] / 2 * vp.width; p.y -= lift[1] / 2 * vp.height; }
    const rect = canvas.getBoundingClientRect();
    return { x: p.x * CANVAS_W / rect.width, y: p.y * CANVAS_H / rect.height };
  }
  screenToWorld(cssX: number, cssY: number, canvasRect: DOMRect, loader: LoaderFrame): { x: number; y: number } | null {
    if (!this.ready || !canvasRect || !loader || loader._lastCenterLat == null) return null;
    const vp = this.host.viewport();
    const hit = this.cameraMap.unproject([cssX * vp.width / canvasRect.width, cssY * vp.height / canvasRect.height]);
    return lngLatToWorld(hit.lng, hit.lat, loader);
  }
  worldToLngLat(worldX: number, worldY: number, loader: LoaderFrame): [number, number] { return worldToLngLat(worldX, worldY, loader); }
  /** The camera eye (lng/lat, metres up): the HUD street-name pass's occlusion test reads it (labels/streetLabelOcclusion.ts). */
  cameraEye(): { lng: number; lat: number; altitudeM: number } { return this.cameraMap.camera.eye(); }

  isWater(worldX: number, worldY: number, loader: LoaderFrame): boolean {
    if (!this._overview || !loader || loader._lastCenterLat == null) return false;
    const [lng, lat] = worldToLngLat(worldX, worldY, loader);
    return this._overview.isWater(lng, lat);
  }

  /** Picking: the facades' own screen-space pick (prismPick) — the nearest surface under the pixel. */
  inspectBuilding(cssX: number, cssY: number, canvasRect: DOMRect): any {
    if (!this.ready || !canvasRect) return null;
    const vp = this.host.viewport();
    const x = cssX * vp.width / canvasRect.width, y = cssY * vp.height / canvasRect.height;
    // A drawn POI label wins the click (vector-map.js inspectBuilding: `_labelOverlay.hitTest` before the surface).
    const label = this._labels.hitTest(x, y);
    if (label) return label;
    // Landmark models first; the nearer surface wins (vector-map.js inspectBuilding).
    return this.extras.pick(x, y, vp.width, vp.height, this._threeBuildings?.inspectAtScreen?.(x, y, vp.width, vp.height) ?? null);
  }

  // ---- vehicles ----
  setPlayerBike(player: any, loader: LoaderFrame, visible: boolean, zoomScale = 1): void {
    if (player) { this.riderAngle = Number.isFinite(player.angle) ? player.angle : null; this.coverLoader = loader; }
    const bike = this._playerBike;
    if (!bike || !player || !loader) return;
    bike.zoomScale = zoomScale;
    const lngLat = worldToLngLat(player.x, player.y, loader);
    const surface = this.riderSurface();
    if (surface && visible) {
      const pose = surface.riderPose(lngLat, player.angle, bike.surfaceContactOffsets?.());
      bike.setSurfacePose?.(this.easeRiderSurface(pose.heightM) + 0.22, pose.pitch);
    }
    bike.update(lngLat, player.angle, visible, player.steerInput || 0, player.distancePx || 0);
  }
  setPlayerBoat(player: any, loader: LoaderFrame, visible: boolean, zoomScale = 1): void {
    const boat = this._playerBoat;
    if (!boat || !player || !loader) return;
    boat.zoomScale = zoomScale;
    const lngLat = worldToLngLat(player.x, player.y, loader);
    const surface = this.riderSurface();
    if (surface && visible && boat.setAltitude) boat.setAltitude(this.easeRiderSurface(surface.waterLevelAt ? surface.waterLevelAt(lngLat) : surface.waterLevelM()) + 0.22);
    boat.update(lngLat, player.angle, visible, player.steerInput || 0);
  }
  setPlayerFerry(player: any, loader: LoaderFrame, visible: boolean, zoomScale = 1): void {
    const ferry = this._playerFerry;
    if (!ferry || !player || !loader) return;
    ferry.zoomScale = zoomScale;
    const lngLat = worldToLngLat(player.x, player.y, loader);
    const surface = this.riderSurface();
    // Only while drawn: the water test ran every frame of every ride for a hidden ferry (#129); `update` below shows it.
    if (visible) ferry.setAltitude?.(surface ? surface.waterLevelAt(lngLat) + 0.22 : 0.22);
    ferry.update(lngLat, player.angle, visible);
  }
  setPlayerTransit(player: any, loader: LoaderFrame, visible: boolean, underground = false, zoomScale = 1): void {
    const tram = this._playerTransit;
    if (!tram || !player || !loader) return;
    tram.zoomScale = zoomScale;
    const lngLat = worldToLngLat(player.x, player.y, loader);
    if (tram.setAltitude) {
      const ground = !underground && visible && this.riderSurface() ? this.easeRiderSurface(this._ownGround.heightAt(lngLat)) : 0;
      tram.setAltitude(underground ? -9 : ground + 0.22);
    }
    tram.update(lngLat, player.angle, visible);
  }
  playerScreenBox(kind: 'bike' | 'boat' | 'ferry' | 'transit'): any {
    const v = { bike: this._playerBike, boat: this._playerBoat, ferry: this._playerFerry, transit: this._playerTransit }[kind];
    return v && v.ready && v.visible ? v.screenBox || null : null;
  }
  isPlayerBikeReady(): boolean { return !!this._playerBike?.ready; }
  isPlayerBoatReady(): boolean { return !!this._playerBoat?.ready; }
  isPlayerFerryReady(): boolean { return !!this._playerFerry?.ready; }
  isPlayerTransitReady(): boolean { return !!this._playerTransit?.ready; }

  // ---- route and question street: draped on the own ground (routeRibbon) ----
  ownGroundDrapesOverlays(): boolean { return !!this._ownGround?.drapesOverlays?.(); }
  /** What `camera.whenIdle()` is still waiting on (engine/settle.ts); [] when the view is settled. */
  pendingWork(): string[] { return this.cameraMap.pendingWork(); }
  ownGroundStatus(): Record<string, unknown> { return this._ownGround ? this._ownGround.status() : { enabled: true, ready: false }; }
  elevationStatus(): Record<string, unknown> { return this.ownGroundStatus(); }

  setRoute(routePath: readonly { x: number; y: number }[] | null, loader: LoaderFrame, visible: boolean): void {
    if (!loader || loader._lastCenterLat == null) return;
    // The buildings' route-ahead prefetch (#217) follows the planned route whether or not its line is shown (the line
    // is an aid the player pays for; most rides hide it).
    if (routePath !== this.buildingsRouteRef) {
      this.buildingsRouteRef = routePath;
      this.buildingsRoute = routePath && routePath.length > 1 ? routePath.map(p => worldToLngLat(p.x, p.y, loader)) : null;
      this._threeBuildings?.setRoute?.(this.buildingsRoute);
    }
    if (routePath !== this.coverRouteSource) {
      this.coverRouteSource = routePath;
      this.coverRouteCoords = routePath && routePath.length >= 2 ? routePath.map(p => worldToLngLat(p.x, p.y, loader)) : null;
    }
    if (!visible || !routePath || routePath.length < 2) { if (this.ownGroundState.route) this.groundRoute(null); this.routeRef = null; return; }
    if (this.routeRef === routePath && this.ownGroundState.route) return;
    this.routeRef = routePath;
    this.groundRoute(routePath.map(p => worldToLngLat(p.x, p.y, loader)));
  }
  private groundRoute(coords: [number, number][] | null): void { this.ownGroundState.route = coords; this._ownGround?.setRoute(coords); }
  private buildingsRouteRef: unknown = null;
  private buildingsRoute: [number, number][] | null = null;

  setStreetHighlights(track: any, loader: LoaderFrame, _learned: Set<string>, activeName: string, activeSegmentIndex: number, routePath: unknown = null): void {
    if (track && loader) { this.coverTrack = track; this.coverLoader = loader; }
    if (!this.ready || !track || !loader) return;
    const key = `${activeName || ''}:${activeSegmentIndex}`;
    if (key !== this.activeStreetKey || routePath !== this.activeStreetRoute) {
      this.activeStreetKey = key;
      this.activeStreetRoute = routePath;
      const streets = W().CanalRecallStreets;
      const ridden = track.segments[activeSegmentIndex];
      const connected = activeName && ridden && ridden.name === activeName ? (track.getConnectedNamedSegments ? track.getConnectedNamedSegments(activeSegmentIndex) : [ridden]) : [];
      const seed = streets?.seedNearestRoute ? streets.seedNearestRoute(connected, ridden, routePath) : ridden;
      const paths = streets?.collapseParallelFragments ? streets.collapseParallelFragments(connected, seed) : connected.map((s: any) => s.points).filter((p: any) => p && p.length > 1);
      const chains = streets?.stitchOverlayPaths ? streets.stitchOverlayPaths(paths) : paths;
      const lines = chains.map((pts: any[]) => pts.map(p => worldToLngLat(p.x, p.y, loader)));
      // The draped highlight is centreline geometry only; the ground never draws a name.
      this.ownGroundState.highlight = lines.length ? lines : null;
      this._ownGround?.setHighlight(this.ownGroundState.highlight);
    }
    const finish = track.isOpenTrack && track.finishPoint;
    const destination = finish ? worldToLngLat(finish.x, finish.y, loader) : null;
    const dkey = destination ? destination.map(v => v.toFixed(7)).join(',') : '';
    if (dkey !== this.destinationKey) { this.destinationKey = dkey; this.ownGroundState.destination = destination; this._ownGround?.setDestination(destination); }
  }

  // ---- content the game hands over ----
  /**
   * The buildings layer keeps its own packed street segments; the raw OSM ways are held only until it exists to take
   * them (24.7 MB on the ride-start heap when kept for the session, #130).
   */
  setStreetFronts(ways: unknown): void {
    if (this._threeBuildings) { this._threeBuildings.setStreets?.(ways); this.streetFronts = null; }
    else this.streetFronts = ways;
  }
  /** Per source, as vector-map.js (spoilerSources.ts: the track's names used to replace the extract's at every route start). */
  setSpoilerNames(names: string[], source = 'extract'): void {
    this.spoilerNames = this.spoilerSourcesOn ? this.spoilerSources.set(names, source) : (names || []);
  }
  private readonly spoilerSources = new SpoilerSources();
  /** `?spoilerSources=0`: the last list wins (the old behaviour). */
  private readonly spoilerSourcesOn = flag('spoilerSources', '__canalRecallSpoilerSources', true);
  _spoils(name: string): boolean { return !!name && this.spoilerNames.includes(name); }
  setMeasuredColoursOnly(on: boolean): void { this.measuredColoursOnly = !!on; this.extras.syncEnabled(); }
  /** The look the saved preference asks for, unless a URL look is in force (vector-map.js, same rule). */
  setBuildingLookPreference(look: string): void { if (!this.buildingLookLocked) this.setBuildingLook(look); }
  buildingLook(): string { return this.buildingLookNow; }
  /**
   * Live switch between the three.js looks (the B key, Settings). 'default' names MapLibre's retired pattern layer,
   * which the own engine does not have: it is reported as asked and the walls keep drawing in the photo look.
   */
  setBuildingLook(look: string): void {
    if (!(BUILDING_LOOK_IDS as readonly string[]).includes(look) || look === this.buildingLookNow) return;
    this.buildingLookNow = look as BuildingLookId;
    void this._threeBuildings?.setLook?.(this.drawnLook());
    this.host.triggerRepaint();
  }
  /** Console alias (vector-map.js setBuildingsLook). */
  setBuildingsLook(look: string): void { this.setBuildingLook(look); }
  private drawnLook(): Exclude<BuildingLookId, 'default'> { return this.buildingLookNow === 'default' ? 'photo' : this.buildingLookNow; }
  get _buildings3dLook(): string { return this.buildingLookNow; }
  /** The streamed buildings' features (context-restore compares them across a restore). */
  _tileFeatures: unknown[] = [];
  applyTheme(theme: string): void {
    this.theme = theme || 'clean';
    const body = W().document?.body;
    body?.classList.remove('theme-8bit', 'theme-16bit', 'theme-psx', 'theme-cyberpunk');
    if (this.theme !== 'clean') body?.classList.add(`theme-${this.theme}`);
    // Palette themes as material parameters (themePalette.ts): the overview's flat materials and the trees.
    this._overview?.setTheme(this.theme);
    this.extras?.setTheme(this.theme);
    this.host.triggerRepaint();
  }
  toggleLabels(): boolean { this._labelsVisible = !this._labelsVisible; this.host.triggerRepaint(); return this._labelsVisible; }
  setLabelsVisible(v: boolean): void { this._labelsVisible = !!v; this.host.triggerRepaint(); }
  setQuizQuietMap(quiet: boolean): void { if (this.quizQuiet !== !!quiet) { this.quizQuiet = !!quiet; this.host.triggerRepaint(); } }
  setSpoilersSuspended(suspended: boolean): void { this.spoilersSuspended = !!suspended; }

  /** The card's landmark: its building(s) lit through the facades, and the marker (look/highlightMarker.ts). */
  setActiveLandmark(landmark: any): void {
    this.activeLandmark = landmark || null;
    const { modelLit, detailed } = this.extras.setActiveLandmark(landmark);
    let ids: string[] = [];
    if (landmark && Array.isArray(landmark.buildingIds) && landmark.buildingIds.length) ids = landmark.buildingIds.map(String);
    else if (landmark?.featureTarget?.id != null) ids = [String(landmark.featureTarget.id)];
    else if (landmark && Array.isArray(landmark.lngLat) && this._completeCity?.buildingForLandmark) {
      const id = this._completeCity.buildingForLandmark({ lng: landmark.lngLat[0], lat: landmark.lngLat[1] });
      if (id) ids = [String(id)];
    }
    if (!ids.length && landmark && Array.isArray(landmark.lngLat) && this._threeBuildings?.boatForLandmark) {
      const boat = this._threeBuildings.boatForLandmark(landmark.lngLat, landmark.type);
      if (boat) ids = [String(boat)];
    }
    // Detailed tiles light their own mesh; the streamed prisms stay plain.
    if (detailed) ids = [];
    // By value: relight() and the game re-send the same landmark (engine/landmarkHighlight.ts). A landmark model
    // lighting it (`modelLit`) still gets the marker, so it does not change what is sent.
    void modelLit;
    const tb = this._threeBuildings;
    const sent = this.landmarkHighlight.apply(ids, landmark && Array.isArray(landmark.lngLat) ? [landmark.lngLat[0], landmark.lngLat[1]] : null, {
      owner: tb,
      setHighlighted: (lit, focus) => tb?.setHighlighted?.(lit, focus),
      footprint: lit => tb?.highlightFootprint?.(lit) || null,
      marker: focus => this._highlightMarker?.set(focus),
    });
    if (sent) this.host.triggerRepaint();
  }

  /** Prominent extract landmarks as POI labels, and the neighbourhood boundaries as lines (vector-map.js setPlaces). */
  setPlaces(landmarks: any[], boundaries: any[]): void {
    this.placePois = (landmarks || []).filter(item => item.center && (item.manualPoi || item.nativeKitPoi || (item.prominenceScore || 0) >= 220))
      .map(item => ({ id: String(item.id), text: item.name, aliases: placeAliases(item), kind: 'poi' as const, priority: 5000 + (item.prominenceScore || 0), lngLat: [item.center[1], item.center[0]] as [number, number], minZoom: 15, aerial: true }));
    this.pushPois();
    const lines: LngLatLine[] = [];
    for (const b of (boundaries || []).filter(item => item.kind === 'neighbourhood' && item.geometry)) {
      for (const polygon of b.geometry) { const ring = polygon[0]; if (ring && ring.length >= 3) lines.push(ring.map(([lat, lng]: [number, number]) => [lng, lat] as [number, number])); }
    }
    this._lines.hoods.set([{ lines, style: { color: '#8B5CF6', width: [[13, 1], [18, 2.5]], minZoom: 13, opacity: 0.48 } }]);
  }
  setBrandedPois(pois: any[]): void {
    // Thinned like vector-map.js (thinOrientationPois): only the best cue per patch of ground.
    const thin = W().CanalRecallOrientationPois?.thinOrientationPois;
    const safe = (pois || []).filter(p => p && p.name && Array.isArray(p.center));
    this.brandedPois = (thin ? thin(safe) : safe)
      .map((p: any) => ({ id: `brand:${p.id}`, text: p.name, kind: 'poi' as const, priority: 3000 + (p.orientationScore || 0), lngLat: [p.center[1], p.center[0]] as [number, number], minZoom: 16.5 }));
    this.pushPois();
  }

  /** The just-answered name, on the road ahead of the rider (streetOverlayStyle pointsAheadOnChains). */
  setAnsweredStreetName(track: any, loader: LoaderFrame, stamp: { name: string; label?: string; segmentIndex: number; correct: boolean } | null, rider: any = null): void {
    if (!this.ready || !track || !loader) return;
    const key = stamp ? `${stamp.name}:${stamp.segmentIndex}:${stamp.correct}` : '';
    if (key === this.answeredKey) return;
    this.answeredKey = key;
    const streets = W().CanalRecallStreets;
    let points: any[] = [];
    if (stamp && rider && streets?.pointsAheadOnChains) {
      const ridden = track.segments[stamp.segmentIndex];
      const connected = ridden && ridden.name === stamp.name ? (track.getConnectedNamedSegments ? track.getConnectedNamedSegments(stamp.segmentIndex) : [ridden]) : [];
      const paths = streets.collapseParallelFragments ? streets.collapseParallelFragments(connected, ridden) : connected.map((s: any) => s.points);
      points = streets.pointsAheadOnChains(streets.stitchOverlayPaths ? streets.stitchOverlayPaths(paths) : paths, rider);
    }
    this._labels.setPoints('answered', points.map((p, i) => ({ id: `a${i}`, text: stamp!.label || stamp!.name, kind: 'street' as const, priority: 10 - i, lngLat: worldToLngLat(p.x, p.y, loader) })));
    this.host.triggerRepaint();
  }

  setFerryTerminals(track: any, loader: LoaderFrame): void {
    if (!this.ready || !track || !loader || this.ferryTrack === track) return;
    this.ferryTrack = track;
    const terminals = new Map<string, any>();
    for (const segment of track.segments) if (segment.ferryLink) for (const t of [segment.ferryLink.from, segment.ferryLink.to]) terminals.set(t.id, t);
    const merge = W().CanalRecallFerry?.terminalLabels;
    const list = merge ? merge([...terminals.values()], 150 * 3) : [...terminals.values()];
    this._labels.setPoints('ferry', list.map((t: any, i: number) => ({ id: `f${i}`, text: `${t.name} ⛴`, kind: 'poi' as const, priority: 100, lngLat: worldToLngLat(t.x, t.y, loader) })));
  }

  setCycleTracks(ways: unknown[]): void {
    const lib = W().CanalRecallOrientationPois;
    const fc = lib?.cycleTrackFeatures ? lib.cycleTrackFeatures(ways || []) : null;
    const lines: LngLatLine[] = (fc?.features ?? []).filter((f: any) => f.geometry?.type === 'LineString').map((f: any) => f.geometry.coordinates);
    this._lines.cycle.set([{ lines, style: { color: lib?.CYCLE_TRACK_COLOUR || '#c0392b', width: [[12, 1], [15, 2], [18, 5]], minZoom: 12, opacity: typeof lib?.CYCLE_TRACK_OPACITY === 'number' ? lib.CYCLE_TRACK_OPACITY : 0.85 } }]);
  }

  setTransitNetwork(load: any, visible: boolean): void {
    const Transit = W().CanalRecallTransit;
    const byColour = new Map<string, LngLatLine[]>();
    if (visible && load?.ways?.length) {
      for (const way of load.ways) {
        if (!way.nodes || way.nodes.length < 2) continue;
        const meta = load.featureMeta && way.tags?.name ? load.featureMeta.get(way.tags.name) : null;
        const line = { name: way.tags?.name || way.id || 'line', mode: way.highway || meta?.mode || 'tram', color: meta?.color, coordinates: way.nodes.map((n: any) => [n.lon, n.lat]) };
        const fc = Transit?.transitOverlayCollection ? Transit.transitOverlayCollection([line]) : { features: [{ properties: { color: line.color || '#E11D48' }, geometry: { type: 'LineString', coordinates: line.coordinates } }] };
        for (const f of fc.features) { if (f.geometry?.type !== 'LineString') continue; const c = f.properties?.color || '#E11D48'; const l = byColour.get(c); if (l) l.push(f.geometry.coordinates); else byColour.set(c, [f.geometry.coordinates]); }
      }
    }
    this._lines.transit.set([...byColour].map(([color, lines]) => ({ lines, style: { color, width: [[11, 1.5], [15, 3], [18, 6]], opacity: 0.85 } })));
  }

  /**
   * The engine owns the loop: game.js hands its per-frame update/render as `frame`, and the driving model's fixed
   * substep as `tick` (CanalRecallUi.stepSteer at `loopStep` seconds), instead of its own requestAnimationFrame.
   */
  setLoop(sim: FrameSimulation | null): void { this.host.setSimulation(sim); }
  get loopStep(): number { return this.host.clock.dt; }
  setTreesVisible(visible: boolean): void { this.extras.setTreesVisible(visible); }
  setDetailedBuildingsVisible(visible: boolean): void { this.extras.setDetailedVisible(visible); }
  /** The flat 2D tree layer's data: the inventory trees load their own (inventory-trees-source.js). */
  setTrees(): void {}
  // Not under the flag (UNIMPLEMENTED): a no-op so the game runs.
}

/** Found numbers, by name: they are `const` in constants.js, and the indirect eval compiled a script per call, several a frame (#129). */
const GLOBAL_NUMS = new Map<string, number>();
function globalNum(name: string, fallback: number): number {
  const known = GLOBAL_NUMS.get(name);
  if (known !== undefined) return known;
  try {
    // Top-level `const` in constants.js is a global lexical binding, not a window property.
    const v = (0, eval)(`typeof ${name} === 'number' ? ${name} : undefined`);
    if (typeof v === 'number') { GLOBAL_NUMS.set(name, v); return v; }
    return fallback;
  } catch (_) { return fallback; }
}
