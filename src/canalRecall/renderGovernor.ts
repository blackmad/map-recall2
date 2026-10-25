/**
 * Step the ride's render cost down on machines that cannot hold the frame rate.
 *
 * "Fine on my M4, way too slow on their computers" (2026-10-23): desktop renders
 * at the full device pixel ratio with MSAA and a 2048² sun shadow map. On a
 * Windows laptop at 150–200 % scaling with an integrated GPU that is 2.25–4×
 * the pixels of a 1× canvas, and the frame is bound by fill rate, not by our
 * main-thread work (which the desktop ride-perf budget already keeps near 4 ms).
 *
 * The governor watches the map's own render cadence (the ride calls `jumpTo`
 * every frame, so the map renders every frame while riding and not at all on
 * the idle setup screen) and, after two consecutive slow windows, takes the
 * next step on a fixed ladder: pixel ratio down towards 1, then sun shadows
 * off, then one last step below 1. It never steps back up — a ride is short
 * and oscillating between sharp and blurry is worse than staying blurry — and
 * a fast machine never meets the threshold (M4: ~4 ms of work per frame).
 *
 * The first `settleMs` of riding after the ride starts (or after any pause) is
 * not judged: that is when tiles, landmarks and the own ground land, and those
 * stalls are main-thread work a lower pixel ratio does not buy back. The
 * Android emulator pass (2026-10-23) stepped all three rungs within 15 s of
 * ride start while the city loaded, then sat at 0.75x for the whole ride.
 *
 * `?governor=0` turns it off; an explicit `?dpr=` keeps the pixel ratio the
 * caller asked for and leaves only the shadow step.
 */

export interface GovernorOptions {
  /** The pixel ratio the map started with. */
  initialPixelRatio: number;
  /** Leave the pixel ratio alone (an explicit `?dpr=`). */
  fixedPixelRatio?: boolean;
  /** Shadows can be switched off (the shared frame is present and casting). */
  shadows?: boolean;
  /** Frames per window... */
  windowFrames?: number;
  /** ...or this much time, once it holds `minWindowFrames`: a 2 fps machine must not wait 90 s. */
  windowMs?: number;
  minWindowFrames?: number;
  /** A window is slow when its 75th-percentile frame interval exceeds this. */
  slowP75Ms?: number;
  /** Consecutive slow windows before a step. */
  slowWindows?: number;
  /** The last resort below 1×; applied only when a window is this slow. */
  verySlowP75Ms?: number;
  floorPixelRatio?: number;
  /** Riding time not judged after a start or a gap (loading, not drawing). */
  settleMs?: number;
}

export type GovernorStep =
  | { kind: 'pixelRatio'; from: number; to: number; p75Ms: number }
  | { kind: 'shadows'; on: false; p75Ms: number };

/**
 * Intervals longer than this are a hidden tab or a stalled main thread, not a
 * slow frame. Not shorter: frames are only counted while riding, when the map
 * draws every frame, and a weak machine really can take 500 ms per frame
 * (SwiftShader at 1.5x: 2 fps), which a 250 ms cutoff would never see.
 */
export const GAP_MS = 1000;

export class RenderGovernor {
  readonly steps: GovernorStep[] = [];
  pixelRatio: number;
  shadows: boolean;
  private readonly o: Required<Omit<GovernorOptions, 'fixedPixelRatio' | 'shadows'>> & { fixedPixelRatio: boolean };
  private window: number[] = [];
  private windowMs = 0;
  private slowRun = 0;
  private settleLeft: number;

  constructor(options: GovernorOptions) {
    this.o = {
      windowFrames: 90,
      windowMs: 1500,
      minWindowFrames: 6,
      slowP75Ms: 26,
      slowWindows: 2,
      verySlowP75Ms: 40,
      floorPixelRatio: 0.75,
      settleMs: 0,
      fixedPixelRatio: false,
      ...options,
    };
    this.pixelRatio = options.initialPixelRatio;
    this.shadows = options.shadows ?? false;
    this.settleLeft = this.o.settleMs;
  }

