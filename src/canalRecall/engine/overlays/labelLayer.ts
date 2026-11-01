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

import { framePhases } from '../framePhases';
import { LABEL_ROOT_CLASS } from '../../labels/labelStyle';
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
  readonly stats = { full: 0, winnersOnly: 0, skipped: 0, fullMs: 0, lastFullMs: 0, occluded: 0, betweenMs: 0, betweenSightlines: 0 };
  /** POI labels hidden behind nearer buildings (engine/labelOcclusion.ts); null tests nothing. */
  private occludedTest: ((c: LabelCandidate) => boolean) | null = null;
  /** Between full placements: sightlines per frame, and whether street and water names are re-tested (A/B knobs). */
  readonly between = { budget: OCCLUSION_PER_FRAME, lines: true };
  /** Copies of street and water names (instanceKeys) found hidden since the last full placement. */
  private readonly hiddenCopies = new Set<string>();
  /** Next drawn POI winner to re-test between full placements. */
  private occlusionCursor = 0;
  setOcclusion(test: ((c: LabelCandidate) => boolean) | null, frontOf: ((id: string) => Vec2 | null) | null = null, lineTest: ((id: string, anchors: readonly Vec2[]) => boolean) | null = null): void {
    if (!test !== !this.occludedTest) { this.rev++; this.drawAt.clear(); }
    this.occludedTest = test; this.frontOf = test ? frontOf : null; this.lineTest = test ? lineTest : null;
  }
  /** Street and water names: hidden when a building stands between the eye and any of their anchors (start, middle, end). */
  private lineTest: ((id: string, anchors: readonly Vec2[]) => boolean) | null = null;
  /** Where a shown POI's frontage is (own-map local metres), from its last occlusion test. */
  private frontOf: ((id: string) => Vec2 | null) | null = null;
  /** POIs drawn at their visible frontage instead of the anchor (by id); refreshed whenever one is tested. */
  private readonly drawAt = new Map<string, Vec2>();
  /** Test one candidate (its own anchor); record where it is drawn. True when hidden; `moved` when the spot changed. */
  private testOcclusion(c: LabelCandidate): { hidden: boolean; moved: boolean } {
    const hidden = this.occludedTest!(c);
    const front = hidden ? null : this.frontOf?.(c.id) ?? null, prior = this.drawAt.get(c.id);
    if (front) this.drawAt.set(c.id, front); else this.drawAt.delete(c.id);
    const moved = !front !== !prior || (!!front && !!prior && Math.hypot(front[0] - prior[0], front[1] - prior[1]) > 0.5);
    return { hidden, moved };
  }
  /** Every label drawn in the last frame (specs read it: nothing under question may be among them). */
  placed: PlacedLabel[] = [];
  visible = true;
  zoom = 0;

  /**
   * The labels' DOM root, `.cr-map-labels` like the MapLibre overlay's (labels/labelOverlay.ts), so a check of "labels
   * hidden while paper covers the map" reads the same element under either engine. Inline geometry: the overlay's
   * stylesheet sizes its own root to zero (it positions each label), and the canvas here fills the view.
   */
  readonly root: HTMLElement;
  /** Menu, setup and loading paint paper over the map: nothing is drawn and the root is hidden (setCovered). */
  covered = false;

  constructor(container: HTMLElement, private readonly policy: () => LabelContext) {
    const doc = container.ownerDocument;
    this.root = doc.createElement('div');
    this.root.className = LABEL_ROOT_CLASS;
    this.root.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none';
    this.canvas = doc.createElement('canvas');
    this.canvas.className = 'engine-labels';
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    this.root.appendChild(this.canvas);
    container.appendChild(this.root);
    this.ctx = this.canvas.getContext('2d')!;
  }

  /** Paper over the map (labels/coveredState.ts): hide the root at once and draw nothing until uncovered. */
  setCovered(covered: boolean): boolean {
    if (covered === this.covered) return false;
    this.covered = covered;
    this.root.style.visibility = covered ? 'hidden' : '';
    this.rev++;
    return true;
  }

  setOverview(data: OverviewData): void { this.data = data; this.ctxKey = ''; this.rev++; }
  setPois(pois: PointLabel[]): void { this.pois = pois; this.ctxKey = ''; this.rev++; }
  /** Game point labels by group (answered street name, ferry landings). */
  setPoints(group: string, points: PointLabel[]): void { this.extra.set(group, points); this.rev++; }

  // Geometry-only work per path, kept across rebuilds (a policy change re-ran it for every labelled street:
  // 115-150 ms frames at 4x, #129 hand-back 16): the bucket keys in first-seen order and the line length.
  private readonly pathKeys = new WeakMap<readonly Vec2[], string[]>();
  private readonly pathLength = new WeakMap<readonly Vec2[], number>();
  private lengthOf(points: readonly Vec2[]): number {
    let l = this.pathLength.get(points);
    if (l === undefined) { l = lineLength(points as Vec2[]); this.pathLength.set(points, l); }
    return l;
  }

  private rebuild(ctx: LabelContext): void {
    this.buckets.clear();
    const keysOf = (c: LabelCandidate): Iterable<string> => {
      const key = ([x, y]: readonly number[]) => `${Math.floor(x / BUCKET)},${Math.floor(y / BUCKET)}`;
      if (!c.path) return [key(c.at!)];
      let keys = this.pathKeys.get(c.path);
      if (!keys) { keys = [...new Set(c.path.map(key))]; this.pathKeys.set(c.path, keys); }
      return keys;
    };
    const add = (c: LabelCandidate) => {
      for (const k of keysOf(c)) { const l = this.buckets.get(k); if (l) l.push(c); else this.buckets.set(k, [c]); }
    };
    const d = this.data;
    if (d) {
      d.streets.forEach((s, i) => {
        if (!s.name) return;
        const mid = s.points[s.points.length >> 1];
        if (!streetLabelVisible(ctx, s.name, mid[0], mid[1])) return;
        add({ id: `s${i}`, text: s.name, kind: 'street', priority: (STREET_STYLE[s.cls].order + 1) * 1000 + Math.min(999, this.lengthOf(s.points) / 10), path: s.points, minZoom: CLASS_LABEL_MINZOOM[s.cls] });
      });
      d.waterLines.forEach((w, i) => {
        const mid = w.points[w.points.length >> 1];
        if (!streetLabelVisible(ctx, w.name, mid[0], mid[1])) return;
        add({ id: `w${i}`, text: w.name, kind: 'water', priority: 8000 + Math.min(999, this.lengthOf(w.points) / 10), path: w.points, minZoom: this.lengthOf(w.points) > 1500 ? 12.5 : 14.5 });
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
    const phases = framePhases();
    let pt = phases ? performance.now() : 0;
    const lap = (name: string) => { if (!phases) return; const t = performance.now(); phases.add(`labels: ${name}`, t - pt); pt = t; };
    const shows = this.visible && !this.covered;
    const policy = shows ? this.policy() : null;
    lap('policy');
    if (policy) {
      const key = `${policy.hiddenName}|${policy.quizQuiet}|${(policy as { revision?: unknown }).revision ?? ''}|${this.pois.length}|${!!this.data}`;
      if (key !== this.ctxKey) { this.ctxKey = key; this.rebuild(policy); this.rev++; }
    }
    lap('rebuild');
    const rev = shows ? this.rev : -2;
    // A still camera and unchanged inputs: the canvas already holds this frame.
    if (!resized && pose && this.drawnPose && rev === this.drawnRev && samePose(pose, this.drawnPose)) { this.stats.skipped++; return; }
    this.drawnRev = rev;
    this.drawnPose = pose ?? null;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, w, h);
    this.placed = [];
    if (!shows) return;
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
    const options = {
      project, width: vp.width, height: vp.height, zoom,
      advance: (ch: string, kind: LabelCandidate['kind']) => this.advance(ch, kind), fontSize, maxDepth: frame.distance * 4, repeatDistance: 260,
    };
    let candidates = full ? [...seen] : [...seen].filter(c => this.winners.has(c.id));
    const original = new Map(candidates.map(c => [c.id, c] as const));
    const shifted = (list: LabelCandidate[]) => list.map(c => { const at = this.drawAt.get(c.id); return at && c.at ? { ...c, at } : c; });
    lap(full ? 'collect (full)' : 'collect');
    this.placed = placeLabels(this.occludedTest ? shifted(candidates) : candidates, options);
    lap(full ? 'place (full)' : 'place');
    // Occlusion (full placements only): test the POIs that won, drop the hidden ones and place again, so the tests
    // cost a few dozen sightlines, not every candidate in view. Only POI points from the map are tested: the
    // game's own points (priority >= 1e6: the answered street, ferry landings, the destination) and the draped
    // street, water and neighbourhood names are exempt.
    let occluded = 0, occludedCopies = 0;
    if (full && this.occludedTest) {
      this.hiddenCopies.clear();
      const tested = new Set<string>(), hidden = new Set<string>();
      for (let round = 0; ; round++) {
        let dropped = 0, moved = 0;
        // A long street or canal is placed several times under one id (repeatDistance): each copy is tested on its own
        // anchors and a hidden copy is dropped alone; the name is not withdrawn from its other, visible copies.
        const keys = instanceKeys(this.placed);
        const hiddenCopies = new Set<PlacedLabel>();
        for (const l of this.placed) {
          const c = original.get(l.id);
          if (!c || c.priority >= 1e6) continue;
          if ((c.kind === 'street' || c.kind === 'water') && l.anchors && this.lineTest) {
            if (this.lineTest(keys.get(l)!, l.anchors)) hiddenCopies.add(l);
            continue;
          }
          if (tested.has(c.id)) continue;
          if (c.kind !== 'poi' || !c.at) continue;
          tested.add(c.id);
          const r = this.testOcclusion(c);
          if (r.hidden) { hidden.add(c.id); dropped++; } else if (r.moved) moved++;
        }
        if (hiddenCopies.size) { this.placed = this.placed.filter(l => !hiddenCopies.has(l)); occludedCopies += hiddenCopies.size; }
        if (!dropped && !moved) break;
        // Out of rounds: drop the hidden newcomers without filling their places.
        if (round === OCCLUSION_ROUNDS) { this.placed = this.placed.filter(l => !hidden.has(l.id)); break; }
        candidates = candidates.filter(c => !hidden.has(c.id));
        this.placed = placeLabels(shifted(candidates), options);
      }
      occluded = hidden.size + occludedCopies;
    } else if (!full && this.occludedTest) {
      // Between full placements the camera still moves (up to 400 ms, or 24 px / 2°): re-test a few of the drawn
      // winners per frame, in turn, and drop one that went behind a building since (the next full pass re-tests it
      // and may place another in its room). POIs cost one sightline, street and water names one per anchor; the
      // frame spends up to OCCLUSION_PER_FRAME sightlines. The tests' own hysteresis keeps an edge label from blinking.
      const t0 = performance.now();
      const due = this.placed.filter(l => {
        const c = original.get(l.id);
        if (!c || c.priority >= 1e6) return false;
        return (c.kind === 'poi' && !!c.at) || (this.between.lines && (c.kind === 'street' || c.kind === 'water') && !!l.anchors?.length && !!this.lineTest);
      });
      const keys = instanceKeys(this.placed);
      let spent = 0, k = 0;
      for (; k < due.length && spent < this.between.budget; k++) {
        const l = due[(this.occlusionCursor + k) % due.length], c = original.get(l.id)!;
        if (c.kind === 'poi') {
          spent++;
          // Hidden: dropped now. A frontage that moved is drawn there from the next full placement (no re-place here).
          if (this.testOcclusion(c).hidden) this.winners.delete(l.id);
        } else {
          spent += l.anchors!.length;
          const key = keys.get(l)!;
          if (this.lineTest!(key, l.anchors!)) this.hiddenCopies.add(key); else this.hiddenCopies.delete(key);
        }
      }
      this.occlusionCursor = due.length ? (this.occlusionCursor + k) % due.length : 0;
      this.stats.betweenMs += performance.now() - t0; this.stats.betweenSightlines += spent;
      if (due.length) this.placed = this.placed.filter(l => this.winners.has(l.id) && !this.hiddenCopies.has(keys.get(l)!));
    }
    lap(full ? 'occlusion (full)' : 'occlusion (between)');
    if (full) {
      const ms = performance.now() - now;
      this.stats.fullMs += ms; this.stats.lastFullMs = ms; this.stats.occluded = occluded;
      this.fullPose = pose ?? null; this.fullAt = now; this.fullRev = rev;
      this.winners = new Set(this.placed.map(l => l.id));
      this.stats.full++;
    } else this.stats.winnersOnly++;
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawPlacedLabels(this.ctx, this.placed, LABEL_PAINT);
    lap('paint');
  }
}

/** The camera in own-map local metres: centre x, y, zoom, bearing and pitch (degrees). */
export type LabelPose = readonly [number, number, number, number, number];

/** Re-placements after dropping occluded winners; newcomers hidden after the last one are dropped, not replaced. */
const OCCLUSION_ROUNDS = 3;
/** Sightlines spent per frame re-testing drawn winners between full placements (a sightline is ~10-30 us). */
const OCCLUSION_PER_FRAME = 8;

/**
 * A key per placed copy of a name: the id, then its order among the copies of that id (`s12@0`, `s12@1`). Line
 * occlusion keeps its hysteresis per copy under this key.
 */
export function instanceKeys(placed: readonly PlacedLabel[]): Map<PlacedLabel, string> {
  const n = new Map<string, number>(), out = new Map<PlacedLabel, string>();
  for (const l of placed) { const k = n.get(l.id) ?? 0; n.set(l.id, k + 1); out.set(l, `${l.id}@${k}`); }
  return out;
}

export function samePose(a: LabelPose, b: LabelPose): boolean {
  return Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01 && Math.abs(a[2] - b[2]) < 1e-4 && Math.abs(a[3] - b[3]) < 0.01 && Math.abs(a[4] - b[4]) < 0.01;
}

/** Far enough to re-run the full placement: ~24 px of travel at the zoom, 0.1 zoom, or 2° of bearing or pitch. */
export function movedEnough(a: LabelPose, b: LabelPose): boolean {
  const metresPerPx = 156543.03 * Math.cos(52.37 * Math.PI / 180) / 2 ** a[2];
  const bearing = Math.abs(((a[3] - b[3] + 540) % 360) - 180);
  return Math.hypot(a[0] - b[0], a[1] - b[1]) > 24 * metresPerPx || Math.abs(a[2] - b[2]) > 0.1 || bearing > 2 || Math.abs(a[4] - b[4]) > 2;
}
