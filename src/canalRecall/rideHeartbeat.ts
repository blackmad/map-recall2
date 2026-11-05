/**
 * Ride heartbeat (lane E2, #215): a tab killed by the browser (a renderer OOM, "Aw, Snap") sends nothing, so Sentry
 * never hears about the crash. While the page runs, a stamp in sessionStorage is rewritten every few seconds with what
 * the page was doing (engine, quality tier, game phase, JS heap); `pagehide` marks it ended. sessionStorage survives a
 * renderer crash and the reload of the same tab, so the next load finds a stamp that never ended and reports it once.
 *
 * Pure logic over a storage and a clock, so it is unit-tested; monitoring.ts owns the Sentry side and the page wiring.
 */

export const HEARTBEAT_KEY = 'canalRecall.rideHeartbeat';
export const HEARTBEAT_INTERVAL_MS = 5000;
/** A stamp older than this is a tab restored long after (a laptop asleep), not a crash worth reporting. */
export const HEARTBEAT_MAX_AGE_MS = 6 * 3600_000;

export interface HeartbeatSample {
  engine?: string;
  tier?: string;
  /** Game phase name (menu, loading, racing, finished, paused) or the raw state. */
  phase?: string;
  heapMB?: number;
  /** Distance ridden this session, metres (how far into the ride the end came). */
  distanceM?: number;
  /** Dedicated workers the page holds (pool + own ground): their heaps share the renderer's V8 cage with the page. */
  workers?: number;
  /** Game pages of this origin open in the browser (this one included): same-site tabs can share one renderer. */
  tabs?: number;
  /** What the own engine held (engine/perfHud.ts PerfSnapshot, `__canalPerf.snapshot()`): GPU MB, residents, p99. */
  gpuMB?: number;
  geometries?: number;
  textures?: number;
  cells?: number;
  chunks?: number;
  models?: number;
  dpr?: number;
}

export interface HeartbeatStamp extends HeartbeatSample {
  v: 1;
  /** This page's id: the shared (localStorage) copy is keyed by it, so a reload of the same tab reports once. */
  id?: string;
  startedAt: number;
  at: number;
  seq: number;
  /** The page was visible at the last stamp (a hidden tab may be discarded by the OS without pagehide). */
  visible: boolean;
  ended: boolean;
  /** Largest heap seen this session, MB. */
  peakHeapMB?: number;
}

export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }

