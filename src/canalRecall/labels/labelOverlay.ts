// The POI label overlay: DOM labels over the map canvas (under the HUD
// canvas), replacing MapLibre's POI symbol layers (`poi-labels`,
// `brand-poi-labels`, `local-food-labels`, `own-poi-labels-*`). DOM because
// the labels are typed in the HUD's face, which MapLibre's glyph PBFs do not
// carry, and because each label needs its own opacity (distance fade,
// occlusion) and a box the HUD can be tested against.
//
// Mounted by vector-map.js (`mountLabelOverlay(this, () => window.canalRecallGame)`).
// `?labels=maplibre` keeps the old symbol layers.
//
// Per frame (MapLibre `render`): project the chosen labels and move them.
// Four times a second: rebuild the candidate set's screen positions, test the
// best of them for occlusion against the picked building surfaces, and plan.

import { HEIGHT_BAND_METRES, type HeightBand } from '../poiCatalog';
import { buildSpoilerIndex, POI_ROOF_HEIGHT_METRES, type SpoilerIndex } from '../orientationPois';
import type { LabelTone } from '../look/palette';
import {
  categoryClass, distanceFade, labelAllowed, labelBudget, labelPriority, planLabels, VENUE_RADIUS_M,
  type LabelCandidate, type LabelRules, type Rect, type ScreenCandidate,
} from './labelPlan';
import { labelCss, labelFont, LABEL_ROOT_CLASS } from './labelStyle';

/** The MapLibre layers this overlay replaces. */
export const REPLACED_LAYER_IDS = [
  'poi-labels', 'brand-poi-labels', 'brand-poi-icons', 'local-food-labels',
  'own-poi-labels-ground', 'own-poi-labels-low', 'own-poi-labels-mid', 'own-poi-labels-high',
];

const PLAN_INTERVAL_MS = 250;
/** Occlusion is tested for this many of the best candidates per plan. */
const OCCLUSION_TESTS = 40;
/** A surface this close in front of the anchor is its own facade or roof (POI points sit a few metres off their walls). */
const OWN_SURFACE_M = 15;
/** Two consecutive verdicts before a label changes occlusion state (hysteresis). */
const OCCLUSION_HOLD = 2;

type AnyMap = any;
type VectorMapLike = any;
type GameLike = any;

interface Projected { x: number; y: number; ndcZ: number; w: number; distM: number; behind: boolean }

/** The overlay is on unless `?labels=maplibre` / window.__canalRecallLabels === 'maplibre'. */
export function labelOverlayEnabled(): boolean {
  try {
    const w = window as any;
    if (w.__canalRecallLabels === 'maplibre') return false;
    return new URLSearchParams(window.location.search).get('labels') !== 'maplibre';
  } catch (_) { return true; }
}

function toneFromUrl(): LabelTone {
  try { return new URLSearchParams(window.location.search).get('labelTone') === 'paper' ? 'paper' : 'ink'; } catch (_) { return 'ink'; }
}

/** The camera as a MercatorCoordinate. MapLibre has no `getFreeCameraOptions()` (that is Mapbox GL). */
function cameraMercator(map: AnyMap): any {
  const ml = (window as any).maplibregl, t = map.transform;
  const at = t?.getCameraLngLat?.(), altitude = t?.getCameraAltitude?.();
  if (!ml?.MercatorCoordinate || !at || !Number.isFinite(altitude)) return null;
  return ml.MercatorCoordinate.fromLngLat(at, altitude);
}

function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Metres between two lng/lat points (local equirectangular; fine at city scale). */
export function groundDistanceM(a: number[], b: number[]): number {
  const k = 111320 * Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180);
  return Math.hypot((a[0] - b[0]) * k, (a[1] - b[1]) * 111320);
}

