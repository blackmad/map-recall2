// The own-ground chunk worker: builds streamed ground cells off the main
// thread (all ground modules are DOM-free). Bundled as
// public/canal-drive/js/own-ground-worker.bundle.js (scripts/build-3d-bundles.mjs).
//
// Messages in:  { type: 'init', root }            extract root URL (absolute)
//               { type: 'build', key, lod, gen }  build one cell
//               { type: 'evict', x, y, keepM, keep: string[] }
// Messages out: { type: 'ready', cells: string[] }
//               { type: 'cell', gen, cell: BuiltCell }   (arrays transferred)
//               { type: 'error', key?, gen?, message }

import { GroundStore, httpFetchBytes } from './groundStore.js';
import { buildCell, cellTransferables } from './groundCell.js';

type In =
  | { type: 'init'; root: string }
  | { type: 'build'; key: string; lod: 0 | 1; gen: number }
  | { type: 'evict'; x: number; y: number; keepM: number; keep: string[] };

const ctx = self as unknown as { postMessage(message: unknown, transfer?: Transferable[]): void; onmessage: ((event: MessageEvent<In>) => void) | null };
let store: GroundStore | null = null;
let ready: Promise<void> | null = null;
// One build at a time: cells are big and the queue order (nearest first) matters.
let chain: Promise<void> = Promise.resolve();

ctx.onmessage = event => {
  const msg = event.data;
  if (msg.type === 'init') {
    store = new GroundStore(httpFetchBytes(msg.root));
    ready = store.init().then(() => ctx.postMessage({ type: 'ready', cells: [...store!.osmCells] }))
      .catch(error => ctx.postMessage({ type: 'error', message: `init: ${String(error?.message ?? error)}` }));
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
  if (msg.type === 'evict') {
    chain = chain.then(() => { s.evictRelief(msg.x, msg.y, msg.keepM); s.forgetCells(new Set(msg.keep)); });
  }
};
