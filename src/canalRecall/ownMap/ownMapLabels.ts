// The own map's label layer: which names are candidates (labelPolicy.ts, the
// game's rules), their style (the game's MapLibre symbol layers, cited per
// kind), bucketed for the visible box, placed by labels.ts and drawn on a 2D
// canvas. No three.js, no MapLibre: the page and the game hand it a
// projection and a zoom each frame.

import { toLocal, type Vec2 } from './frame';
import type { Vec3 } from './mapCamera';
import type { OverviewData, StreetClass } from './overviewFormat';
import { STREET_STYLE, interpolateStops } from './style';
import { drawPlacedLabels, placeLabels, type LabelCandidate, type LabelIcon, type LabelKind, type LabelPaint, type PlacedLabel, type Projected } from './labels';
import { brandIconVisible, ferryLabelVisible, neighbourhoodLabelVisible, poiLabelVisible, streetLabelVisible, type LabelContext } from './labelPolicy';
import { ownPoiFeatures, type OrientationPoiFile } from '../ownPois';
import { HEIGHT_BAND_METRES } from '../poiCatalog';
import { POI_ROOF_HEIGHT_METRES } from '../orientationPois';
import { brandedPoiOverlay, ferryTerminalLabel, interpolateLinear, type BrandedPoi, type FerryTerminal } from './overlays';
import { lineLength } from './geometry';

const FONT = '"Helvetica Neue", Arial, sans-serif';

/** Paint per kind, from the game's symbol layers (vector-map.js). */
export const LABEL_PAINT: Record<LabelKind, LabelPaint> = {
  street: { font: s => `600 ${s}px ${FONT}`, fill: '#34424d', halo: 'rgba(255,255,255,.92)', haloWidth: 1.8 },
  water: { font: s => `italic 500 ${s}px ${FONT}`, fill: '#2f5f86', halo: 'rgba(236,244,250,.9)', haloWidth: 1.6 },
  // own-poi-labels-<band> (_ensureOwnPoiLayers): #34424d, white halo 1.6.
  poi: { font: s => `400 ${s}px ${FONT}`, fill: '#34424d', halo: 'rgba(255,255,255,.92)', haloWidth: 1.6 },
  // neighborhood-labels: #6D28D9, white halo 2, letter-spacing .12.
  hood: { font: s => `700 ${s}px ${FONT}`, fill: '#6D28D9', halo: 'rgba(255,255,255,.9)', haloWidth: 2 },
  // brand-poi-labels: Noto Sans Bold 10, #E0F2FE, halo #071E2B 2.
  brand: { font: s => `700 ${s}px ${FONT}`, fill: '#E0F2FE', halo: '#071E2B', haloWidth: 2 },
  // local-food-labels: Noto Sans Regular 10→12, #C9DDE5, halo #071E2B 2.
  food: { font: s => `400 ${s}px ${FONT}`, fill: '#C9DDE5', halo: '#071E2B', haloWidth: 2 },
  // cycling-ferry-terminal-labels: 12, #153c54, halo #f2f0e7 2.
  ferry: { font: s => `600 ${s}px ${FONT}`, fill: '#153c54', halo: '#f2f0e7', haloWidth: 2 },
};

export function labelFontSize(kind: LabelKind, z: number): number {
  switch (kind) {
    case 'hood': return Math.round(interpolateLinear([[13, 11], [17, 16]], z));
    case 'poi': return Math.round(interpolateLinear([[16.5, 10], [18, 12]], z));
    case 'food': return Math.round(interpolateLinear([[16, 10], [18, 12]], z));
    case 'brand': return 10;
    case 'ferry': return 12;
    default: return Math.round(interpolateStops([[13, 10.5], [16, 12], [18, 14.5]], z));
  }
}

const CLASS_LABEL_MINZOOM: Record<StreetClass, number> = { major: 12.5, secondary: 13.5, tertiary: 14.5, minor: 15.3, service: 16.8, cycle: 16.3, path: 17 };
const BUCKET = 500;

export interface LabelStats { street: number; water: number; poi: number; hood: number; brand: number; food: number; ferry: number; withheld: number; withheldOverlay: number }

export class OwnMapLabels {
  private buckets = new Map<string, LabelCandidate[]>();
  private advanceCache = new Map<string, number>();
  private zoom = 0;
  stats: LabelStats = { street: 0, water: 0, poi: 0, hood: 0, brand: 0, food: 0, ferry: 0, withheld: 0, withheldOverlay: 0 };
  private extra: { pois?: OrientationPoiFile; branded?: { pois: BrandedPoi[]; icons: Record<string, LabelIcon['image']> }; ferry?: { terminals: FerryTerminal[]; pin: LabelIcon['image'] } } = {};

