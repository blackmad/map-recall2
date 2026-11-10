// Screen-space label placement with collision, the part of MapLibre's symbol
// engine the game actually uses: priority order, no overlap, one copy of a
// name per stretch of screen, point labels for POIs/neighbourhoods and text
// curved along the street/canal for line labels (glyph by glyph, kept
// upright, refused where the line bends too sharply).
//
// Pure: projection and text measurement are injected, so it is tested in node
// and the browser draws the result on a 2D canvas over the WebGL frame
// (`drawPlacedLabels`). Which names are candidates at all is decided first by
// labelPolicy.ts; this file never sees a withheld name.

import type { Vec2 } from './frame';

export type LabelKind = 'street' | 'water' | 'poi' | 'hood';

export interface LabelCandidate {
  id: string;
  text: string;
  kind: LabelKind;
  /** Higher places first. */
  priority: number;
  /** Point labels. */
  at?: Vec2;
  /** Line labels, local metres. */
  path?: Vec2[];
  minZoom?: number;
  maxZoom?: number;
}

export interface Projected { x: number; y: number; depth: number }

export interface PlaceOptions {
  project: (p: Vec2) => Projected;
  width: number;
  height: number;
  zoom: number;
  /** Advance of one glyph, px. */
  advance: (ch: string, kind: LabelKind) => number;
  fontSize: (kind: LabelKind, zoom: number) => number;
  /** Pixels between two copies of the same name. */
  repeatDistance?: number;
  /** Max turn between neighbouring glyphs, degrees. */
  maxGlyphTurn?: number;
  /** Ignore candidates farther than this (eye-space metres): the horizon at high pitch. */
  maxDepth?: number;
  padding?: number;
  /** Line labels: try only the centres that can land on screen (default; false: every centre along the run). */
  clipTries?: boolean;
}

export interface PlacedGlyph { ch: string; x: number; y: number; angle: number }
export interface PlacedLabel {
  id: string; text: string; kind: LabelKind; size: number;
  /** Point labels. */
  x?: number; y?: number;
  /** Line labels. */
  glyphs?: PlacedGlyph[];
  /** Line labels: the street points (local metres) under the first, middle and last glyph (occlusion tests them). */
  anchors?: Vec2[];
  /** Drawn at this opacity (labelFade.ts); absent: 1. */
  alpha?: number;
}

type Box = [number, number, number, number];

/** Uniform grid of boxes, like MapLibre's GridIndex. */
export class CollisionGrid {
  private cells = new Map<number, Box[]>();
  constructor(private cell = 48) {}
  private keys(b: Box): number[] {
    const out: number[] = [];
    for (let cx = Math.floor(b[0] / this.cell); cx <= Math.floor(b[2] / this.cell); cx++)
      for (let cy = Math.floor(b[1] / this.cell); cy <= Math.floor(b[3] / this.cell); cy++) out.push(cx * 65_536 + cy);
    return out;
  }
  hits(b: Box): boolean {
    for (const k of this.keys(b)) for (const o of this.cells.get(k) ?? []) if (b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) return true;
    return false;
  }
  insert(b: Box): void {
    for (const k of this.keys(b)) { const list = this.cells.get(k); if (list) list.push(b); else this.cells.set(k, [b]); }
  }
}

const inside = (b: Box, w: number, h: number) => b[0] >= 0 && b[1] >= 0 && b[2] <= w && b[3] <= h;

/** Glyph positions along a screen polyline, centred at arc length `centre`. */
export function glyphsAlong(line: readonly { x: number; y: number }[], cum: readonly number[], centre: number, advances: readonly number[], chars: readonly string[]): PlacedGlyph[] | null {
  const total = advances.reduce((a, b) => a + b, 0);
  let s = centre - total / 2;
  if (s < 0 || centre + total / 2 > cum[cum.length - 1]) return null;
  const out: PlacedGlyph[] = [];
  let seg = 0;
  for (let i = 0; i < chars.length; i++) {
    const mid = s + advances[i] / 2;
    while (seg < cum.length - 2 && cum[seg + 1] < mid) seg++;
    const a = line[seg], b = line[seg + 1];
    const len = cum[seg + 1] - cum[seg] || 1;
    const t = (mid - cum[seg]) / len;
    out.push({ ch: chars[i], x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) });
    s += advances[i];
  }
  return out;
}

