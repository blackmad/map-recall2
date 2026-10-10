// The own map inside the game (`?ownMap=1`, vector-map.js): step 1 of
// dropping MapLibre (docs/research/drop-maplibre-20261010.md §6).
//
// MapLibre stays the camera and the host of the shared three.js frame, but
// draws no third-party basemap: its style is a local background, the flat
// cartography (OwnMapScene) is a shared-frame participant under the
// buildings, and the label layers MapLibre used to draw (own POIs on their
// roofline bands, brands, local food, neighbourhood names, ferry terminals)
// are OwnMapLabels on a 2D canvas inside the map container — under the
// game canvas, which keeps drawing the earned street names (road-network.js).
// `isWater` answers from the overview's water polygons instead of
// `queryRenderedFeatures` on the basemap fills.
//
// Bundle: node scripts/build-3d-bundles.mjs --only=own-map-game
//         (three resolved to the page's copy; global CanalRecallOwnMap).

import { fromLocal, toLocal, type Vec2 } from './frame';
import { decodeOverview, type OverviewData, type OverviewFile } from './overviewFormat';
import { cameraFrame, metresPerPixel, project, visibleBounds, type CameraState } from './mapCamera';
import { OwnMapScene } from './ownMapScene';
import { OwnMapLabels, brandDisc, ferryPin } from './ownMapLabels';
import { BRAND_ICON_URLS, answeredStreetPlacement, ferryOverlay, transitOverlay, type BrandedPoi, type FerryTerminal } from './overlays';
import { handover } from './layers';
import { NEAR_FIELD_FADE, PALETTE, fade } from './style';
import { PolygonGrid } from './geometry';
import type { LabelContext } from './labelPolicy';
import type { SpoilerIndex } from '../orientationPois';
import type { OrientationPoiFile } from '../ownPois';
import type { TransitNetwork } from '../transit/network';
import { groundMercatorFromLocal } from '../ownGround/sharedFrameGround';
import type { FrameParticipant, SharedFrame } from '../rendererShared/sharedFrame';

/** Below the own ground (-10) and the facades (0). */
export const OWN_MAP_ORDER = -20;

