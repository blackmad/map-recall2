/**
 * Browser/worker client for `world-v1` (behind `?world=v1`). v1 is tile-preserving: the streamer still
 * plans z14 tiles exactly as the default path does, and asks this client for a tile's buildings, which it
 * assembles from the cells that hold them (index.json `tileCells`), in the tile's own order (`ordinal`).
 * So the resident set, its order, the chunk groups and their context are the default path's, and the
 * chunk arrays are identical; what goes away is the GeoJSON parse, the clones, dropNestedDuplicates, the
 * facts/roof-facts tile fetches and the decorator chain on the main thread.
 *
 * Off the main thread (lane L4, 2026-10-30): with a worker (`WorldCellWorkerHost` in the three.js building
 * worker), the fetch, the gzip inflate, the decode and the decoded-cell cache live in the worker, and the main
 * thread receives a tile's styled features in batches of `WORLD_BATCH` buildings, each its own small task,
 * so no cell is ever one long main-thread task. Without a worker (Node, a worker that failed) it all runs here.
 */
import { decodeCell, inflateCell, rawFeature, styledFeature, WORLD_FORMAT_VERSION, type Cell, type Props, type Geometry } from './cellFormat.js';
import { CellQueue, affinity, poolSize, rankCells } from '../engine/worldStreamer.js';
import type { LngLat } from '../streamingLookAhead.js';

export type WorldIndex = { version: 1; format: number; compiler: string; tileCells: Record<string, string[]>; cells: Record<string, { gzBytes: number; buildings: number; sha256: string }> };
export type WorldFeature = { type: 'Feature'; properties: Props; geometry: Geometry };
export type WorldTile = { features: WorldFeature[]; styled: Map<WorldFeature, WorldFeature> };

export function worldV1Enabled(search: string = typeof location !== 'undefined' ? location.search : ''): boolean {
  try { return new URLSearchParams(search).get('world') === 'v1'; } catch { return false; }
}

/** Parse and check index.json; null when it is not a world-v1 index (a host answering with the app page). */
export function readWorldIndex(value: unknown): WorldIndex | null {
  const v = value as Partial<WorldIndex> | null;
  if (!v || v.version !== 1 || v.format !== WORLD_FORMAT_VERSION || !v.tileCells || typeof v.tileCells !== 'object' || !v.cells || typeof v.cells !== 'object') return null;
  return v as WorldIndex;
}

/** Decoded cells kept for neighbouring tiles; a z14 tile spans ~2x2 cells, and the streamer holds 9-12 tiles. */
export const WORLD_CELL_CACHE = 24;
/** Decoded cells per worker when a pool shares them by affinity (engine/worldStreamer.ts): the pool holds about 36. */
export const worldCellCachePerWorker = (workers: number): number => Math.max(8, Math.ceil(36 / Math.max(1, workers)));
/** Buildings per worker message: a batch is one main-thread task (structured-clone deserialise + adopt). */
export const WORLD_BATCH = 400;

/** Fetch + inflate + decode with an LRU of decoded cells; runs in the worker or, as a fallback, on the main thread. */
export class WorldCellReader {
  private readonly cells = new Map<string, Promise<Cell>>();
  /** Per cell, ms: `decodeMs` is the synchronous decode (one task in whichever thread runs it); `inflateMs` is the
   *  wall time of the gzip inflate, which awaits a stream and so also counts whatever else ran meanwhile (the 1.2 s
   *  "decodes" of the first A/B, 2026-10-30, were this wall time during page start, not decode work). */
  readonly decodeMs = new Map<string, number>();
  readonly inflateMs = new Map<string, number>();
  constructor(private readonly baseUrl: string, private readonly fetcher: typeof fetch = (...a) => fetch(...a), private readonly capacity = WORLD_CELL_CACHE) {}

