/**
 * Two drawn models on the same ground. Each passes its own review (sheets render one GLB alone) and hides the same
 * OSM/BAG buildings, so the suppression checks pass too; only a ride shows the pair. 2026-10-16: the 2026-10-04
 * Wereldmuseum massing and the measured 2026-10-14 Tropenmuseum both drew the KIT complex, and the new entrance
 * faces poked through the old walls. A model shares ground with another when both answer to one landmark, or both
 * suppress one OSM way / BAG pand.
 */
import type {SignatureModelSpec} from './signaturePlacement';

export interface ModelCollision {
  /** Model ids, sorted. */
  ids: string[];
  /** What they share: `landmark <id>` and/or the shared suppressed OSM/BAG ids. */
  landmarkId?: string;
  suppressed: string[];
}

type Spec = Pick<SignatureModelSpec, 'id' | 'landmarkId' | 'suppressOsmIds'>;

/** Every pair of distinct models that share a landmark id or a suppressed id. Duplicate specs (same id) count once. */
export function modelCollisions(models: readonly Spec[]): ModelCollision[] {
  const byId = new Map<string, Spec>();
  for (const m of models) if (!byId.has(m.id)) byId.set(m.id, m);
  const pairs = new Map<string, ModelCollision>();
  const pair = (a: string, b: string) => {
    const ids = [a, b].sort(), key = ids.join('\u0000');
    let hit = pairs.get(key);
    if (!hit) pairs.set(key, hit = {ids, suppressed: []});
    return hit;
  };
  const owners = (key: (m: Spec) => readonly string[]) => {
    const index = new Map<string, string[]>();
    for (const m of byId.values()) for (const k of new Set(key(m))) if (k) index.set(k, [...(index.get(k) ?? []), m.id]);
    return [...index].filter(([, ids]) => ids.length > 1);
  };
  for (const [landmarkId, ids] of owners(m => [m.landmarkId ?? ''])) for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pair(ids[i], ids[j]).landmarkId = landmarkId;
  for (const [osm, ids] of owners(m => m.suppressOsmIds ?? [])) for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pair(ids[i], ids[j]).suppressed.push(osm);
  return [...pairs.values()].sort((a, b) => a.ids.join().localeCompare(b.ids.join()));
}

export const describeCollision = (c: ModelCollision) =>
  `${c.ids.join(' + ')}: ${[c.landmarkId && `landmark ${c.landmarkId}`, c.suppressed.length && `${c.suppressed.length} suppressed id(s) ${c.suppressed.slice(0, 4).join(', ')}${c.suppressed.length > 4 ? ', …' : ''}`].filter(Boolean).join('; ')}`;