  /** Feed one frame interval; returns the step to apply, if any. */
  frame(intervalMs: number): GovernorStep | null {
    if (!(intervalMs > 0) || intervalMs > GAP_MS) {
      // A pause breaks the run: what follows may be a different scene.
      this.window = [];
      this.windowMs = 0;
      this.slowRun = 0;
      this.settleLeft = this.o.settleMs;
      return null;
    }
    if (this.settleLeft > 0) {
      this.settleLeft -= intervalMs;
      return null;
    }
    this.window.push(intervalMs);
    this.windowMs += intervalMs;
    const full = this.window.length >= this.o.windowFrames
      || (this.windowMs >= this.o.windowMs && this.window.length >= this.o.minWindowFrames);
    if (!full) return null;
    const sorted = this.window.sort((a, b) => a - b);
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    this.window = [];
    this.windowMs = 0;
    if (p75 <= this.o.slowP75Ms) {
      this.slowRun = 0;
      return null;
    }
    if (++this.slowRun < this.o.slowWindows) return null;
    this.slowRun = 0;
    const step = this.nextStep(p75);
    if (!step) return null;
    if (step.kind === 'pixelRatio') this.pixelRatio = step.to;
    else this.shadows = false;
    this.steps.push(step);
    return step;
  }

  /** Nothing left to give up. */
  get exhausted(): boolean {
    return this.nextStep(Infinity) === null;
  }

  /** The step a window this slow would take; pure, so `exhausted` can ask. */
  private nextStep(p75Ms: number): GovernorStep | null {
    const ratio = this.pixelRatio;
    if (!this.o.fixedPixelRatio && ratio > 1) {
      // 0.75× per step is ~0.56× the pixels; snap the last step to exactly 1.
      const to = Math.max(1, Math.round(ratio * 0.75 * 100) / 100);
      return { kind: 'pixelRatio', from: ratio, to, p75Ms };
    }
    if (this.shadows) {
      return { kind: 'shadows', on: false, p75Ms };
    }
    if (!this.o.fixedPixelRatio && ratio > this.o.floorPixelRatio && p75Ms > this.o.verySlowP75Ms) {
      return { kind: 'pixelRatio', from: ratio, to: this.o.floorPixelRatio, p75Ms };
    }
    return null;
  }
}

export interface GovernableMap {
  on(event: 'render', listener: () => void): unknown;
  off?(event: 'render', listener: () => void): unknown;
  getPixelRatio(): number;
  setPixelRatio(ratio: number): unknown;
  /** Draw a frame now (MapLibre `redraw`): a resized canvas must not reach the screen empty. */
  redraw?(): unknown;
}

export interface GovernorInstallOptions {
  /** Switches the sun shadows; omit when there is no shared frame. */
  setShadows?: (on: boolean) => void;
  fixedPixelRatio?: boolean;
  /** Count frames only while this holds (riding, not loading or the intro). */
  active?: () => boolean;
  /** Riding time not judged after the ride starts or resumes; default 12 s. */
  settleMs?: number;
  now?: () => number;
  /**
   * Where a pixel-ratio step runs: the start of the next frame (requestAnimationFrame), never inside `render`.
   * Without requestAnimationFrame (node tests) the step applies at once.
   */
  defer?: (apply: () => void) => void;
  onStep?: (step: GovernorStep, governor: RenderGovernor) => void;
}

/** Attach a governor to a map's render events. Returns it for status/tests. */
export function governMapRender(map: GovernableMap, options: GovernorInstallOptions = {}): RenderGovernor {
  const now = options.now ?? (() => performance.now());
  const defer = options.defer
    ?? (typeof requestAnimationFrame === 'function'
      ? (apply: () => void) => { requestAnimationFrame(() => apply()); }
      : (apply: () => void) => apply());
  const governor = new RenderGovernor({
    initialPixelRatio: map.getPixelRatio(),
    fixedPixelRatio: options.fixedPixelRatio,
    shadows: !!options.setShadows,
    settleMs: options.settleMs ?? 12_000,
  });
  let last = 0;
  const onRender = () => {
    const t = now();
    const interval = last ? t - last : 0;
    last = t;
    if (options.active && !options.active()) {
      governor.frame(0); // a gap: start a fresh window when it holds again
      return;
    }
    const step = governor.frame(interval);
    if (!step) return;
    if (step.kind === 'pixelRatio') {
      // White flashes (issue #64): resizing the canvas clears its drawing buffer, and `render` fires after the
      // frame was drawn, so a step taken here put the cleared, transparent canvas on screen for one frame: the
      // page's paper background, mean luma 0.89 against the ride's 0.48. Resize at the start of the next frame
      // and draw it at once, so the canvas the browser composites always holds a drawn frame.
      const to = step.to;
      defer(() => {
        map.setPixelRatio(to);
        map.redraw?.();
      });
    } else {
      options.setShadows?.(false);
    }
    options.onStep?.(step, governor);
    if (governor.exhausted) map.off?.('render', onRender);
  };
  map.on('render', onRender);
  return governor;
}