  cell(key: string, signal?: AbortSignal): Promise<Cell> {
    let hit = this.cells.get(key);
    if (hit) { this.cells.delete(key); this.cells.set(key, hit); return hit; }
    hit = (async () => {
      const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, '')}/world-v1/cells/${key}.bin`, { signal });
      if (!response.ok) throw Error(`world cell ${key}: HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const t0 = performance.now();
      const inflated = await inflateCell(bytes);
      const t1 = performance.now();
      const cell = decodeCell(inflated, `world cell ${key}`);
      this.inflateMs.set(key, t1 - t0);
      this.decodeMs.set(key, performance.now() - t1);
      return cell;
    })();
    // A failed or aborted fetch must not stay cached.
    hit.catch(() => { if (this.cells.get(key) === hit) this.cells.delete(key); });
    this.cells.set(key, hit);
    while (this.cells.size > this.capacity) this.cells.delete(this.cells.keys().next().value as string);
    return hit;
  }

  /** Give decoded cells back (the streamer's residency budget). */
  evict(keys: readonly string[]): void { for (const k of keys) this.cells.delete(k); }
  get residentCells(): number { return this.cells.size; }

  /** One cell's buildings of one tile, with their ordinals in the tile (a worker's share of a tile). */
  async cellTile(cellKey: string, tileKey: string, signal?: AbortSignal): Promise<{ ordinals: number[]; raw: WorldFeature[]; styled: (Props | null)[] }> {
    const cell = await this.cell(cellKey, signal), ordinals: number[] = [], raw: WorldFeature[] = [], styled: (Props | null)[] = [];
    for (const b of cell.buildings) {
      if (b.tile !== tileKey) continue;
      const r = rawFeature(b), st = styledFeature(b, r);
      ordinals.push(b.ordinal); raw.push(r); styled.push(st !== r ? st.properties : null);
    }
    return { ordinals, raw, styled };
  }

  /** A z14 tile's buildings from these cells, in the default path's adopted order, with the baked styled copy of each. */
  async tile(tileKey: string, keys: readonly string[], signal?: AbortSignal): Promise<WorldTile> {
    const cells = await Promise.all(keys.map(k => this.cell(k, signal)));
    const picked: { ordinal: number; raw: WorldFeature; styled: WorldFeature }[] = [];
    for (const cell of cells) for (const b of cell.buildings) {
      if (b.tile !== tileKey) continue;
      const raw = rawFeature(b);
      picked.push({ ordinal: b.ordinal, raw, styled: styledFeature(b, raw) });
    }
    picked.sort((a, b) => a.ordinal - b.ordinal);
    for (let i = 1; i < picked.length; i++) if (picked[i].ordinal === picked[i - 1].ordinal) throw Error(`world tile ${tileKey}: ordinal ${picked[i].ordinal} twice`);
    const styled = new Map<WorldFeature, WorldFeature>();
    for (const p of picked) styled.set(p.raw, p.styled);
    return { features: picked.map(p => p.raw), styled };
  }
}

// --- worker protocol -----------------------------------------------------------------------------------------
// The main thread asks a worker for one cell's share of one tile (`tile` set), or to read a cell ahead of need
// (`tile` null: prefetch, the streamer's queue), or to drop cells (`world-evict`). A tile spread over several
// cells is read by several workers at once and merged here by ordinal.
type CellRequest = { kind: 'world-cell'; id: number; baseUrl: string; cell: string; tile: string | null; cache: number };
type AbortRequest = { kind: 'world-abort'; id: number };
type EvictRequest = { kind: 'world-evict'; cells: string[] };
export type WorldRequest = CellRequest | AbortRequest | EvictRequest;
/** A batch of one cell's share of a tile. Runtime cells: `styled[i]` null (the feature is its own styled copy). */
type Batch = { kind: 'world-batch'; id: number; ordinals: number[]; raw: WorldFeature[]; styled: (Props | null)[] };
type Done = { kind: 'world-done'; id: number; count: number; decodeMs: Record<string, number>; inflateMs: Record<string, number> };
type Failed = { kind: 'world-error'; id: number; message: string };
export type WorldReply = Batch | Done | Failed;
const REQUEST_KINDS = new Set(['world-cell', 'world-abort', 'world-evict']);
export const isWorldRequest = (data: unknown): data is WorldRequest => !!data && typeof data === 'object' && REQUEST_KINDS.has(String((data as { kind?: unknown }).kind));
export const isWorldReply = (data: unknown): data is WorldReply => !!data && typeof data === 'object' && typeof (data as { kind?: unknown }).kind === 'string' && String((data as { kind: string }).kind).startsWith('world-');

