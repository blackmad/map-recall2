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
//   picture unchanged. Desktop keeps the stepped ring and one mesh per layer.
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

import { GroundStore, httpFetchBytes, toLocal, WATER_Z, type ReliefTileLoader, type Rect } from './groundStore.js';
import { readGroundTile } from './heightField.js';
import { boundingSphereOf } from '../geometryBounds.js';
import { GROUND_LAYERS, PARK_RANK, type BuiltCell, type CellDetail, type GroundLayer } from './groundCell.js';
import { gpuMeshBytes, isCompact, type GpuMesh } from './compactMesh.js';
import { groundParticipant, GROUND_ORDER, ndcOf } from './sharedFrameGround.js';
import { footprintBase } from './placement.js';
import { splitIntoTiles } from './cellTiles.js';
import { inTouchRing, residentRadius, touchAheadMarginM, touchResidentRadius, viewCornerReachM, viewReachM } from './residency.js';
import { farBlockCells, farBlocksWithin, farRadiusM, FAR_KEEP_M, type BuiltFar } from './farRing.js';
import { routeRibbon } from './streets.js';
import { disc, emptyMesh, merge, type MeshArrays } from './drape.js';
import { riderPose as surfaceRiderPose, type Vec2 } from './surface.js';
import { GROUND_LOOK_DEFAULT, groundPalette, type GroundLook } from './groundLook.js';
import { asphaltGrain, herringboneBricks, KLINKER_TONES } from './streetTextures.js';
import { FLAT_GROUND_GAIN } from './groundLight.js';
import { OverviewBlend, presenceOf, transitionOn } from '../overviewTransition/blend.js';
import { flatLayerTones } from '../overviewTiles/layerColours.js';
import { MotionEstimate, aheadRankXY, lookAheadEnabled } from '../streamingLookAhead.js';

export interface GroundHost {
  /** Ask for another frame. */
  repaint(): void;
  /** Hide (true) or restore (false) the basemap's own ground fills and lines. */
  setBasemapGroundHidden(hidden: boolean): void;
}

export interface OwnGroundOptions {
  workerUrl: string;
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
  /** The far ring beyond the resident cells from the air (default on). */
  far?: boolean;
  /**
   * Free each vertex/index array once three has uploaded it (default off; the
   * ride turns it on for phones). A resident cell's typed arrays (~12 MB) lived
   * on beside their GPU copy; only `layersAt`, a diagnostics walk, reads them.
   */
  releaseArrays?: boolean;
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
   * default: from the page, `groundTilesFlag()` below; 1 = one mesh per layer, the desktop path). Display only.
   */
  tiles?: number;
}

/**
 * Cell tiles on this device: 3×3 on a touch device, none on a desktop (unchanged). `?groundTiles=1..4` (or
 * `window.__canalRecallGroundTiles`) overrides it.
 */
