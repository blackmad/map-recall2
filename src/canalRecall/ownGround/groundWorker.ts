// The own-ground chunk worker: builds streamed ground cells off the main
// thread (all ground modules are DOM-free). Bundled as
// public/canal-drive/js/own-ground-worker.bundle.js (scripts/build-3d-bundles.mjs).
//
// Messages in:  { type: 'init', root, parks, roads, groundLook }  extract root URL (absolute); parks: load parks-v1; roads: load roads-v1; far-ring palette
//               { type: 'build', key, lod, gen }  build one cell
//               { type: 'far', key, gen }         build one far block (farRing.ts)
//               { type: 'evict', x, y, keepM, keep: string[] }
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

type In =
  | { type: 'init'; root: string; parks?: boolean; roads?: boolean; groundLook?: GroundLook }
  | { type: 'build'; key: string; lod: 0 | 1; gen: number }
  | { type: 'far'; key: string; gen: number }
  | { type: 'evict'; x: number; y: number; keepM: number; keep: string[] }
  | { type: 'relief'; id: number; url: string; index: Pick<GroundIndex, 'stepM' | 'tileSizeM' | 'samples' | 'predictor'>; entry: number[] };

const ctx = self as unknown as { postMessage(message: unknown, transfer?: Transferable[]): void; onmessage: ((event: MessageEvent<In>) => void) | null };
let store: GroundStore | null = null;
let ready: Promise<void> | null = null;
let colours: FarColours | undefined;
// One build at a time: cells are big and the queue order (nearest first) matters.
let chain: Promise<void> = Promise.resolve();

ctx.onmessage = event => {
  const msg = event.data;
  if (msg.type === 'init') {
    store = new GroundStore(httpFetchBytes(msg.root), { parks: msg.parks !== false, roads: msg.roads === true });
    colours = msg.groundLook && msg.groundLook !== 'default' ? farColours(groundPalette(msg.groundLook)) : undefined;
    ready = store.init().then(() => ctx.postMessage({ type: 'ready', cells: [...store!.osmCells] }))
      .catch(error => ctx.postMessage({ type: 'error', message: `init: ${String(error?.message ?? error)}` }));
    return;
  }
  if (msg.type === 'relief') {
    // Independent of the build chain: a relief tile must not wait behind a 400 ms cell build.
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
  if (msg.type === 'build') {
    chain = chain.then(() => ready).then(async () => {
      try {
        const input = await s.cellInput(msg.key, msg.lod);
        const cell = buildCell(input);
        ctx.postMessage({ type: 'cell', gen: msg.gen, cell }, cellTransferables(cell));
      } catch (error) {
        ctx.postMessage({ type: 'error', key: msg.key, gen: msg.gen, message: String((error as Error)?.stack ?? error) });
      }
    });
    return;
  }
  if (msg.type === 'far') {
    chain = chain.then(() => ready).then(async () => {
      try {
        const input = await s.farInput(msg.key);
        const far = input ? buildFarBlock(input, colours) : null;
        ctx.postMessage({ type: 'far', gen: msg.gen, key: msg.key, far }, far ? farTransferables(far) : []);
      } catch (error) {
        ctx.postMessage({ type: 'error', far: msg.key, gen: msg.gen, message: String((error as Error)?.stack ?? error) });
      }
    });
    return;
  }
  if (msg.type === 'evict') {
    chain = chain.then(() => { s.evictRelief(msg.x, msg.y, msg.keepM); s.forgetCells(new Set(msg.keep)); });
  }
};
