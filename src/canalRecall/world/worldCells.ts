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
  constructor(private readonly baseUrl: string, private readonly fetcher: typeof fetch = (...a) => fetch(...a)) {}

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
    while (this.cells.size > WORLD_CELL_CACHE) this.cells.delete(this.cells.keys().next().value as string);
    return hit;
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
type TileRequest = { kind: 'world-tile'; id: number; baseUrl: string; tile: string; cells: string[] };
type AbortRequest = { kind: 'world-abort'; id: number };
export type WorldRequest = TileRequest | AbortRequest;
/** A batch of a tile's buildings. Runtime cells: `raw` only (the feature is its own styled copy). DEBUG cells:
 *  `styled[i]` is the styled bag of `raw[i]` when it differs. */
type Batch = { kind: 'world-batch'; id: number; raw: WorldFeature[]; styled: (Props | null)[] };
type Done = { kind: 'world-done'; id: number; count: number; decodeMs: Record<string, number>; inflateMs: Record<string, number> };
type Failed = { kind: 'world-error'; id: number; message: string };
export type WorldReply = Batch | Done | Failed;
export const isWorldRequest = (data: unknown): data is WorldRequest => !!data && typeof data === 'object' && ((data as { kind?: unknown }).kind === 'world-tile' || (data as { kind?: unknown }).kind === 'world-abort');
export const isWorldReply = (data: unknown): data is WorldReply => !!data && typeof data === 'object' && typeof (data as { kind?: unknown }).kind === 'string' && String((data as { kind: string }).kind).startsWith('world-');

/** Worker side: answers `world-tile` requests from a reader whose cell cache lives in the worker. */
export class WorldCellWorkerHost {
  private reader: WorldCellReader | null = null;
  private readonly aborts = new Map<number, AbortController>();
  constructor(private readonly post: (reply: WorldReply) => void) {}
  handle(request: WorldRequest): void {
    if (request.kind === 'world-abort') { this.aborts.get(request.id)?.abort(); this.aborts.delete(request.id); return; }
    void this.answer(request);
  }
  private async answer({ id, baseUrl, tile, cells }: TileRequest): Promise<void> {
    const controller = new AbortController();
    this.aborts.set(id, controller);
    try {
      this.reader ??= new WorldCellReader(baseUrl);
      const { features, styled } = await this.reader.tile(tile, cells, controller.signal);
      if (controller.signal.aborted) return;
      for (let i = 0; i < features.length; i += WORLD_BATCH) {
        const raw = features.slice(i, i + WORLD_BATCH);
        this.post({ kind: 'world-batch', id, raw, styled: raw.map(f => { const s = styled.get(f); return s && s !== f ? s.properties : null; }) });
      }
      const pick = (m: Map<string, number>) => Object.fromEntries(cells.filter(k => m.has(k)).map(k => [k, m.get(k)!]));
      this.post({ kind: 'world-done', id, count: features.length, decodeMs: pick(this.reader.decodeMs), inflateMs: pick(this.reader.inflateMs) });
    } catch (error) {
      if (!controller.signal.aborted) this.post({ kind: 'world-error', id, message: error instanceof Error ? error.message : String(error) });
    } finally { this.aborts.delete(id); }
  }
}

/** The three.js building worker bundle next to this script, which also reads world cells. */
export const WORLD_WORKER_URL = typeof document !== 'undefined'
  ? ((document.currentScript as HTMLScriptElement | null)?.src ?? '').replace(/[\w-]+\.bundle\.js(\?.*)?$/, 'three-buildings-worker.bundle.js$1')
  : '';

export class WorldCellClient {
  private readonly reader: WorldCellReader;
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, { tile: string; raw: WorldFeature[]; styled: (Props | null)[]; resolve: (t: WorldTile) => void; reject: (e: Error) => void }>();
  /** Per cell, ms (diagnostics: the `?world=v1` decode table), from whichever thread decoded it. */
  readonly decodeMs = new Map<string, number>();
  readonly inflateMs = new Map<string, number>();
  /** Main-thread cost of the worker replies: messages received and the longest one (deserialise + collect), ms. */
  messages = 0;
  longestMessageMs = 0;
  /** Where cells are decoded: 'worker', or 'main' (no worker, `?worldWorker=0`, or the worker failed). */
  get decodeThread(): 'worker' | 'main' { return this.worker ? 'worker' : 'main'; }

