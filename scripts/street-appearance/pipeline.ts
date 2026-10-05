import { createHash } from 'node:crypto';
import type { ArchitecturalRecipe, StreetAppearanceProfile, StreetAppearanceEvidence } from '../../src/canalRecall/streetAppearance.ts';
export const sha256 = (x: string | Uint8Array) => createHash('sha256').update(x).digest('hex');
export interface Observation { profileId: string; startM: number; endM: number; quality: number; evidence: StreetAppearanceEvidence; recipes: Array<{ weight: number; recipe: ArchitecturalRecipe; yearMin?: number; yearMax?: number }> }
/** One strongest observation per 5m frontage cell; overlapping views never multiply its vote. */
export function aggregateObservations(base: StreetAppearanceProfile, observations: Observation[]): StreetAppearanceProfile {
  const cells = new Map<number, Observation>();
  for (const o of observations.filter(o => o.profileId === base.id && o.quality >= .45 && o.endM > o.startM).sort((a,b) => a.evidence.id.localeCompare(b.evidence.id))) {
    for (let cell = Math.floor(o.startM / 5); cell * 5 < o.endM; cell++) {
      const existing = cells.get(cell); if (!existing || o.quality > existing.quality) cells.set(cell, o);
    }
  }
  const combined = new Map<string, { weight: number; recipe: ArchitecturalRecipe; yearMin?: number; yearMax?: number }>();
  for (const o of cells.values()) {
    const total = o.recipes.reduce((s,r) => s + r.weight, 0); if (!(total > 0)) continue;
    for (const r of o.recipes) {
      const key = JSON.stringify([r.recipe, r.yearMin, r.yearMax]);
      const existing = combined.get(key); const weight = r.weight / total;
      if (existing) existing.weight += weight; else combined.set(key, { ...r, weight });
    }
  }
  const used = [...new Map([...cells.values()].map(o => [o.evidence.sha256, o.evidence])).values()];
  if (!used.length || !combined.size) return { ...base, confidence: 0, recipes: [], evidence: [] };
  const recipes = [...combined.values()].sort((a,b) => JSON.stringify(a.recipe).localeCompare(JSON.stringify(b.recipe)));
  const revision = sha256(JSON.stringify({ base: { id: base.id, segment: base.segment, side: base.side }, used, recipes })).slice(0,16);
  return { ...base, revision, recipes, evidence: used, confidence: Math.min(.8, used.reduce((s,e)=>s+e.quality,0)/used.length) };
}
