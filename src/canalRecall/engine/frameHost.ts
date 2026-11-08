// The engine's frame host (engine programme P1, `?engine=own`): one canvas, one
// WebGLRenderer, one requestAnimationFrame loop with a fixed-step accumulator.
//
//   tick(dtFixed)  — the simulation substep (lane L8's driving model plugs in
//                    here; `game.js _loop` becomes `engine.tick` in a later
//                    step). Called 0..maxSubsteps times per animation frame.
//   render(alpha)  — draw once, `alpha` ∈ [0, 1) the fraction of a step not
//                    yet simulated, for interpolation.
//
// It owns WebGL context loss and restore (the semantics SharedFrame had under
// MapLibre: on loss nothing draws and the renderer is dropped; on restore a
// new renderer is made and `webglcontextrestored` fires, so the shared frame
// re-adopts it and participants rebuild in `onContextRestored`).
//
// Its event surface is the slice of MapLibre's map that `mapGuard.ts`
// (`guardMapRender`: `_render`, `on`, `triggerRepaint`, `getCanvas`,
// `getContainer`) and `renderGovernor.ts` (`governMapRender`: `on('render')`,
// `getPixelRatio`, `setPixelRatio`, `redraw`) already guard, so the one-shot
// Sentry graphics reports and the render budget ladder attach unchanged.
//
// THREE is injected (window.CanalRecallThree.THREE in the page).

import { framePhases } from './framePhases';

export type FrameListener = (event?: unknown) => void;

export interface FrameHostHooks {
  /** One fixed simulation step of `dtFixed` seconds. */
  tick?(dtFixed: number): void;
  /** Draw the frame. The host has cleared colour and depth. */
  render(alpha: number, nowMs: number): void;
  /** Render this frame even without `triggerRepaint` (e.g. an easing camera). */
  wantsFrame?(): boolean;
  /**
   * While something opaque covers the world (the game's loading screen), the least ms between renders, else null.
   * A covered frame is never seen; under headless SwiftShader each one is a 300-900 ms main-thread task and the
   * chunk builds and installs the loading screen waits for queued behind them (#129, 2026-11-01). Dirty frames
   * are kept, so the first uncovered frame draws at once.
   */
  coveredFrameMs?(): number | null;
  /** After `render`, before the frame is shown: a full-frame pass over the drawn buffer (the toon look, #161). */
  post?(renderer: any, width: number, height: number): void;
}

/**
 * The game's simulation when the engine owns the loop (`FrameHost.setSimulation`): `tick` runs per fixed step of
 * `clock.dt` (1/120 s, steerModel.ts STEP_MAX: `CanalRecallUi.stepSteer` takes it as `h`), then `frame` once per
 * animation frame with the frame's seconds (capped at 0.25) and the unsimulated fraction, before the render.
 */
export interface FrameSimulation {
  tick?(dtFixed: number): void;
  frame?(dtSeconds: number, alpha: number): void;
}

export interface FrameHostOptions {
  antialias?: boolean;
  pixelRatio?: number;
  /** Simulation step, seconds (default 1/120). */
  fixedDt?: number;
  /** At most this many steps per animation frame; the rest of a long stall is dropped (default 8). */
  maxSubsteps?: number;
  /** Clear colour (the sky). */
  clearColor?: number;
  /**
   * Render only when something asked for it (`triggerRepaint`: a camera move, an install, an easing) even while the
   * game's simulation runs every frame. A still frame is not redrawn; the canvas keeps the last one. Default true;
   * false draws every animation frame the simulation runs (the old behaviour, `?renderOnChange=0`).
   */
  renderOnChange?: boolean;
  /**
   * Re-assert the sky before each frame's clear (default true; `?skyClear=0` turns it off). three's `renderer.clear()`
   * clears with whatever `gl.clearColor` and colour mask the GL context holds; it sets the clear colour only inside
   * `renderer.render()`. Work between frames that ends in `renderer.resetState()` (SharedFrame.compile/compileAsync, a
   * streamed install's precompile) leaves `gl.clearColor(0, 0, 0, 0)`, so the next frame cleared the sky to
   * transparent and the page's cream background showed through it: the sky flicker (#216, ~1 frame in 3 while riding,
   * headed Chrome on the Mac).
   */
  clearGuard?: boolean;
  /** Tests: the clock and the frame scheduler. */
  now?: () => number;
  requestFrame?: (callback: (t: number) => void) => unknown;
  cancelFrame?: (handle: unknown) => void;
  /** Tests: make the renderer (default `new THREE.WebGLRenderer({canvas, antialias})`). */
  createRenderer?: (canvas: HTMLCanvasElement) => any;
}

