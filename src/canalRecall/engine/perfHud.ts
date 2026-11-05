// Perf HUD (lane R1-C, #225): one small mono line, bottom-left above the map attribution, so a rider whose tab is
// slowing down can read (and report) what the page holds: quality tier, pixel ratio, JS heap, GPU memory (estimate),
// resident world cells / building chunks / landmark models, and the frame-time p99 over the last 5 s.
//
// Off by default. `?perfHud=1` turns it on for a load, `?perfHud=0` keeps it off whatever the preference says, and
// the "Show performance" switch under Comfort & detail (preferences `perfHud`, applied through
// `window.__canalRecallPerfHud`) turns it on and off live. Off, the page pays one boolean read a second.
// On, it costs one rAF callback that stores an interval (no layout) and a 1 Hz text update (a few Map sizes and one
// `textContent` write), well under the 0.2 ms a frame the brief allows.
//
// GPU MB is the context's allocation estimate (glCounters.ts GlResident), which only counts what was allocated after
// it was installed: the engine installs it at start when the HUD is wanted then (URL or saved preference), else the
// line shows geometry and texture counts only ("GPU –").
//
// `perfSnapshot` is the same numbers as data; the ride heartbeat and the stall report (rideHeartbeat.ts) carry it, so
// the next locked tab leaves them in Sentry.

export interface PerfSnapshot {
  tier: string | null;
  dpr: number | null;
  heapMB: number | null;
  /** GPU bytes the context holds (GlResident estimate), MB; null when not tracked. */
  gpuMB: number | null;
  geometries: number | null;
  textures: number | null;
  /** Resident building tiles / world cells (the city streamer's cache). */
  cells: number | null;
  /** Building chunks (three.js meshes per tile/detail block). */
  chunks: number | null;
  /** Landmark models resident. */
  models: number | null;
  /** Frame-time p99 over the last window, ms; null before enough frames. */
  p99Ms: number | null;
}

const fmt = (v: number | null | undefined, digits = 0): string => (v == null || !Number.isFinite(v) ? '–' : v.toFixed(digits));

/** The HUD line, e.g. `high 2.0× · heap 312 MB · GPU 480 MB · cells 14 · chunks 26 · models 70 · p99 18 ms`. */
export function perfHudLine(s: PerfSnapshot): string {
  const gpu = s.gpuMB != null ? `GPU ${fmt(s.gpuMB)} MB` : `GPU – (geo ${fmt(s.geometries)} tex ${fmt(s.textures)})`;
  return [
    `${s.tier ?? '–'} ${fmt(s.dpr, 1)}×`,
    `heap ${fmt(s.heapMB)} MB`,
    gpu,
    `cells ${fmt(s.cells)}`,
    `chunks ${fmt(s.chunks)}`,
    `models ${fmt(s.models)}`,
    `p99 ${fmt(s.p99Ms)} ms`,
  ].join(' · ');
}

/**
 * Whether the HUD is wanted: the URL wins (`perfHud=1|0`), then the live global the game writes from the
 * preference, then the saved preference itself (read at start, before the game has applied preferences).
 */
