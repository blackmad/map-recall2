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

import { SharedFrame } from '../rendererShared/sharedFrame';
import { mapLibreSky } from '../look/sunny';
import { FrameHost } from './frameHost';
import { guardFrameHost } from './frameGuards';
import { CameraMap, EngineCamera, unitsPerMetre, mercatorX, mercatorY } from './cameraMap';
import { GameCameraSolver, lngLatToWorld, worldToLngLat, type GameCamera, type LoaderFrame } from './gameCamera';
import { clearCamera } from './cameraClearance';
import { RiderCoverTracker } from './riderCover';
import { fetchOverview, OverviewLayer } from './overviewLayer';
import type { JumpOptions, ScreenPoint, WorldCamera } from './worldViewApi';
import { FlatLines, type LngLatLine } from './overlays/flatLines';
import { LabelLayer, type PointLabel } from './overlays/labelLayer';
import { gameLabelContext, type LabelContext } from '../ownMap/labelPolicy';
import { ownPoiFeatures, type OrientationPoiFile } from '../ownPois';
import { cameraFrame } from '../ownMap/mapCamera';
import { fromLocal, toLocal } from '../ownMap/frame';
import { placeAliases } from './placeNames';

declare const CANVAS_W: number;
declare const CANVAS_H: number;

const W = () => globalThis as any;
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
  'setTreesVisible (no trees yet)', 'setDetailedBuildingsVisible', 'setGoogleTilesEnabled', 'applyTheme (palette themes)',
  'signature landmarks', 'neighbourhood lines are solid (MapLibre drew them dashed)',
] as const;

type Vehicle = any;

export class OwnWorldView {
  readonly engine = 'own' as const;
  ready = false;
  readonly container: HTMLElement;
  readonly host: FrameHost;
  readonly map: null = null; // no MapLibre: anything still reading `vectorMap.map` must move to `camera`
  readonly cameraMap: CameraMap;
  readonly camera: WorldCamera;
  readonly _sharedFrame: SharedFrame;
  _renderGovernor: any = null;
  _cameraTilt = 0;
  theme = 'clean';
  riderCovered = false;
  _labelsVisible = false;

