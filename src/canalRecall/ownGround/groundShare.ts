// One fetch and one gunzip per extract file for all the ground workers (lane R5-A #260 step 3; pure, no DOM).
//
// Measured 2026-11-09 (3 cold desktop starts, load 10–15, workerTrace.ts): each ground worker loads and plans a cell's
// whole 3×3 neighbourhood, so the three workers fetched and gunzipped the same files twice over (626–676 fetches for
// 322–328 distinct files, 78 MB of duplicate bytes after gunzip per start). As CPU the duplicates are small (~0.3 s
// gunzip + parse in Node), but two LOD 0 cells starting together on two workers each took 2.1–2.5 s of data-in for
// the ~110 files they both fetched, against 1.25 s for the same-sized cell alone during the hold: the requests share
// six connections and the gunzips queue behind each other on a loaded machine.
//
// The share host is one more instance of the ground worker bundle that never builds: it fetches and gunzips each file
// once and hands every worker asking for it a copy of the gunzipped bytes over a MessagePort, keeping recent files in
// an LRU byte cap. (A SharedArrayBuffer needs COOP/COEP headers, which neither the dev server nor the deploy sends.)
// The bytes are the same bytes, so the built meshes are unchanged. `?groundShare=0` (or
// `window.__canalRecallGroundShare = false`) restores a fetch per worker.

/** Gunzipped bytes of one extract file (`path` relative to the extract root); throws on a failed fetch. */
export type RawFetch = (path: string) => Promise<Uint8Array>;

export type ShareRequest = { type: 'get'; id: number; path: string };
export type ShareReply = {
  type: 'got'; id: number; bytes?: ArrayBuffer; error?: string;
  /** Served without a new fetch: from the cache, or joined to another worker's fetch in flight. */
  hit: boolean;
  /** The host's fetch (request → body) and gunzip for this file, ms (for a hit: what the requester did not spend). */
  netMs: number; gunzipMs: number;
};

export const SHARE_CACHE_MB = 64;

export function groundShareFlag(search?: string): boolean {
  const g = globalThis as { __canalRecallGroundShare?: boolean; location?: { search?: string } };
  if (typeof g.__canalRecallGroundShare === 'boolean') return g.__canalRecallGroundShare;
  return new URLSearchParams(search ?? g.location?.search ?? '').get('groundShare') !== '0';
}

/** The share host's cache in MB (`?groundShareMB=N`, 0–512), else SHARE_CACHE_MB. */
export function groundShareMB(search?: string): number {
  const g = globalThis as { location?: { search?: string } };
  const raw = new URLSearchParams(search ?? g.location?.search ?? '').get('groundShareMB');
  const n = Number(raw);
  return raw != null && raw !== '' && Number.isFinite(n) && n >= 0 && n <= 512 ? n : SHARE_CACHE_MB;
}

interface Entry { bytes?: Uint8Array; loading?: Promise<Uint8Array>; netMs: number; gunzipMs: number }

export interface ShareStats { requests: number; hits: number; fetches: number; errors: number; hitBytes: number; cachedBytes: number; evicted: number }

/**
 * The host side: one fetch per path while it is cached or in flight. `fetchRaw` returns the body as fetched and
 * `gunzip` decodes it (split so the host can time each); a failed fetch is not cached (the rail retry asks again).
 */
export class ShareHost {
  private readonly entries = new Map<string, Entry>();
  private bytes = 0;
  readonly stats: ShareStats = { requests: 0, hits: 0, fetches: 0, errors: 0, hitBytes: 0, cachedBytes: 0, evicted: 0 };
  constructor(private readonly fetchRaw: RawFetch, private readonly gunzip: (raw: Uint8Array) => Promise<Uint8Array>, private readonly capBytes = SHARE_CACHE_MB * 1024 * 1024, private readonly now: () => number = () => performance.now()) {}

