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
//               { type: 'share-host', root, ports: MessagePort[], capMB }  this instance builds nothing: it is the share
//                                                  host (groundShare.ts), one fetch + gunzip per file for every worker;
//                                                  an init's `sharePort` is a building worker's end of one of `ports`
// Relief tiles for the game's main-thread store decode in the page's worker pool (reliefDecode.ts), not here.
// Messages out: { type: 'ready', cells: string[], railCells: number }   (railCells: the worker's rail manifest size)
//               { type: 'cell', gen, cell: BuiltCell, railFetch }   (arrays transferred; railFetch: GroundStore.railOutcomes of the key)
//               { type: 'far', gen, key, far: BuiltFar | null }   (arrays transferred; null: nothing there)
//               { type: 'error', key?, gen?, message }

import { GroundStore, maybeGunzip, type FetchBytes } from './groundStore.js';
import { WorkerTrace, phaseSplit, type PhaseEvent } from './workerTrace.js';
import { ShareHost, shareClient, type ShareRequest, type SharePort } from './groundShare.js';
import { buildCell, cellTransferables, type CellDetail } from './groundCell.js';
import { buildFarBlock, farColours, farTransferables, type FarColours } from './farRing.js';
import { groundPalette, isRoadLookId, type GroundLook } from './groundLook.js';
import { setKerbShadowRoadLook } from './roadSurfaces.js';
import { GroundBuildQueue } from './buildQueue.js';
import { cellTileGrid, layerTiles, tileTransferables } from './cellTiles.js';
import { cellGpuTransferables, compactCell, compactFar, farGpuTransferables } from './compactMesh.js';

type In =
  | { type: 'init'; root: string; /** Lane R5-A #260 step 1: this worker's index and the page's performance.timeOrigin (the trace's clock). */ index?: number; pageOrigin?: number; /** false: `?portalClip=0` (tunnels.ts clipMeshAtCuts). */ portalClip?: boolean; /** false: `?portalEnds=0` (tunnels.ts PortalClipOptions.ends, #269). */ portalEnds?: boolean; /** false: `?rampGaps=0` (tunnels.ts bridgeBankGaps, #270). */ rampGaps?: boolean; /** false: `?roadSlivers=0` (roads-v1 version-2 cells). */ roadSlivers?: boolean; parks?: boolean; rails?: boolean; /** false: `?railRetry=0` (groundResidency.ts). */ railRetry?: boolean; /** The main thread's rail manifest keys (one source of truth, #232). */ railManifest?: string[]; /** false: no far rail corridors (`?farRail=0`). */ farRails?: boolean; /** false: far rail bands at their bends only (`?farRailDrape=0`, #232). */ farRailDrape?: boolean; roads?: boolean; /** false: the pre-fix bridge decks (gameGround bridgeGapsFlag, issue #178). */ bridgeGaps?: boolean; /** false: `?bridgeCarry=0` / `?redDedupe=0` (lane R5-C1). */ bridgeCarry?: boolean; redDedupe?: boolean; /** true: bridgeGaps step 3, dry way decks (gameGround dryWayDecksFlag). */ dryWayDecks?: boolean; groundLook?: GroundLook; compact?: boolean; detail?: CellDetail; tiles?: number; /** Tiles per side for a LOD 0, full-detail cell (cellTiles.ts cellTileGrid). */ nearTiles?: number; tileMin?: number; /** The road look under review (gameGround roadLookFlag), for the kerb shadows' ramp ends. */ roadLook?: string | null; /** false: `?groundPlanShare=0` (groundStore.ts bandedWaterTest, lane R5-A #260 step 4). */ planShare?: boolean; /** false: `?groundDeterministic=0` (groundStore.ts `deterministic`: first-arrival planning). */ deterministic?: boolean; /** false: `?openGround=0` (open-ground-v1 off, groundSurface.ts). */ openGround?: boolean; /** Lane R5-A #260 step 3: fetch through the share host (groundShare.ts); absent: `?groundShare=0` or one worker. */ sharePort?: MessagePort }
  | { type: 'share-host'; root: string; ports: MessagePort[]; capMB?: number }
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
/** Lane R5-A #260 step 1: this worker's index, the page clock (worker ms + offset), the job and fetch log (workerTrace.ts). */
let index = 0, clockOffset = 0;
let trace = new WorkerTrace();
const pageNow = (): number => performance.now() + clockOffset;
/** Lane R5-A #260 step 4: the store's data-in phases since the last job ended (GroundStore.phaseHook), drained per job. */
const phaseEvents: PhaseEvent[] = [];

