/**
 * Block faces from a set of houses: connected components of "shares a party
 * wall" restricted to houses whose frontages run the same way. A cross street
 * or any unmodelled pand between two houses breaks the face, which is exactly
 * where a chunk has to end.
 */
import {frontFrame, ringToFrame} from '../buildingRecipe/instances.ts';
import {findContacts} from './party.ts';
import type {ChunkHouseInput, P2} from './types.ts';

export function groupBlockFaces(houses: ChunkHouseInput[], partyToleranceM = 0.05): ChunkHouseInput[][] {
  if (!houses.length) return [];
  const ref = frontFrame(houses[0].facts.fronts[0] as any);
  const rings = houses.map(h => h.facts.surveyFootprintPolygonsRD.map(poly => ringToFrame(poly[0], ref) as P2[]));
  const parent = houses.map((_, i) => i);
  const find = (i: number): number => parent[i] === i ? i : (parent[i] = find(parent[i]));
  for (const c of findContacts(rings, partyToleranceM)) {
    const a = frontFrame(houses[c.a].facts.fronts[0] as any), b = frontFrame(houses[c.b].facts.fronts[0] as any);
    if (a.uRD[0] * b.uRD[0] + a.uRD[1] * b.uRD[1] > 0.98) parent[find(c.a)] = find(c.b);
  }
  const groups = new Map<number, ChunkHouseInput[]>();
  houses.forEach((h, i) => { const r = find(i); groups.set(r, [...(groups.get(r) ?? []), h]); });
  return [...groups.values()].sort((a, b) => b.length - a.length || a[0].id.localeCompare(b[0].id));
}