function groundTilesFlag(): number {
  const g = globalThis as { __canalRecallGroundTiles?: number | string; matchMedia?: (query: string) => { matches: boolean }; location?: { search?: string } };
  const asked = Number(g.__canalRecallGroundTiles ?? (g.location?.search ? new URLSearchParams(g.location.search).get('groundTiles') : NaN));
  if (Number.isInteger(asked) && asked >= 1 && asked <= 4) return asked;
  return g.matchMedia?.('(pointer: coarse)')?.matches ? TOUCH_TILES : 1;
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
/** Cell tiles per side on a touch device (OwnGroundOptions.tiles), and the smallest layer worth cutting (fewer draw calls for the rest). */
const TOUCH_TILES = 3;
const TILE_MIN_TRIANGLES = 4000;
const AERIAL_RADIUS_M = 2000;
/** A cell arriving in the ring (not an LOD swap of a resident one) dissolves in over this long. */
export const FADE_MS = 400;
const NEAR_M = 350;
const RESIDENCY_STEP_M = 60;

/** Which mask channel cuts a layer: R = water (land, parks), G = water minus decks (street bands). */
const CUT: Partial<Record<GroundLayer, 'r' | 'g'>> = {
  land: 'r', park: 'r', wood: 'r', square: 'r', parking: 'r',
  lawn: 'r', bed: 'r', shrub: 'r', bark: 'r', sand: 'r', parkGravel: 'r', parkPath: 'r', pond: 'r',
  asphalt: 'g', klinker: 'g', brick: 'g', cycle: 'g', paving: 'g', gravel: 'g', kerb: 'g', paint: 'g', tram: 'g', bollard: 'g',
};
/** Polygon-offset rank of coplanar ground layers (later wins), as the prototype. */
/** Materials that are objects on the ground, not the ground: lit by the rig as is (no FLAT_GROUND_GAIN). */
const UNGAINED = new Set(['hedge', 'furniture', 'bollard', 'tram']);
const OFFSET: Partial<Record<GroundLayer, number>> = { deckTop: 1, park: 1, wood: 1, square: 1, parking: 1, ...PARK_RANK, klinker: 2, brick: 2, asphalt: 2, gravel: 3, cycle: 3, paving: 3, paint: 4, tram: 5 };

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
  private readonly cellBuilds = new Map<string, BuiltCell['stats'] & { lod: 0 | 1; detail: CellDetail }>();
  /** Far ring radius now (0: the resident ring reaches what the camera sees). */
  private farRadius = 0;
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
  readonly stats = { cellsBuilt: 0, buildMs: [] as number[], installMs: [] as number[], latencyMs: [] as number[], errors: [] as string[], lastBuild: null as null | Record<string, unknown> };

  constructor(THREE: any, frame: any, host: GroundHost, options: OwnGroundOptions) {
    this.THREE = THREE;
    this.frame = frame;
    this.host = host;
    this.opts = { radiusM: RADIUS_M, aerialRadiusM: AERIAL_RADIUS_M, fadeMs: FADE_MS, nearM: NEAR_M, minZoom: 15, parks: parksFlag(), roads: roadsFlag(), groundLook: GROUND_LOOK_DEFAULT, transition: transitionOn(), far: true, releaseArrays: false, detail: detailFlag(), groundNear: groundNearFlag(), ring: groundRingFlag(), tiles: groundTilesFlag(), ...options };
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
    this.store = new GroundStore(httpFetchBytes(root), { parks: this.opts.parks, roads: this.opts.roads, reliefTile: this.reliefLoader(root) });
    this.ready = false;
    if (!/\/amsterdam\/?$/.test(root)) return;
    await this.store.init();
    try {
      this.worker = new Worker(this.opts.workerUrl);
      this.worker.onmessage = event => this.onWorker(event.data);
      this.worker.onerror = event => { this.stats.errors.push(`worker: ${event.message}`); };
      // Compact meshes: the same geometry in ~half the bytes (compactMesh.ts).
      this.worker.postMessage({ type: 'init', root, parks: this.opts.parks, roads: this.opts.roads, groundLook: this.opts.groundLook, compact: compactFlag(), detail: this.opts.detail });
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
   * Relief tiles for the main-thread surface (poses, building bases, overlays) are fetched and decoded in a
   * second instance of the ground worker, not on the main thread. Falls back to the main thread without workers.
   */
  private reliefWorker: Worker | null = null;
  private readonly reliefWaiting = new Map<number, { resolve: (v: { heights: Float32Array; bytes: number }) => void; reject: (e: Error) => void }>();
  private reliefIds = 0;
  private reliefLoader(root: string): ReliefTileLoader | undefined {
    if (typeof Worker === 'undefined' || !this.opts.workerUrl) return undefined;
    return (path, index, entry) => {
      if (!this.reliefWorker) {
        try {
          const worker = new Worker(this.opts.workerUrl);
          worker.onmessage = event => {
            const msg = event.data, waiting = this.reliefWaiting.get(msg.id);
            if (msg.type !== 'relief' || !waiting) return;
            this.reliefWaiting.delete(msg.id);
            if (msg.heights) waiting.resolve({ heights: msg.heights, bytes: msg.bytes });
            else waiting.reject(new Error(msg.error ?? 'relief tile failed'));
          };
          this.reliefWorker = worker;
        } catch (error) {
          this.stats.errors.push(`relief worker unavailable: ${String(error)}`);
          return httpFetchBytes(root)(path).then(bytes => ({ heights: readGroundTile(index, entry, bytes), bytes: bytes.byteLength }));
        }
      }
      const id = ++this.reliefIds;
      return new Promise((resolve, reject) => {
        this.reliefWaiting.set(id, { resolve, reject });
        this.reliefWorker!.postMessage({ type: 'relief', id, url: `${root}/${path}`, index: { stepM: index.stepM, tileSizeM: index.tileSizeM, samples: index.samples, predictor: index.predictor }, entry: [...entry] });
      });
    };
  }

  dispose(full = true): void {
    for (const key of [...this.resident.keys()]) this.drop(key);
    for (const key of [...this.far.keys()]) this.dropFar(key);
    this.farPending.clear();
    this.farEmpty.clear();
    this.pending.clear();
    this.installQueue.length = 0;
    this.prepared.clear();
    this.worker?.terminate();
    this.worker = null;
    this.reliefWorker?.terminate();
    this.reliefWorker = null;
    for (const w of this.reliefWaiting.values()) w.reject(new Error('own ground disposed'));
    this.reliefWaiting.clear();
    this.workerReady = false;
    this.gen++;
    if (full) { this.unregister?.(); this.unregister = null; this.setBasemapHidden(false); for (const m of this.keepers) m.dispose(); this.keepers.length = 0; this.precompiled = false; }
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
  update(lngLat: LngLat, zoom: number, pitchDeg = 60): void {
    this.zoom = zoom;
    this.centre = toLocal(lngLat[0], lngLat[1]);
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
    const far = this.opts.far ? farRadiusM(reach, radius) : 0;
    if (far !== this.farRadius) { this.farRadius = far; this.residencyAt = null; }
    if (!this.ready) return;
    if (!this.residencyAt || Math.hypot(this.centre[0] - this.residencyAt[0], this.centre[1] - this.residencyAt[1]) >= RESIDENCY_STEP_M) this.updateResidency();
  }

  private visibleAtZoom(zoom: number): boolean {
    if (!this.enabled || !this.ready) return false;
    return this.opts.transition ? this.blend.active : zoom >= this.opts.minZoom;
  }

  /** Per frame, from the shared frame's main pass. */
  private beforeRender(zoom: number): boolean {
    this.zoom = zoom;
    if (!this.precompiled) this.precompile();
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
      out.push({ key, lod: d <= this.opts.nearM ? 0 : 1, detail: this.opts.detail === 'touch' && !fine ? 'touch' : 'full', d, rank: direction ? aheadRankXY(this.centre, near, direction) : d });
    }
    return out.sort((a, b) => a.rank - b.rank || a.d - b.d);
  }

  private updateResidency(): void {
    if (!this.centre) return;
    this.residencyAt = [this.centre[0], this.centre[1]];
    const wanted = this.wantedCells();
    const keep = new Set(wanted.map(w => w.key));
    this.wantedKeys = keep;
    for (const key of [...this.resident.keys()]) if (!keep.has(key)) this.drop(key);
    for (const key of [...this.pending.keys()]) if (!keep.has(key)) this.pending.delete(key);
    for (let i = this.installQueue.length - 1; i >= 0; i--) if (!keep.has(this.installQueue[i].key)) this.installQueue.splice(i, 1);
    for (const w of wanted) {
      // Main-thread surface for poses, bases and overlays: relief + decks of every wanted cell.
      this.prepareMain(w.key);
      const want = levelOf(w.lod, w.detail), have = this.resident.get(w.key);
      if ((have && levelOf(have.lod, have.detail) === want) || this.pending.get(w.key) === want) continue;
      // A cell that becomes near again (or that the ring wants at another LOD) rebuilds through this same path: one
      // request, then the install swaps the whole cell, so two levels are never on screen together.
      this.pending.set(w.key, want);
      this.requestedAt.set(`${w.key}:${want}`, performance.now());
      this.worker?.postMessage({ type: 'build', key: w.key, lod: w.lod, detail: w.detail, gen: this.gen });
    }
    // The worker builds its queue in this order and drops cells the rider has left (buildQueue.ts).
    if (this.lookAheadOn) this.worker?.postMessage({ type: 'order', keys: wanted.map(w => w.key) });
    // Relief far behind is dropped on both sides (decks keep their placed heights).
    const keepM = this.radiusM + 2200;
    this.worker?.postMessage({ type: 'evict', x: this.centre[0], y: this.centre[1], keepM, keep: [...keep].flatMap(k => GroundStore.neighbours(k)) });
    if (this.store.evictRelief(this.centre[0], this.centre[1], keepM)) {
      for (const key of [...this.prepared]) if (!keep.has(key)) this.prepared.delete(key);
    }
    this.store.forgetCells(new Set([...keep].flatMap(k => GroundStore.neighbours(k))));
    this.updateFar(keep);
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

  /** A far part hides once the resident ring draws its cell (after the cell's dissolve). */
  private syncFar(): void {
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

  private onWorker(msg: any): void {
    if (msg.type === 'ready') { this.workerReady = true; return; }
    if (msg.type === 'error' && msg.far) { this.stats.errors.push(`far ${msg.far}: ${msg.message}`.slice(0, 400)); this.farPending.delete(msg.far); return; }
    if (msg.type === 'far') {
      if (msg.gen !== this.gen || !this.farPending.delete(msg.key)) return;
      if (msg.far) this.installFar(msg.far as BuiltFar); else this.farEmpty.add(msg.key);
      return;
    }
    if (msg.type === 'error') { this.stats.errors.push(`${msg.key ?? ''}: ${msg.message}`.slice(0, 400)); if (msg.key) this.pending.delete(msg.key); return; }
    if (msg.type !== 'cell' || msg.gen !== this.gen) return;
    const cell = msg.cell as BuiltCell;
    if (this.pending.get(cell.key) !== levelOf(cell.lod, cell.detail)) return;
    this.pending.delete(cell.key);
    this.stats.cellsBuilt++;
    this.stats.buildMs.push(cell.stats.buildMs);
    this.stats.lastBuild = { key: cell.key, lod: cell.lod, detail: cell.detail, ...cell.stats };
    this.cellBuilds.set(cell.key, { ...cell.stats, lod: cell.lod, detail: cell.detail });
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
    t.anisotropy = 4; t.repeat.set(1 / metres, 1 / metres);
    return t;
  }

  /** Base materials (as the prototype page); cut layers are cloned per cell with that cell's mask. */
  private makeMaterials(): void {
    const THREE = this.THREE;
    const { street: STREET_GROUND, tones: G } = groundPalette(this.opts.groundLook);
    let seed = 99;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const noise = (g: CanvasRenderingContext2D, s: number, base: readonly number[], spread: number, grain = 2) => {
      for (let y = 0; y < s; y += grain) for (let x = 0; x < s; x += grain) {
        const v = (rnd() - 0.5) * spread;
        g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`; g.fillRect(x, y, grain, grain);
      }
    };
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
    const M: Record<string, any> = {
      land: std({ map: pavers(G.land.base, G.land.joint, 3, 0.3, 0.3) }),
      // Klinker carriageways: herringbone in mixed tones (streetTextures.ts), so a brick street never reads as cycle-path red.
      klinker: std({ map: this.canvasTexture(512, 2, (g, s) => {
        const units = 20, px = s / units, base = STREET_GROUND.klinker.base;
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
      asphalt: std({ map: this.canvasTexture(512, 4, (g, s) => grain(g, s, [...STREET_GROUND.asphalt.base], { fine: 16, stones: 26, mottle: 2.5 }, 1)) }),
      cycle: std({ map: this.canvasTexture(512, 4, (g, s) => grain(g, s, [...STREET_GROUND.cycle.base], { fine: 10, stones: 14, mottle: 1.5 }, 2)), roughness: 0.85 }),
      // Pavements: grey-rose klinkers in stretcher bond (Amsterdam's gebakken klinker trottoir).
      paving: std({ map: pavers([...STREET_GROUND.pavement.base], STREET_GROUND.pavement.joint, 2.1, 0.21, 0.105) }),
      gravel: std({ map: this.canvasTexture(256, 4, (g, s) => noise(g, s, G.gravel, 30, 2)) }),
      // Vertex-tinted: white is the kerb tone, roadSurfaces KERB_SHADOW_TINT its shadow line (groundCell VERTEX_TINTED).
      kerb: std({ color: STREET_GROUND.kerb, roughness: 0.9, vertexColors: true }),
      paint: std({ color: STREET_GROUND.paint, roughness: 0.6 }),
      // Dark grooves (issue #52): the tram rails, matte (the kerbs' shadow lines take the same tone, roadSurfaces kerbShadowTint).
      tram: std({ color: STREET_GROUND.rail, roughness: 0.9 }),
      bollard: std({ color: STREET_GROUND.bollard, roughness: 0.7 }),
      park: std({ map: this.canvasTexture(256, 6, (g, s) => noise(g, s, G.park, 30, 3)), roughness: 1 }),
      wood: std({ map: this.canvasTexture(256, 6, (g, s) => noise(g, s, G.wood, 34, 3)), roughness: 1 }),
      square: std({ map: pavers(G.square.base, G.square.joint, 4, 0.6, 0.6) }),
      parking: std({ map: this.canvasTexture(256, 4, (g, s) => noise(g, s, G.parking, 16)) }),
      quay: std({ vertexColors: true }),
      deckBody: std({ vertexColors: true, roughness: 0.85 }),
      deckTop: std({ vertexColors: true, roughness: 0.85 }),
      // Matte water (user 2026-10-13 'do not need this reflection'); the mood pass's bluer tone (GROUND_TONES.water).
      water: std({ color: G.water, roughness: 0.65, envMapIntensity: 0.5 }),
      // Parks (parks.ts): textured surfaces, ponds like the canals, one vertex-coloured mesh each for hedges and furniture.
      lawn: std({ map: this.canvasTexture(256, 5, (g, s) => { noise(g, s, G.lawn, 18, 2); stripes(g, s); }), roughness: 1 }),
      bed: std({ map: this.canvasTexture(256, 3, (g, s) => { noise(g, s, G.bed.soil, 24, 2); dabs(g, s, G.bed.leaf, 260, 3, 7); }), roughness: 1 }),
      shrub: std({ map: this.canvasTexture(256, 6, (g, s) => { noise(g, s, G.shrub.base, 22, 3); dabs(g, s, G.shrub.leaf, 160, 6, 14); }), roughness: 1 }),
      bark: std({ map: this.canvasTexture(256, 2, (g, s) => noise(g, s, G.bark, 40, 3)), roughness: 1 }),
      sand: std({ map: this.canvasTexture(256, 3, (g, s) => noise(g, s, G.sand, 22, 2)), roughness: 1 }),
      parkGravel: std({ map: this.canvasTexture(256, 3, (g, s) => noise(g, s, G.parkGravel, 34, 2)), roughness: 1 }),
      parkPath: std({ map: this.canvasTexture(256, 4, (g, s) => noise(g, s, G.parkPath, 16)), roughness: 0.92 }),
      pond: std({ color: G.pond, roughness: 0.6, envMapIntensity: 0.5 }),
      hedge: std({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
      furniture: std({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }),
    };
    for (const [layer, k] of Object.entries(OFFSET)) Object.assign(M[layer], { polygonOffset: true, polygonOffsetFactor: -k!, polygonOffsetUnits: -2 * k! });
    // Level sunlit ground draws its palette luminance (groundLight.ts); objects standing on it keep the rig's light as the buildings do.
    for (const [layer, m] of Object.entries(M)) if (!UNGAINED.has(layer)) m.color.multiplyScalar(FLAT_GROUND_GAIN);
    // The overview → city blend: every ground material (not the draped overlays below) is present early and takes its
    // colour from the flat palette tone the basemap draws (`flat`), so the shaded ground crossfades over the flat one.
    // The basemap's tones are look/sunny.ts `groundTokens` (basemapPalette.ts); the ground fades from the same strings.
    // One table with the overview tiles (overviewTiles/layerColours.ts), so the flat map and the fading ground agree.
    const flat = flatLayerTones(groundPalette(this.opts.groundLook)) as Record<string, readonly number[] | string | 'vertex'>;
    for (const [layer, m] of Object.entries(M)) this.blendMaterial(m, flat[layer] ?? 'vertex');
    // Overlays: the game's own route / active-street colours (vector-map.js), draped.
    const overlay = (color: string, k: number, o: Record<string, unknown> = {}) => new THREE.MeshBasicMaterial({ color, polygonOffset: true, polygonOffsetFactor: -k, polygonOffsetUnits: -2 * k, ...o });
    M.routeCasing = overlay('#03121c', 5, { transparent: true, opacity: 0.75, depthWrite: false });
    M.route = overlay('#38BDF8', 6, { transparent: true, opacity: 0.9, depthWrite: false });
    M.highlight = overlay('#38BDF8', 7, { transparent: true, opacity: 0.96, depthWrite: false });
    M.destination = overlay('#f97316', 7, { transparent: true, opacity: 0.85, depthWrite: false });
    Object.assign(this.base, M);
  }

  /**
   * Every ground program a cell can use (each layer's base, its water cut, and the dissolve of either),
   * compiled once when the frame first draws, and held by keeper materials for the session. Before this,
   * each arriving cell compiled its dissolve programs in the frame it first drew, and released them when
   * its dissolve ended, so the next cell compiled them again: ~90 program links in the first seconds of a
   * ride and three's first-use link waits inside MapLibre's frame (docs/perf-motion-stutter-20261016.md).
   * Same materials and cache keys as the cells', so the cells reuse these programs.
   */
  private precompiled = false;
  private readonly keepers: any[] = [];
  private precompile(): void {
    const renderer = this.frame?.renderer;
    if (!renderer || typeof this.frame.compile !== 'function') return;
    this.precompiled = true;
    const THREE = this.THREE;
    const uniforms = { waterMask: { value: null }, maskOrigin: { value: new THREE.Vector2(0, 0) }, maskSize: { value: new THREE.Vector2(1, 1) } };
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
      const variants = [base];
      if (CUT[layer]) variants.push(this.cutMaterial(layer, uniforms));
      for (const v of [...variants]) variants.push(this.fadeMaterial(v, { value: 1 }));
      for (const m of variants) {
        const mesh = new THREE.Mesh(m.vertexColors ? coloured : plain, m);
        mesh.receiveShadow = true;
        mesh.castShadow = layer === 'deckBody' || layer === 'hedge' || layer === 'furniture';
        group.add(mesh);
        if (m !== base) this.keepers.push(m);
      }
    }
    group.updateMatrixWorld(true);
    this.frame.compile(group);
  }

  /** A clone of a base material that discards fragments over water by this cell's mask. */
  private cutMaterial(layer: GroundLayer, uniforms: Record<string, { value: unknown }>): any {
    const channel = CUT[layer]!;
    const m = this.base[layer].clone();
    const base = this.base[layer];
    m.onBeforeCompile = (shader: any, renderer: any) => {
      base.onBeforeCompile?.(shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      // The mask UV is formed per vertex (0..1, highp): scene metres reach ±15 km
      // city-wide, too coarse for a mediump varying on a phone GPU.
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying highp vec2 vMaskUV;\nuniform vec2 maskOrigin;\nuniform vec2 maskSize;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMaskUV = (transformed.xy - maskOrigin) / maskSize;');
      // Outside the mask's extent the ground is land (no cut). The discard
      // edge is per pixel (MSAA does not smooth it); at quays it is covered by
      // the walls' coping cap (water.ts quayWallMesh, QUAY_CAP_M), which is
      // what fixed the stair-stepped, see-through seam on phones (DPR 1.5).
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying highp vec2 vMaskUV;\nuniform sampler2D waterMask;')
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nif (vMaskUV.x > 0.0 && vMaskUV.y > 0.0 && vMaskUV.x < 1.0 && vMaskUV.y < 1.0 && texture2D(waterMask, vMaskUV).${channel} < 0.5) discard;`);
    };
    // The cut's code depends on the channel and the base's own edits (the blend), not on the layer: keying by layer
    // compiled one copy of the same program per ground surface (68 programs on a phone ride, 2026-10-26).
    m.customProgramCacheKey = () => `ownGround-cut3-${channel}-${base.customProgramCacheKey()}`;
    return m;
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
   * Patch a base ground material for the overview blend (transition on; no-op otherwise): its alpha is the presence
   * (`presenceOf(b)`, blended only while `setGroundTransparent`), and its output colour mixes from `flat` (the palette tone the basemap draws, sRGB; 'vertex' =
   * its own vertex colour) to the lit, textured ground by `b`.
   */
  private blendMaterial(m: any, flat: readonly number[] | string | 'vertex'): void {
    if (!this.opts.transition) return;
    const { blendUniform: blend, presenceUniform: presence } = this;
    const vertex = flat === 'vertex';
    const rgb = vertex ? [0, 0, 0] : typeof flat === 'string' ? new this.THREE.Color(flat).convertLinearToSRGB().toArray() : (flat as number[]).map(v => v / 255);
    const tone = { value: rgb };
    m.onBeforeCompile = (shader: any) => {
      shader.uniforms.ownBlend = blend;
      shader.uniforms.ownPresence = presence;
      shader.uniforms.ownFlat = tone;
      const flatExpr = vertex ? 'pow(max(vColor.rgb, vec3(0.0)), vec3(1.0 / 2.2))' : 'ownFlat';
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float ownBlend;\nuniform float ownPresence;\nuniform vec3 ownFlat;')
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>\nif (ownBlend < 1.0) gl_FragColor.rgb = mix(${flatExpr}, gl_FragColor.rgb, ownBlend);\ngl_FragColor.a = ownPresence;`);
    };
    m.customProgramCacheKey = () => `ownGround-blend3-${m.type}-${vertex ? 'vc' : 'flat'}`;
  }

  /**
   * A per-cell clone of `source` that dissolves by `fade.value` (0 → 1): a screen-door dither discard, so no blending
   * (no sorting against the map's own layers) and no change to the depth buffer. Chains the source's own shader edits.
   */
  private fadeMaterial(source: any, fade: { value: number }): any {
    const m = source.clone();
    m.onBeforeCompile = (shader: any, renderer: any) => {
      source.onBeforeCompile?.(shader, renderer);
      shader.uniforms.ownFade = fade;
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float ownFade;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (ownFade < 1.0 && fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) > ownFade) discard;');
    };
    const key = source.customProgramCacheKey ? source.customProgramCacheKey() : `base-${source.type}`;
    m.customProgramCacheKey = () => `${key}-ownFade`;
    return m;
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
  private tiledGeometries(p: GpuMesh): any[] {
    const tiles = splitIntoTiles(p.positions, p.indices, this.opts.tiles, TILE_MIN_TRIANGLES);
    if (!tiles) return [this.geometry(p)];
    const THREE = this.THREE, base = this.packedGeometry(p);
    return tiles.map(t => {
      const g = new THREE.BufferGeometry();
      for (const [name, attribute] of Object.entries(base.attributes)) g.setAttribute(name, attribute);
      g.setIndex(new THREE.BufferAttribute(t.indices, 1));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(...t.center), t.radius);
      if (this.opts.releaseArrays) for (const attribute of [...Object.values(g.attributes), g.index] as any[]) (attribute?.isInterleavedBufferAttribute ? attribute.data : attribute)?.onUpload(releaseArray);
      return g;
    });
  }

  private packedGeometry(p: GpuMesh): any {
    const THREE = this.THREE;
    const g = new THREE.BufferGeometry();
    if (isCompact(p)) {
      // The uv is the position's x, y (compactMesh.ts): one GPU buffer, two views. Normals and linear colours normalised.
      const shared = new THREE.InterleavedBuffer(p.positions, 3);
      g.setAttribute('position', new THREE.InterleavedBufferAttribute(shared, 3, 0));
      g.setAttribute('uv', new THREE.InterleavedBufferAttribute(shared, 2, 0));
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
    if (!this.wantedCells().some(w => w.key === cell.key && w.lod === cell.lod && w.detail === cell.detail)) return;
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
      for (const geometry of this.tiledGeometries(p)) {
        const mesh = new THREE.Mesh(geometry, material);
        if (fade) fade.meshes.push({ mesh, original, clone: material });
        mesh.name = layer;
        mesh.matrixAutoUpdate = false;
        mesh.receiveShadow = true;
        // Deck bodies, hedges and park furniture stand up; the rest is ground.
        mesh.castShadow = layer === 'deckBody' || layer === 'hedge' || layer === 'furniture';
        mesh.renderOrder = layer === 'water' || layer === 'quay' ? 0 : layer === 'land' ? 1 : 2;
        group.add(mesh);
      }
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
    this.frame.invalidateShadows?.();
    this.host.repaint();
  }

  private drop(key: string): void {
    const r = this.resident.get(key);
    if (!r) return;
    this.root.remove(r.group);
    this.fading.delete(key);
    for (const f of r.fade?.meshes ?? []) f.clone.dispose();
    r.group.traverse((o: any) => { if (o.isMesh) o.geometry.dispose(); });
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
        if (!o.isMesh) return;
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
    return { lod: b.lod, detail: b.detail, triangles: b.triangles, byLayer: b.byLayer, buildMs: b.buildMs, bytes: b.bytes, parks: b.parks, hasParks: this.store.parkCells.has(key), roads: b.roads ?? null, hasRoads: this.store.roadCells.has(key), flatBridges: b.bridges.flat };
  }

  status(): Record<string, unknown> {
    let triangles = 0, bytes = 0;
    const cells: Record<string, number> = {}, details: Record<string, CellDetail> = {};
    for (const r of this.resident.values()) { triangles += r.triangles; bytes += r.bytes; cells[r.key] = r.lod; details[r.key] = r.detail; }
    const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[s.length >> 1].toFixed(1) : null; };
    return {
      enabled: this.enabled, ready: this.ready, workerReady: this.workerReady, visible: this.visibleAtZoom(this.zoom), transition: this.opts.transition, blend: this.blend.value, basemapHidden: this.basemapHidden, radiusM: this.radiusM, zoom: this.zoom, roads: this.opts.roads ? this.store.roadCells.size : false, detail: this.opts.detail, groundNear: this.opts.groundNear, ring: this.opts.ring, aheadM: this.aheadM,
      cells, details, pending: Object.fromEntries(this.pending), queued: this.installQueue.length, triangles, geometryMB: +(bytes / 1048576).toFixed(1),
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
    };
  }
}
