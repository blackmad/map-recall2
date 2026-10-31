// The engine's camera (`?engine=own`): MapLibre's camera model from
// ownMap/mapCamera.ts (`CameraState`, `cameraFrame`), evaluated in east/north
// metres about the view centre so the projection is MapLibre's exactly (both
// are linear in Web Mercator about the centre; the own map's fixed local frame
// was what left 1–3 px, docs/research/drop-maplibre-20261010.md §3).
//
// It answers three audiences:
//   - `WorldCamera` (engine/worldViewApi.ts): the oracle the specs and the game
//     read as `vectorMap.camera`.
//   - the shared frame's host driver: `clipFromMercator()` is the matrix
//     MapLibre hands a custom layer as `mainMatrix`, so every participant
//     renders unchanged.
//   - participants built for a MapLibre map (`getZoom`, `getCenter`,
//     `getBounds`, `project`, `on('move')`, `triggerRepaint`, …): the slice
//     they read is implemented here over the camera; style queries answer
//     empty. Anything else they reach for is a gap to list, not to fake.

import { cameraFrame, project as projectFrame, unproject as unprojectFrame, visibleBounds, DEFAULT_FOV_DEG, MAX_PITCH_DEG, type CameraFrame, type CameraState, type Viewport } from '../ownMap/mapCamera';
import type { FrameHost, FrameListener } from './frameHost';
import type { LngLat, LngLatLike, ScreenPoint, ViewBounds, WorldCamera } from './worldViewApi';

/** MapLibre's earth (6371008.8 m), the one its zoom and `mainMatrix` use. */
const EARTH_CIRCUMFERENCE = 2 * Math.PI * 6371008.8;

export function mercatorX(lng: number): number { return (180 + lng) / 360; }
export function mercatorY(lat: number): number { return (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360; }
export function lngOfMercatorX(x: number): number { return x * 360 - 180; }
export function latOfMercatorY(y: number): number { return (360 / Math.PI) * Math.atan(Math.exp(((180 - y * 360) * Math.PI) / 180)) - 90; }
/** MapLibre's `meterInMercatorCoordinateUnits` at a latitude. */
export function unitsPerMetre(lat: number): number { return 1 / (EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180)); }

const asLngLat = (p: LngLatLike): [number, number] => Array.isArray(p) ? [p[0], p[1]] : [(p as LngLat).lng, (p as LngLat).lat];

export type MapCameraOptions = { center?: LngLatLike; zoom?: number; bearing?: number; pitch?: number; elevation?: number; fovDeg?: number; minZoom?: number; maxZoom?: number; maxPitch?: number };

const lngLatObject = (lng: number, lat: number) => ({ lng, lat, toArray: () => [lng, lat] as [number, number] });
type LngLatObject = ReturnType<typeof lngLatObject>;
type BoundsLike = ViewBounds & {
  getWest(): number; getEast(): number; getSouth(): number; getNorth(): number;
  getNorthEast(): LngLatObject; getSouthWest(): LngLatObject;
  getNorthWest(): LngLatObject; getSouthEast(): LngLatObject;
  getCenter(): LngLatObject;
  contains(lngLat: LngLatLike | { lon: number; lat: number }): boolean;
  isEmpty(): boolean;
  toArray(): [[number, number], [number, number]];
};
/**
 * MapLibre's LngLatBounds surface over the view's box: the participants call it on `map.getBounds()`
 * (artis-animals.js `contains`, park-landscape.js `getWest()`…). `contains` follows LngLatBounds.contains:
 * inclusive edges, and a box whose west lies east of its east wraps the antimeridian.
 */
export const boundsObject = (b: ViewBounds): BoundsLike => ({
  ...b,
  getWest: () => b.west, getEast: () => b.east, getSouth: () => b.south, getNorth: () => b.north,
  getNorthEast: () => lngLatObject(b.east, b.north), getSouthWest: () => lngLatObject(b.west, b.south),
  getNorthWest: () => lngLatObject(b.west, b.north), getSouthEast: () => lngLatObject(b.east, b.south),
  getCenter: () => lngLatObject((b.west + b.east) / 2, (b.south + b.north) / 2),
  contains: (p) => {
    const o = p as { lng?: number; lon?: number; lat?: number } & ArrayLike<number>;
    const lng = Array.isArray(p) ? o[0] : (o.lng ?? o.lon ?? NaN);
    const lat = Array.isArray(p) ? o[1] : (o.lat ?? NaN);
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || lat < b.south || lat > b.north) return false;
    return b.west <= b.east ? lng >= b.west && lng <= b.east : lng >= b.west || lng <= b.east;
  },
  isEmpty: () => !(Number.isFinite(b.west) && Number.isFinite(b.east) && Number.isFinite(b.south) && Number.isFinite(b.north)),
  toArray: () => [[b.west, b.south], [b.east, b.north]],
});

