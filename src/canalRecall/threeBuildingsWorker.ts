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

type Job = { surveyedEnvelopeData?: SurveyedBuildingEnvelope[]; surveyedEnvelopeRevision?: string; special?: 'kits' | 'boats'; boats?: Houseboat[]; layers: KitLayers; key: string; gen: number; look: BuildingLook; features: Feature[]; contextFeatures?: Feature[]; mode?: 'walls' | 'extras' | 'coarse'; streets?: Float32Array; profiles?: StreetAppearanceProfile[]; appearanceRevision?: string; hostOpenings?: ChunkHostOpeningConfig[]; hostOpeningRevision?: string };

self.onmessage = (event: MessageEvent<Job>) => {
  const { key, gen, look, features, contextFeatures, mode, streets, profiles, appearanceRevision, hostOpenings, hostOpeningRevision, surveyedEnvelopeRevision } = event.data;
  const t0 = performance.now();
  const {chunk,boundParentIds} = event.data.special === 'kits' ? {chunk:buildSpecialKits(features, look, event.data.layers),boundParentIds:[]}
    : event.data.special === 'boats' ? {chunk:buildSpecialBoats(event.data.boats ?? [], look, event.data.layers),boundParentIds:[]}
    : buildTransportedEnvelopeChunk(features,event.data);
  const buffers = [chunk.positions, chunk.uvs, chunk.layers, chunk.tints, chunk.accents, chunk.indices].map(a => a.buffer as ArrayBuffer);
  (self as unknown as Worker).postMessage({ key, gen, appearanceRevision, hostOpeningRevision, surveyedEnvelopeRevision, boundParentIds, chunk, ms: performance.now() - t0 }, buffers);
};