/** Worker side: answers cell requests from a reader whose decoded-cell cache lives in the worker. */
export class WorldCellWorkerHost {
  private reader: WorldCellReader | null = null;
  private readonly aborts = new Map<number, AbortController>();
  constructor(private readonly post: (reply: WorldReply) => void) {}
  handle(request: WorldRequest): void {
    if (request.kind === 'world-abort') { this.aborts.get(request.id)?.abort(); this.aborts.delete(request.id); return; }
    if (request.kind === 'world-evict') { this.reader?.evict(request.cells); return; }
    void this.answer(request);
  }
  private async answer({ id, baseUrl, cell, tile, cache }: CellRequest): Promise<void> {
    const controller = new AbortController();
    this.aborts.set(id, controller);
    try {
      this.reader ??= new WorldCellReader(baseUrl, undefined, cache);
      let count = 0;
      if (tile === null) await this.reader.cell(cell, controller.signal);
      else {
        const share = await this.reader.cellTile(cell, tile, controller.signal);
        if (controller.signal.aborted) return;
        count = share.raw.length;
        for (let i = 0; i < count; i += WORLD_BATCH) this.post({ kind: 'world-batch', id, ordinals: share.ordinals.slice(i, i + WORLD_BATCH), raw: share.raw.slice(i, i + WORLD_BATCH), styled: share.styled.slice(i, i + WORLD_BATCH) });
      }
      if (controller.signal.aborted) return;
      const d = this.reader.decodeMs.get(cell), f = this.reader.inflateMs.get(cell);
      this.post({ kind: 'world-done', id, count, decodeMs: d === undefined ? {} : { [cell]: d }, inflateMs: f === undefined ? {} : { [cell]: f } });
    } catch (error) {
      if (!controller.signal.aborted) this.post({ kind: 'world-error', id, message: error instanceof Error ? error.message : String(error) });
    } finally { this.aborts.delete(id); }
  }
}

/** The three.js building worker bundle next to this script, which also reads world cells. */
export const WORLD_WORKER_URL = typeof document !== 'undefined'
  ? ((document.currentScript as HTMLScriptElement | null)?.src ?? '').replace(/[\w-]+\.bundle\.js(\?.*)?$/, 'three-buildings-worker.bundle.js$1')
  : '';

type Share = { ordinals: number[]; raw: WorldFeature[]; styled: (Props | null)[] };
type Pending = { cell: string; tile: string | null; worker: number; share: Share; resolve: (s: Share) => void; reject: (e: Error) => void };

/** Resident decoded cells kept across the pool (the streamer evicts above this, off-plan and furthest first). */
export const WORLD_RESIDENT_CELLS = 36;

export class WorldCellClient {
  private readonly reader: WorldCellReader;
  private workers: Worker[] = [];
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  /** The one cell queue (engine/worldStreamer.ts): cells the planned tiles need, read ahead in rank order. */
  readonly queue: CellQueue;
  /** Per cell, ms (diagnostics: the `?world=v1` decode table), from whichever thread decoded it. */
  readonly decodeMs = new Map<string, number>();
  readonly inflateMs = new Map<string, number>();
  /** Main-thread cost of the worker replies: messages received and the longest one (deserialise + collect), ms. */
  messages = 0;
  longestMessageMs = 0;
  /** Where cells are decoded: 'worker', or 'main' (no worker, `?worldWorker=0`, or the workers failed). */
  get decodeThread(): 'worker' | 'main' { return this.workers.length ? 'worker' : 'main'; }
  get workerCount(): number { return this.workers.length; }