/** httpFetchBytes, logged: each file's request → body → gunzipped, and its wait for a connection (resource timing). */
function tracedFetchBytes(root: string): FetchBytes {
  try { (performance as Performance & { setResourceTimingBufferSize?(n: number): void }).setResourceTimingBufferSize?.(4000); } catch { /* not in this worker */ }
  return async path => {
    const url = `${root}/${path}`, start = pageNow();
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    const raw = new Uint8Array(await r.arrayBuffer());
    const fetched = pageNow();
    const bytes = await maybeGunzip(raw);
    let stallMs = 0;
    try {
      const e = performance.getEntriesByName(new URL(url, (self as unknown as { location: { href: string } }).location.href).href).at(-1) as PerformanceResourceTiming | undefined;
      if (e && e.requestStart > 0) stallMs = e.requestStart - e.startTime;
    } catch { /* no resource timing */ }
    trace.fetch({ path, start, fetched, end: pageNow(), bytes: bytes.byteLength, stallMs });
    return bytes;
  };
}

/** Lane R5-A #260 step 3: the same FetchBytes through the share host's port, logged with whether it was shared. */
function sharedFetchBytes(port: SharePort): FetchBytes {
  const get = shareClient(port);
  return async path => {
    const start = pageNow();
    const r = await get(path);
    const end = pageNow();
    trace.fetch({ path, start, fetched: end, end, bytes: r.bytes.byteLength, stallMs: 0, shared: r.hit, savedMs: r.hit ? r.netMs + r.gunzipMs : 0, hostGunzipMs: r.hit ? 0 : r.gunzipMs });
    return r.bytes;
  };
}