/** The local point (metres) at screen arc length `s` along a projected run (linear between its path points). */
function localAlong(run: readonly { q: Vec2 }[], cum: readonly number[], s: number): Vec2 {
  let i = 0;
  while (i < cum.length - 2 && cum[i + 1] < s) i++;
  const len = cum[i + 1] - cum[i] || 1, t = Math.max(0, Math.min(1, (s - cum[i]) / len));
  const a = run[i].q, b = run[i + 1].q;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function placeLabels(candidates: readonly LabelCandidate[], opts: PlaceOptions): PlacedLabel[] {
  const placement = new LabelPlacement(candidates, opts);
  placement.step();
  return placement.out;
}

/**
 * `placeLabels` in steps (lane R3-F #241, `?labelBudget=0` off): the same priority walk, resumable. `step(deadline)`
 * places candidates until `now()` passes the deadline (checked every LABEL_STEP_CHECK candidates) and says whether the
 * walk is done; `out` holds the winners so far, highest priority first. Run to the end in one step it is
 * `placeLabels`, byte for byte.
 */
export class LabelPlacement {
  readonly out: PlacedLabel[] = [];
  private readonly order: LabelCandidate[];
  private next = 0;
  private readonly grid = new CollisionGrid();
  private readonly placedAt = new Map<string, Array<{ x: number; y: number }>>();
  private readonly pad: number;
  private readonly repeat: number;
  private readonly maxTurn: number;

  constructor(candidates: readonly LabelCandidate[], private readonly opts: PlaceOptions) {
    const zoom = opts.zoom;
    this.pad = opts.padding ?? 2;
    this.repeat = opts.repeatDistance ?? 280;
    this.maxTurn = (opts.maxGlyphTurn ?? 35) * Math.PI / 180;
    this.order = candidates
      .filter(c => (c.minZoom ?? 0) <= zoom && zoom < (c.maxZoom ?? 99))
      .slice().sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : 1));
  }

  get done(): boolean { return this.next >= this.order.length; }
  /** Candidates walked so far, and in all. */
  get walked(): number { return this.next; }
  get total(): number { return this.order.length; }

  step(deadline = Infinity, now: () => number = () => performance.now()): boolean {
    const timed = deadline !== Infinity;
    // Every step places at least LABEL_STEP_CHECK candidates (progress even past the deadline).
    for (let k = 0; this.next < this.order.length; k++) {
      if (timed && k > 0 && k % LABEL_STEP_CHECK === 0 && now() > deadline) return false;
      this.place(this.order[this.next++]);
    }
    return true;
  }

  private tooClose(text: string, x: number, y: number): boolean { return (this.placedAt.get(text) ?? []).some(p => Math.hypot(p.x - x, p.y - y) < this.repeat); }
  private remember(text: string, x: number, y: number): void { const l = this.placedAt.get(text); if (l) l.push({ x, y }); else this.placedAt.set(text, [{ x, y }]); }
  private measure(c: LabelCandidate) {
    const chars = [...c.text];
    const advances = chars.map(ch => this.opts.advance(ch, c.kind));
    return { chars, advances, textW: advances.reduce((a, b) => a + b, 0) };
  }

  private place(c: LabelCandidate): void {
    const opts = this.opts, { width: W, height: H, zoom } = opts, pad = this.pad, grid = this.grid, out = this.out;
    const size = opts.fontSize(c.kind, zoom);
    if (c.at) {
      // Project before measuring: most candidates in the gathered cells are off screen.
      const p = opts.project(c.at);
      if (p.depth <= 0 || (opts.maxDepth && p.depth > opts.maxDepth) || p.x < -50 || p.x > W + 50 || p.y < 0 || p.y > H) return;
      if (this.tooClose(c.text, p.x, p.y)) return;
      const { textW } = this.measure(c);
      const box: Box = [p.x - textW / 2 - pad, p.y - size / 2 - pad, p.x + textW / 2 + pad, p.y + size / 2 + pad];
      if (!inside(box, W, H) || grid.hits(box)) return;
      grid.insert(box); this.remember(c.text, p.x, p.y);
      out.push({ id: c.id, text: c.text, kind: c.kind, size, x: p.x, y: p.y });
      return;
    }
    if (!c.path || c.path.length < 2) return;
    // Project; cut where the line goes behind the eye or past the horizon depth.
    const runs: Array<Array<{ x: number; y: number; q: Vec2 }>> = [[]];
    for (const q of c.path) {
      const p = opts.project(q);
      const ok = p.depth > 0 && (!opts.maxDepth || p.depth < opts.maxDepth);
      if (ok) runs[runs.length - 1].push({ x: p.x, y: p.y, q });
      else if (runs[runs.length - 1].length) runs.push([]);
    }
    let metrics: ReturnType<LabelPlacement['measure']> | null = null;
    for (const run0 of runs) {
      if (run0.length < 2) continue;
      // Cheap rejections before any glyph is measured: off screen, or too short for the name.
      let rx0 = Infinity, ry0 = Infinity, rx1 = -Infinity, ry1 = -Infinity;
      for (const p of run0) { rx0 = Math.min(rx0, p.x); rx1 = Math.max(rx1, p.x); ry0 = Math.min(ry0, p.y); ry1 = Math.max(ry1, p.y); }
      if (rx1 < 0 || ry1 < 0 || rx0 > W || ry0 > H) continue;
      if (Math.hypot(rx1 - rx0, ry1 - ry0) < c.text.length * size * 0.45) continue;
      metrics ??= this.measure(c);
      const { chars, advances, textW } = metrics;
      // Upright: read left to right.
      const run = run0[run0.length - 1].x < run0[0].x ? run0.slice().reverse() : run0;
      const cum = [0];
      for (let i = 1; i < run.length; i++) cum.push(cum[i - 1] + Math.hypot(run[i].x - run[i - 1].x, run[i].y - run[i - 1].y));
      const L = cum[cum.length - 1];
      if (L < textW * 1.15) continue;
      // Try the middle first, then outward, MapLibre-style spacing.
      let tries = [L / 2];
      if (opts.clipTries === false) for (let d = textW; d < L / 2; d += textW) tries.push(L / 2 - d, L / 2 + d);
      else {
        // Only centres that can be on screen (lane R3-F #241): a centre farther than half the name from the screen
        // puts every glyph off it, so that try fails anyway. From the air a run's points just ahead of the eye's foot
        // project 10^5-10^6 px below the screen, and the tries along that length (glyphsAlong each) took 20-75 ms
        // in one frame. The arc range of the segments whose box meets the screen grown by half the name (and a glyph)
        // holds every centre that can pass, so skipping the rest places exactly what the full walk places.
        const m = textW / 2 + size + pad;
        let lo = Infinity, hi = -Infinity;
        for (let i = 1; i < run.length; i++) {
          const a = run[i - 1], b = run[i];
          if (Math.max(a.x, b.x) < -m || Math.min(a.x, b.x) > W + m || Math.max(a.y, b.y) < -m || Math.min(a.y, b.y) > H + m) continue;
          if (cum[i - 1] < lo) lo = cum[i - 1];
          if (cum[i] > hi) hi = cum[i];
        }
        const ok = (c: number) => c >= lo && c <= hi;
        tries = ok(L / 2) ? [L / 2] : [];
        // The same steps as the unclipped walk (d accumulated the same way), stopping once both sides are past the range.
        const reach = Math.max(Math.abs(lo - L / 2), Math.abs(hi - L / 2));
        if (lo <= hi) for (let d = textW; d < L / 2 && d <= reach + textW; d += textW) { if (ok(L / 2 - d)) tries.push(L / 2 - d); if (ok(L / 2 + d)) tries.push(L / 2 + d); }
      }
      for (const centre of tries) {
        const glyphs = glyphsAlong(run, cum, centre, advances, chars);
        if (!glyphs) continue;
        let bent = false;
        for (let i = 1; i < glyphs.length && !bent; i++) {
          let d = glyphs[i].angle - glyphs[i - 1].angle;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          if (Math.abs(d) > this.maxTurn) bent = true;
        }
        // Still upside down after the reversal (a line that runs mostly vertically and curls back).
        if (bent || glyphs.some(g => Math.cos(g.angle) < -0.2)) continue;
        const boxes: Box[] = glyphs.map(g => [g.x - size * 0.55 - pad, g.y - size * 0.55 - pad, g.x + size * 0.55 + pad, g.y + size * 0.55 + pad]);
        const mid = glyphs[glyphs.length >> 1];
        if (boxes.some(b => !inside(b, W, H) || grid.hits(b)) || this.tooClose(c.text, mid.x, mid.y)) continue;
        for (const b of boxes) grid.insert(b);
        this.remember(c.text, mid.x, mid.y);
        out.push({ id: c.id, text: c.text, kind: c.kind, size, glyphs, anchors: [centre - textW / 2, centre, centre + textW / 2].map(a => localAlong(run, cum, a)) });
        break;
      }
    }
  }
}
/** Candidates placed between two deadline checks (a candidate is ~10-40 us). */
export const LABEL_STEP_CHECK = 8;