  _ownGround: any = null;
  _threeBuildings: any = null;
  _completeCity: any = null;
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
  private introLanding = false;
  private measuredColoursOnly = false;
  private buildingLookPref = 'photo';
  /** Overlays (engine/overlays): flat lines over the ground, labels on a 2D canvas, the landmark marker. */
  readonly _lines: Record<'cycle' | 'transit' | 'hoods', FlatLines>;
  readonly _labels: LabelLayer;
  _highlightMarker: any = null;
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
    const three = W().CanalRecallThree;
    if (!three?.THREE) throw new Error('OwnWorldView needs window.CanalRecallThree');
    const THREE = three.THREE;
    // MSAA unless the device reports ≤ 3 GB (vector-map.js canalRecallAntialias); phones cap at 1.25× (PHONE_PIXEL_RATIO).
    const memory = Number(W().navigator?.deviceMemory);
    const antialias = flag('msaa', '__canalRecallMsaa', !(Number.isFinite(memory) && memory > 0 && memory <= 3));
    const dpr = W().devicePixelRatio || 1;
    let cap = coarse() ? 1.25 : dpr;
    const askedDpr = Number(new URLSearchParams(W().location?.search ?? '').get('dpr'));
    if (Number.isFinite(askedDpr) && askedDpr > 0) cap = askedDpr;
    const sky = mapLibreSky() as Record<string, unknown> | null;
    const clear = typeof sky?.['sky-color'] === 'string' ? new THREE.Color(sky['sky-color']).getHex() : 0xbfd8ee;
    this.host = new FrameHost(THREE, container, {
      render: () => this.renderFrame(),
    }, { antialias, pixelRatio: Math.min(dpr, cap), clearColor: clear });
    const prefs = W().CanalRecallPreferences;
    const maxPitch = prefs && Number.isFinite(prefs.MAP_MAX_PITCH) ? Math.max(60, prefs.MAP_MAX_PITCH) : 60;
    this.cameraMap = new CameraMap(this.host, { center: [4.9041, 52.3676], zoom: 17, maxPitch });
    this.camera = this.cameraMap.api;
    const shadows = flag('shadows', '__canalRecallShadows', true);
    this._sharedFrame = new SharedFrame(THREE, this.cameraMap, {
      host: { renderer: () => this.host.renderer },
      shadows,
      shadowMapSize: coarse() ? 1024 : 2048,
      shadowRamp: flag('transition', '__canalRecallTransition', true) && three.blendAtZoom ? (z: number) => three.blendAtZoom(z) : undefined,
    });
    (this.cameraMap as any)._canalSharedFrame = this._sharedFrame;
    this._sharedFrame.attach();
    const guards = guardFrameHost(this.host, {
      governor: flag('governor', '__canalRecallGovernor', true),
      fixedPixelRatio: new URLSearchParams(W().location?.search ?? '').has('dpr'),
      active: () => !!W().canalRecallGame && W().canalRecallGame.state === 4,
      setShadows: shadows ? on => this._sharedFrame.setShadows(on) : undefined,
      restoredOk: () => !!this._sharedFrame.renderer,
      probe: () => this.graphicsProbe(),
    });
    this._renderGovernor = guards.governor;
    const view = { center: () => this.camera.center(), zoom: () => this.camera.zoom() };
    this._lines = { cycle: new FlatLines('cycle-tracks', view), transit: new FlatLines('transit-network', view), hoods: new FlatLines('neighbourhoods', view) };
    this._sharedFrame.register('engine-hoods', this._lines.hoods, { order: -60 });
    this._sharedFrame.register('engine-transit', this._lines.transit, { order: -55 });
    this._sharedFrame.register('engine-cycle', this._lines.cycle, { order: -50 });
    this._labels = new LabelLayer(container, () => this.labelPolicy());
    if (three.HighlightMarker && three.highlightStyle?.() !== 'yellow') {
      try {
        this._highlightMarker = new three.HighlightMarker(THREE, this.cameraMap, {
          sharedFrame: this._sharedFrame,
          heightAt: (p: [number, number]) => (this._ownGround?.ready ? this._ownGround.heightAt(p) : 0),
          featuresById: (ids: string[]) => this._completeCity?.featuresById?.(ids) ?? null,
        });
      } catch (error) { this.fail('highlight marker', error); }
    }
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
    this.ready = true;
    this.applyPendingAim();
    await Promise.all([this.loadOverview(), this.loadBuildings(), this.loadOwnGround()]);
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
      const data = await fetchOverview(this.absoluteExtractRoot());
      this._overview = new OverviewLayer(data, { center: () => this.camera.center(), zoom: () => this.camera.zoom(), rider: () => this.lastSubject });
      // First in the main pass, under every 3D participant.
      this._sharedFrame.register('engine-overview', this._overview, { order: -100 });
      this.status.overview = { water: data.water.length, parks: data.parks.length, streets: data.streets.length };
      this._labels.setOverview(data);
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
      this._threeBuildings = new api.ThreeBuildings(this.cameraMap, MERCATOR, 'photo');
      this._threeBuildings.attachToSharedFrame(this._sharedFrame);
      if (this.streetFronts && this._threeBuildings.setStreets) this._threeBuildings.setStreets(this.streetFronts);
      this._threeBuildings.setVisible(true);
      const city = this._completeCity = new runtime.BuildingTileStreamer(this.cameraMap, 'osm-building-appearance', this.extractPath);
      // No MapLibre source to feed: the streamer answers featuresAt / sampleFeatures itself.
      city.setPublishing?.(false);
      const years = Facades.constructionYearEnricher(this.extractPath);
      city.setTileEnricher(Facades.composeEnrichers && Facades.roofFactsEnabled() ? Facades.composeEnrichers(years, Facades.roofFactsEnricher(this.extractPath)) : years);
      const decorate = api.decorateRoof ? (f: any) => api.decorateRoof(Facades.decorateFacade(f)) : Facades.decorateFacade;
      const base = api.exceptLandmarks ? api.exceptLandmarks(decorate, new Set(), undefined) : decorate;
      city.setFeatureDecorator(api.decorateKitRoof ? (f: any) => api.decorateShopfront(api.decorateFront(api.decorateKitRoof(base(f)))) : base);
      if (!(await city.probe())) { this.fail('buildings', 'tiles not published'); return; }
      city.attach(() => { this.status.firstBuildingsAt = performance.now(); }, (features: any[]) => {
        this._tileFeatures = features;
        try { this._threeBuildings.setFeatures(features); } catch (error) { console.warn('[engine] facade sync failed', error); }
      });
      this.applyPendingAim();
      this.status.buildings = true;
    } catch (error) { this.fail('buildings', error); }
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
      const budget: Record<string, unknown> = { releaseArrays: coarse() && W().__canalRecallKeepGroundArrays !== true };
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

  private riderSurface(): any { return this._ownGround && this._ownGround.ready ? this._ownGround : null; }
  private easeRiderSurface(target: number): number {
    const v = Number.isFinite(target) ? target : 0, d = v - this.riderSurfaceM;
    this.riderSurfaceM = Math.abs(d) < 0.01 ? v : this.riderSurfaceM + d * 0.35;
    return this.riderSurfaceM;
  }

  private syncGroundConsumers(): void {
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
    if (ground.surfaceRevision === this.groundRevision) return;
    const now = performance.now();
    if (this.groundRefreshAt && now - this.groundRefreshAt < 400) return;
    this.groundRefreshAt = now;
    this.groundRevision = ground.surfaceRevision;
    tb?.refreshGroundBases?.();
  }

  // ---- the frame ----
  private renderFrame(): void {
    this._sharedFrame.drive(this.cameraMap.camera.clipFromMercator());
    this.drawLabels();
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
        spoilerNames: spoilers, quizQuiet: this.quizQuiet,
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
    this._labels.draw(frame, [x0, y0, x1, y1], zoom, this.host.getPixelRatio(), p => { const [lng, lat] = fromLocal(p[0], p[1]); return cam.project([lng, lat]); });
  }

  private async loadPois(): Promise<void> {
    try {
      const r = await fetch(`${this.absoluteExtractRoot()}/orientation-pois.json`);
      if (!r.ok) throw new Error(`orientation-pois: ${r.status}`);
      const b = new Uint8Array(await r.arrayBuffer());
      const text = b[0] === 0x1f && b[1] === 0x8b ? await new Response(new Blob([b as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))).text() : new TextDecoder().decode(b);
      // The spoiler screen runs per frame (labelPolicy); ownPoiFeatures only thins here.
      const fc = ownPoiFeatures(JSON.parse(text) as OrientationPoiFile, () => false);
      this.orientationPois = fc.features.map((f, i) => ({ id: `p${i}`, text: f.properties.name, kind: 'poi' as const, priority: f.properties.rank, lngLat: f.geometry.coordinates as [number, number] }));
      this.pushPois();
    } catch (error) { this.fail('pois', error); }
  }
  private pushPois(): void { this._labels.setPois([...this.orientationPois, ...this.placePois, ...this.brandedPois]); }

  private graphicsProbe(): Record<string, unknown> {
    const r = this.host.renderer;
    return {
      engine: 'own', zoom: Math.round(this.camera.zoom() * 10) / 10, pitch: Math.round(this.camera.pitch()),
      programs: r?.info?.programs?.length ?? null, geometries: r?.info?.memory?.geometries ?? null, textures: r?.info?.memory?.textures ?? null,
      lastFrameCalls: this._sharedFrame.stats.main.calls, lastFrameTriangles: this._sharedFrame.stats.main.triangles,
    };
  }

  // ---- WorldView: frame / camera ----
  frameCanvas(): HTMLCanvasElement { return this.host.canvas; }
  captureFrame(): Promise<HTMLCanvasElement | null> {
    return new Promise(resolve => { this.host.once('render', () => resolve(this.host.canvas)); this.host.triggerRepaint(); });
  }
  jumpToLngLat(options: JumpOptions): void { this.cameraMap.jumpTo(options); }

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
      }, () => this._completeCity.sampleFeatures(20_000));
      if (result) this.solver.safePitch = result.safePitch;
      (this as any)._lastCameraClearance = result;
    }
    const pitch = this.solver.applyClearance(view, !!camera.reducedMotion);
    const city = this._completeCity;
    if (view.introFlat > 0 && city?.setSuspended) {
      city.setSuspended(true);
      if (!this.introLanding) { this.introLanding = true; city.preloadAt?.(view.subject[0], view.subject[1]); }
    }
    if (view.introFlat === 0) this.introLanding = false;
    if (this._ownGround) { this._ownGround.update(view.subject, view.introFlat > 0 ? 0 : view.zoom, pitch); this.syncGroundConsumers(); }
    this.cameraMap.jumpTo({ center: view.lngLat, zoom: view.zoom, bearing: view.bearing, pitch, elevation });
    this.lastSubject = view.subject;
    this._threeBuildings?.setDetailCentre?.(view.subject[0], view.subject[1]);
    this.updateRiderCover(view.subject, pitch > 0 && !view.detached && view.introFlat === 0);
    if (view.introFlat === 0 && city) {
      city.setSuspended?.(false);
      if (!view.detached) city.setRider?.(view.subject[0], view.subject[1]);
      city.followCamera?.();
    }
    camera.projector = pitch > 0 || view.introFlat > 0 ? (x: number, y: number) => this.projectWorld(x, y, loader, canvas) : null;
  }

  private updateRiderCover(rider: [number, number], active: boolean): void {
    const city = this._completeCity;
    const r = this.cover.update(rider, active, performance.now() / 1000, () => city?.featuresAt ? city.featuresAt(rider[0], rider[1]) : []);
    if (!r.changed) return;
    this._threeBuildings?.setHidden?.('cover', r.covered && r.id ? [r.id] : []);
    this.riderCovered = r.covered;
  }

  projectWorld(worldX: number, worldY: number, loader: LoaderFrame, canvas: HTMLCanvasElement): ScreenPoint {
    const lngLat = worldToLngLat(worldX, worldY, loader);
    const p = this.cameraMap.project(lngLat);
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
    return this._threeBuildings?.inspectAtScreen?.(x, y, vp.width, vp.height) ?? null;
  }

  // ---- vehicles ----
  setPlayerBike(player: any, loader: LoaderFrame, visible: boolean, zoomScale = 1): void {
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
    ferry.setAltitude?.(surface ? surface.waterLevelAt(lngLat) + 0.22 : 0.22);
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
  ownGroundStatus(): Record<string, unknown> { return this._ownGround ? this._ownGround.status() : { enabled: true, ready: false }; }
  elevationStatus(): Record<string, unknown> { return this.ownGroundStatus(); }

  setRoute(routePath: readonly { x: number; y: number }[] | null, loader: LoaderFrame, visible: boolean): void {
    if (!loader || loader._lastCenterLat == null) return;
    if (!visible || !routePath || routePath.length < 2) { if (this.ownGroundState.route) this.groundRoute(null); this.routeRef = null; return; }
    if (this.routeRef === routePath && this.ownGroundState.route) return;
    this.routeRef = routePath;
    this.groundRoute(routePath.map(p => worldToLngLat(p.x, p.y, loader)));
  }
  private groundRoute(coords: [number, number][] | null): void { this.ownGroundState.route = coords; this._ownGround?.setRoute(coords); }

  setStreetHighlights(track: any, loader: LoaderFrame, _learned: Set<string>, activeName: string, activeSegmentIndex: number, routePath: unknown = null): void {
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
  setStreetFronts(ways: unknown): void { this.streetFronts = ways; this._threeBuildings?.setStreets?.(ways); }
  setSpoilerNames(names: string[]): void { this.spoilerNames = names || []; }
  _spoils(name: string): boolean { return !!name && this.spoilerNames.includes(name); }
  setMeasuredColoursOnly(on: boolean): void { this.measuredColoursOnly = !!on; }
  setBuildingLookPreference(look: string): void { this.buildingLookPref = look || 'photo'; }
  buildingLook(): string { return this.buildingLookPref; }
  /** Read by the look specs; the own view draws one look until the look switch is ported. */
  get _buildings3dLook(): string { return this.buildingLookPref; }
  /** The streamed buildings' features (context-restore compares them across a restore). */
  _tileFeatures: unknown[] = [];
  applyTheme(theme: string): void {
    this.theme = theme || 'clean';
    const body = W().document?.body;
    body?.classList.remove('theme-8bit', 'theme-16bit', 'theme-psx', 'theme-cyberpunk');
    if (this.theme !== 'clean') body?.classList.add(`theme-${this.theme}`);
  }
  toggleLabels(): boolean { this._labelsVisible = !this._labelsVisible; this.host.triggerRepaint(); return this._labelsVisible; }
  setLabelsVisible(v: boolean): void { this._labelsVisible = !!v; this.host.triggerRepaint(); }
  setQuizQuietMap(quiet: boolean): void { if (this.quizQuiet !== !!quiet) { this.quizQuiet = !!quiet; this.host.triggerRepaint(); } }
  setSpoilersSuspended(suspended: boolean): void { this.spoilersSuspended = !!suspended; }

  /** The card's landmark: its building(s) lit through the facades, and the marker (look/highlightMarker.ts). */
  setActiveLandmark(landmark: any): void {
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
    const focus = landmark && landmark.lngLat ? { lngLat: landmark.lngLat, ids } : null;
    this._threeBuildings?.setHighlighted?.(ids, focus);
    this._highlightMarker?.set(focus ? (this._threeBuildings?.highlightFootprint?.(ids) || focus) : null);
    this.host.triggerRepaint();
  }

  /** Prominent extract landmarks as POI labels, and the neighbourhood boundaries as lines (vector-map.js setPlaces). */
  setPlaces(landmarks: any[], boundaries: any[]): void {
    this.placePois = (landmarks || []).filter(item => item.center && (item.manualPoi || item.nativeKitPoi || (item.prominenceScore || 0) >= 220))
      .map(item => ({ id: `l:${item.id}`, text: item.name, aliases: placeAliases(item), kind: 'poi' as const, priority: 5000 + (item.prominenceScore || 0), lngLat: [item.center[1], item.center[0]] as [number, number], minZoom: 15 }));
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
      .map((p: any, i: number) => ({ id: `b${i}`, text: p.name, kind: 'poi' as const, priority: 3000 + (p.orientationScore || 0), lngLat: [p.center[1], p.center[0]] as [number, number], minZoom: 16.5 }));
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

  // Not yet under the flag (UNIMPLEMENTED): no-ops so the game runs.
  setTreesVisible(): void {}
  setDetailedBuildingsVisible(): void {}
  setGoogleTilesEnabled(): void {}
  setTrees(): void {}
}

function globalNum(name: string, fallback: number): number {
  try {
    // Top-level `const` in constants.js is a global lexical binding, not a window property.
    const v = (0, eval)(`typeof ${name} === 'number' ? ${name} : undefined`);
    return typeof v === 'number' ? v : fallback;
  } catch (_) { return fallback; }
}