/**
 * The camera state as MapLibre holds it (lng/lat centre), plus the derived frame. Pure maths over a viewport; the
 * page adapter `CameraMap` adds the host's events and canvas.
 */
export class EngineCamera {
  lng = 4.9041;
  lat = 52.3676;
  zoom = 17;
  bearing = 0;
  pitch = 0;
  elevation = 0;
  fovDeg = DEFAULT_FOV_DEG;
  minZoom = 0;
  maxZoom = 22;
  maxPitch = MAX_PITCH_DEG;
  private cached: { key: string; frame: CameraFrame } | null = null;

  constructor(private readonly viewportOf: () => Viewport, options: MapCameraOptions = {}) { this.set(options); }

  /** Apply a jump; returns whether anything changed (and whether the zoom did). */
  set(options: MapCameraOptions): { moved: boolean; zoomed: boolean } {
    const before = this.key();
    const zoomBefore = this.zoom;
    if (options.minZoom != null) this.minZoom = options.minZoom;
    if (options.maxZoom != null) this.maxZoom = options.maxZoom;
    if (options.maxPitch != null) this.maxPitch = Math.min(MAX_PITCH_DEG, options.maxPitch);
    if (options.center) { const [lng, lat] = asLngLat(options.center); if (Number.isFinite(lng) && Number.isFinite(lat)) { this.lng = lng; this.lat = Math.max(-85, Math.min(85, lat)); } }
    if (Number.isFinite(options.zoom)) this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, options.zoom!));
    if (Number.isFinite(options.bearing)) this.bearing = ((((options.bearing! + 180) % 360) + 360) % 360) - 180;
    if (Number.isFinite(options.pitch)) this.pitch = Math.max(0, Math.min(this.maxPitch, options.pitch!));
    if (options.elevation != null && Number.isFinite(options.elevation)) this.elevation = options.elevation;
    if (options.fovDeg != null) this.fovDeg = options.fovDeg;
    return { moved: this.key() !== before, zoomed: this.zoom !== zoomBefore };
  }

  state(): CameraState { return { center: [0, 0], zoom: this.zoom, bearing: this.bearing, pitch: this.pitch, fovDeg: this.fovDeg, elevation: this.elevation }; }
  private key(): string { return `${this.lng},${this.lat},${this.zoom},${this.bearing},${this.pitch},${this.elevation},${this.fovDeg}`; }

  /** mapCamera.ts frame in east/north/up metres about the centre (centre = [0, 0, elevation]). */
  frame(): CameraFrame {
    const vp = this.viewportOf();
    const key = `${this.key()}|${vp.width}x${vp.height}`;
    if (this.cached?.key === key) return this.cached.frame;
    const frame = cameraFrame(this.state(), vp, this.lat);
    this.cached = { key, frame };
    return frame;
  }

  /** lng/lat (+ metres above z = 0) → metres about the centre. Exact in Mercator: the scale is the centre's. */
  enuOf(lng: number, lat: number, altitudeM = 0): [number, number, number] {
    const u = unitsPerMetre(this.lat);
    return [(mercatorX(lng) - mercatorX(this.lng)) / u, -(mercatorY(lat) - mercatorY(this.lat)) / u, altitudeM];
  }
  lngLatOf(x: number, y: number): [number, number] {
    const u = unitsPerMetre(this.lat);
    return [lngOfMercatorX(mercatorX(this.lng) + x * u), latOfMercatorY(mercatorY(this.lat) - y * u)];
  }

  project(lngLat: LngLatLike, altitudeM = 0): ScreenPoint & { depth: number } {
    const [lng, lat] = asLngLat(lngLat);
    return projectFrame(this.frame(), this.enuOf(lng, lat, altitudeM));
  }
  unproject(x: number, y: number, planeZ = 0): LngLat | null {
    const hit = unprojectFrame(this.frame(), x, y, planeZ);
    if (!hit) return null;
    const [lng, lat] = this.lngLatOf(hit[0], hit[1]);
    return { lng, lat };
  }
  bounds(): ViewBounds {
    const [x0, y0, x1, y1] = visibleBounds(this.frame());
    const [west, south] = this.lngLatOf(x0, y0), [east, north] = this.lngLatOf(x1, y1);
    return { west, south, east, north };
  }

  /** The eye: lng/lat and altitude (MapLibre `transform.getCameraLngLat` / `getCameraAltitude`). */
  eye(): { lng: number; lat: number; altitudeM: number } {
    const f = this.frame();
    const [lng, lat] = this.lngLatOf(f.eye[0], f.eye[1]);
    return { lng, lat, altitudeM: f.eye[2] };
  }

  /**
   * clip ← Mercator ([0,1]² + Mercator-unit altitude), MapLibre's `mainMatrix` for this camera: perspective × view
   * (mapCamera's eye and basis) × (metres about the centre ← Mercator). Near and far follow MapLibre's choice
   * (near = distance / 50, far just past the furthest visible ground), so depth precision matches.
   */
  clipFromMercator(): number[] {
    const f = this.frame();
    const vp = f.viewport;
    const fov = (this.fovDeg * Math.PI) / 180, half = fov / 2;
    const pitch = (this.pitch * Math.PI) / 180;
    const d = f.distance;
    const groundAngle = Math.PI / 2 + pitch;
    const topHalf = (Math.sin(half) * d) / Math.sin(Math.max(0.01, Math.min(Math.PI - 0.01, Math.PI - groundAngle - half)));
    const furthest = Math.cos(Math.PI / 2 - pitch) * topHalf + d;
    const near = d / 50, far = Math.max(near * 2, furthest * 1.01 + Math.max(0, this.elevation));
    const aspect = vp.width / Math.max(1, vp.height);
    const t = 1 / Math.tan(half);
    // Column-major perspective (GL convention, -z forward in view space).
    const P = [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0];
    const r = f.right, u = f.up, b = [-f.forward[0], -f.forward[1], -f.forward[2]], e = f.eye;
    const dot = (a: readonly number[], c: readonly number[]) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
    const V = [r[0], u[0], b[0], 0, r[1], u[1], b[1], 0, r[2], u[2], b[2], 0, -dot(r, e), -dot(u, e), -dot(b, e), 1];
    const k = 1 / unitsPerMetre(this.lat);
    const cx = mercatorX(this.lng), cy = mercatorY(this.lat);
    const W = [k, 0, 0, 0, 0, -k, 0, 0, 0, 0, k, 0, -cx * k, cy * k, 0, 1];
    return mul(P, mul(V, W));
  }
}

