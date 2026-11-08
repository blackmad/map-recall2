// Road number shields on the MapLibre map, once per ref per stretch (issue #259; the rule is
// engine/roadShieldPlacement.ts). The basemap's `highway-shield-non-us` layer (OpenFreeMap Liberty) places a shield
// every `symbol-spacing` 200 tile pixels along every way piece in every tile: 8 × "A10", 7 × "A5" and 8 × "S101" in the
// user's Sloterdijk frame. Here that layer never draws; a point layer with the same look shows the shields
// placeRoadShields picks from anchors sampled along the same features on screen. Free Ride's label toggle still owns
// the visibility (vector-map.js shows and hides every symbol layer; ours is one). `?roadShields=0` keeps the basemap's.
//
// Driven by the label overlay's frame (labelOverlay.ts), at most every PLAN_MS, only while our layer is visible.

import { placeRoadShields, sampleScreenLine, type ShieldAnchor } from '../engine/roadShieldPlacement';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMap = any;

/** The basemap's line-placed shield layers this replaces (the US ones never match in the Netherlands). */
export const BASEMAP_SHIELD_LAYER_IDS = ['highway-shield-non-us'] as const;
export const ROAD_SHIELD_LAYER_ID = 'cr-road-shields';
const SOURCE_ID = 'cr-road-shields';
const PLAN_MS = 250;
/** Anchors along each line on screen, CSS px. */
const SAMPLE_PX = 32;

interface Shield extends ShieldAnchor { lng?: number; lat?: number; refLength: number }

export function roadShieldsEnabled(search = (globalThis as { location?: { search?: string } }).location?.search ?? ''): boolean {
  return new URLSearchParams(search).get('roadShields') !== '0';
}

export class RoadShields {
  private ready = false;
  private failed = false;
  private source: { id: string; sourceLayer: string; filter: unknown } | null = null;
  private previous: Shield[] = [];
  private lastPlan = -Infinity;
  private lastKey = '';
  /** Last plan's numbers, for the probes: anchors sampled, shields placed by ref, ms. */
  stats = { anchors: 0, placed: 0, byRef: {} as Record<string, number>, ms: 0, worstMs: 0, plans: 0 };

  constructor(private readonly map: AnyMap) {}

  /** Every overlay frame: keep the basemap's layer hidden and re-plan on the cadence. */
  frame(now: number): void {
    if (this.failed) return;
    try {
      if (!this.ready && !this.install()) return;
      for (const id of BASEMAP_SHIELD_LAYER_IDS) {
        if (this.map.getLayer(id) && this.map.getLayoutProperty(id, 'visibility') !== 'none') this.map.setLayoutProperty(id, 'visibility', 'none');
      }
      if (now - this.lastPlan < PLAN_MS) return;
      if (this.map.getLayoutProperty(ROAD_SHIELD_LAYER_ID, 'visibility') === 'none') return;
      this.lastPlan = now;
      this.plan();
    } catch (error) {
      this.failed = true;
      console.warn('road shields: off', error);
    }
  }

  /** Adds our source and layer once the basemap's shield layer is in the style, in its look. */
  private install(): boolean {
    const id = BASEMAP_SHIELD_LAYER_IDS[0];
    const base = this.map.getLayer(id);
    if (!base) return false;
    const spec = (this.map.getStyle()?.layers || []).find((l: { id: string }) => l.id === id);
    if (!spec) return false;
    this.source = { id: spec.source, sourceLayer: spec['source-layer'], filter: spec.filter };
    const visibility = this.map.getLayoutProperty(id, 'visibility') ?? 'visible';
    const layout = { ...(spec.layout || {}), 'symbol-placement': 'point', visibility };
    delete layout['symbol-spacing'];
    if (!this.map.getSource(SOURCE_ID)) this.map.addSource(SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!this.map.getLayer(ROAD_SHIELD_LAYER_ID)) {
      this.map.addLayer({ id: ROAD_SHIELD_LAYER_ID, type: 'symbol', source: SOURCE_ID, minzoom: spec.minzoom ?? 0, layout, paint: { ...(spec.paint || {}) } }, id);
    }
    this.ready = true;
    return true;
  }

  private plan(): void {
    const t0 = performance.now();
    const map = this.map, src = this.source!;
    const canvas = map.getCanvas();
    const width = canvas.clientWidth, height = canvas.clientHeight;
    const features = map.querySourceFeatures(src.id, { sourceLayer: src.sourceLayer, filter: src.filter });
    const anchors: Shield[] = [];
    for (const f of features) {
      const ref = f.properties?.ref;
      if (ref == null || ref === '') continue;
      const refLength = Number(f.properties.ref_length) || String(ref).length;
      const g = f.geometry;
      const lines: number[][][] = g?.type === 'LineString' ? [g.coordinates] : g?.type === 'MultiLineString' ? g.coordinates : [];
      for (const line of lines) {
        const screen = line.map(([lng, lat]) => map.project([lng, lat]) as { x: number; y: number });
        // Off-screen lines contribute nothing (placeRoadShields drops them) but cost samples: skip a line whose box misses.
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const p of screen) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
        if (x1 < 0 || y1 < 0 || x0 > width || y0 > height) continue;
        for (const s of sampleScreenLine(screen, SAMPLE_PX)) anchors.push({ ref: String(ref), x: s.x, y: s.y, refLength });
      }
    }
    const previous = this.previous.map(p => { const s = map.project([p.lng, p.lat]); return { ...p, x: s.x, y: s.y }; });
    // Winners are fixed on the ground (lng/lat) so a kept shield moves with the map, not with the screen.
    const placed = placeRoadShields(anchors, previous, { width, height }).map(s => {
      if (s.lng != null) return s;
      const ll = map.unproject([s.x, s.y]);
      return { ...s, lng: ll.lng as number, lat: ll.lat as number };
    });
    this.previous = placed;
    const key = placed.map(s => `${s.ref}@${s.lng!.toFixed(6)},${s.lat!.toFixed(6)}`).join('|');
    if (key !== this.lastKey) {
      this.lastKey = key;
      map.getSource(SOURCE_ID)?.setData({
        type: 'FeatureCollection',
        features: placed.map(s => ({ type: 'Feature', properties: { ref: s.ref, ref_length: s.refLength }, geometry: { type: 'Point', coordinates: [s.lng, s.lat] } })),
      });
    }
    const ms = performance.now() - t0;
    const byRef: Record<string, number> = {};
    for (const s of placed) byRef[s.ref] = (byRef[s.ref] ?? 0) + 1;
    this.stats = { anchors: anchors.length, placed: placed.length, byRef, ms: +ms.toFixed(2), worstMs: Math.max(this.stats.worstMs, +ms.toFixed(2)), plans: this.stats.plans + 1 };
  }
}