  constructor(readonly index: WorldIndex, private readonly baseUrl: string, fetcher: typeof fetch = (...a) => fetch(...a), workerUrl: string = WORLD_WORKER_URL, workers = poolSize()) {
    this.reader = new WorldCellReader(baseUrl, fetcher);
    let off = false;
    try { off = typeof location !== 'undefined' && new URLSearchParams(location.search).get('worldWorker') === '0'; } catch { /* no location */ }
    if (!off && workerUrl && typeof Worker !== 'undefined') {
      try {
        for (let w = 0; w < workers; w++) {
          const worker = new Worker(workerUrl);
          worker.onmessage = event => {
            const t0 = performance.now(), data = event.data; // reading .data deserialises the batch: timed with it
            if (!isWorldReply(data)) return;
            this.receive(data);
            const ms = performance.now() - t0;
            this.messages++; if (ms > this.longestMessageMs) this.longestMessageMs = ms;
          };
          worker.onerror = error => { console.warn('world-v1 cell worker failed; decoding on the main thread', error); this.dropWorkers(); };
          this.workers.push(worker);
        }
      } catch (error) { console.warn('world-v1 cell workers unavailable; decoding on the main thread', error); this.dropWorkers(); }
    }
    this.queue = new CellQueue(key => this.read(key, null).then(() => undefined), Math.max(2, this.workers.length * 2));
  }

  /** Absolute cell base for the workers (their own URL is the bundle's, not the page's). */
  private absoluteBase(): string {
    try { return new URL(this.baseUrl, typeof location !== 'undefined' ? location.href : undefined).href; } catch { return this.baseUrl; }
  }

  private receive(reply: WorldReply): void {
    const job = this.pending.get(reply.id);
    if (!job) return;
    if (reply.kind === 'world-batch') { job.share.ordinals.push(...reply.ordinals); for (const f of reply.raw) job.share.raw.push(f); for (const s of reply.styled) job.share.styled.push(s); return; }
    this.pending.delete(reply.id);
    if (reply.kind === 'world-error') { job.reject(Error(reply.message)); return; }
    for (const [k, v] of Object.entries(reply.decodeMs)) this.decodeMs.set(k, v);
    for (const [k, v] of Object.entries(reply.inflateMs)) this.inflateMs.set(k, v);
    if (job.share.raw.length !== reply.count) { job.reject(Error(`world cell ${job.cell}: ${job.share.raw.length} of ${reply.count} buildings arrived`)); return; }
    job.resolve(job.share);
  }

  private dropWorkers(): void {
    const workers = this.workers;
    this.workers = [];
    for (const w of workers) w.terminate();
    // Whatever was in flight there is redone here.
    for (const [id, job] of this.pending) {
      this.pending.delete(id);
      (job.tile === null ? this.reader.cell(job.cell).then(() => ({ ordinals: [], raw: [], styled: [] })) : this.reader.cellTile(job.cell, job.tile)).then(job.resolve, job.reject);
    }
  }