  constructor(readonly index: WorldIndex, private readonly baseUrl: string, fetcher: typeof fetch = (...a) => fetch(...a), workerUrl: string = WORLD_WORKER_URL) {
    this.reader = new WorldCellReader(baseUrl, fetcher);
    let off = false;
    try { off = typeof location !== 'undefined' && new URLSearchParams(location.search).get('worldWorker') === '0'; } catch { /* no location */ }
    if (!off && workerUrl && typeof Worker !== 'undefined') {
      try {
        const worker = new Worker(workerUrl);
        worker.onmessage = event => {
          const t0 = performance.now(), data = event.data; // reading .data deserialises the batch: timed with it
          if (!isWorldReply(data)) return;
          this.receive(data);
          const ms = performance.now() - t0;
          this.messages++; if (ms > this.longestMessageMs) this.longestMessageMs = ms;
        };
        worker.onerror = error => { console.warn('world-v1 cell worker failed; decoding on the main thread', error); this.dropWorker(); };
        this.worker = worker;
      } catch (error) { console.warn('world-v1 cell worker unavailable; decoding on the main thread', error); }
    }
  }

  /** Absolute cell base for the worker (its own URL is the bundle's, not the page's). */
  private absoluteBase(): string {
    try { return new URL(this.baseUrl, typeof location !== 'undefined' ? location.href : undefined).href; } catch { return this.baseUrl; }
  }

  private receive(reply: WorldReply): void {
    const job = this.pending.get(reply.id);
    if (!job) return;
    if (reply.kind === 'world-batch') { for (const f of reply.raw) job.raw.push(f); for (const s of reply.styled) job.styled.push(s); return; }
    this.pending.delete(reply.id);
    if (reply.kind === 'world-error') { job.reject(Error(reply.message)); return; }
    for (const [k, v] of Object.entries(reply.decodeMs)) this.decodeMs.set(k, v);
    for (const [k, v] of Object.entries(reply.inflateMs)) this.inflateMs.set(k, v);
    if (job.raw.length !== reply.count) { job.reject(Error(`world tile ${job.tile}: ${job.raw.length} of ${reply.count} buildings arrived`)); return; }
    const styled = new Map<WorldFeature, WorldFeature>();
    job.raw.forEach((raw, i) => { const bag = job.styled[i]; styled.set(raw, bag ? { type: 'Feature', properties: bag, geometry: raw.geometry } : raw); });
    job.resolve({ features: job.raw, styled });
  }

  private dropWorker(): void {
    const worker = this.worker;
    this.worker = null;
    worker?.terminate();
    // Whatever was in flight there is redone here.
    for (const [id, job] of this.pending) { this.pending.delete(id); this.reader.tile(job.tile, this.index.tileCells[job.tile] ?? []).then(job.resolve, job.reject); }
  }

  /**
   * A z14 tile's buildings in the default path's adopted order, with the baked styled copy of each.
   * Empty when the index lists no cell for the tile (the tile 404s in the default path too).
   */
  async tile(tileKey: string, signal?: AbortSignal): Promise<WorldTile> {
    const keys = this.index.tileCells[tileKey] ?? [];
    if (!keys.length) return { features: [], styled: new Map() };
    const worker = this.worker;
    if (!worker) {
      const out = await this.reader.tile(tileKey, keys, signal);
      for (const k of keys) { const d = this.reader.decodeMs.get(k), i = this.reader.inflateMs.get(k); if (d !== undefined) this.decodeMs.set(k, d); if (i !== undefined) this.inflateMs.set(k, i); }
      return out;
    }
    const id = this.nextId++;
    return new Promise<WorldTile>((resolve, reject) => {
      if (signal?.aborted) { reject(new DOMException('aborted', 'AbortError')); return; }
      this.pending.set(id, { tile: tileKey, raw: [], styled: [], resolve, reject });
      signal?.addEventListener('abort', () => {
        if (!this.pending.delete(id)) return;
        this.worker?.postMessage({ kind: 'world-abort', id } satisfies WorldRequest);
        reject(new DOMException('aborted', 'AbortError'));
      }, { once: true });
      worker.postMessage({ kind: 'world-tile', id, baseUrl: this.absoluteBase(), tile: tileKey, cells: keys } satisfies WorldRequest);
    });
  }

  dispose(): void { this.worker?.terminate(); this.worker = null; }
}
