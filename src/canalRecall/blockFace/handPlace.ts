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
  /**
   * The storey grid read on the strip (the Opus strip review, 2026-11-10: canal houses whose raised bel-etage stands over
   * a souterrain, or whose two or three storeys are 3.5-4.5 m tall, drew standard storeys 0.6-2 m off the photo's rows).
   * `storeysM`: floor-to-floor heights of the `storeys`, ground (or bel-etage) first; `souterrainM`: the souterrain under
   * them (drawn by the type's souterrain ground, `souterrainGround`). Absent = the type's grid, byte-identical.
   */
  grid?: {storeysM: number[]; souterrainM?: number};
}

/** The body override a storey-grid pin writes (`storeyHeights` in metres, normalised to the wall by the recipe; a
 *  souterrain's height first, the list one longer than the storeys, intent.ts). */
export function gridOverrides(grid: NonNullable<HandHouse['grid']>): {storeyHeights: number[]} {
  return {storeyHeights: grid.souterrainM === undefined ? [...grid.storeysM] : [grid.souterrainM, ...grid.storeysM]};
}

/** The type's ground variant that draws a souterrain (the first with `souterrain: true`), if any. */
export function souterrainGround(t: Pick<HouseTypeIntent, 'grounds'>): string | undefined {
  return Object.entries(t.grounds ?? {}).find(([, g]) => (g as {souterrain?: unknown}).souterrain === true)?.[0];
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
    if (h.grid) {
      const g = h.grid, ok = Array.isArray(g.storeysM) && g.storeysM.every(v => typeof v === 'number' && v >= 1.8 && v <= 6);
      if (!ok || g.storeysM.length !== h.storeys) p.push(`${at}: ${h.pand} grid.storeysM: one height per storey (${h.storeys}), each 1.8..6 m`);
      if (g.souterrainM !== undefined && !(g.souterrainM >= 0.8 && g.souterrainM <= 3)) p.push(`${at}: ${h.pand} grid.souterrainM must be 0.8..3 m`);
      if (g.souterrainM !== undefined && !souterrainGround(t)) p.push(`${at}: ${h.pand} grid.souterrainM needs a souterrain ground in ${h.type}`);
      if (g.souterrainM !== undefined && h.ground && h.ground !== souterrainGround(t)) p.push(`${at}: ${h.pand} grid.souterrainM with ground ${h.ground} (not the souterrain ground)`);
      const sum = (ok ? g.storeysM.reduce((a, b) => a + b, 0) : 0) + (g.souterrainM ?? 0);
      // The storeys stop under the cornice band: a plain cornice takes 0.3-1 m, a white attic frieze up to 2.5 m (Bloemgracht 118-126).
      if (ok && h.eavesM !== undefined && !(sum <= h.eavesM + 0.6 && sum >= h.eavesM - 2.5)) p.push(`${at}: ${h.pand} grid sums to ${sum.toFixed(1)} m, eavesM ${h.eavesM} (the storeys end 0-2.5 m under the cornice top)`);
      if (h.overrides && 'storeyHeights' in h.overrides) p.push(`${at}: ${h.pand} grid and overrides both set the storey grid`);
    }
  }
  return p;
}