/** The share host's fetch: the body as fetched, the same error text as a direct fetch. */
function rawFetch(root: string): (path: string) => Promise<Uint8Array> {
  return async path => {
    const r = await fetch(`${root}/${path}`);
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  };
}

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
          const t0 = performance.now(), queued = queue.size;
          const input = await s.cellInput(job.key, job.lod, job.detail);
          const t1 = performance.now();
          const built = buildCell(input), cell = compact ? compactCell(built) : built;
          const t2 = performance.now();
          // The tiles of the meshes exactly as sent (compact or not): the main thread's install only wraps them.
          if (tiles > 1) cell.tiles = layerTiles(cell.layers, cellTileGrid(tiles, nearTiles, cell.lod, cell.detail), tileMin);
          const t3 = performance.now(), asked = askedAt.get(job.key);
          trace.job({ kind: 'cell', key: job.key, start: t0 + clockOffset, inputEnd: t1 + clockOffset, end: t3 + clockOffset });
          // Where a cell's time goes (lane R5-A #260): queued in the worker, data in (fetch + decode), build, tiles; step 1
          // adds the worker, its queue, what ran ahead of the cell on it, and the data-in's network/CPU split (workerTrace.ts).
          const timing = { phases: phaseSplit(phaseEvents.splice(0), built.stats?.phases), waitMs: asked == null ? null : Math.round(t0 - asked), inputMs: Math.round(t1 - t0), buildMs: Math.round(t2 - t1), tileMs: Math.round(t3 - t2),
            worker: index, queuedBehind: queued, askedAt: asked == null ? null : Math.round(asked + clockOffset), startAt: Math.round(t0 + clockOffset),
            ahead: asked == null ? null : trace.ahead(asked + clockOffset, t0 + clockOffset), fetch: trace.fetchSplit(t0 + clockOffset, t1 + clockOffset) };
          ctx.postMessage({ type: 'cell', gen: job.gen, cell, railFetch: s.railOutcomes.get(job.key) ?? 'unasked', timing }, [...(compact ? cellGpuTransferables(cell) : cellTransferables(cell)), ...tileTransferables(cell.tiles)]);
        } catch (error) {
          ctx.postMessage({ type: 'error', key: job.key, gen: job.gen, message: String((error as Error)?.stack ?? error) });
        }
      } else {
        try {
          const f0 = performance.now();
          const input = await s.farInput(job.key);
          const f1 = performance.now();
          phaseEvents.length = 0;
          const built = input ? buildFarBlock(input, colours) : null, far = built && compact ? compactFar(built) : built;
          trace.job({ kind: 'far', key: job.key, start: f0 + clockOffset, inputEnd: f1 + clockOffset, end: performance.now() + clockOffset });
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
  if (msg.type === 'share-host') {
    const host = new ShareHost(rawFetch(msg.root), maybeGunzip, Math.max(0, msg.capMB ?? 64) * 1024 * 1024);
    for (const port of msg.ports) port.onmessage = (e: MessageEvent<ShareRequest>) => { if (e.data?.type === 'get') host.answer(e.data, (reply, transfer) => port.postMessage(reply, transfer)); };
    (self as unknown as { __groundShareHost?: ShareHost }).__groundShareHost = host;
    return;
  }
  if (msg.type === 'init') {
    index = msg.index ?? 0;
    if (typeof msg.pageOrigin === 'number') clockOffset = performance.timeOrigin - msg.pageOrigin;
    initAt = performance.now();
    trace = new WorkerTrace(initAt + clockOffset);
    store = new GroundStore(msg.sharePort ? sharedFetchBytes(msg.sharePort as unknown as SharePort) : tracedFetchBytes(msg.root), { parks: msg.parks !== false, roads: msg.roads === true, rails: msg.rails !== false, ...(msg.railRetry === false ? { railRetry: false } : {}), ...(Array.isArray(msg.railManifest) ? { railManifest: msg.railManifest } : {}), ...(msg.farRails === false ? { farRails: false } : {}), ...(msg.farRailDrape === false ? { farRailDrape: false } : {}), ...(msg.bridgeGaps === false ? { bridgeGaps: false } : {}), ...(msg.dryWayDecks === true ? { dryWayDecks: true } : {}) , ...(msg.bridgeCarry === false ? { bridgeCarry: false } : {}), ...(msg.redDedupe === false ? { redDedupe: false } : {}), ...(msg.portalClip === false ? { portalClip: false } : {}), ...(msg.portalEnds === false ? { portalEnds: false } : {}), ...(msg.rampGaps === false ? { rampGaps: false } : {}), ...(msg.roadSlivers === false ? { roadSlivers: false } : {}), ...(msg.planShare === false ? { planShare: false } : {}), ...(msg.deterministic === false ? { deterministic: false } : {}), ...(msg.openGround === false ? { openGround: false } : {}) });
    store.phaseHook = (phase, key, ms) => { phaseEvents.push([phase, key, ms]); };
    compact = msg.compact === true;
    detail = msg.detail === 'touch' ? 'touch' : 'full';
    tiles = Math.max(0, Math.floor(msg.tiles ?? 0)); nearTiles = Math.max(0, Math.floor(msg.nearTiles ?? 0)); tileMin = Math.max(0, msg.tileMin ?? 0);
    const look = isRoadLookId(msg.roadLook) ? msg.roadLook : null;
    setKerbShadowRoadLook(look);
    colours = farColours(groundPalette(msg.groundLook || 'default'), look);
    ready = store.init().then(() => { trace.readyAt = pageNow(); }).then(() => ctx.postMessage({ type: 'ready', index, cells: [...store!.osmCells], railCells: store!.railCells.size, initMs: Math.round(performance.now() - initAt) }))
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