export interface LabelPaint { font: (size: number) => string; fill: string; halo: string; haloWidth: number }

/** Draw placed labels on a 2D canvas (CSS px coordinates; caller sets DPR transform). */
export function drawPlacedLabels(ctx: CanvasRenderingContext2D, placed: readonly PlacedLabel[], paint: Record<LabelKind, LabelPaint>): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  let faded = false;
  for (const l of placed) {
    const p = paint[l.kind];
    if (l.alpha !== undefined && l.alpha < 1) { ctx.globalAlpha = l.alpha; faded = true; } else if (faded) { ctx.globalAlpha = 1; faded = false; }
    ctx.font = p.font(l.size);
    ctx.strokeStyle = p.halo; ctx.lineWidth = p.haloWidth * 2; ctx.fillStyle = p.fill;
    if (l.glyphs) {
      for (const pass of [0, 1]) for (const g of l.glyphs) {
        ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.angle);
        if (pass === 0) ctx.strokeText(g.ch, 0, 0); else ctx.fillText(g.ch, 0, 0);
        ctx.restore();
      }
    } else {
      ctx.strokeText(l.text, l.x!, l.y!);
      ctx.fillText(l.text, l.x!, l.y!);
    }
  }
  if (faded) ctx.globalAlpha = 1;
}
