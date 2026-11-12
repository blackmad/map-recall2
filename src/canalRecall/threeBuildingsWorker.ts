import {buildTransportedEnvelopeChunk} from './surveyedEnvelopeTransport.js';
import type {SurveyedBuildingEnvelope} from './surveyedBuildingEnvelope.js';
// Chunk worker for the three.js building layer: turns a group of streamed features into
// the typed arrays of one chunk off the main thread, so a tile arriving mid-ride no longer
// stalls a frame for the ~40 ms a chunk takes to lay out (user report "janky", 2026-10-02).
import { buildFeatureChunk, type BuildingLook, type Feature } from './threeBuildingFeatures.js';

import { buildSpecialKits, buildSpecialBoats, type KitLayers } from './buildingSpecialChunks.js';
import type { Houseboat } from './houseboats.js';
import type { ChunkHostOpeningConfig } from './hostWallOpenings.js';
import type { StreetAppearanceProfile } from './streetAppearance.js';
import { WorldCellWorkerHost, isWorldRequest, type WorldRequest } from './world/worldCells.js';
import { answerRelief, isReliefRequest, type ReliefRequest } from './ownGround/reliefDecode.js';
import { answerStandIn, isStandInRequest, type StandInRequest } from './rendererShared/shadowStandIns.js';
import { planTiles, plannedTransferables } from './ownGround/cellTiles.js';
import { answerOverview, isOverviewRequest, type OverviewRequest } from './ownMap/overviewPool.js';
import { SpecTileTable, packChunkRecords } from './look/facadeSpecTiles.js';
import type { FacadeRecordInput, FacadeSpecInput } from './look/facadeRecord.js';

type Job = { surveyedEnvelopeData?: SurveyedBuildingEnvelope[]; surveyedEnvelopeRevision?: string; special?: 'kits' | 'boats'; boats?: Houseboat[]; layers: KitLayers; key: string; gen: number; look: BuildingLook; features: Feature[]; contextFeatures?: Feature[]; mode?: 'walls' | 'extras' | 'coarse' | 'shell'; streets?: Float32Array; profiles?: StreetAppearanceProfile[]; appearanceRevision?: string; hostOpenings?: ChunkHostOpeningConfig[]; hostOpeningRevision?: string; shellRoofs?: boolean; /** Facade tiles per side and the smallest chunk worth cutting: the tiles' x/y partition is cut here (cellTiles.ts planTiles). */ tiles?: number; tileMin?: number; /** F1 (#380, `?shaderFacades=1`): a record-mode chunk; `specBase` the house-specs extract (absolute URL). */ facadeRecord?: { specBase: string } };

// world-v1 (`?world=v1`): the streamer's cell reads (fetch, inflate, decode, decoded-cell cache) run here, off the
// main thread, and come back as batches of styled features (world/worldCells.ts).
const world = new WorldCellWorkerHost((reply, transfer) => (self as unknown as Worker).postMessage(reply, transfer ?? []));

// The pool (engine/workerPool.ts) also decodes the own ground's relief tiles here (ownGround/reliefDecode.ts) and
// welds landmark shadow stand-ins (rendererShared/shadowStandIns.ts, #129) and builds the engine's overview geometry.
self.onmessage = (event: MessageEvent<Job | WorldRequest | ReliefRequest | StandInRequest | OverviewRequest>) => {
  if (isWorldRequest(event.data)) { world.handle(event.data); return; }
  if (isReliefRequest(event.data)) { answerRelief(event.data, (reply, transfer) => (self as unknown as Worker).postMessage(reply, transfer)); return; }
  if (isStandInRequest(event.data)) { answerStandIn(event.data, (reply, transfer) => (self as unknown as Worker).postMessage(reply, transfer)); return; }
  // The engine's overview geometry (ownMap/overviewPool.ts, #129: 184 ms of the own boot on the main thread).
  if (isOverviewRequest(event.data)) { void answerOverview(event.data, (reply, transfer) => (self as unknown as Worker).postMessage(reply, transfer)); return; }
  const job = event.data;
  if (job.facadeRecord && !job.special) {
    // The resolved specs first (fetched once per tile and kept); a failed read packs priors, as for an unspec'd pand.
    const t0 = performance.now(), base = job.facadeRecord.specBase;
    const table = specTables.get(base) ?? new SpecTileTable(base);
    specTables.set(base, table);
    void table.specFor(job.features).then(specFor => answer(job, t0, specFor));
    return;
  }
  answer(job, performance.now());
};

const specTables = new Map<string, SpecTileTable>();
function answer(job: Job, t0: number, specFor?: (id: string) => FacadeSpecInput | undefined): void {
  const { key, gen, look, features, appearanceRevision, hostOpeningRevision, surveyedEnvelopeRevision } = job;
  const event = { data: specFor ? { ...job, facadeRecord: true, specFor } : { ...job, facadeRecord: undefined } };
  const {chunk,boundParentIds} = event.data.special === 'kits' ? {chunk:buildSpecialKits(features, look, event.data.layers),boundParentIds:[]}
    : event.data.special === 'boats' ? {chunk:buildSpecialBoats(event.data.boats ?? [], look, event.data.layers),boundParentIds:[]}
    : buildTransportedEnvelopeChunk(features,event.data);
  // The partition reads x/y only, which the main thread's ground lift leaves alone (threeBuildingsBrowser.ts install).
  const n = event.data.tiles ?? 0;
  const tiles = n > 1 ? { n, plan: planTiles(chunk.positions, chunk.indices, n, event.data.tileMin ?? 0, 3, chunk.ranges) } : undefined;
  // F1: a record chunk ships its wall/rec/wallKind arrays and its packed records in place of the record inputs.
  const rc = (chunk as { record?: { walls: Float32Array; recs: Uint16Array; wallKinds: Uint8Array; inputs: FacadeRecordInput[] } }).record;
  const record = rc ? { walls: rc.walls, recs: rc.recs, wallKinds: rc.wallKinds, records: packChunkRecords(rc.inputs) } : null;
  const sent = record ? { ...chunk, record } : chunk;
  const buffers = [chunk.positions, chunk.uvs, chunk.layers, chunk.tints, chunk.accents, chunk.indices, ...(chunk.thin ? [chunk.thin] : []), ...(record ? [record.walls, record.recs, record.wallKinds, record.records.bytes] : [])].map(a => a.buffer as ArrayBuffer);
  (self as unknown as Worker).postMessage({ key, gen, appearanceRevision, hostOpeningRevision, surveyedEnvelopeRevision, boundParentIds, chunk: sent, ms: performance.now() - t0, tiles }, [...buffers, ...plannedTransferables(tiles?.plan)]);
}
