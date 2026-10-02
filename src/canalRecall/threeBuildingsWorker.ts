// Chunk worker for the three.js building layer: turns a group of streamed features into
// the typed arrays of one chunk off the main thread, so a tile arriving mid-ride no longer
// stalls a frame for the ~40 ms a chunk takes to lay out (user report "janky", 2026-10-02).
import { buildFeatureChunk, type BuildingLook, type Feature } from './threeBuildingFeatures.js';

type Job = { key: string; gen: number; look: BuildingLook; features: Feature[]; mode?: 'walls' | 'extras' };

self.onmessage = (event: MessageEvent<Job>) => {
  const { key, gen, look, features, mode } = event.data;
  const t0 = performance.now();
  const chunk = buildFeatureChunk(features, look, mode ?? 'walls');
  const buffers = [chunk.positions, chunk.uvs, chunk.layers, chunk.tints, chunk.accents, chunk.indices].map(a => a.buffer as ArrayBuffer);
  (self as unknown as Worker).postMessage({ key, gen, chunk, ms: performance.now() - t0 }, buffers);
};