  constructor(private data: OverviewData, private ctx: LabelContext, private measure: CanvasRenderingContext2D) { this.rebuild(); }

  /** New rules (an answer earned a name, a question opened, quiz-quiet): rebuild the candidates. */
  setContext(ctx: LabelContext): void { this.ctx = ctx; this.rebuild(); }
  setPois(file: OrientationPoiFile): void { this.extra.pois = file; this.rebuild(); }
  setBranded(pois: BrandedPoi[], icons: Record<string, LabelIcon['image']>): void { this.extra.branded = { pois, icons }; this.rebuild(); }
  setFerryTerminals(terminals: FerryTerminal[], pin: LabelIcon['image']): void { this.extra.ferry = { terminals, pin }; this.rebuild(); }

  private add(c: LabelCandidate): void {
    const pts = c.path ?? [c.at as Vec2];
    const keys = new Set(pts.map(([x, y]) => `${Math.floor(x / BUCKET)},${Math.floor(y / BUCKET)}`));
    for (const k of keys) { const l = this.buckets.get(k); if (l) l.push(c); else this.buckets.set(k, [c]); }
  }

  private rebuild(): void {
    const { ctx, data } = this;
    this.buckets.clear();
    const st: LabelStats = { street: 0, water: 0, poi: 0, hood: 0, brand: 0, food: 0, ferry: 0, withheld: 0, withheldOverlay: 0 };
    const asked = (name: string) => !!ctx.hiddenName && !streetLabelVisible({ ...ctx, isLabelled: () => true }, name, 0, 0);
    data.streets.forEach((s, i) => {
      if (!s.name) return;
      const mid = s.points[s.points.length >> 1];
      if (!streetLabelVisible(ctx, s.name, mid[0], mid[1])) { if (asked(s.name)) st.withheld++; return; }
      st.street++;
      this.add({ id: `s${i}`, text: s.name, kind: 'street', priority: (STREET_STYLE[s.cls].order + 1) * 1000 + Math.min(999, lineLength(s.points) / 10), path: s.points, minZoom: CLASS_LABEL_MINZOOM[s.cls] });
    });
    data.waterLines.forEach((w, i) => {
      const mid = w.points[w.points.length >> 1];
      if (!streetLabelVisible(ctx, w.name, mid[0], mid[1])) { if (asked(w.name)) st.withheld++; return; }
      st.water++;
      this.add({ id: `w${i}`, text: w.name, kind: 'water', priority: 8000 + Math.min(999, lineLength(w.points) / 10), path: w.points, minZoom: lineLength(w.points) > 1500 ? 12.5 : 14.5 });
    });
    if (neighbourhoodLabelVisible(ctx)) data.hoods.forEach((h, i) => { st.hood++; this.add({ id: `h${i}`, text: h.name.toUpperCase(), kind: 'hood', priority: 9000, at: h.at, minZoom: 13, maxZoom: 18.5 }); });
    // Own POIs: the game's chain (ownPoiFeatures: spoilers out, thinned), each
    // label anchored on its building's roofline band (HEIGHT_BAND_METRES) in 3D
    // instead of MapLibre's screen-space roofLiftTranslate; text hangs below
    // the anchor (text-anchor top, offset 0.45 em).
    if (this.extra.pois) {
      const fc = ownPoiFeatures(this.extra.pois, name => !poiLabelVisible(ctx, name));
      fc.features.forEach((f, i) => {
        st.poi++;
        const [x, y] = toLocal(f.geometry.coordinates[0], f.geometry.coordinates[1]);
        this.add({ id: `p${i}`, text: f.properties.name, kind: 'poi', priority: f.properties.rank, at: [x, y, HEIGHT_BAND_METRES[f.properties.band] ?? 0], minZoom: 16.5, anchor: 'top', offsetEm: 0.45 });
      });
    }
    // Branded POIs (setBrandedPois → brand-poi-icons / brand-poi-labels / local-food-labels), lifted to POI_ROOF_HEIGHT_METRES.
    if (this.extra.branded) {
      const { pois, icons } = this.extra.branded;
      const spoils = (name: string) => !brandIconVisible(ctx, name);
      const before = pois.filter(p => !spoils(p.name)).length;
      st.withheldOverlay += pois.length - before;
      for (const p of brandedPoiOverlay(pois, spoils)) {
        const at: Vec3 = [p.at[0], p.at[1], POI_ROOF_HEIGHT_METRES];
        if (p.kind === 'albert-heijn') {
          const image = icons[p.kind];
          if (image) { st.brand++; this.add({ id: `bi${p.id}`, text: '', kind: 'brand', priority: 50, at, minZoom: 15.5, icon: { image, size: 0 } }); }
          // Names go quiet in a quiz (setQuizQuietMap :2560); the icon stays.
          if (!ctx.quizQuiet) this.add({ id: `bl${p.id}`, text: p.name, kind: 'brand', priority: 40, at, minZoom: 17, anchor: 'bottom', offsetEm: -1.7 });
        } else if (p.kind === 'local-food' && !ctx.quizQuiet) {
          st.food++;
          this.add({ id: `f${p.id}`, text: p.name, kind: 'food', priority: 20 + (p.orientationScore ?? 0), at, minZoom: 16 });
        }
      }
    }
    if (this.extra.ferry) {
      for (const t of this.extra.ferry.terminals) {
        if (!ferryLabelVisible(ctx, t.name)) { st.withheldOverlay++; continue; }
        st.ferry++;
        this.add({ id: `ft${t.id}`, text: ferryTerminalLabel(t.name), kind: 'ferry', priority: 9500, at: t.at, minZoom: 11, offsetEm: 1.4, icon: { image: this.extra.ferry.pin, size: 16 } });
      }
    }
    this.stats = st;
  }

