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
}

export interface HeartbeatStamp extends HeartbeatSample {
  v: 1;
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
      heapMB: stamp.heapMB ?? null, peakHeapMB: stamp.peakHeapMB ?? null, distanceM: stamp.distanceM ?? null,
    },
  };
}

export interface HeartbeatOptions {
  storage: StorageLike | null | undefined;
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
    this.stamp = { v: 1, startedAt: t, at: t, seq: 0, visible, ended: false };
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
    try { this.o.storage?.setItem(HEARTBEAT_KEY, JSON.stringify(this.stamp)); } catch { /* quota, private mode */ }
  }
}

const PHASES: Record<number, string> = { 0: 'menu', 1: 'map-select', 2: 'loading', 4: 'racing', 5: 'finished', 6: 'paused' };
export function phaseName(state: unknown): string | undefined {
  return typeof state === 'number' ? PHASES[state] ?? String(state) : undefined;
}