/**
 * A paced frame may come this much early: animation frames arrive on the display's vsync (16.7 ms at 60 Hz, 8.3 ms at
 * 120 Hz) with jitter, so a 33.3 ms pace taken strictly would often wait one vsync too many (an uneven 20-30 fps).
 */
export const PACE_SLACK_MS = 4;

/** Fixed-step accumulator: how many steps to run for a frame of `dtSeconds`, and the leftover fraction. */
export class StepClock {
  private acc = 0;
  /** Steps dropped because a frame needed more than `maxSubsteps` (diagnostics). */
  dropped = 0;
  constructor(readonly dt: number, readonly maxSubsteps: number) {}
  advance(dtSeconds: number): { steps: number; alpha: number } {
    // A background tab or a breakpoint is not 30 s of physics.
    this.acc += Math.max(0, Math.min(dtSeconds, 0.25));
    let steps = Math.floor(this.acc / this.dt + 1e-9);
    if (steps > this.maxSubsteps) { this.dropped += steps - this.maxSubsteps; steps = this.maxSubsteps; this.acc = 0; }
    else this.acc -= steps * this.dt;
    return { steps, alpha: Math.max(0, Math.min(1, this.acc / this.dt)) };
  }
  reset(): void { this.acc = 0; }
}

export class FrameHost {
  readonly THREE: any;
  readonly container: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  renderer: any = null;
  /** Context losses and restores seen (diagnostics, the context-restore spec). */
  readonly contextEvents = { lost: 0, restored: 0 };
  readonly clock: StepClock;
  /** Frames drawn, and the last frame's render time (ms, main thread). */
  readonly stats = { frames: 0, renderMs: 0, ticks: 0, idleFrames: 0, coveredSkips: 0, pacedSkips: 0 };
  private lastRenderAt = -Infinity;
  /**
   * Least ms between rendered frames, measured on the animation-frame clock, or null (render every frame something
   * changed). Set per frame by the world view (engine/aerialPower.ts `?aerialFps=0`: 30 fps while the camera flies from
   * the air). The simulation still steps every animation frame; a skipped frame stays dirty and draws at the next one
   * the pace allows, or at once when the pace is lifted.
   */
  minFrameMs: number | null = null;
  private lastPacedAt = -Infinity;
  private readonly hooks: FrameHostHooks;
  private sim: FrameSimulation | null = null;
  private readonly options: FrameHostOptions;
  private readonly listeners = new Map<string, Set<FrameListener>>();
  private pixelRatio: number;
  private dirty = true;
  private running = false;
  private handle: unknown = null;
  private lastT: number | null = null;
  private lost = false;
  private cssSize = [0, 0];
  private resizeObserver: { disconnect(): void } | null = null;

  constructor(THREE: any, container: HTMLElement, hooks: FrameHostHooks, options: FrameHostOptions = {}) {
    this.THREE = THREE;
    this.container = container;
    this.hooks = hooks;
    this.options = options;
    this.pixelRatio = options.pixelRatio ?? 1;
    this.renderOnChange = options.renderOnChange ?? true;
    this.clock = new StepClock(options.fixedDt ?? 1 / 120, options.maxSubsteps ?? 8);
    const doc = container.ownerDocument;
    this.canvas = doc.createElement('canvas');
    this.canvas.className = 'engine-canvas';
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    container.appendChild(this.canvas);
    this.canvas.addEventListener('webglcontextlost', event => {
      // Without preventDefault the browser never restores the context.
      event.preventDefault();
      this.onContextLost();
    }, false);
    this.canvas.addEventListener('webglcontextrestored', () => this.onContextRestored(), false);
    this.renderer = this.makeRenderer();
    this.resize();
    const RO = (globalThis as { ResizeObserver?: new (cb: () => void) => { observe(el: Element): void; disconnect(): void } }).ResizeObserver;
    if (RO) { const ro = new RO(() => this.resize()); ro.observe(container); this.resizeObserver = ro; }
  }

