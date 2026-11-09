// Browser half of the knowledge map: fetch the slim outline file once per page
// (knowledge-map-outline.json, ~60 kB, #297) and keep the geometry in memory.
// If the outline is not published, fall back to the two big extracts
// (boundaries.json and water.json, ~1 MB). The map then draws from
// localStorage alone.

import { BUURT_KIND_RANKS, geometryFromExtract, type BoundaryInput, type KnowledgeMapGeometry, type WaterInput } from './knowledgeMap.ts';
import { geometryFromOutline, KNOWLEDGE_MAP_OUTLINE_VERSION, type KnowledgeMapOutline } from './knowledgeMapOutline.ts';

export const KNOWLEDGE_MAP_EXTRACT = '/data/extracts/amsterdam';
export const KNOWLEDGE_MAP_OUTLINE_FILE = 'knowledge-map-outline.json';

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
  cached = fetcher(`${base}/${KNOWLEDGE_MAP_OUTLINE_FILE}`)
    .then(response => (response.ok ? response.json() : null) as Promise<KnowledgeMapOutline | null>)
    .catch(() => null)
    .then(async (outline): Promise<KnowledgeMapGeometry> => {
      if (outline && outline.version === KNOWLEDGE_MAP_OUTLINE_VERSION && Array.isArray(outline.buurts)) {
        return geometryFromOutline(outline, BUURT_KIND_RANKS);
      }
      const [boundaries, water] = await Promise.all([
        fetcher(`${base}/boundaries.json`).then(response => (response.ok ? response.json() : [])) as Promise<BoundaryInput[]>,
        fetcher(`${base}/water.json`).then(response => (response.ok ? response.json() : [])).catch(() => []) as Promise<WaterInput[]>,
      ]);
      return geometryFromExtract(Array.isArray(boundaries) ? boundaries : [], Array.isArray(water) ? water : []);
    })
    .then(geometry => {
      ready = geometry;
      return geometry;
    })
    .catch(error => {
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