function mul(a: readonly number[], b: readonly number[]): number[] {
  const out = new Array<number>(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let i = 0; i < 4; i++) s += a[i * 4 + r] * b[c * 4 + i];
    out[c * 4 + r] = s;
  }
  return out;
}

/**
 * The camera with the host's canvas and events: `vectorMap.camera` (WorldCamera) and the MapLibre-shaped surface the
 * shared frame and the participants are handed as their `map`.
 */
export class CameraMap {
  readonly camera: EngineCamera;
  /** The WorldCamera view of this map. */
  readonly api: WorldCamera;
  /** Pending fetches / builds the view is waiting on (participants report through `busy`). */
  private busyCount = 0;
  private readonly idleWaiters: Array<() => void> = [];

  constructor(readonly host: FrameHost, options: MapCameraOptions = {}) {
    this.camera = new EngineCamera(() => host.viewport(), options);
    this.host.on('render', () => this.checkIdle());
    const self = this;
    this.api = {
      project: p => { const s = self.camera.project(p); return { x: s.x, y: s.y }; },
      unproject: p => self.unproject(p),
      center: () => lngLatObject(self.camera.lng, self.camera.lat),
      zoom: () => self.camera.zoom,
      bounds: () => boundsObject(self.camera.bounds()),
      pitch: () => self.camera.pitch,
      bearing: () => self.camera.bearing,
      onFrame: cb => { const l = () => cb(); self.host.on('render', l); return () => self.host.off('render', l); },
      whenIdle: () => self.whenIdle(),
    };
  }

