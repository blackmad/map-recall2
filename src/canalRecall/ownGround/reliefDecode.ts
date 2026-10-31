/**
 * Relief tiles for the own ground's main-thread surface (poses, building bases, overlays), fetched and decoded in
 * the page's worker pool (engine/workerPool.ts) instead of a second instance of the own-ground worker (lane L4).
 *
 * Request: { type: 'relief', id, url, index, entry }   Reply: { type: 'relief', id, heights?: Float32Array
 * (transferred), bytes?, error? }. Ids are drawn from one page-wide counter, so pool subscribers never collide.
 */
import { readGroundTile, type GroundIndex } from './heightField.js';
import type { ReliefTileLoader } from './groundStore.js';
import type { WorkerPool } from '../engine/workerPool.js';

export type ReliefRequest = { type: 'relief'; id: number; url: string; index: Pick<GroundIndex, 'stepM' | 'tileSizeM' | 'samples' | 'predictor'>; entry: number[] };
export type ReliefReply = { type: 'relief'; id: number; heights?: Float32Array; bytes?: number; error?: string };
export const isReliefRequest = (data: unknown): data is ReliefRequest => !!data && typeof data === 'object' && (data as { type?: unknown }).type === 'relief' && typeof (data as { url?: unknown }).url === 'string';
const isReliefReply = (data: unknown): data is ReliefReply => !!data && typeof data === 'object' && (data as { type?: unknown }).type === 'relief' && typeof (data as { url?: unknown }).url !== 'string';

async function gunzipMaybe(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Worker side: fetch + gunzip + decode one tile, independent of any build queue. */
export function answerRelief(msg: ReliefRequest, post: (reply: ReliefReply, transfer: Transferable[]) => void): void {
  fetch(msg.url).then(async r => {
    if (!r.ok) throw new Error(`${msg.url}: ${r.status}`);
    const bytes = await gunzipMaybe(new Uint8Array(await r.arrayBuffer()));
    const heights = readGroundTile(msg.index, msg.entry, bytes);
    post({ type: 'relief', id: msg.id, heights, bytes: bytes.byteLength }, [heights.buffer as ArrayBuffer]);
  }).catch(error => post({ type: 'relief', id: msg.id, error: String((error as Error)?.message ?? error) }, []));
}

const ID_KEY = '__canalRecallReliefIds';
const nextId = (): number => {
  const g = globalThis as unknown as Record<string, number>;
  return g[ID_KEY] = (g[ID_KEY] ?? 0) + 1;
};

/** Main side: a relief loader over the pool, spread round-robin; null without a live pool. Returns the loader and its disposer. */
export function poolReliefLoader(pool: WorkerPool | null, root: string): { loader: ReliefTileLoader; dispose: () => void } | null {
  if (!pool?.live) return null;
  const waiting = new Map<number, { resolve: (v: { heights: Float32Array; bytes: number }) => void; reject: (e: Error) => void; worker: number }>();
  let turn = 0;
  const unsubscribe = pool.subscribe(data => {
    if (!isReliefReply(data)) return false;
    const w = waiting.get(data.id);
    if (!w) return false; // another loader's reply
    waiting.delete(data.id);
    if (data.heights) w.resolve({ heights: data.heights, bytes: data.bytes ?? 0 });
    else w.reject(new Error(data.error ?? 'relief tile failed'));
    return true;
  }, worker => {
    for (const [id, w] of waiting) if (w.worker === worker) { waiting.delete(id); w.reject(new Error(`relief: pool worker ${worker} failed`)); }
  });
  const loader: ReliefTileLoader = (path, index, entry) => new Promise((resolve, reject) => {
    let worker = -1;
    for (let i = 0; i < pool.size && worker < 0; i++) { const w = (turn + i) % pool.size; if (pool.alive(w)) worker = w; }
    if (worker < 0) { reject(new Error('relief: no live pool worker')); return; }
    turn = worker + 1;
    const id = nextId();
    waiting.set(id, { resolve, reject, worker });
    pool.post(worker, { type: 'relief', id, url: `${root}/${path}`, index: { stepM: index.stepM, tileSizeM: index.tileSizeM, samples: index.samples, predictor: index.predictor }, entry: [...entry] } satisfies ReliefRequest);
  });
  return { loader, dispose: () => { unsubscribe(); for (const w of waiting.values()) w.reject(new Error('own ground disposed')); waiting.clear(); } };
}