/** The MapLibre style the game uses under `?ownMap=1`: nothing to fetch. */
export function ownMapStyle(): Record<string, unknown> {
  return { version: 8, name: 'own-map', sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': PALETTE.land } }] };
}

type LngLat = [number, number];
/** Minimal MapLibre surface used here (camera read-out only). */
interface MapLike {
  getCenter(): { lng: number; lat: number };
  getZoom(): number; getPitch(): number; getBearing(): number;
  getContainer(): HTMLElement;
  transform?: { fov?: number };
  triggerRepaint(): void;
  on(type: string, fn: () => void): void;
}

async function inflate<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(`${r.url}: ${r.status}`);
  const b = new Uint8Array(await r.arrayBuffer());
  const text = b[0] === 0x1f && b[1] === 0x8b
    ? await new Response(new Blob([b as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(b);
  return JSON.parse(text) as T;
}

export interface OwnMapGameOptions {
  /** Absolute extract root (vector-map `_absoluteExtractRoot()`). */
  extractRoot: string;
  /** Dissolve the flat map round the rider where the own ground draws (`?ownGround=1`). */
  nearField?: boolean;
}

export class OwnMapGame {
  data: OverviewData | null = null;
  scene: OwnMapScene | null = null;
  labels: OwnMapLabels | null = null;
  readonly overlay: HTMLCanvasElement;
  private octx: CanvasRenderingContext2D;
  private water: PolygonGrid | null = null;
  private unregister: (() => void) | null = null;
  private ctx: LabelContext = { isLabelled: () => false, hiddenName: '', spoilerIndex: null, quizQuiet: false };
  private ctxKey = '';
  private network: TransitNetwork | null = null;
  private pending: { route?: LngLat[] | null; transit?: boolean; ferry?: Array<{ id: string; name: string; lngLat: LngLat }>; pois?: OrientationPoiFile; branded?: BrandedPoi[] } = {};
  private rider: { at: Vec2; bearing: number } | null = null;
  readonly stats = { loadMs: 0, labelMs: [] as number[], placed: 0, frames: 0, error: '' as string };

  constructor(private frame: SharedFrame, private map: MapLike, private opts: OwnMapGameOptions) {
    this.overlay = document.createElement('canvas');
    this.overlay.className = 'own-map-labels';
    // Over MapLibre's canvas — index.html gives every canvas z-index 2, so 3
    // here — and still under the game canvas, whose #vector-map sibling
    // stacking context (z-index 1) holds this one.
    this.overlay.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3';
    map.getContainer().appendChild(this.overlay);
    this.octx = this.overlay.getContext('2d')!;
  }

  async load(): Promise<void> {
    const t0 = performance.now();
    const root = this.opts.extractRoot;
    const file = await inflate<OverviewFile>(await fetch(`${root}/own-map-v1/overview.json.gz`));
    this.data = decodeOverview(file);
    this.scene = new OwnMapScene(this.data);
    this.water = new PolygonGrid(this.data.water);
    this.labels = new OwnMapLabels(this.data, this.ctx, this.octx);
    const participant: FrameParticipant = {
      root: this.scene.group,
      mercatorFromLocal: () => groundMercatorFromLocal(),
      beforeRender: c => {
        if (c.pass !== 'main' || !this.scene) return false;
        const centre = this.map.getCenter();
        this.scene.update(c.zoom, metresPerPixel(c.zoom, centre.lat));
        if (this.opts.nearField && this.rider) {
          handover.uRider.value.set(this.rider.at[0], this.rider.at[1]);
          handover.uNearR.value = 550;
          handover.uNear.value = fade(c.zoom, NEAR_FIELD_FADE);
        } else handover.uNear.value = 0;
        return true;
      },
    };
    this.unregister = this.frame.register('own-map', participant, { order: OWN_MAP_ORDER });
    try {
      this.network = await inflate<TransitNetwork>(await fetch(`${root}/transit-network.json`));
      this.scene.setFerryLines(ferryOverlay(this.network).lines);
    } catch { /* city without a transit extract */ }
    const icon = await new Promise<HTMLImageElement | null>(resolve => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => resolve(null); i.src = BRAND_ICON_URLS['albert-heijn']; });
    this.brandIcons = icon ? { 'albert-heijn': brandDisc(icon) } : {};
    this.stats.loadMs = Math.round(performance.now() - t0);
    this.replay();
    this.map.on('render', () => this.drawLabels());
    this.map.triggerRepaint();
  }

  private brandIcons: Record<string, HTMLCanvasElement> = {};

  private replay(): void {
    const p = this.pending;
    if (p.route !== undefined) this.setRoute(p.route);
    if (p.transit !== undefined) this.setTransitVisible(p.transit);
    if (p.ferry) this.setFerryTerminals(p.ferry);
    if (p.pois) this.setOwnPois(p.pois);
    if (p.branded) this.setBranded(p.branded);
  }

  dispose(): void {
    this.unregister?.();
    this.overlay.remove();
  }

  /** Route line, lng/lat (null hides it). */
  setRoute(coords: LngLat[] | null): void {
    this.pending.route = coords;
    this.scene?.setRoute(coords && coords.length > 1 ? coords.map(([lng, lat]) => toLocal(lng, lat)) : null);
  }

  /** The transit corridor overlay (the game shows it while riding transit). */
  setTransitVisible(visible: boolean): void {
    this.pending.transit = visible;
    if (!this.scene) return;
    this.scene.setTransit(visible && this.network ? transitOverlay(this.network) : null);
  }

  /** The route's ferry terminals (vector-map setFerryTerminals). */
  setFerryTerminals(list: Array<{ id: string; name: string; lngLat: LngLat }>): void {
    this.pending.ferry = list;
    const terminals: FerryTerminal[] = list.map(t => ({ id: t.id, name: t.name, at: toLocal(t.lngLat[0], t.lngLat[1]) }));
    this.labels?.setFerryTerminals(terminals, ferryPin());
  }

  setOwnPois(file: OrientationPoiFile): void { this.pending.pois = file; this.labels?.setPois(file); }
  setBranded(pois: BrandedPoi[]): void { this.pending.branded = pois; this.labels?.setBranded(pois, this.brandIcons); }

  /**
   * The game's label rules, re-read each frame: the name under question
   * (`quizPromptName || quizCandidateName`), the spoiler index
   * (vector-map `_spoilerIndex`) and quiz-quiet. Rebuilds candidates only when
   * one of them changes. Street/water names stay with road-network.js.
   */
  setRules(hiddenName: string, spoilerIndex: SpoilerIndex | null, quizQuiet: boolean): void {
    const key = `${hiddenName}|${quizQuiet}|${spoilerIndex ? spoilerIndex.names.size : 0}`;
    if (key === this.ctxKey) return;
    this.ctxKey = key;
    this.ctx = { isLabelled: () => false, hiddenName, spoilerIndex, quizQuiet };
    this.labels?.setContext(this.ctx);
  }

  setRider(lngLat: LngLat, bearing: number): void { this.rider = { at: toLocal(lngLat[0], lngLat[1]), bearing }; }

  /** The answered name on the road ahead (null clears); chains are the street's lng/lat polylines. */
  setAnswered(name: string | null, correct: boolean, chains: LngLat[][]): void {
    if (!this.scene) return;
    if (!name || !this.rider || name === this.ctx.hiddenName) { this.scene.setAnswered(null, [], true); return; }
    const placements = answeredStreetPlacement(chains.map(c => c.map(([lng, lat]) => toLocal(lng, lat))), this.rider);
    this.scene.setAnswered(name, placements, correct, fromLocal(this.rider.at[0], this.rider.at[1])[1]);
  }

  /** Water test without the basemap (replaces queryRenderedFeatures on water fills). */
  isWater(lng: number, lat: number): boolean | null {
    if (!this.water) return null;
    const [x, y] = toLocal(lng, lat);
    return this.water.contains(x, y);
  }

  /** The MapLibre camera as an own-map camera (parity: ownMap.test.ts, no-maplibre e2e). */
  camera(): CameraState {
    const c = this.map.getCenter();
    return { center: toLocal(c.lng, c.lat), zoom: this.map.getZoom(), pitch: this.map.getPitch(), bearing: this.map.getBearing(), fovDeg: this.map.transform?.fov };
  }

  private drawLabels(): void {
    if (!this.labels) return;
    const t = performance.now();
    const el = this.overlay, w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) { el.width = Math.round(w * dpr); el.height = Math.round(h * dpr); }
    const g = this.octx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const cam = this.camera();
    const frame = cameraFrame(cam, { width: w, height: h });
    const placed = this.labels.place(p => project(frame, p), w, h, cam.zoom, visibleBounds(frame, Math.min(6000, frame.distance * 4)), frame.distance * 4);
    this.labels.draw(g, placed);
    this.stats.placed = placed.length;
    this.stats.frames++;
    this.stats.labelMs.push(performance.now() - t);
    if (this.stats.labelMs.length > 600) this.stats.labelMs.splice(0, 300);
  }

  status(): Record<string, unknown> {
    const ms = [...this.stats.labelMs].sort((a, b) => a - b);
    return { loaded: !!this.scene, loadMs: this.stats.loadMs, placed: this.stats.placed, frames: this.stats.frames, labelMsMedian: ms[ms.length >> 1] ?? 0, scene: this.scene?.stats, labels: this.labels?.stats };
  }
}

