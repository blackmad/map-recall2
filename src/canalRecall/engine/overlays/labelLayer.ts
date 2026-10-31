// Map labels under `?engine=own` (engine programme P1 step 4): one 2D canvas
// over the frame, placed by ownMap/labels.ts (collision, line-following
// glyphs) and screened by ownMap/labelPolicy.ts — the same spoiler rules the
// MapLibre symbol layers and labels/labelOverlay.ts apply (that DOM overlay is
// not used under the flag):
//   - a street or water name only once earned, never the one being asked;
//   - a POI whose name contains a quiz name is never drawn;
//   - during a place quiz POI and neighbourhood names go quiet.
// Plus the game's own point labels: the just-answered street name (drawn on
// the road ahead, as answeredStreetNameLayer did) and the ferry landings.

import { placeLabels, drawPlacedLabels, type LabelCandidate, type LabelKind, type LabelPaint, type PlacedLabel } from '../../ownMap/labels';
import { neighbourhoodLabelVisible, poiLabelVisible, streetLabelVisible, type LabelContext } from '../../ownMap/labelPolicy';
import { interpolateStops, STREET_STYLE } from '../../ownMap/style';
import { toLocal, type Vec2 } from '../../ownMap/frame';
import { lineLength } from '../../ownMap/geometry';
import type { OverviewData, StreetClass } from '../../ownMap/overviewFormat';
import type { CameraFrame } from '../../ownMap/mapCamera';

const BUCKET = 500;
const CLASS_LABEL_MINZOOM: Record<StreetClass, number> = { major: 12.5, secondary: 13.5, tertiary: 14.5, minor: 15.3, service: 16.8, cycle: 16.3, path: 17 };
const FONT = '"Helvetica Neue", Arial, sans-serif';
export const LABEL_PAINT: Record<LabelKind, LabelPaint> = {
  street: { font: s => `600 ${s}px ${FONT}`, fill: '#34424d', halo: 'rgba(255,255,255,.92)', haloWidth: 1.8 },
  water: { font: s => `italic 500 ${s}px ${FONT}`, fill: '#2f5f86', halo: 'rgba(236,244,250,.9)', haloWidth: 1.6 },
  poi: { font: s => `400 ${s}px ${FONT}`, fill: '#34424d', halo: 'rgba(255,255,255,.92)', haloWidth: 1.6 },
  hood: { font: s => `700 ${s}px ${FONT}`, fill: '#6D28D9', halo: 'rgba(255,255,255,.9)', haloWidth: 2 },
};
const fontSize = (kind: LabelKind, z: number) => Math.round(kind === 'hood' ? interpolateStops([[13, 11], [17, 16]], z)
  : kind === 'poi' ? interpolateStops([[16.5, 10], [18, 12]], z)
  : interpolateStops([[13, 10.5], [16, 12], [18, 14.5]], z));

export interface PointLabel {
  id: string; text: string; kind: LabelKind; lngLat: readonly [number, number]; priority: number; minZoom?: number;
  /** Other names of the same place (the Dutch name behind an English one): screened like `text`. */
  aliases?: readonly string[];
}

