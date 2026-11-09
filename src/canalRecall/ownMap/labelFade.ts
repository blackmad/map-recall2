// Label fade for the own engine's canvas labels (#288): every label eases in
// over OWN_LABEL_FADE_MS when it wins a place and eases out over the same time
// when it loses it, whatever the reason (distance cull, collision, occlusion,
// the aerial cap, a name the landmark approach withholds). The MapLibre overlay
// fades its labels the same way (labels/labelPlan.ts opacity, 300 ms); without
// it a name the approach withheld popped out in one frame, a tell of the
// question's answer (ride review #280, L1 #281/#283).
//
// A label that is fading out is still drawn, so it still counts as drawn for
// the label ledger (game/labelDrawLedger.ts) until its alpha reaches 0: the
// caller reports `drawn`, not the placement's winners. A fading-out label keeps
// the shape it last had and follows its anchor on screen (its POI point, or the
// street point under its middle glyph), so it does not slide with the camera.
//
// Pure: projection is injected; the clock is the caller's.

import type { PlacedLabel } from './labels';
import type { Vec2 } from './frame';

/** Fade in / fade out, ms (the MapLibre overlay's feel). */
export const OWN_LABEL_FADE_MS = 300;
/** A frame gap longer than this (tab hidden, first frame) advances a fade by this much only. */
const MAX_STEP_MS = 100;
/** The first step of a fade that starts after a settled stretch, ms (one 60 Hz frame). */
const FIRST_STEP_MS = 16;

/** Smoothstep: eased in and out, monotone on [0, 1]. */
export function easeLabelAlpha(progress: number): number {
  const p = progress <= 0 ? 0 : progress >= 1 ? 1 : progress;
  return p * p * (3 - 2 * p);
}

export interface DrawnLabel extends PlacedLabel {
  /** 0 < alpha <= 1. */
  alpha: number;
}

interface Entry {
  /** Linear fade progress, 0..1 (alpha is its easing). */
  progress: number;
  /** The label as last placed, and its anchor (local metres) with that anchor's screen point then. */
  label: PlacedLabel;
  anchor: Vec2 | null;
  sx: number; sy: number;
  frame: number;
}

type Project = (p: Vec2) => { x: number; y: number; depth: number };

/** A key per placed copy of a name: `id@k`, k its order among the copies of that id this frame. */
function keysOf(placed: readonly PlacedLabel[]): string[] {
  const n = new Map<string, number>();
  return placed.map(l => { const k = n.get(l.id) ?? 0; n.set(l.id, k + 1); return `${l.id}@${k}`; });
}

/** The label's own screen point: a point label's centre, a line label's middle glyph. */
function screenOf(l: PlacedLabel): [number, number] {
  if (l.glyphs?.length) { const g = l.glyphs[l.glyphs.length >> 1]; return [g.x, g.y]; }
  return [l.x ?? 0, l.y ?? 0];
}

/** `l` moved by (dx, dy) on screen. */
function shifted(l: PlacedLabel, dx: number, dy: number): PlacedLabel {
  if (!dx && !dy) return l;
  if (l.glyphs) return { ...l, glyphs: l.glyphs.map(g => ({ ...g, x: g.x + dx, y: g.y + dy })) };
  return { ...l, x: (l.x ?? 0) + dx, y: (l.y ?? 0) + dy };
}

export class OwnLabelFade {
  private readonly entries = new Map<string, Entry>();
  private last = 0;
  private frameNo = 0;

  constructor(readonly fadeMs = OWN_LABEL_FADE_MS) {}

  /**
   * This frame's drawn labels: `placed` (the placement's winners, fading in or at full strength) and, after them, the
   * labels that lost their place and are still fading out, moved to follow their anchors. `anchorOf` gives a placed
   * label's anchor in local metres (null: it keeps its last screen spot); `project` maps local metres to the screen.
   */
  update(placed: readonly PlacedLabel[], now: number, anchorOf: (l: PlacedLabel) => Vec2 | null, project: Project): DrawnLabel[] {
    // After a settled stretch (the layer skips redrawing a still frame) a new fade starts with one frame's step, not
    // the gap since the last draw.
    const settled = !this.active;
    const dt = this.last ? Math.max(0, Math.min(settled ? FIRST_STEP_MS : MAX_STEP_MS, now - this.last)) : FIRST_STEP_MS;
    this.last = now;
    const frame = ++this.frameNo;
    const step = this.fadeMs > 0 ? dt / this.fadeMs : 1;
    const out: DrawnLabel[] = [];
    const keys = keysOf(placed);
    for (let i = 0; i < placed.length; i++) {
      const l = placed[i], key = keys[i];
      let e = this.entries.get(key);
      if (!e) { e = { progress: 0, label: l, anchor: null, sx: 0, sy: 0, frame }; this.entries.set(key, e); }
      e.progress = Math.min(1, e.progress + step);
      e.label = l; e.frame = frame;
      // The anchor's screen point now, so a fade-out moves the label exactly as its anchor moves.
      const anchor = anchorOf(l), p = anchor ? project(anchor) : null;
      if (p && p.depth > 0 && Number.isFinite(p.x) && Number.isFinite(p.y)) { e.anchor = anchor; e.sx = p.x; e.sy = p.y; }
      else { e.anchor = null; [e.sx, e.sy] = screenOf(l); }
      out.push({ ...l, alpha: easeLabelAlpha(e.progress) });
    }
    for (const [key, e] of this.entries) {
      if (e.frame === frame) continue;
      e.progress -= step;
      if (e.progress <= 0) { this.entries.delete(key); continue; }
      let dx = 0, dy = 0;
      if (e.anchor) {
        const p = project(e.anchor);
        // Behind the eye: gone at once (nothing to follow).
        if (!(p.depth > 0) || !Number.isFinite(p.x) || !Number.isFinite(p.y)) { this.entries.delete(key); continue; }
        dx = p.x - e.sx; dy = p.y - e.sy;
      }
      out.push({ ...shifted(e.label, dx, dy), alpha: easeLabelAlpha(e.progress) });
    }
    return out;
  }

  /** Some label is fading in or out: the frame after this one differs even with a still camera. */
  get active(): boolean {
    for (const e of this.entries.values()) if (e.progress < 1 || e.frame !== this.frameNo) return true;
    return false;
  }

  /** Forget the labels `drop` names at once (the name a question has just asked: it never lingers). */
  dropWhere(drop: (l: PlacedLabel) => boolean): void {
    for (const [key, e] of this.entries) if (drop(e.label)) this.entries.delete(key);
  }

  /** Forget everything (labels hidden, paper over the map). */
  clear(): void { this.entries.clear(); this.last = 0; }

  get size(): number { return this.entries.size; }
}
