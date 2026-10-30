// Label fade and placement hysteresis for the canvas-drawn labels (street
// names in road-network.js `drawLabels`, the Free Ride place pills).
//
// User 2026-10-30 (#122): "the rate at which the labels pop in and out of
// screen is too distracting, they at least need a fade". Every label fades in
// and out over FADE_MS. A label that loses its place for a moment (collision
// with a neighbour, the rider passing over it) is held at full strength for
// HOLD_MS before it starts to fade, and labels shown last frame are placed
// first, so a neighbour cannot take the spot on a one-frame jitter.
//
// Spoilers never fade: a name the quiz withholds is dropped at once (`drop`).

/** Fade in / fade out, ms. */
export const LABEL_FADE_MS = 300;
/** A shown label that loses its place stays this long before it fades. */
export const LABEL_HOLD_MS = 250;

interface FadeState { alpha: number; seen: number; wantedAt: number; frame: number }

export interface WantOptions {
  /** Skip the hold: start fading at once (a label a building now hides). */
  noHold?: boolean;
}

/**
 * Per-key fade state. Call `begin(now)` once per frame, `want(key, shown)` for
 * every label considered, then `leftovers()` for labels shown earlier but not
 * considered this frame (out of reach): the caller re-checks them and either
 * `want(key, false)`s them (they fade out) or `drop`s them.
 */
export class LabelFade<K> {
  private readonly states = new Map<K, FadeState>();
  private now = 0;
  private dt = 0;
  private frameNo = 0;

  constructor(readonly fadeMs = LABEL_FADE_MS, readonly holdMs = LABEL_HOLD_MS) {}

  begin(nowMs: number): void {
    // A long gap (tab hidden, first frame) must not jump a fade to its end mid-way; clamp.
    this.dt = this.now ? Math.max(0, Math.min(100, nowMs - this.now)) : 16;
    this.now = nowMs;
    this.frameNo++;
  }

  /** Alpha the label had at the end of the last frame (0 when not shown). */
  alpha(key: K): number { return this.states.get(key)?.alpha ?? 0; }

  /** True while the label is placed: shown, or held after losing its place. */
  placed(key: K): boolean {
    const s = this.states.get(key);
    return !!s && s.alpha > 0 && this.now - s.wantedAt <= this.holdMs;
  }

  /**
   * This frame's alpha for `key`. `shown`: the label won its place this
   * frame. Returns 0 when it should not be drawn. A label that lost its place
   * but is within its hold returns its alpha unchanged and stays `placed`.
   */
  want(key: K, shown: boolean, options: WantOptions = {}): number {
    let s = this.states.get(key);
    if (!s) {
      if (!shown) return 0;
      s = { alpha: 0, seen: this.now, wantedAt: this.now, frame: 0 };
      this.states.set(key, s);
    }
    if (s.frame === this.frameNo) return s.alpha;
    s.frame = this.frameNo;
    const step = this.fadeMs > 0 ? this.dt / this.fadeMs : 1;
    if (shown) {
      s.wantedAt = this.now;
      s.alpha = Math.min(1, s.alpha + step);
    } else if (!options.noHold && this.now - s.wantedAt <= this.holdMs) {
      // Held: keep the current strength (a fading-in label keeps rising so a hold never freezes it half-seen).
      if (s.alpha < 1) s.alpha = Math.min(1, s.alpha + step);
    } else {
      s.alpha = Math.max(0, s.alpha - step);
      if (s.alpha === 0) { this.states.delete(key); return 0; }
    }
    return s.alpha;
  }

  /** Forget a label at once (a spoiler, a label that no longer exists). */
  drop(key: K): void { this.states.delete(key); }

  /** Labels with state not considered this frame. */
  leftovers(): K[] {
    const out: K[] = [];
    for (const [key, s] of this.states) if (s.frame !== this.frameNo) out.push(key);
    return out;
  }

  /** `items` with the ones placed last frame first (stable otherwise): placement hysteresis. */
  order<T extends K>(items: readonly T[]): T[] {
    if (!this.states.size) return items as T[];
    const first: T[] = [], rest: T[] = [];
    for (const item of items) (this.states.has(item) ? first : rest).push(item);
    return first.length ? first.concat(rest) : items as T[];
  }

  get size(): number { return this.states.size; }
}

/** Screen-space point. */
export interface ScreenPoint { x: number; y: number }

/** How far either side of the anchor the street direction is sampled, world px. */
const DIRECTION_STEP = 24;
/** Within this of vertical, a label keeps the reading direction it had (no flip-flop). */
const UPRIGHT_SLACK = 12 * Math.PI / 180;

/** Fold an angle into (-π/2, π/2]: text never reads upside down. */
export function uprightAngle(angle: number): number {
  let a = Math.atan2(Math.sin(angle), Math.cos(angle));
  if (a > Math.PI / 2) a -= Math.PI;
  else if (a <= -Math.PI / 2) a += Math.PI;
  return a;
}

/**
 * The street's direction on screen at a label anchor, upright. `worldAngle`
 * is the street's direction in world space; `project` the camera's
 * world-to-screen. In a pitched camera this is not the world angle less the
 * camera's rotation: perspective turns a street running away from the camera
 * towards the vertical (user 2026-10-30, Kattenburg: names sat across their
 * streets). `previous`, when given, holds the reading direction near the
 * vertical so a label does not flip as the camera turns. Also returns the
 * screen length of one world px along the street (for sizing the label's
 * footprint), or null when the street is end-on to the camera.
 */
export function screenTextAngle(
  project: (x: number, y: number) => ScreenPoint,
  x: number, y: number, worldAngle: number,
  previous?: number | null,
): { angle: number; scale: number } | null {
  const c = Math.cos(worldAngle) * DIRECTION_STEP, s = Math.sin(worldAngle) * DIRECTION_STEP;
  const a = project(x - c, y - s), b = project(x + c, y + s);
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len < 1e-3) return null;
  let angle = uprightAngle(Math.atan2(dy, dx));
  if (previous != null && Number.isFinite(previous) && Math.abs(Math.abs(angle) - Math.PI / 2) < UPRIGHT_SLACK) {
    const flipped = angle > 0 ? angle - Math.PI : angle + Math.PI;
    const d = (p: number, q: number) => Math.abs(Math.atan2(Math.sin(p - q), Math.cos(p - q)));
    if (d(flipped, previous) < d(angle, previous)) angle = flipped;
  }
  return { angle, scale: len / (2 * DIRECTION_STEP) };
}

interface StreetLabelLike { x: number; y: number; angle: number }
interface CameraLike { worldToScreen(x: number, y: number): ScreenPoint; rotation?: number }

/**
 * What road-network.js `drawLabels` asks per street name: the fade, and the
 * on-screen angle (remembered per label for the upright hysteresis).
 */
export class StreetLabelPlacement {
  readonly fade = new LabelFade<object>();
  private readonly angles = new WeakMap<object, number>();

  /** Upright screen angle of `label`'s street, and px per world px along it. */
  place(camera: CameraLike, label: StreetLabelLike): { angle: number; scale: number } {
    const prev = this.angles.get(label);
    const hit = screenTextAngle((x, y) => camera.worldToScreen(x, y), label.x, label.y, label.angle, prev);
    const out = hit ?? { angle: prev ?? uprightAngle(label.angle - (camera.rotation || 0)), scale: 1 };
    this.angles.set(label, out.angle);
    return out;
  }
}
