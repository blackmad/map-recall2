// The own-ground chunk worker: builds streamed ground cells off the main
// thread (all ground modules are DOM-free). Bundled as
// public/canal-drive/js/own-ground-worker.bundle.js (scripts/build-3d-bundles.mjs).
//
// Messages in:  { type: 'init', root, parks, roads, groundLook, compact }  extract root URL (absolute); parks: load parks-v1; roads: load roads-v1; far-ring palette;
//                                                           compact: send compact meshes (compactMesh.ts, phones)
//               { type: 'build', key, lod, gen }  build one cell
//               { type: 'far', key, gen }         build one far block (farRing.ts)
//               { type: 'evict', x, y, keepM, keep: string[] }
//               { type: 'order', keys: string[] }  wanted cells, best first: queued cells build in this order and
//                                                  cells not in it are dropped unbuilt (buildQueue.ts)
//               { type: 'relief', id, url, index, entry }  fetch + decode one relief tile (no init needed; the
//                                                          game's main-thread store uses a second instance for this)
// Messages out: { type: 'ready', cells: string[] }
//               { type: 'cell', gen, cell: BuiltCell }   (arrays transferred)
//               { type: 'far', gen, key, far: BuiltFar | null }   (arrays transferred; null: nothing there)
//               { type: 'error', key?, gen?, message }
//               { type: 'relief', id, heights?: Float32Array (transferred), bytes?, error? }

import { GroundStore, httpFetchBytes, maybeGunzip } from './groundStore.js';
import { readGroundTile, type GroundIndex } from './heightField.js';
import { buildCell, cellTransferables } from './groundCell.js';
import { buildFarBlock, farColours, farTransferables, type FarColours } from './farRing.js';
import { groundPalette, type GroundLook } from './groundLook.js';
import { GroundBuildQueue } from './buildQueue.js';
import { cellGpuTransferables, compactCell, compactFar, farGpuTransferables } from './compactMesh.js';

type In =
  | { type: 'init'; root: string; parks?: boolean; roads?: boolean; groundLook?: GroundLook; compact?: boolean }
  | { type: 'build'; key: string; lod: 0 | 1; gen: number }
  | { type: 'far'; key: string; gen: number }
  | { type: 'evict'; x: number; y: number; keepM: number; keep: string[] }
  | { type: 'order'; keys: string[] }
  | { type: 'relief'; id: number; url: string; index: Pick<GroundIndex, 'stepM' | 'tileSizeM' | 'samples' | 'predictor'>; entry: number[] };

const ctx = self as unknown as { postMessage(message: unknown, transfer?: Transferable[]): void; onmessage: ((event: MessageEvent<In>) => void) | null };
let store: GroundStore | null = null;
let ready: Promise<void> | null = null;
let colours: FarColours | undefined;
let compact = false;
// One build at a time: cells are big and the order matters (nearest ahead first, buildQueue.ts).
const queue = new GroundBuildQueue();
const evictions: Array<() => void> = [];
let running = false;

async function pump(s: GroundStore): Promise<void> {
  if (running) return;
  running = true;
  try {
    await ready;
    for (;;) {
      for (const evict of evictions.splice(0)) evict();
      const job = queue.next();
      if (!job) break;
      if (job.kind === 'cell') {
        try {
          const input = await s.cellInput(job.key, job.lod);
          const built = buildCell(input), cell = compact ? compactCell(built) : built;
          ctx.postMessage({ type: 'cell', gen: job.gen, cell }, compact ? cellGpuTransferables(cell) : cellTransferables(cell));
        } catch (error) {
          ctx.postMessage({ type: 'error', key: job.key, gen: job.gen, message: String((error as Error)?.stack ?? error) });
        }
      } else {
        try {
          const input = await s.farInput(job.key);
          const built = input ? buildFarBlock(input, colours) : null, far = built && compact ? compactFar(built) : built;
          ctx.postMessage({ type: 'far', gen: job.gen, key: job.key, far }, far ? (compact ? farGpuTransferables(far) : farTransferables(far)) : []);
        } catch (error) {
          ctx.postMessage({ type: 'error', far: job.key, gen: job.gen, message: String((error as Error)?.stack ?? error) });
        }
      }
    }
  } finally {
    running = false;
  }
}

ctx.onmessage = event => {
  const msg = event.data;
  if (msg.type === 'init') {
    store = new GroundStore(httpFetchBytes(msg.root), { parks: msg.parks !== false, roads: msg.roads === true });
    compact = msg.compact === true;
    colours = msg.groundLook && msg.groundLook !== 'default' ? farColours(groundPalette(msg.groundLook)) : undefined;
    ready = store.init().then(() => ctx.postMessage({ type: 'ready', cells: [...store!.osmCells] }))
      .catch(error => ctx.postMessage({ type: 'error', message: `init: ${String(error?.message ?? error)}` }));
    return;
  }
  if (msg.type === 'relief') {
    // Independent of the build queue: a relief tile must not wait behind a 400 ms cell build.
    fetch(msg.url).then(async r => {
      if (!r.ok) throw new Error(`${msg.url}: ${r.status}`);
      const bytes = await maybeGunzip(new Uint8Array(await r.arrayBuffer()));
      const heights = readGroundTile(msg.index, msg.entry, bytes);
      ctx.postMessage({ type: 'relief', id: msg.id, heights, bytes: bytes.byteLength }, [heights.buffer]);
    }).catch(error => ctx.postMessage({ type: 'relief', id: msg.id, error: String((error as Error)?.message ?? error) }));
    return;
  }
  if (!store || !ready) return;
  const s = store;
  if (msg.type === 'build') { queue.build(msg.key, msg.lod, msg.gen); void pump(s); return; }
  if (msg.type === 'far') { queue.requestFar(msg.key, msg.gen); void pump(s); return; }
  if (msg.type === 'order') { queue.order(msg.keys); return; }
  if (msg.type === 'evict') {
    // Between builds, never under one (a build reads the relief it is evicting).
    evictions.push(() => { s.evictRelief(msg.x, msg.y, msg.keepM); s.forgetCells(new Set(msg.keep)); });
    void pump(s);
  }
};