  private makeRenderer(): any {
    const renderer = this.options.createRenderer
      ? this.options.createRenderer(this.canvas)
      : new this.THREE.WebGLRenderer({ canvas: this.canvas, antialias: this.options.antialias ?? true, powerPreference: 'high-performance' });
    // The host sizes the drawing buffer itself (css × pixel ratio); three draws at 1:1 into it.
    renderer.setPixelRatio?.(1);
    renderer.autoClear = false;
    if (renderer.shadowMap) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = this.THREE.PCFShadowMap;
      // The shared frame redraws the shadow map only when its box or casters change.
      renderer.shadowMap.autoUpdate = false;
    }
    renderer.setClearColor?.(this.options.clearColor ?? 0xbfd8ee, 1);
    return renderer;
  }

  /** See FrameHostOptions.clearGuard: the host's clear colour (alpha 1) and a full colour write mask, in GL. */
  private assertClearState(renderer: any): void {
    if (this.options.clearGuard === false) return;
    // setClearColor goes through three's state cache (invalidated by resetState), so it reaches GL after a reset.
    renderer.setClearColor?.(this.options.clearColor ?? 0xbfd8ee, 1);
    renderer.state?.buffers?.color?.setMask?.(true);
  }

  // ---- MapLibre-shaped event surface (mapGuard, renderGovernor, SharedFrame) ----
  on(type: string, listener: FrameListener): this {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, set = new Set());
    set.add(listener);
    return this;
  }
  off(type: string, listener: FrameListener): this { this.listeners.get(type)?.delete(listener); return this; }
  once(type: string, listener?: FrameListener): any {
    if (!listener) return new Promise<void>(resolve => this.once(type, () => resolve()));
    const wrapped: FrameListener = event => { this.off(type, wrapped); listener(event); };
    return this.on(type, wrapped);
  }
  fire(type: string, event?: unknown): void {
    const set = this.listeners.get(type);
    if (!set) return;
    const phases = framePhases();
    for (const listener of [...set]) {
      const t0 = phases ? performance.now() : 0;
      try { listener(event); } catch (error) { console.warn(`frame host: ${type} listener failed`, error); }
      if (phases) phases.add(`${type} listener: ${(listener as { label?: string }).label ?? (listener.name || String(listener).slice(0, 60))}`, performance.now() - t0);
    }
  }
  getCanvas(): HTMLCanvasElement { return this.canvas; }
  getContainer(): HTMLElement { return this.container; }
  getPixelRatio(): number { return this.pixelRatio; }
  setPixelRatio(ratio: number): void {
    if (!(ratio > 0) || ratio === this.pixelRatio) return;
    this.pixelRatio = ratio;
    this.resize(true);
  }
  /** Draw a frame now (a resized canvas must not reach the screen empty). */
  redraw(): void { this.dirty = true; this._render(); }
  triggerRepaint(): void { this.dirty = true; }
  isContextLost(): boolean { return this.lost; }

  /** Match the drawing buffer to the container (css px × pixel ratio). */
  resize(force = false): void {
    const w = Math.max(1, this.container.clientWidth || 1), h = Math.max(1, this.container.clientHeight || 1);
    if (!force && w === this.cssSize[0] && h === this.cssSize[1]) return;
    this.cssSize = [w, h];
    const bw = Math.max(1, Math.round(w * this.pixelRatio)), bh = Math.max(1, Math.round(h * this.pixelRatio));
    if (this.canvas.width !== bw) this.canvas.width = bw;
    if (this.canvas.height !== bh) this.canvas.height = bh;
    this.dirty = true;
    this.fire('resize');
  }
  /** CSS size of the canvas. */
  viewport(): { width: number; height: number } { return { width: this.cssSize[0], height: this.cssSize[1] }; }

  // ---- loop ----
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastT = null;
    this.clock.reset();
    this.schedule();
  }
  stop(): void {
    this.running = false;
    if (this.handle != null) (this.options.cancelFrame ?? ((h: unknown) => cancelAnimationFrame(h as number)))(this.handle);
    this.handle = null;
  }
  destroy(): void {
    this.stop();
    this.resizeObserver?.disconnect();
    try { this.renderer?.dispose(); } catch (_) { /* lost */ }
    this.renderer = null;
    this.canvas.remove();
  }

  private schedule(): void {
    const request = this.options.requestFrame ?? ((cb: (t: number) => void) => requestAnimationFrame(cb));
    this.handle = request(t => this.frame(t));
  }

  /** One animation frame: fixed steps, then (if anything changed) one render. Public for tests. */
  frame(t: number): void {
    this.handle = null;
    if (!this.running) return;
    const dt = this.lastT == null ? 0 : (t - this.lastT) / 1000;
    this.lastT = t;
    const { steps, alpha } = this.clock.advance(dt);
    const sim = this.sim;
    const phases = framePhases(), f0 = phases ? performance.now() : 0;
    if (this.hooks.tick || sim?.tick) {
      for (let i = 0; i < steps; i++) {
        try { this.hooks.tick?.(this.clock.dt); sim?.tick?.(this.clock.dt); } catch (error) { console.warn('frame host: tick failed', error); }
        this.stats.ticks++;
      }
      if (steps) this.dirty = true;
    }
    const f1 = phases ? performance.now() : 0;
    if (phases) phases.add('simulation steps', f1 - f0);
    this.alpha = alpha;
    if (sim?.frame) {
      try { sim.frame(Math.max(0, Math.min(dt, 0.25)), alpha); } catch (error) { console.warn('frame host: frame failed', error); }
      // What the frame changed reaches the host as triggerRepaint (the camera's jumpTo, the participants).
      if (this.renderOnChange === false) this.dirty = true;
    }
    if (phases) phases.add('game frame', performance.now() - f1);
    // Measured from the end of the last render, so a frame slower than the interval still leaves the interval free.
    const covered = this.hooks.coveredFrameMs?.() ?? null, clock = this.options.now ?? (() => performance.now());
    let rendered = false;
    const paced = covered == null ? this.minFrameMs : null;
    if (covered != null && clock() - this.lastRenderAt < covered) { if (this.dirty) this.stats.coveredSkips++; else this.stats.idleFrames++; }
    else if (paced != null && t - this.lastPacedAt < paced - PACE_SLACK_MS && (this.dirty || this.hooks.wantsFrame?.())) this.stats.pacedSkips++;
    else if (this.dirty || this.hooks.wantsFrame?.()) { this._render(); this.lastRenderAt = clock(); this.lastPacedAt = t; rendered = true; }
    else this.stats.idleFrames++;
    if (phases && rendered) phases.end(performance.now() - f0);
    this.schedule();
  }
  private alpha = 0;
  /** See FrameHostOptions.renderOnChange; mutable so a probe can compare both at one pose. */
  renderOnChange: boolean;

  /** Hand the game's loop to the host (null gives it back): see FrameSimulation. Resets the step accumulator. */
  setSimulation(sim: FrameSimulation | null): void {
    this.sim = sim;
    this.clock.reset();
    this.dirty = true;
  }

  /**
   * Clear and draw one frame, then fire `render`. Named like MapLibre's so `guardMapRender` can wrap it (a dead-GPU
   * shader error holds drawing and reports once). Call through the property, never a captured reference.
   */
  _render(): void {
    const renderer = this.renderer;
    if (!renderer || this.lost) return;
    const gl = renderer.getContext?.() as WebGL2RenderingContext | undefined;
    if (gl?.isContextLost?.()) return;
    this.dirty = false;
    const now = (this.options.now ?? (() => performance.now()))();
    renderer.setRenderTarget?.(null);
    renderer.setViewport?.(0, 0, this.canvas.width, this.canvas.height);
    this.assertClearState(renderer);
    renderer.clear?.(true, true, true);
    const phases = framePhases();
    if (phases) phases.add('clear', (this.options.now ?? (() => performance.now()))() - now);
    this.hooks.render(this.alpha, now);
    if (this.hooks.post) this.hooks.post(renderer, this.canvas.width, this.canvas.height);
    this.stats.renderMs = (this.options.now ?? (() => performance.now()))() - now;
    this.stats.frames++;
    this.fire('render');
  }

  private onContextLost(): void {
    if (this.lost) return;
    this.lost = true;
    this.contextEvents.lost++;
    const old = this.renderer;
    this.renderer = null;
    // Listeners (the shared frame, mapGuard) see the loss before the renderer goes.
    this.fire('webglcontextlost');
    try { old?.dispose(); } catch (_) { /* lost context */ }
  }

  private onContextRestored(): void {
    this.lost = false;
    this.contextEvents.restored++;
    // A fresh renderer: nothing of the old GL state survives a restore.
    this.renderer = this.makeRenderer();
    this.dirty = true;
    this.fire('webglcontextrestored');
  }
}
