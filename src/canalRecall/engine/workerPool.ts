/**
 * The one worker pool (engine programme P3, lane L4): min(cores - 1, 3) instances of the three.js building worker
 * bundle, shared by every layer that sends work off the main thread — world-v1 cell reads (world/worldCells.ts),
 * building chunk builds (threeBuildingsBrowser.ts) and relief-tile decodes for the own ground (gameGround.ts).
 * Before it, each of those started its own worker(s): one chunk worker, up to three cell workers and a second
 * own-ground worker for relief.
 *
 * The page loads its layers as separate bundles, so the pool lives on `globalThis` (`sharedWorkerPool`): the first
 * layer to ask starts it, the rest join it. Every worker message goes to each subscriber until one claims it
 * (returns true); jobs carry their own ids, so subscribers never see one another's replies as theirs.
 */
import { poolSize } from './worldStreamer.js';

export type PoolMessage = (data: unknown, worker: number) => boolean;
export type PoolFailure = (worker: number, error: unknown) => void;

export class WorkerPool {
  private workers: (Worker | null)[] = [];
  private readonly subscribers = new Set<PoolMessage>();
  private readonly failures = new Set<PoolFailure>();
  /** Main-thread messages received and the longest dispatch, ms (diagnostics). */
  messages = 0;
  longestMessageMs = 0;

  constructor(readonly url: string, size: number, make: (url: string) => Worker = url => new Worker(url)) {
    for (let w = 0; w < size; w++) {
      try {
        const worker = make(url);
        worker.onmessage = event => {
          const t0 = performance.now(), data = event.data; // reading .data deserialises the message: timed with it
          for (const s of this.subscribers) if (s(data, w)) break;
          const ms = performance.now() - t0;
          this.messages++; if (ms > this.longestMessageMs) this.longestMessageMs = ms;
        };
        worker.onerror = error => this.fail(w, error);
        this.workers.push(worker);
      } catch (error) { console.warn('worker pool: a worker could not start', error); }
    }
  }

  /** Live workers. A failed worker leaves a hole (null) so the others keep their index (cell affinity). */
  get size(): number { return this.workers.length; }
  get live(): number { return this.workers.filter(Boolean).length; }
  alive(worker: number): boolean { return !!this.workers[worker]; }

  post(worker: number, message: unknown, transfer: Transferable[] = []): boolean {
    const w = this.workers[worker];
    if (!w) return false;
    w.postMessage(message, transfer);
    return true;
  }

  subscribe(onMessage: PoolMessage, onFailure?: PoolFailure): () => void {
    this.subscribers.add(onMessage);
    if (onFailure) this.failures.add(onFailure);
    return () => { this.subscribers.delete(onMessage); if (onFailure) this.failures.delete(onFailure); };
  }

  private fail(worker: number, error: unknown): void {
    const w = this.workers[worker];
    if (!w) return;
    console.warn(`worker pool: worker ${worker} failed`, error);
    this.workers[worker] = null;
    w.terminate();
    for (const f of this.failures) f(worker, error);
  }

  dispose(): void { for (const w of this.workers) w?.terminate(); this.workers = []; }
}

/** The A/B flags the building worker reads from its own URL (buurtProfiles/data.ts, modernFacades.ts). */
export function withWorkerFlags(url: string, search: string = typeof location !== 'undefined' ? location.search : ''): string {
  if (!url) return url;
  let flags: string[] = [];
  try {
    const q = new URLSearchParams(search);
    flags = ['buurtProfiles', 'modernFacades'].flatMap(name => { const v = q.get(name); return v ? [`${name}=${encodeURIComponent(v)}`] : []; });
  } catch { /* no location */ }
  return flags.length ? `${url}${url.includes('?') ? '&' : '?'}${flags.join('&')}` : url;
}

/** The building worker bundle next to a `*.bundle.js` script (any of the page's bundles). */
export function poolWorkerUrl(scriptSrc: string): string {
  return /[\w-]+\.bundle\.js(\?.*)?$/.test(scriptSrc) ? scriptSrc.replace(/[\w-]+\.bundle\.js(\?.*)?$/, 'three-buildings-worker.bundle.js$1') : '';
}

const KEY = '__canalRecallWorkerPool';
/**
 * The page's pool, started on first use with `url` (the building worker bundle); null without Worker support,
 * without a URL, under `?workerPool=0`, or when no worker started.
 */
export function sharedWorkerPool(url: string, size = poolSize()): WorkerPool | null {
  const g = globalThis as unknown as Record<string, WorkerPool | null | undefined>;
  if (g[KEY] !== undefined) return g[KEY] ?? null;
  let off = false;
  try { off = typeof location !== 'undefined' && new URLSearchParams(location.search).get('workerPool') === '0'; } catch { /* no location */ }
  if (off || typeof Worker === 'undefined' || !url) { g[KEY] = null; return null; }
  const pool = new WorkerPool(withWorkerFlags(url), size);
  g[KEY] = pool.size ? pool : null;
  return g[KEY] ?? null;
}