export class LabelLayer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly advances = new Map<string, number>();
  /** Candidates from the overview (streets, water, neighbourhoods), bucketed by 500 m cell. */
  private readonly buckets = new Map<string, LabelCandidate[]>();
  private data: OverviewData | null = null;
  private pois: PointLabel[] = [];
  private extra = new Map<string, PointLabel[]>();
  private ctxKey = '';
  /** Bumped on every input change (overview, POIs, game points, policy): the next draw places afresh. */
  private rev = 0;
  private drawnRev = -1;
  /** Camera pose of the last draw and of the last full placement, and the ids that won it. */
  private drawnPose: LabelPose | null = null;
  private fullPose: LabelPose | null = null;
  private fullAt = -Infinity;
  private winners = new Set<string>();
  private fullRev = -1;
  /** Full placements (all candidates) vs re-placements of the last winners; read by the perf probe. */
  readonly stats = { full: 0, winnersOnly: 0, skipped: 0 };
  /** Every label drawn in the last frame (specs read it: nothing under question may be among them). */
  placed: PlacedLabel[] = [];
  visible = true;
  zoom = 0;

  constructor(container: HTMLElement, private readonly policy: () => LabelContext) {
    this.canvas = container.ownerDocument.createElement('canvas');
    this.canvas.className = 'engine-labels';
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  setOverview(data: OverviewData): void { this.data = data; this.ctxKey = ''; this.rev++; }
  setPois(pois: PointLabel[]): void { this.pois = pois; this.ctxKey = ''; this.rev++; }
  /** Game point labels by group (answered street name, ferry landings). */
  setPoints(group: string, points: PointLabel[]): void { this.extra.set(group, points); this.rev++; }

  private rebuild(ctx: LabelContext): void {
    this.buckets.clear();
    const add = (c: LabelCandidate) => {
      const keys = new Set((c.path ?? [c.at!]).map(([x, y]) => `${Math.floor(x / BUCKET)},${Math.floor(y / BUCKET)}`));
      for (const k of keys) { const l = this.buckets.get(k); if (l) l.push(c); else this.buckets.set(k, [c]); }
    };
    const d = this.data;
    if (d) {
      d.streets.forEach((s, i) => {
        if (!s.name) return;
        const mid = s.points[s.points.length >> 1];
        if (!streetLabelVisible(ctx, s.name, mid[0], mid[1])) return;
        add({ id: `s${i}`, text: s.name, kind: 'street', priority: (STREET_STYLE[s.cls].order + 1) * 1000 + Math.min(999, lineLength(s.points) / 10), path: s.points, minZoom: CLASS_LABEL_MINZOOM[s.cls] });
      });
      d.waterLines.forEach((w, i) => {
        const mid = w.points[w.points.length >> 1];
        if (!streetLabelVisible(ctx, w.name, mid[0], mid[1])) return;
        add({ id: `w${i}`, text: w.name, kind: 'water', priority: 8000 + Math.min(999, lineLength(w.points) / 10), path: w.points, minZoom: lineLength(w.points) > 1500 ? 12.5 : 14.5 });
      });
      if (neighbourhoodLabelVisible(ctx)) d.hoods.forEach((h, i) => add({ id: `h${i}`, text: h.name.toUpperCase(), kind: 'hood', priority: 9000, at: h.at, minZoom: 13, maxZoom: 18.5 }));
    }
    for (const p of this.pois) if (poiLabelVisible(ctx, p.text) && (p.aliases ?? []).every(a => poiLabelVisible(ctx, a))) add({ id: p.id, text: p.text, kind: p.kind, priority: p.priority, at: toLocal(p.lngLat[0], p.lngLat[1]), minZoom: p.minZoom ?? 16.5 });
  }

  private advance(ch: string, kind: LabelKind): number {
    const size = fontSize(kind, this.zoom);
    const key = `${kind}|${size}|${ch}`;
    let w = this.advances.get(key);
    if (w === undefined) { this.ctx.font = LABEL_PAINT[kind].font(size); w = this.ctx.measureText(ch).width + (kind === 'hood' ? size * 0.12 : 0); this.advances.set(key, w); }
    return w;
  }

  /**
   * Draw for this frame. `frame` is the camera in own-map local metres (cameraFrame of the local centre), `bounds`
   * the visible local box, `ratio` the canvas pixel ratio.
   */
  draw(frame: CameraFrame, bounds: readonly [number, number, number, number], zoom: number, ratio: number, project: (p: Vec2) => { x: number; y: number; depth: number }, pose?: LabelPose): void {
    const vp = frame.viewport;
    const w = Math.round(vp.width * ratio), h = Math.round(vp.height * ratio);
    let resized = false;
    if (this.canvas.width !== w) { this.canvas.width = w; resized = true; }
    if (this.canvas.height !== h) { this.canvas.height = h; resized = true; }
    const policy = this.visible ? this.policy() : null;
    if (policy) {
      const key = `${policy.hiddenName}|${policy.quizQuiet}|${(policy as { revision?: unknown }).revision ?? ''}|${this.pois.length}|${!!this.data}`;
      if (key !== this.ctxKey) { this.ctxKey = key; this.rebuild(policy); this.rev++; }
    }
    const rev = this.visible ? this.rev : -2;
    // A still camera and unchanged inputs: the canvas already holds this frame.
    if (!resized && pose && this.drawnPose && rev === this.drawnRev && samePose(pose, this.drawnPose)) { this.stats.skipped++; return; }
    this.drawnRev = rev;
    this.drawnPose = pose ?? null;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, w, h);
    this.placed = [];
    if (!this.visible) return;
    // Which labels win only changes when the camera has moved enough (or every 400 ms while it creeps); in between
    // the last winners are re-placed at the new projection (cheap: a handful of labels, not every candidate).
    const now = performance.now();
    const full = !pose || !this.fullPose || rev !== this.fullRev || movedEnough(pose, this.fullPose) || now - this.fullAt > 400;
    this.zoom = zoom;
    const seen = new Set<LabelCandidate>();
    for (let x = Math.floor(bounds[0] / BUCKET); x <= Math.floor(bounds[2] / BUCKET); x++)
      for (let y = Math.floor(bounds[1] / BUCKET); y <= Math.floor(bounds[3] / BUCKET); y++)
        for (const c of this.buckets.get(`${x},${y}`) ?? []) if ((c.minZoom ?? 0) <= zoom && zoom < (c.maxZoom ?? 99)) seen.add(c);
    // Game point labels always compete first (priority above every map label).
    for (const points of this.extra.values()) for (const p of points) seen.add({ id: p.id, text: p.text, kind: p.kind, priority: 1e6 + p.priority, at: toLocal(p.lngLat[0], p.lngLat[1]), minZoom: p.minZoom ?? 0 });
    const candidates = full ? [...seen] : [...seen].filter(c => this.winners.has(c.id));
    this.placed = placeLabels(candidates, {
      project, width: vp.width, height: vp.height, zoom,
      advance: (ch, kind) => this.advance(ch, kind), fontSize, maxDepth: frame.distance * 4, repeatDistance: 260,
    });
    if (full) {
      this.fullPose = pose ?? null; this.fullAt = now; this.fullRev = rev;
      this.winners = new Set(this.placed.map(l => l.id));
      this.stats.full++;
    } else this.stats.winnersOnly++;
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawPlacedLabels(this.ctx, this.placed, LABEL_PAINT);
  }
}

/** The camera in own-map local metres: centre x, y, zoom, bearing and pitch (degrees). */
export type LabelPose = readonly [number, number, number, number, number];

export function samePose(a: LabelPose, b: LabelPose): boolean {
  return Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01 && Math.abs(a[2] - b[2]) < 1e-4 && Math.abs(a[3] - b[3]) < 0.01 && Math.abs(a[4] - b[4]) < 0.01;
}

/** Far enough to re-run the full placement: ~24 px of travel at the zoom, 0.1 zoom, or 2° of bearing or pitch. */
export function movedEnough(a: LabelPose, b: LabelPose): boolean {
  const metresPerPx = 156543.03 * Math.cos(52.37 * Math.PI / 180) / 2 ** a[2];
  const bearing = Math.abs(((a[3] - b[3] + 540) % 360) - 180);
  return Math.hypot(a[0] - b[0], a[1] - b[1]) > 24 * metresPerPx || Math.abs(a[2] - b[2]) > 0.1 || bearing > 2 || Math.abs(a[4] - b[4]) > 2;
}