export function readStamp(storage: StorageLike | null | undefined): HeartbeatStamp | null {
  try {
    const raw = storage?.getItem(HEARTBEAT_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as HeartbeatStamp;
    return s && s.v === 1 && typeof s.at === 'number' && typeof s.startedAt === 'number' ? s : null;
  } catch { return null; }
}

/** The report for a previous page that never reached pagehide, or null (none, ended, or too old). */
export function unendedReport(stamp: HeartbeatStamp | null, now: number, maxAgeMs = HEARTBEAT_MAX_AGE_MS):
  { message: string; tags: Record<string, string>; extra: Record<string, unknown> } | null {
  if (!stamp || stamp.ended || now - stamp.at > maxAgeMs || now < stamp.at) return null;
  const tags: Record<string, string> = { heartbeat: 'unended', previousVisible: String(stamp.visible) };
  if (stamp.engine) tags.engine = stamp.engine;
  if (stamp.tier) tags.tier = stamp.tier;
  if (stamp.phase) tags.phase = stamp.phase;
  return {
    message: 'previous ride ended without unload',
    tags,
    extra: {
      uptimeS: Math.round((stamp.at - stamp.startedAt) / 1000), sinceLastStampS: Math.round((now - stamp.at) / 1000), stamps: stamp.seq,
      heapMB: stamp.heapMB ?? null, peakHeapMB: stamp.peakHeapMB ?? null, distanceM: stamp.distanceM ?? null, workers: stamp.workers ?? null, tabs: stamp.tabs ?? null,
      gpuMB: stamp.gpuMB ?? null, geometries: stamp.geometries ?? null, textures: stamp.textures ?? null,
      cells: stamp.cells ?? null, chunks: stamp.chunks ?? null, models: stamp.models ?? null, dpr: stamp.dpr ?? null,
    },
  };
}

/**
 * The shared copy (lane R1-C, #225). sessionStorage belongs to one tab: a tab that locks up and is *closed* (the
 * user's aerial pan, 2026-11-05) takes its stamp with it, so nothing is ever reported. Each page also keeps its stamp
 * in localStorage under its own id while it runs and removes it at pagehide; the next load in any tab reports the
 * pages whose stamp stopped beating without an end. `?heartbeatShared=0` turns the copy off.
 */
export const SHARED_HEARTBEAT_PREFIX = 'canalRecall.rideHeartbeat.page.';
/** A visible page whose stamp is older than this has stopped beating (a hung main thread or a dead renderer). */
export const ORPHAN_VISIBLE_MS = 30_000;
/** A hidden page's timers are throttled (Chrome: once a minute after 5 min hidden), so it is given much longer. */
export const ORPHAN_HIDDEN_MS = 15 * 60_000;

export interface KeyedStorage extends StorageLike { readonly length: number; key(index: number): string | null; removeItem(key: string): void }

/** Other pages' shared stamps that stopped beating without an end: removed from storage and returned (oldest first). */
export function takeOrphans(storage: KeyedStorage | null | undefined, selfId: string, now: number, maxAgeMs = HEARTBEAT_MAX_AGE_MS): HeartbeatStamp[] {
  if (!storage) return [];
  const out: HeartbeatStamp[] = [];
  const keys: string[] = [];
  try { for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k && k.startsWith(SHARED_HEARTBEAT_PREFIX)) keys.push(k); } } catch { return []; }
  for (const k of keys) {
    if (k === SHARED_HEARTBEAT_PREFIX + selfId) continue;
    let s: HeartbeatStamp | null = null;
    try { const raw = storage.getItem(k); s = raw ? JSON.parse(raw) as HeartbeatStamp : null; } catch { s = null; }
    const valid = s && s.v === 1 && typeof s.at === 'number';
    const age = valid ? now - s!.at : Infinity;
    // Ended, unreadable or too old: litter, removed without a report. Still beating: a live peer, left alone.
    if (!valid || s!.ended || age > maxAgeMs || age < 0) { try { storage.removeItem(k); } catch { /* */ } continue; }
    if (age < (s!.visible ? ORPHAN_VISIBLE_MS : ORPHAN_HIDDEN_MS)) continue;
    try { storage.removeItem(k); } catch { /* */ }
    out.push(s!);
  }
  return out.sort((a, b) => a.at - b.at);
}

/** The report for an orphaned shared stamp: as `unendedReport`, tagged `orphaned` (the tab was closed or hung). */
export function orphanReport(stamp: HeartbeatStamp, now: number): { message: string; tags: Record<string, string>; extra: Record<string, unknown> } | null {
  const r = unendedReport({ ...stamp, ended: false }, now, Infinity);
  if (!r) return null;
  const tags: Record<string, string> = { ...r.tags, heartbeat: 'orphaned' };
  return { ...r, message: 'previous ride stopped beating (tab closed or hung)', tags };
}

/**
 * Stall watch (lane R1-C, #225): a tab that is "practically locked" but alive never ends unclean, so the heartbeat
 * says nothing. Long frames (long-animation-frame / longtask entries) are counted in a sliding window; `count` of at
 * least `minMs` within `windowMs`, or one of at least `singleMs`, is a stall, reported at once (the page can still
 * send) and at most `maxReports` times a page, `gapMs` apart. `?stallReport=0` turns it off.
 */
export const STALL_DEFAULTS = { minMs: 250, count: 6, windowMs: 10_000, singleMs: 2000, maxReports: 2, gapMs: 120_000 } as const;
export interface StallOptions { minMs: number; count: number; windowMs: number; singleMs: number; maxReports: number; gapMs: number }
export interface Stall { longest: number; count: number; totalMs: number; windowMs: number }

export class StallWatch {
  private readonly recent: { at: number; ms: number }[] = [];
  private reports = 0;
  private lastReport = -Infinity;
  constructor(private readonly o: StallOptions = STALL_DEFAULTS) {}
  /** A long frame of `ms` that started at `at` (page ms); returns a stall to report, or null. */
  note(at: number, ms: number): Stall | null {
    if (ms < this.o.minMs) return null;
    this.recent.push({ at, ms });
    while (this.recent.length && at - this.recent[0].at > this.o.windowMs) this.recent.shift();
    if (this.reports >= this.o.maxReports || at - this.lastReport < this.o.gapMs) return null;
    if (this.recent.length < this.o.count && ms < this.o.singleMs) return null;
    this.reports++;
    this.lastReport = at;
    const stall = { longest: Math.round(Math.max(...this.recent.map(r => r.ms))), count: this.recent.length, totalMs: Math.round(this.recent.reduce((a, r) => a + r.ms, 0)), windowMs: this.o.windowMs };
    this.recent.length = 0;
    return stall;
  }
}