  private advance = (ch: string, kind: LabelKind): number => {
    const size = labelFontSize(kind, this.zoom);
    const key = `${kind}|${size}|${ch}`;
    let w = this.advanceCache.get(key);
    if (w === undefined) { this.measure.font = LABEL_PAINT[kind].font(size); w = this.measure.measureText(ch).width + (kind === 'hood' ? size * 0.12 : 0); this.advanceCache.set(key, w); }
    return w;
  };

  /** Candidates in the box at this zoom, placed (collision, upright curved text). */
  place(project: (p: Vec2 | Vec3) => Projected, width: number, height: number, zoom: number, bounds: [number, number, number, number], maxDepth: number, blocked: ReadonlyArray<readonly [number, number, number, number]> = []): PlacedLabel[] {
    this.zoom = zoom;
    const seen = new Set<LabelCandidate>();
    for (let x = Math.floor(bounds[0] / BUCKET); x <= Math.floor(bounds[2] / BUCKET); x++)
      for (let y = Math.floor(bounds[1] / BUCKET); y <= Math.floor(bounds[3] / BUCKET); y++)
        for (const c of this.buckets.get(`${x},${y}`) ?? []) if ((c.minZoom ?? 0) <= zoom && zoom < (c.maxZoom ?? 99)) seen.add(c);
    // Brand icon size: 48 px image at pixelRatio 2 × icon-size 0.62→0.9 (z15.5→18).
    const iconPx = 24 * interpolateLinear([[15.5, 0.62], [18, 0.9]], zoom);
    const list = [...seen].map(c => (c.kind === 'brand' && c.icon ? { ...c, icon: { ...c.icon, size: iconPx } } : c));
    return placeLabels(list, { project, width, height, zoom, advance: this.advance, fontSize: labelFontSize, maxDepth, repeatDistance: 260, blocked });
  }

  draw(ctx: CanvasRenderingContext2D, placed: readonly PlacedLabel[]): void { drawPlacedLabels(ctx, placed, LABEL_PAINT); }
}

/** The game's brand disc (vector-map.js `_loadBrandIcon`): white circle, #0F3040 ring, logo 30/48. */
export function brandDisc(image: CanvasImageSource): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const g = c.getContext('2d')!;
  g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(24, 24, 22, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#0F3040'; g.lineWidth = 2; g.stroke();
  g.drawImage(image, 9, 9, 30, 30);
  return c;
}

/** The game's ferry terminal pin (cycling-ferry-terminal-pins: r 6, #008bce, stroke #f2f0e7 2). */
export function ferryPin(scale = 2): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = 16 * scale;
  const g = c.getContext('2d')!;
  g.scale(scale, scale);
  g.fillStyle = '#008bce'; g.strokeStyle = '#f2f0e7'; g.lineWidth = 2;
  g.beginPath(); g.arc(8, 8, 6, 0, Math.PI * 2); g.fill(); g.stroke();
  return c;
}