  /** The gunzipped bytes of `path` (shared: never mutate them; post a copy) and whether they came without a new fetch. */
  async get(path: string): Promise<{ bytes: Uint8Array; hit: boolean; netMs: number; gunzipMs: number }> {
    this.stats.requests++;
    const e = this.entries.get(path);
    if (e) {
      this.entries.delete(path); this.entries.set(path, e); // most recently used last
      const bytes = e.bytes ?? await e.loading!;
      this.stats.hits++; this.stats.hitBytes += bytes.byteLength;
      return { bytes, hit: true, netMs: e.netMs, gunzipMs: e.gunzipMs };
    }
    const entry: Entry = { netMs: 0, gunzipMs: 0 };
    this.stats.fetches++;
    entry.loading = (async () => {
      const t0 = this.now();
      const raw = await this.fetchRaw(path);
      const t1 = this.now();
      const bytes = await this.gunzip(raw);
      entry.netMs = t1 - t0; entry.gunzipMs = this.now() - t1;
      return bytes;
    })();
    this.entries.set(path, entry);
    try {
      const bytes = await entry.loading;
      entry.bytes = bytes; entry.loading = undefined;
      if (this.entries.get(path) === entry) { this.bytes += bytes.byteLength; this.trim(); }
      return { bytes, hit: false, netMs: entry.netMs, gunzipMs: entry.gunzipMs };
    } catch (error) {
      this.stats.errors++;
      if (this.entries.get(path) === entry) this.entries.delete(path);
      throw error;
    }
  }

  /** Drop the least recently used finished files until the cache fits its cap. */
  private trim(): void {
    for (const [path, e] of this.entries) {
      if (this.bytes <= this.capBytes) break;
      if (!e.bytes) continue;
      this.entries.delete(path);
      this.bytes -= e.bytes.byteLength;
      this.stats.evicted++;
    }
    this.stats.cachedBytes = this.bytes;
  }

  /** Answer one request on a port: a copy of the bytes, transferred. */
  answer(msg: ShareRequest, post: (reply: ShareReply, transfer: Transferable[]) => void): void {
    this.get(msg.path).then(({ bytes, hit, netMs, gunzipMs }) => {
      const copy = bytes.slice().buffer as ArrayBuffer;
      post({ type: 'got', id: msg.id, bytes: copy, hit, netMs: Math.round(netMs), gunzipMs: Math.round(gunzipMs) }, [copy]);
    }, error => post({ type: 'got', id: msg.id, error: String((error as Error)?.message ?? error), hit: false, netMs: 0, gunzipMs: 0 }, []));
  }
}

/** What a worker learns of each shared fetch (for its trace). */
export interface ShareOutcome { hit: boolean; netMs: number; gunzipMs: number }

/** Minimal MessagePort surface (tests pass a fake). */
export interface SharePort { postMessage(message: unknown): void; onmessage: ((event: { data: unknown }) => void) | null }

/**
 * The worker side: a fetch through the share host's port. Resolves with the gunzipped bytes and the outcome; rejects
 * with the host's error message (the same `${path}: ${status}` text a direct fetch throws).
 */
export function shareClient(port: SharePort): (path: string) => Promise<{ bytes: Uint8Array } & ShareOutcome> {
  let next = 0;
  const waiting = new Map<number, { resolve: (v: { bytes: Uint8Array } & ShareOutcome) => void; reject: (e: Error) => void }>();
  port.onmessage = event => {
    const r = event.data as ShareReply;
    if (!r || r.type !== 'got') return;
    const w = waiting.get(r.id);
    if (!w) return;
    waiting.delete(r.id);
    if (r.bytes) w.resolve({ bytes: new Uint8Array(r.bytes), hit: r.hit, netMs: r.netMs, gunzipMs: r.gunzipMs });
    else w.reject(new Error(r.error ?? 'share: no bytes'));
  };
  return path => new Promise((resolve, reject) => {
    const id = ++next;
    waiting.set(id, { resolve, reject });
    port.postMessage({ type: 'get', id, path } satisfies ShareRequest);
  });
}