export interface HeartbeatOptions {
  storage: StorageLike | null | undefined;
  /** The shared copy (localStorage), keyed by `id`; removed at a clean end. */
  shared?: KeyedStorage | null;
  id?: string;
  sample: () => HeartbeatSample;
  now?: () => number;
  intervalMs?: number;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (handle: unknown) => void;
}

export class RideHeartbeat {
  private stamp: HeartbeatStamp | null = null;
  private handle: unknown = null;
  private readonly now: () => number;

  constructor(private readonly o: HeartbeatOptions) {
    this.now = o.now ?? (() => Date.now());
  }

  /** Read the previous page's stamp (for `unendedReport`), then start this page's beat. */
  start(visible = true): HeartbeatStamp | null {
    const previous = readStamp(this.o.storage);
    const t = this.now();
    this.stamp = { v: 1, ...(this.o.id ? { id: this.o.id } : {}), startedAt: t, at: t, seq: 0, visible, ended: false };
    this.beat();
    const every = this.o.setInterval ?? ((fn: () => void, ms: number) => setInterval(fn, ms));
    this.handle = every(() => this.beat(), this.o.intervalMs ?? HEARTBEAT_INTERVAL_MS);
    return previous;
  }

  beat(): void {
    if (!this.stamp || this.stamp.ended) return;
    let sample: HeartbeatSample = {};
    try { sample = this.o.sample(); } catch { /* a page half torn down */ }
    const peak = Math.max(this.stamp.peakHeapMB ?? 0, sample.heapMB ?? 0);
    this.stamp = { ...this.stamp, ...sample, at: this.now(), seq: this.stamp.seq + 1, ...(peak ? { peakHeapMB: peak } : {}) };
    this.write();
  }

  setVisible(visible: boolean): void {
    if (!this.stamp || this.stamp.visible === visible) return;
    this.stamp = { ...this.stamp, visible };
    this.beat();
  }

  /** The page is going away normally (pagehide): the stamp is closed and the beat stops. */
  end(): void {
    if (!this.stamp) return;
    this.stamp = { ...this.stamp, at: this.now(), ended: true };
    this.write();
    if (this.handle != null) (this.o.clearInterval ?? ((h: unknown) => clearInterval(h as ReturnType<typeof setInterval>)))(this.handle);
    this.handle = null;
  }

  /** A page restored from the back/forward cache (pageshow persisted) is alive again. */
  resume(): void {
    if (!this.stamp) return;
    this.stamp = { ...this.stamp, ended: false };
    this.beat();
    if (this.handle == null) {
      const every = this.o.setInterval ?? ((fn: () => void, ms: number) => setInterval(fn, ms));
      this.handle = every(() => this.beat(), this.o.intervalMs ?? HEARTBEAT_INTERVAL_MS);
    }
  }

  current(): HeartbeatStamp | null { return this.stamp; }

  private write(): void {
    const json = JSON.stringify(this.stamp);
    try { this.o.storage?.setItem(HEARTBEAT_KEY, json); } catch { /* quota, private mode */ }
    if (!this.o.shared || !this.o.id) return;
    const key = SHARED_HEARTBEAT_PREFIX + this.o.id;
    try { if (this.stamp?.ended) this.o.shared.removeItem(key); else this.o.shared.setItem(key, json); } catch { /* quota, private mode */ }
  }
}

const PHASES: Record<number, string> = { 0: 'menu', 1: 'map-select', 2: 'loading', 4: 'racing', 5: 'finished', 6: 'paused' };
export function phaseName(state: unknown): string | undefined {
  return typeof state === 'number' ? PHASES[state] ?? String(state) : undefined;
}

/**
 * Peer game pages of this origin, from their heartbeats on a BroadcastChannel: each page posts its id on every beat
 * and counts the ids heard within `windowMs`. Same-site tabs may share a renderer process and its V8 heap ceiling,
 * so a crash report says how many were open.
 */
export class PeerTabs {
  private readonly seen = new Map<string, number>();
  constructor(readonly id: string, private readonly windowMs = 3 * HEARTBEAT_INTERVAL_MS) {}
  heard(id: string, at: number): void { if (id !== this.id) this.seen.set(id, at); }
  /** Pages open now, this one included. */
  count(now: number): number {
    for (const [id, at] of this.seen) if (now - at > this.windowMs) this.seen.delete(id);
    return 1 + this.seen.size;
  }
}