/** Metres from a point to the nearest edge of a footprint (0 inside it). */
export function footprintDistanceM(geometry: any, at: [number, number]): number {
  if (footprintContains(geometry, at[0], at[1])) return 0;
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
  const k = 111320 * Math.cos(at[1] * Math.PI / 180);
  let best = Infinity;
  for (const rings of polygons) {
    const ring: number[][] = rings?.[0] || [];
    for (let i = 0; i + 1 < ring.length; i++) {
      const ax = (ring[i][0] - at[0]) * k, ay = (ring[i][1] - at[1]) * 111320;
      const bx = (ring[i + 1][0] - at[0]) * k, by = (ring[i + 1][1] - at[1]) * 111320;
      const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
      const t = len > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return best;
}

/** Mean vertex of a footprint's outer ring (lng/lat): which block a hit building is. */
function footprintCentroid(geometry: any): [number, number] | null {
  const ring = geometry?.type === 'Polygon' ? geometry.coordinates?.[0] : geometry?.type === 'MultiPolygon' ? geometry.coordinates?.[0]?.[0] : null;
  if (!ring?.length) return null;
  let x = 0, y = 0;
  for (const [lng, lat] of ring) { x += lng; y += lat; }
  return [x / ring.length, y / ring.length];
}

/** Whether a GeoJSON Polygon/MultiPolygon (lng/lat) contains the point. */
export function footprintContains(geometry: any, lng: number, lat: number): boolean {
  if (!geometry) return false;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  return polygons.some((rings: number[][][]) => rings[0] && pointInRing(lng, lat, rings[0]));
}

export class LabelOverlay {
  readonly root: HTMLDivElement;
  private readonly elements = new Map<string, HTMLDivElement>();
  private readonly sizes = new Map<string, { width: number; height: number }>();
  private candidates: LabelCandidate[] = [];
  private byId = new Map<string, LabelCandidate>();
  /** Landmark footprints (lng/lat), so a hit on the landmark's own walls is not an occluder. */
  private footprints = new Map<string, unknown>();
  private ownReach = new Map<string, number>();
  private sourceKey: unknown[] = [];
  private drawn = new Map<string, number>();
  private occlusion = new Map<string, { occluded: boolean; votes: number }>();
  private lastPlan = 0;
  private placeWarned = false;
  private hiddenName = '';
  private hiddenIndex: SpoilerIndex | null = null;
  /** Last plan's counts, for the e2e and the debug overlay. */
  stats = { candidates: 0, inView: 0, occluded: 0, drawn: 0, budget: 0 };

  constructor(private readonly vm: VectorMapLike, private readonly game: () => GameLike, tone: LabelTone = toneFromUrl()) {
    const map: AnyMap = vm.map;
    const container: HTMLElement = map.getContainer();
    const style = document.createElement('style');
    style.textContent = labelCss(tone);
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.className = LABEL_ROOT_CLASS;
    this.root.dataset.labelTone = tone;
    // Above the game canvas (z 2, which draws over the map container), so
    // after it in the same stacking layer; the HUD plates it carries are kept
    // clear by collision, and DOM cards (z > 2) still cover the labels.
    const gameCanvas = document.getElementById('gameCanvas');
    if (gameCanvas?.parentElement) gameCanvas.after(this.root); else container.appendChild(this.root);
    this.fit(container);
    map.on('render', () => this.frame());
  }

  /** The layer covers the map canvas exactly, so map pixels are layer pixels. */
  private fit(container: HTMLElement): void {
    const r = container.getBoundingClientRect(), st = this.root.style;
    const want = [`${r.left}px`, `${r.top}px`, `${r.width}px`, `${r.height}px`];
    if (st.left !== want[0] || st.top !== want[1] || st.width !== want[2] || st.height !== want[3]) {
      st.left = want[0]; st.top = want[1]; st.width = want[2]; st.height = want[3];
    }
  }

  /** A label under the pointer (CSS px of the map canvas): a click selects its venue. */
  hitTest(x: number, y: number): { id: string; landmarkId: string; name: string; lngLat: [number, number]; poi: true; featureTarget: null } | null {
    for (const [id, el] of this.elements) {
      if (!this.drawn.has(id)) continue;
      const c = this.byId.get(id);
      const box = el.getBoundingClientRect(), origin = this.root.getBoundingClientRect();
      if (!c || x < box.left - origin.left || x > box.right - origin.left || y < box.top - origin.top || y > box.bottom - origin.top) continue;
      return { id: c.id, landmarkId: c.id, name: c.name, lngLat: [c.lng, c.lat], poi: true, featureTarget: null };
    }
    return null;
  }

  private frame(): void {
    const map: AnyMap = this.vm.map;
    if (!map || !map.getStyle()) return;
    this.hideReplacedLayers(map);
    const now = performance.now();
    if (now - this.lastPlan >= PLAN_INTERVAL_MS) {
      this.lastPlan = now;
      this.fit(map.getContainer());
      try { this.plan(map); } catch (error) { console.warn('labels: plan failed', error); }
    }
    try { this.place(map); } catch (error) { if (!this.placeWarned) { this.placeWarned = true; console.warn('labels: place failed', error); } }
  }

  /** The symbol layers stay in the style (other code toggles them); they just never draw. */
  private hideReplacedLayers(map: AnyMap): void {
    for (const id of REPLACED_LAYER_IDS) {
      if (map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none') map.setLayoutProperty(id, 'visibility', 'none');
    }
  }

  private rebuildCandidates(game: GameLike): void {
    const vm = this.vm;
    const own = vm._ownPoiData, places = vm._pendingPlaces, branded = vm._pendingBrandedPois;
    const destinationName = game?._destinationLabel?.() || '';
    const finish = game?.track?.finishPoint;
    const key = [own, places, branded, destinationName, finish];
    if (key.every((value, i) => value === this.sourceKey[i])) return;
    this.sourceKey = key;
    const out: LabelCandidate[] = [];
    for (const f of own?.features || []) {
      const [lng, lat] = f.geometry.coordinates, p = f.properties;
      out.push({ id: `own:${p.name}:${lng.toFixed(5)}`, name: p.name, lng, lat, heightM: HEIGHT_BAND_METRES[p.band as HeightBand] ?? 0, cls: categoryClass(p.category), rank: p.rank || 0 });
    }
    // The game's landmarks (the same set `setPlaces` hands `poi-labels`).
    for (const item of places?.landmarks || []) {
      if (!item.center || !(item.manualPoi || item.nativeKitPoi || (item.prominenceScore || 0) >= 220)) continue;
      // A landmark with a footprint is a building: its name sits at a roofline
      // (POI_ROOF_HEIGHT_METRES), as the shops' do. Trees, statues and
      // memorials have no footprint and keep the ground (Bevrijdingslinde, 2026-09-29).
      const building = Array.isArray(item.path) && item.path.length >= 3;
      out.push({ id: String(item.id), name: item.name, lng: item.center[1], lat: item.center[0], heightM: building ? POI_ROOF_HEIGHT_METRES : 0, cls: 'landmark', rank: Math.min(999, (item.prominenceScore || 0) / 2) });
      if (building) {
        this.footprints.set(String(item.id), { type: 'Polygon', coordinates: [item.path.map(([lat, lng]: number[]) => [lng, lat])] });
        // How far its own walls can stand in front of its centre.
        const k = 111320 * Math.cos(item.center[0] * Math.PI / 180);
        this.ownReach.set(String(item.id), Math.max(...item.path.map(([lat, lng]: number[]) => Math.hypot((lng - item.center[1]) * k, (lat - item.center[0]) * 111320))));
      }
    }
    for (const poi of branded || []) {
      if (!poi.center) continue;
      out.push({ id: `brand:${poi.id}`, name: poi.name, lng: poi.center[1], lat: poi.center[0], heightM: HEIGHT_BAND_METRES.low, cls: 'venue', rank: poi.orientationScore || 0 });
    }
    if (destinationName && destinationName !== 'your destination' && finish && game.osmLoader) {
      const ll = vm.worldToLngLat(finish.x, finish.y, game.osmLoader);
      const [lng, lat] = Array.isArray(ll) ? ll : [ll.lng, ll.lat];
      if (Number.isFinite(lng) && Number.isFinite(lat)) out.push({ id: 'destination', name: destinationName, lng, lat, heightM: 0, cls: 'destination', rank: 999 });
    }
    this.candidates = out;
    this.byId = new Map(out.map(c => [c.id, c]));
  }

  private rules(game: GameLike): LabelRules {
    const hiddenName = game?.quizPromptName || game?.quizCandidateName || game?._silentPass?.name || '';
    if (hiddenName !== this.hiddenName) { this.hiddenName = hiddenName; this.hiddenIndex = null; }
    return {
      // Not `_labelsVisible`: the D toggle hides street names but keeps the
      // orientation POIs on purpose (vector-map.js `_hideLabels`).
      labelsOff: false,
      hiddenName,
      spoilerIndex: this.vm._spoilerIndex || (hiddenName ? (this.hiddenIndex ??= buildSpoilerIndex([hiddenName])) : null),
      quizQuiet: !!this.vm._quizQuietMap,
      isLabelled: () => false,
    };
  }

  /** Clip-space projection of a point `heightM` above the ground. */
  private projector(map: AnyMap): ((lng: number, lat: number, heightM: number) => Projected) | null {
    const ml = (window as any).maplibregl;
    const data = map.transform?.getProjectionDataForCustomLayer?.(false);
    const m = data?.mainMatrix;
    if (!ml?.MercatorCoordinate || !m) return null;
    const canvas = map.getCanvas() as HTMLCanvasElement;
    const width = canvas.clientWidth, height = canvas.clientHeight;
    const cam = cameraMercator(map);
    const metre = cam ? cam.meterInMercatorCoordinateUnits() : 1;
    return (lng, lat, heightM) => {
      const mc = ml.MercatorCoordinate.fromLngLat([lng, lat], heightM);
      const x = mc.x, y = mc.y, z = mc.z;
      const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
      const cz = m[2] * x + m[6] * y + m[10] * z + m[14];
      const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
      const distM = cam ? Math.hypot(x - cam.x, y - cam.y, z - cam.z) / metre : 0;
      if (cw <= 1e-9) return { x: -1e4, y: -1e4, ndcZ: 2, w: cw, distM, behind: true };
      return { x: (cx / cw + 1) / 2 * width, y: (1 - cy / cw) / 2 * height, ndcZ: cz / cw, w: cw, distM, behind: false };
    };
  }

  /**
   * The nearest building surface under a pixel, with its ground distance
   * from the camera. The pickers (three.js city, signature landmarks, tile
   * buildings) each report depth in their own clip space, which do not agree
   * with MapLibre's or each other's (measured 2026-10-13: a hit at NDC 0.46
   * against an anchor at 0.9995 behind it), so hits are compared on the
   * ground: the camera's distance to the hit building's footprint.
   */
  private pick(x: number, y: number, width: number, height: number, camera: [number, number]): { hit: any; groundM: number } | null {
    const vm = this.vm;
    let best: { hit: any; groundM: number } | null = null;
    for (const layer of [vm._signatureLandmarks, vm._threeBuildings, vm._tileBuildings]) {
      const hit = layer?.inspectAtScreen?.(x, y, width, height);
      // A camera inside a footprint sees none of its (back-face culled) walls.
      if (!hit || footprintContains(hit.footprint, camera[0], camera[1])) continue;
      const groundM = hit.footprint ? footprintDistanceM(hit.footprint, camera)
        : Array.isArray(hit.lngLat) ? Math.max(0, groundDistanceM(hit.lngLat, camera) - OWN_SURFACE_M) : Infinity;
      if (Number.isFinite(groundM) && (!best || groundM < best.groundM)) best = { hit, groundM };
    }
    return best;
  }

  /** Hidden when the first surface on the ray is clearly in front of the anchor and is not the POI's own building. */
  private occludedNow(c: LabelCandidate, p: Projected, width: number, height: number, camera: [number, number]): boolean {
    const picked = this.pick(p.x, p.y, width, height, camera);
    if (!picked) return false;
    const { hit, groundM } = picked;
    // POI points sit a few metres off their walls; a landmark's walls stand up to its own reach in front of its centre.
    const reach = Math.max(OWN_SURFACE_M, (this.ownReach.get(c.id) ?? 0) + 5);
    if (groundM >= groundDistanceM([c.lng, c.lat], camera) - reach) return false;
    if (hit.landmarkId && String(hit.landmarkId) === c.id) return false;
    if (footprintContains(hit.footprint, c.lng, c.lat)) return false;
    // The hit lies inside the landmark's own footprint: its own facade.
    const own = this.footprints.get(c.id);
    const at = footprintCentroid(hit.footprint) ?? (Array.isArray(hit.lngLat) ? hit.lngLat : null);
    if (own && at && footprintContains(own, at[0], at[1])) return false;
    return true;
  }

  private hudRects(game: GameLike, origin: DOMRect): Rect[] {
    const rects: Rect[] = [];
    const add = (r: DOMRect | null | undefined) => { if (r && r.width > 0 && r.height > 0) rects.push({ x: r.left - origin.left, y: r.top - origin.top, width: r.width, height: r.height }); };
    try {
      const layout = game?._hudRects?.();
      const canvas = game?.canvas as HTMLCanvasElement | undefined;
      if (layout && canvas) {
        const box = canvas.getBoundingClientRect();
        const w = (0, eval)('typeof CANVAS_W === "number" ? CANVAS_W : 0') || canvas.width;
        const h = (0, eval)('typeof CANVAS_H === "number" ? CANVAS_H : 0') || canvas.height;
        const sx = box.width / w, sy = box.height / h;
        const names = ['recall', 'location', 'destination', 'compass', 'trip', 'zoomBadge', 'controlsHint'];
        if (game.showMiniMap !== false) names.push('minimap');
        if (game._landmarkNotice) names.push('landmark', 'postcard');
        for (const name of names) {
          const r = layout[name];
          if (r) add(new DOMRect(box.left + r.x * sx, box.top + r.y * sy, r.width * sx, r.height * sy));
        }
        if (layout.dpad?.bounds) { const r = layout.dpad.bounds; add(new DOMRect(box.left + r.x * sx, box.top + r.y * sy, r.width * sx, r.height * sy)); }
      }
    } catch (_) { /* no HUD yet */ }
    // DOM teaching surfaces: the question prompt and the landmark panel.
    for (const el of [game?._prompt, document.getElementById('landmark-panel')] as HTMLElement[]) {
      if (el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden') add(el.getBoundingClientRect());
    }
    return rects;
  }

  private size(c: LabelCandidate): { width: number; height: number } {
    let s = this.sizes.get(c.id);
    if (s) return s;
    const el = this.element(c);
    el.style.visibility = 'hidden';
    el.style.opacity = '0';
    s = { width: el.offsetWidth || c.name.length * 7, height: el.offsetHeight || 24 };
    el.style.visibility = '';
    this.sizes.set(c.id, s);
    return s;
  }

  private element(c: LabelCandidate): HTMLDivElement {
    let el = this.elements.get(c.id);
    if (el && el.dataset.mapLabel === c.name) return el;
    el?.remove();
    el = document.createElement('div');
    el.className = `l ${c.cls}`;
    el.dataset.mapLabel = c.name;
    el.dataset.labelClass = c.cls;
    el.style.opacity = '0';
    const name = document.createElement('div');
    name.className = 'n';
    name.textContent = c.name;
    name.style.font = labelFont(c.cls);
    el.append(name, Object.assign(document.createElement('div'), { className: 's' }), Object.assign(document.createElement('div'), { className: 'd' }));
    this.root.appendChild(el);
    this.elements.set(c.id, el);
    this.sizes.delete(c.id);
    return el;
  }

  private plan(map: AnyMap): void {
    const game = this.game();
    this.rebuildCandidates(game);
    const project = this.projector(map);
    if (!project) return;
    const canvas = map.getCanvas() as HTMLCanvasElement;
    const width = canvas.clientWidth, height = canvas.clientHeight;
    const rules = this.rules(game);
    const altitude = map.transform?.getCameraAltitude?.();
    const cameraHeightM = Number.isFinite(altitude) ? Math.max(1, altitude) : 250;
    const player = game?.player, loader = game?.osmLoader;
    let rider: [number, number] | null = null;
    if (player && loader && Number.isFinite(player.x)) {
      const ll = this.vm.worldToLngLat(player.x, player.y, loader);
      rider = Array.isArray(ll) ? [ll[0], ll[1]] : [ll.lng, ll.lat];
    }
    const mPerLng = 111320 * Math.cos((rider?.[1] ?? 52.37) * Math.PI / 180);
    // Cheap screen and rule pass first; occlusion (ray picks) only for the best few.
    const screen: (ScreenCandidate & { ndcZ: number; w: number })[] = [];
    for (const c of this.candidates) {
      const riderDistM = rider ? Math.hypot((c.lng - rider[0]) * mPerLng, (c.lat - rider[1]) * 111320) : Infinity;
      if (c.cls === 'venue' && riderDistM > VENUE_RADIUS_M) continue;
      if (!labelAllowed(rules, c.cls, c.name)) continue;
      const p = project(c.lng, c.lat, c.heightM);
      if (p.behind || p.x < 0 || p.y < 0 || p.x > width || p.y > height || p.ndcZ > 1) continue;
      // Beyond the fade range: never drawn, so never worth a ray pick.
      if (c.cls !== 'destination' && distanceFade(p.distM, cameraHeightM) <= 0.05) continue;
      screen.push({ ...c, x: p.x, y: p.y, width: 0, height: 0, distM: p.distM, riderDistM, occluded: false, ndcZ: p.ndcZ, w: p.w });
    }
    const order = screen.map((c, i) => ({ i, score: labelPriority(c, c.distM) + (this.drawn.has(c.id) ? 150 : 0) }))
      .sort((a, b) => b.score - a.score);
    const cameraAt = map.transform?.getCameraLngLat?.();
    const camera: [number, number] = cameraAt ? [cameraAt.lng, cameraAt.lat] : [map.getCenter().lng, map.getCenter().lat];
    let occludedCount = 0;
    for (const { i } of order.slice(0, OCCLUSION_TESTS)) {
      const c = screen[i];
      const now = this.occludedNow(c, { x: c.x, y: c.y, ndcZ: c.ndcZ, w: c.w, distM: c.distM, behind: false }, width, height, camera);
      const state = this.occlusion.get(c.id) ?? { occluded: now, votes: OCCLUSION_HOLD };
      state.votes = now === state.occluded ? OCCLUSION_HOLD : state.votes - 1;
      if (state.votes <= 0) { state.occluded = now; state.votes = OCCLUSION_HOLD; }
      this.occlusion.set(c.id, state);
      c.occluded = state.occluded;
      if (c.occluded) occludedCount++;
    }
    // Untested candidates rank below the tested ones; treat them as hidden rather than guess.
    const tested = new Set(order.slice(0, OCCLUSION_TESTS).map(o => o.i));
    const pool = screen.filter((_, i) => tested.has(i));
    for (const c of pool) Object.assign(c, this.size(c));
    const plan = planLabels({
      candidates: pool, rules, cameraHeightM, viewport: { width, height },
      hud: this.hudRects(game, canvas.getBoundingClientRect()), previous: new Set(this.drawn.keys()),
    });
    const previous = this.drawn;
    this.drawn = new Map(plan.map(p => [p.id, p.opacity]));
    // Elements neither drawn now nor fading out from the last plan go.
    for (const [id, el] of this.elements) {
      if (this.drawn.has(id) || previous.has(id)) continue;
      el.remove(); this.elements.delete(id); this.sizes.delete(id);
    }
    this.stats = { candidates: this.candidates.length, inView: screen.length, occluded: occludedCount, drawn: plan.length, budget: labelBudget(cameraHeightM, width * height) };
  }

  /** Every frame: follow the camera; fade in the planned labels, fade out the rest. */
  private place(map: AnyMap): void {
    const project = this.projector(map);
    if (!project) return;
    for (const [id, el] of this.elements) {
      const opacity = this.drawn.get(id);
      if (opacity == null) {
        if (el.style.opacity !== '0') el.style.opacity = '0';
        continue;
      }
      const c = this.byId.get(id);
      if (!c) { el.style.opacity = '0'; continue; }
      const p = project(c.lng, c.lat, c.heightM);
      const s = this.size(c);
      el.style.transform = `translate(${(p.x - s.width / 2).toFixed(1)}px, ${(p.y + 3 - s.height).toFixed(1)}px)`;
      el.style.opacity = opacity.toFixed(2);
    }
  }
}

/** vector-map.js mount: one overlay per map, or null when `?labels=maplibre`. */
export function mountLabelOverlay(vm: VectorMapLike, game: () => GameLike): LabelOverlay | null {
  if (!labelOverlayEnabled() || !vm?.map) return null;
  return new LabelOverlay(vm, game);
}