  /** One cell's share of a tile (or, with `tile` null, just the cell read into its worker's cache). */
  private read(cell: string, tile: string | null, signal?: AbortSignal): Promise<Share> {
    if (!this.workers.length) {
      return (tile === null ? this.reader.cell(cell, signal).then(() => ({ ordinals: [], raw: [], styled: [] })) : this.reader.cellTile(cell, tile, signal)).then(share => {
        const d = this.reader.decodeMs.get(cell), f = this.reader.inflateMs.get(cell);
        if (d !== undefined) this.decodeMs.set(cell, d); if (f !== undefined) this.inflateMs.set(cell, f);
        return share;
      });
    }
    const id = this.nextId++, w = affinity(cell, this.workers.length), worker = this.workers[w];
    return new Promise<Share>((resolve, reject) => {
      if (signal?.aborted) { reject(new DOMException('aborted', 'AbortError')); return; }
      this.pending.set(id, { cell, tile, worker: w, share: { ordinals: [], raw: [], styled: [] }, resolve, reject });
      signal?.addEventListener('abort', () => {
        if (!this.pending.delete(id)) return;
        this.workers[w]?.postMessage({ kind: 'world-abort', id } satisfies WorldRequest);
        reject(new DOMException('aborted', 'AbortError'));
      }, { once: true });
      worker.postMessage({ kind: 'world-cell', id, baseUrl: this.absoluteBase(), cell, tile, cache: worldCellCachePerWorker(this.workers.length) } satisfies WorldRequest);
    });
  }

  /**
   * The streamer's plan: `tiles` in priority order (view, then look-ahead). Their cells are read ahead, in that
   * order, ranked by `aheadRank` from `rider` within it; resident cells above the budget that the plan no longer
   * needs are evicted, furthest first.
   */
  plan(tiles: readonly string[], rider: LngLat | null, direction: readonly [number, number] | null): void {
    const planned: string[] = [];
    for (const t of tiles) for (const c of this.index.tileCells[t] ?? []) planned.push(c);
    const ranked = rankCells(planned, rider, direction);
    this.queue.want(ranked);
    const evict = this.queue.evictions(WORLD_RESIDENT_CELLS, rider, key => ranked.has(key));
    if (!evict.length) return;
    for (const k of evict) this.queue.forget(k);
    if (this.workers.length) {
      const byWorker = new Map<number, string[]>();
      for (const k of evict) { const w = affinity(k, this.workers.length); let l = byWorker.get(w); if (!l) byWorker.set(w, l = []); l.push(k); }
      for (const [w, cells] of byWorker) this.workers[w].postMessage({ kind: 'world-evict', cells } satisfies WorldRequest);
    } else this.reader.evict(evict);
  }

  /**
   * A z14 tile's buildings in the default path's adopted order, with the baked styled copy of each.
   * Empty when the index lists no cell for the tile (the tile 404s in the default path too).
   */
  async tile(tileKey: string, signal?: AbortSignal): Promise<WorldTile> {
    const keys = this.index.tileCells[tileKey] ?? [];
    if (!keys.length) return { features: [], styled: new Map() };
    if (!this.workers.length) {
      const out = await this.reader.tile(tileKey, keys, signal);
      for (const k of keys) { const d = this.reader.decodeMs.get(k), i = this.reader.inflateMs.get(k); if (d !== undefined) this.decodeMs.set(k, d); if (i !== undefined) this.inflateMs.set(k, i); this.queue.noteResident(k); }
      return out;
    }
    const shares = await Promise.all(keys.map(k => this.read(k, tileKey, signal)));
    for (const k of keys) this.queue.noteResident(k);
    const picked: { ordinal: number; raw: WorldFeature; styled: Props | null }[] = [];
    for (const s of shares) s.raw.forEach((raw, i) => picked.push({ ordinal: s.ordinals[i], raw, styled: s.styled[i] }));
    picked.sort((a, b) => a.ordinal - b.ordinal);
    for (let i = 1; i < picked.length; i++) if (picked[i].ordinal === picked[i - 1].ordinal) throw Error(`world tile ${tileKey}: ordinal ${picked[i].ordinal} twice`);
    const styled = new Map<WorldFeature, WorldFeature>();
    for (const p of picked) styled.set(p.raw, p.styled ? { type: 'Feature', properties: p.styled, geometry: p.raw.geometry } : p.raw);
    return { features: picked.map(p => p.raw), styled };
  }

  dispose(): void { for (const w of this.workers) w.terminate(); this.workers = []; }
}
