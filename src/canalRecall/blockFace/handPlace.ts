/**
 * Hand-placed block-face runs (scripts/block-face/hand-place.ts): the spec a lane writes per pand from the strip, and its
 * validation. Canal-belt rows (Jordaan, 2026-11-10) mix restorations BAG dates 1940-1990, tile saddles the skyline reads
 * as bell gables and 2.4-3.5 m storey pitches, so the lane names type, crown, storeys and the cornice line itself.
 */
import type {HousePlacement, HouseTypeIntent} from './houseType.ts';

export interface HandHouse {
  pand: string; type: string; crown?: string; storeys: number; mirror?: boolean; shop?: boolean; ground?: string;
  overrides?: HousePlacement['overrides']; paletteOverrides?: HousePlacement['paletteOverrides']; wall?: false; why: string;
  /** The front eaves (cornice top) read on the strip, m over the strip ground, when 3DBAG's eaves is not the cornice. */
  eavesM?: number;
  /** This house's roof covering over the type's (seen on the strip; `HousePlacement.roof`, needs `evidence`). */
  roof?: HousePlacement['roof'];
}
export interface HandRun {id: string; face: string; reason: string; houses: HandHouse[]}

/** Problems of a hand-run spec against its face members and the type library (empty = valid). */
export function handRunProblems(run: HandRun, members: readonly string[], types: readonly Pick<HouseTypeIntent, 'id' | 'crowns' | 'grounds'>[]): string[] {
  const p: string[] = [], at = `hand run ${run.id}`;
  if (!run.reason) p.push(`${at}: reason required`);
  if (!run.houses?.length) p.push(`${at}: no houses`);
  const idx = run.houses.map(h => members.findIndex(m => m.endsWith(h.pand)));
  idx.forEach((i, k) => { if (i < 0) p.push(`${at}: pand ${run.houses[k].pand} not on ${run.face}`); });
  if (idx.every(i => i >= 0) && idx.some((i, k) => k > 0 && i !== idx[k - 1] + 1)) p.push(`${at}: pands are not consecutive members of ${run.face}`);
  for (const h of run.houses) {
    const t = types.find(x => x.id === h.type);
    if (!t) { p.push(`${at}: unknown type ${h.type}`); continue; }
    if (h.crown && !t.crowns[h.crown]) p.push(`${at}: ${h.pand} crown ${h.crown} not in ${h.type}`);
    if (h.ground && !t.grounds?.[h.ground]) p.push(`${at}: ${h.pand} ground ${h.ground} not in ${h.type}`);
    if (!(Number.isInteger(h.storeys) && h.storeys >= 1 && h.storeys <= 8)) p.push(`${at}: ${h.pand} storeys must be 1..8`);
    if (!h.why) p.push(`${at}: ${h.pand} why required (what the strip shows)`);
    if (h.eavesM !== undefined && !(h.eavesM > 2 && h.eavesM < 30)) p.push(`${at}: ${h.pand} eavesM must be 2..30 m`);
  }
  return p;
}
