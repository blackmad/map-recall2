// Browser half of the knowledge map: fetch the two extract files once per page
// (boundaries.json and water.json, both already loaded by a ride, so usually
// from the HTTP cache) and keep the thinned geometry in memory. The map then
// draws from localStorage alone.

import { geometryFromExtract, type BoundaryInput, type KnowledgeMapGeometry, type WaterInput } from './knowledgeMap.ts';

export const KNOWLEDGE_MAP_EXTRACT = '/data/extracts/amsterdam';

let cached: Promise<KnowledgeMapGeometry> | null = null;
let ready: KnowledgeMapGeometry | null = null;

export function knowledgeMapGeometryNow(): KnowledgeMapGeometry | null {
  return ready;
}

export function loadKnowledgeMapGeometry(
  base = KNOWLEDGE_MAP_EXTRACT,
  fetcher: typeof fetch = (...args) => fetch(...args),
): Promise<KnowledgeMapGeometry> {
  if (cached) return cached;
  cached = Promise.all([
    fetcher(`${base}/boundaries.json`).then(response => (response.ok ? response.json() : [])) as Promise<BoundaryInput[]>,
    fetcher(`${base}/water.json`).then(response => (response.ok ? response.json() : [])).catch(() => []) as Promise<WaterInput[]>,
  ]).then(([boundaries, water]) => {
    ready = geometryFromExtract(Array.isArray(boundaries) ? boundaries : [], Array.isArray(water) ? water : []);
    return ready;
  }).catch(error => {
    cached = null;
    throw error;
  });
  return cached;
}

/** Storybook and tests hand the geometry in directly. */
export function primeKnowledgeMapGeometry(geometry: KnowledgeMapGeometry): void {
  ready = geometry;
  cached = Promise.resolve(geometry);
}