export function perfHudWanted(search: string, live: unknown, savedPrefsJson: string | null): boolean {
  const m = /[?&]perfHud=([^&#]*)/.exec(search);
  if (m) return m[1] === '1' || m[1] === 'true' || m[1] === 'on';
  if (typeof live === 'boolean') return live;
  if (!savedPrefsJson) return false;
  try { return (JSON.parse(savedPrefsJson) as { perfHud?: unknown })?.perfHud === true; } catch { return false; }
}

/** Is the HUD pinned off for this load (`?perfHud=0`)? The live switch then cannot turn it on. */
export function perfHudForcedOff(search: string): boolean {
  const m = /[?&]perfHud=([^&#]*)/.exec(search);
  return !!m && !(m[1] === '1' || m[1] === 'true' || m[1] === 'on');
}

/** Frame intervals in a fixed ring: p99 over the ones within the last `windowMs`. */
export class FrameRing {
  private readonly at: Float64Array;
  private readonly ms: Float32Array;
  private n = 0;
  private head = 0;
  constructor(capacity = 720, private readonly windowMs = 5000) { this.at = new Float64Array(capacity); this.ms = new Float32Array(capacity); }
  push(now: number, intervalMs: number): void {
    this.at[this.head] = now; this.ms[this.head] = intervalMs;
    this.head = (this.head + 1) % this.at.length; this.n = Math.min(this.n + 1, this.at.length);
  }
  clear(): void { this.n = 0; this.head = 0; }
  /** p99 of the intervals stamped within the window before `now`; null under 10 frames. */
  p99(now: number): number | null {
    const v: number[] = [];
    for (let i = 0; i < this.n; i++) if (now - this.at[i] <= this.windowMs) v.push(this.ms[i]);
    if (v.length < 10) return null;
    v.sort((a, b) => a - b);
    return v[Math.min(v.length - 1, Math.floor(0.99 * v.length))];
  }
}

export interface PerfHudSource { snapshot(p99Ms: number | null): PerfSnapshot }

interface HudWindow {
  document: Document;
  innerWidth?: number;
  location?: { search?: string };
  localStorage?: Storage;
  requestAnimationFrame(cb: (t: number) => void): number;
  setInterval(fn: () => void, ms: number): number;
  __canalRecallPerfHud?: unknown;
}

export const PERF_HUD_ID = 'perf-hud-line';
/** The line's style: the attribution's muted ink and halo (index.html `#map-attribution`), in mono, one line above it. */
export const PERF_HUD_STYLE = 'position:fixed;left:10px;bottom:20px;z-index:10;pointer-events:none;white-space:nowrap;'
  + 'font:10px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--day-ink-muted,#5f584d);'
  + 'text-shadow:0 0 3px rgba(251,248,242,.9);max-width:calc(100vw - 20px);overflow:hidden;text-overflow:ellipsis;';
/** Narrow screens (< 600 px): the line wraps in the bottom-left corner, clear of the d-pad. */
export const PERF_HUD_NARROW_STYLE = 'white-space:normal;max-width:calc(50vw - 72px);';
export const PERF_HUD_PREFS_KEY = 'canalRecall.preferences.v1';

/**
 * The DOM line. `start()` begins the 1 Hz check; the element exists only while the HUD is on. `bottomPx` sits it
 * above the attribution line (index.html `#map-attribution`: bottom 6 px, 10 px type).
 */
export class PerfHud {
  private el: HTMLElement | null = null;
  private readonly frames = new FrameRing();
  private lastFrame = 0;
  private rafOn = false;
  private readonly forcedOff: boolean;
  constructor(private readonly win: HudWindow, private readonly source: PerfHudSource) {
    this.forcedOff = perfHudForcedOff(win.location?.search ?? '');
  }

  /** Wanted at start (URL or saved preference)? The engine installs the GPU tracker only then. */
  static wantedAtStart(win: HudWindow): boolean {
    let saved: string | null = null;
    try { saved = win.localStorage?.getItem(PERF_HUD_PREFS_KEY) ?? null; } catch { /* blocked storage */ }
    return perfHudWanted(win.location?.search ?? '', win.__canalRecallPerfHud, saved);
  }

  start(): void {
    if (this.forcedOff) return;
    let saved: string | null = null;
    try { saved = this.win.localStorage?.getItem(PERF_HUD_PREFS_KEY) ?? null; } catch { /* blocked storage */ }
    const search = this.win.location?.search ?? '';
    // The URL or saved preference decide the first second; after that the live global (the game applies prefs).
    let on = perfHudWanted(search, this.win.__canalRecallPerfHud, saved);
    const urlOn = /[?&]perfHud=(1|true|on)\b/.test(search);
    this.apply(on);
    this.win.setInterval(() => {
      const live = this.win.__canalRecallPerfHud;
      on = urlOn || (typeof live === 'boolean' ? live : on);
      this.apply(on);
      if (on) this.update();
    }, 1000);
  }

  get visible(): boolean { return !!this.el; }

  private apply(on: boolean): void {
    if (on && !this.el) {
      const el = this.win.document.createElement('div');
      el.id = PERF_HUD_ID;
      el.setAttribute('aria-hidden', 'true');
      // A phone has no attribution line but a centred d-pad at the bottom: wrap into the corner left of it.
      el.style.cssText = PERF_HUD_STYLE + ((this.win.innerWidth ?? 1024) < 600 ? PERF_HUD_NARROW_STYLE : '');
      this.win.document.body.appendChild(el);
      this.el = el;
      this.frames.clear();
      this.lastFrame = 0;
      if (!this.rafOn) { this.rafOn = true; this.win.requestAnimationFrame(t => this.tick(t)); }
      this.update();
    } else if (!on && this.el) {
      this.el.remove();
      this.el = null;
    }
  }

  private tick(t: number): void {
    if (!this.el) { this.rafOn = false; return; }
    if (this.lastFrame) this.frames.push(t, t - this.lastFrame);
    this.lastFrame = t;
    this.win.requestAnimationFrame(n => this.tick(n));
  }

  private update(): void {
    if (!this.el) return;
    const now = this.lastFrame || 0;
    try { this.el.textContent = perfHudLine(this.source.snapshot(this.frames.p99(now))); } catch { /* a page half torn down */ }
  }
}
