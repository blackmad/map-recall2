// The own-ground chunk worker: builds streamed ground cells off the main
// thread (all ground modules are DOM-free). Bundled as
// public/canal-drive/js/own-ground-worker.bundle.js (scripts/build-3d-bundles.mjs).
//
// Messages in:  { type: 'init', root, parks, roads, groundLook, compact, detail, railRetry, railManifest }  extract root URL (absolute); parks: load parks-v1; roads: load roads-v1; far-ring palette;
//                                                           railManifest: the main thread's rail cells.json keys (#232);
//                                                           compact: send compact meshes (compactMesh.ts, phones);
//                                                           detail: 'touch' on a touch device, the device's far-cell level (gameGround.ts)
//                                                           tiles, tileMin: cut each layer into tiles×tiles culled tiles here (cellTiles.ts layerTiles)
//               { type: 'build', key, lod, gen, detail }  build one cell at 'full' or 'touch' detail (CellDetail)
//               { type: 'far', key, gen }         build one far block (farRing.ts)
//               { type: 'evict', x, y, keepM, keep: string[] }
//               { type: 'order', keys: string[] }  wanted cells, best first: queued cells build in this order and
//                                                  cells not in it are dropped unbuilt (buildQueue.ts)
// Relief tiles for the game's main-thread store decode in the page's worker pool (reliefDecode.ts), not here.
// Messages out: { type: 'ready', cells: string[], railCells: number }   (railCells: the worker's rail manifest size)
//               { type: 'cell', gen, cell: BuiltCell, railFetch }   (arrays transferred; railFetch: GroundStore.railOutcomes of the key)
//               { type: 'far', gen, key, far: BuiltFar | null }   (arrays transferred; null: nothing there)
//               { type: 'error', key?, gen?, message }

import { GroundStore, httpFetchBytes } from './groundStore.js';
import { buildCell, cellTransferables, type CellDetail } from './groundCell.js';
import { buildFarBlock, farColours, farTransferables, type FarColours } from './farRing.js';
import { groundPalette, isRoadLookId, type GroundLook } from './groundLook.js';
import { setKerbShadowRoadLook } from './roadSurfaces.js';
import { GroundBuildQueue } from './buildQueue.js';
import { cellTileGrid, layerTiles, tileTransferables } from './cellTiles.js';
import { cellGpuTransferables, compactCell, compactFar, farGpuTransferables } from './compactMesh.js';

type In =
  | { type: 'init'; root: string; parks?: boolean; rails?: boolean; /** false: `?railRetry=0` (groundResidency.ts). */ railRetry?: boolean; /** The main thread's rail manifest keys (one source of truth, #232). */ railManifest?: string[]; /** false: no far rail corridors (`?farRail=0`). */ farRails?: boolean; /** false: far rail bands at their bends only (`?farRailDrape=0`, #232). */ farRailDrape?: boolean; roads?: boolean; /** false: the pre-fix bridge decks (gameGround bridgeGapsFlag, issue #178). */ bridgeGaps?: boolean; /** false: `?bridgeCarry=0` / `?redDedupe=0` (lane R5-C1). */ bridgeCarry?: boolean; redDedupe?: boolean; /** true: bridgeGaps step 3, dry way decks (gameGround dryWayDecksFlag). */ dryWayDecks?: boolean; groundLook?: GroundLook; compact?: boolean; detail?: CellDetail; tiles?: number; /** Tiles per side for a LOD 0, full-detail cell (cellTiles.ts cellTileGrid). */ nearTiles?: number; tileMin?: number; /** The road look under review (gameGround roadLookFlag), for the kerb shadows' ramp ends. */ roadLook?: string | null }
  | { type: 'build'; key: string; lod: 0 | 1; gen: number; detail?: CellDetail }
  | { type: 'far'; key: string; gen: number }
  | { type: 'evict'; x: number; y: number; keepM: number; keep: string[] }
  | { type: 'order'; keys: string[] };

