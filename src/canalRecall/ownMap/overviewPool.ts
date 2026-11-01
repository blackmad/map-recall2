// The overview's geometry built in the worker pool (#129: the own engine's boot built it on the main thread, 184 ms
// of boot -> submit). The main thread fetches overview.json.gz once and hands the pool a copy of the bytes; the worker
// decodes them and builds every geometry (overviewArrays.ts buildOverview) while the main thread decodes its own copy
// for the water index and the labels. The geometry comes back as transferred buffers.
import { decodeOverview, type OverviewFile } from './overviewFormat';
import { buildOverview, overviewTransferables, type BuiltOverviewGeometry } from './overviewArrays';

export type OverviewRequest = { type: 'overview'; id: number; bytes: ArrayBuffer; tiles: number; tileMin: number };
export type OverviewReply = { type: 'overview'; id: number; built?: BuiltOverviewGeometry[]; error?: string };

export const isOverviewRequest = (m: unknown): m is OverviewRequest => (m as { type?: string } | null)?.type === 'overview' && (m as { bytes?: unknown }).bytes instanceof ArrayBuffer;

/** overview.json(.gz) bytes → the file's text (gzip by its magic bytes). */
export async function overviewText(b: Uint8Array): Promise<string> {
  return b[0] === 0x1f && b[1] === 0x8b
    ? await new Response(new Blob([b as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(b);
}

/** Worker side: decode the bytes, build every geometry, reply with the buffers transferred. */
export async function answerOverview(msg: OverviewRequest, post: (reply: OverviewReply, transfer: Transferable[]) => void): Promise<void> {
  try {
    const data = decodeOverview(JSON.parse(await overviewText(new Uint8Array(msg.bytes))) as OverviewFile);
    const built = buildOverview(data, msg.tiles, msg.tileMin);
    post({ type: 'overview', id: msg.id, built }, overviewTransferables(built));
  } catch (error) {
    post({ type: 'overview', id: msg.id, error: String((error as Error)?.message ?? error) }, []);
  }
}

type PoolLike = { size: number; alive(worker: number): boolean; post(worker: number, message: unknown, transfer?: Transferable[]): boolean; subscribe(on: (data: unknown, worker: number) => boolean, fail?: (worker: number, error: unknown) => void): () => void };

let nextId = 1;
/**
 * Main side: the geometry built by one pool worker from a copy of `bytes`, or null (no live worker, the worker failed
 * or answered with an error: the caller builds on the main thread as before).
 */
export function overviewFromPool(pool: PoolLike | null, bytes: Uint8Array, tiles: number, tileMin: number): Promise<BuiltOverviewGeometry[] | null> {
  if (!pool) return Promise.resolve(null);
  let worker = -1;
  for (let w = 0; w < pool.size && worker < 0; w++) if (pool.alive(w)) worker = w;
  if (worker < 0) return Promise.resolve(null);
  const id = nextId++, copy = bytes.slice().buffer as ArrayBuffer;
  return new Promise(resolve => {
    const off = pool.subscribe((data, w) => {
      const r = data as OverviewReply;
      if (r?.type !== 'overview' || r.id !== id) return false;
      off(); resolve(r.built ?? null);
      return true;
    }, w => { if (w === worker) { off(); resolve(null); } });
    let posted = false;
    try { posted = pool.post(worker, { type: 'overview', id, bytes: copy, tiles, tileMin } satisfies OverviewRequest, [copy]); } catch { posted = false; }
    if (!posted) { off(); resolve(null); }
  });
}