  // ---- MapLibre-shaped camera ----
  jumpTo(options: MapCameraOptions): this {
    const { moved, zoomed } = this.camera.set(options);
    if (!moved) return this;
    this.host.fire('movestart');
    this.host.fire('move');
    if (zoomed) this.host.fire('zoom');
    this.host.fire('moveend');
    this.host.triggerRepaint();
    return this;
  }
  getZoom(): number { return this.camera.zoom; }
  getCenter() { return lngLatObject(this.camera.lng, this.camera.lat); }
  getBearing(): number { return this.camera.bearing; }
  getPitch(): number { return this.camera.pitch; }
  getBounds(): BoundsLike { return boundsObject(this.camera.bounds()); }
  project(lngLat: LngLatLike) { const s = this.camera.project(lngLat); return { x: s.x, y: s.y }; }
  unproject(point: ScreenPoint | readonly [number, number]) {
    const x = Array.isArray(point) ? point[0] : (point as ScreenPoint).x, y = Array.isArray(point) ? point[1] : (point as ScreenPoint).y;
    const hit = this.camera.unproject(x, y);
    if (hit) return lngLatObject(hit.lng, hit.lat);
    // Above the horizon MapLibre clamps to the far edge; do the same along the column.
    const vp = this.host.viewport();
    for (let yy = y; yy < vp.height; yy += vp.height / 32) { const h = this.camera.unproject(x, yy); if (h) return lngLatObject(h.lng, h.lat); }
    return this.getCenter();
  }
  /**
   * MapLibre's `calculateCameraOptionsFromTo`: the camera at `from` (+`altitudeFrom` m) looking at `to` (+`altitudeTo` m),
   * as centre/elevation/zoom/pitch/bearing. Uses this map's viewport and field of view.
   */
  calculateCameraOptionsFromTo(from: LngLatLike, altitudeFrom: number, to: LngLatLike, altitudeTo = 0): MapCameraOptions {
    const [fl, fa] = asLngLat(from), [tl, ta] = asLngLat(to);
    const u = unitsPerMetre(ta);
    const dx = (mercatorX(tl) - mercatorX(fl)) / u, dy = -(mercatorY(ta) - mercatorY(fa)) / u, dz = altitudeTo - altitudeFrom;
    const distance = Math.hypot(dx, dy, dz);
    const vp = this.host.viewport();
    const focal = 0.5 * vp.height / Math.tan((this.camera.fovDeg * Math.PI / 180) / 2);
    // distance = focal · metres-per-pixel, and metres-per-pixel = 2π R cos(lat) / (512 · 2^zoom).
    const zoom = Math.log2((2 * Math.PI * 6371008.8 * Math.cos(ta * Math.PI / 180) * focal) / (512 * distance));
    const pitch = Math.atan2(Math.hypot(dx, dy), -dz) * 180 / Math.PI;
    const bearing = Math.atan2(dx, dy) * 180 / Math.PI;
    return { center: [tl, ta], elevation: altitudeTo, zoom, pitch, bearing };
  }
  /** MapLibre's camera knobs the look specs set; padding is always zero here. */
  stop(): this { return this; }
  setPadding(): this { return this; }
  setVerticalFieldOfView(deg: number): this { this.camera.set({ fovDeg: deg }); this.host.triggerRepaint(); return this; }
  getMaxPitch(): number { return this.camera.maxPitch; }
  setMaxPitch(p: number): this { this.camera.maxPitch = Math.min(MAX_PITCH_DEG, p); return this; }
  /** MapLibre's transform: the two members the camera clearance reads. */
  get transform() {
    const self = this;
    return {
      getCameraLngLat: () => { const e = self.camera.eye(); return lngLatObject(e.lng, e.lat); },
      getCameraAltitude: () => self.camera.eye().altitudeM,
      get zoom() { return self.camera.zoom; },
      get pitch() { return self.camera.pitch; },
      get bearing() { return self.camera.bearing; },
    };
  }

  // ---- host passthroughs ----
  on(type: string, listener: FrameListener): this { this.host.on(type, listener); return this; }
  off(type: string, listener: FrameListener): this { this.host.off(type, listener); return this; }
  once(type: string, listener?: FrameListener): any { return listener ? (this.host.once(type, listener), this) : this.host.once(type); }
  fire(type: string, event?: unknown): this { this.host.fire(type, event); return this; }
  triggerRepaint(): void { this.host.triggerRepaint(); }
  getCanvas(): HTMLCanvasElement { return this.host.getCanvas(); }
  getCanvasContainer(): HTMLElement { return this.host.getContainer(); }
  getContainer(): HTMLElement { return this.host.getContainer(); }
  getPixelRatio(): number { return this.host.getPixelRatio(); }
  setPixelRatio(r: number): void { this.host.setPixelRatio(r); }
  resize(): this { this.host.resize(); return this; }
  redraw(): this { this.host.redraw(); return this; }

  // ---- style: there is none (participants that probe it see an empty style) ----
  isStyleLoaded(): boolean { return true; }
  loaded(): boolean { return true; }
  get style() { return { loaded: () => true }; }
  getStyle() { return { layers: [] as unknown[], sources: {} }; }
  getLayer(): undefined { return undefined; }
  getSource(): undefined { return undefined; }
  getLayersOrder(): string[] { return []; }
  queryRenderedFeatures(): unknown[] { return []; }

  // ---- idle ----
  /** A participant starts (true) or finishes (false) loading something the view waits for. */
  busy(on: boolean): void { this.busyCount = Math.max(0, this.busyCount + (on ? 1 : -1)); if (!on) this.host.triggerRepaint(); }
  whenIdle(): Promise<void> {
    return new Promise(resolve => { this.idleWaiters.push(resolve); this.host.triggerRepaint(); });
  }
  private checkIdle(): void {
    if (this.busyCount || !this.idleWaiters.length) return;
    const waiters = this.idleWaiters.splice(0);
    this.host.fire('idle');
    for (const resolve of waiters) resolve();
  }
}