const ctx = self as unknown as { postMessage(message: unknown, transfer?: Transferable[]): void; onmessage: ((event: MessageEvent<In>) => void) | null };
let store: GroundStore | null = null;
let ready: Promise<void> | null = null;
let colours: FarColours | undefined;
let compact = false;
/** Tiles per side and the smallest layer worth cutting (init `tiles`, `tileMin`); 0: the main thread cuts (or nobody). */
let tiles = 0, nearTiles = 0, tileMin = 0;
/** The device's far-cell level (init `detail`): `touch` on a coarse-pointer device, `full` on a desktop. */
let detail: CellDetail = 'full';
// One build at a time: cells are big and the order matters (nearest ahead first, buildQueue.ts).
const queue = new GroundBuildQueue();
const evictions: Array<() => void> = [];
let running = false;
/** When each cell's latest build request reached the worker (lane R5-A #260: the queue wait in each cell's timing). */
const askedAt = new Map<string, number>();
let initAt = 0;

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
          const t0 = performance.now();
          const input = await s.cellInput(job.key, job.lod, job.detail);
          const t1 = performance.now();
          const built = buildCell(input), cell = compact ? compactCell(built) : built;
          const t2 = performance.now();
          // The tiles of the meshes exactly as sent (compact or not): the main thread's install only wraps them.
          if (tiles > 1) cell.tiles = layerTiles(cell.layers, cellTileGrid(tiles, nearTiles, cell.lod, cell.detail), tileMin);
          const t3 = performance.now(), asked = askedAt.get(job.key);
          // Where a cell's time goes (lane R5-A #260): queued in the worker, data in (fetch + decode), build, tiles.
          const timing = { waitMs: asked == null ? null : Math.round(t0 - asked), inputMs: Math.round(t1 - t0), buildMs: Math.round(t2 - t1), tileMs: Math.round(t3 - t2) };
          ctx.postMessage({ type: 'cell', gen: job.gen, cell, railFetch: s.railOutcomes.get(job.key) ?? 'unasked', timing }, [...(compact ? cellGpuTransferables(cell) : cellTransferables(cell)), ...tileTransferables(cell.tiles)]);
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
    store = new GroundStore(httpFetchBytes(msg.root), { parks: msg.parks !== false, roads: msg.roads === true, rails: msg.rails !== false, ...(msg.railRetry === false ? { railRetry: false } : {}), ...(Array.isArray(msg.railManifest) ? { railManifest: msg.railManifest } : {}), ...(msg.farRails === false ? { farRails: false } : {}), ...(msg.farRailDrape === false ? { farRailDrape: false } : {}), ...(msg.bridgeGaps === false ? { bridgeGaps: false } : {}), ...(msg.dryWayDecks === true ? { dryWayDecks: true } : {}) , ...(msg.bridgeCarry === false ? { bridgeCarry: false } : {}), ...(msg.redDedupe === false ? { redDedupe: false } : {})});
    compact = msg.compact === true;
    detail = msg.detail === 'touch' ? 'touch' : 'full';
    tiles = Math.max(0, Math.floor(msg.tiles ?? 0)); nearTiles = Math.max(0, Math.floor(msg.nearTiles ?? 0)); tileMin = Math.max(0, msg.tileMin ?? 0);
    const look = isRoadLookId(msg.roadLook) ? msg.roadLook : null;
    setKerbShadowRoadLook(look);
    colours = farColours(groundPalette(msg.groundLook || 'default'), look);
    initAt = performance.now();
    ready = store.init().then(() => ctx.postMessage({ type: 'ready', cells: [...store!.osmCells], railCells: store!.railCells.size, initMs: Math.round(performance.now() - initAt) }))
      .catch(error => ctx.postMessage({ type: 'error', message: `init: ${String(error?.message ?? error)}` }));
    return;
  }
  if (!store || !ready) return;
  const s = store;
  if (msg.type === 'build') { askedAt.set(msg.key, performance.now()); queue.build(msg.key, msg.lod, msg.gen, msg.detail ?? detail); void pump(s); return; }
  if (msg.type === 'far') { queue.requestFar(msg.key, msg.gen); void pump(s); return; }
  if (msg.type === 'order') { queue.order(msg.keys); return; }
  if (msg.type === 'evict') {
    // Between builds, never under one (a build reads the relief it is evicting).
    evictions.push(() => { s.evictRelief(msg.x, msg.y, msg.keepM); s.forgetCells(new Set(msg.keep)); });
    void pump(s);
  }
};
