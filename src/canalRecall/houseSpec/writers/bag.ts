/**
 * BAG writer (house line H5): what the BAG and 3DBAG tiles state about a pand. Reads the compact `bag-facts` descriptor
 * (bagTiles.ts `decodeDescriptor`: storeys, roof, eaves, ridge, year, terraced) and writes a partial HouseSpec.
 *
 *   facts/facadeYear     BAG construction year, source `bag`. A pand's year is the building's, not necessarily its street front's, so
 *                        it is recorded at 0.5; the register's dated facade (monument-text, 0.7) outranks it.
 *   fronts/0/storeys     eaves (or roof) height at 3 m a storey (`storeysOf`, already in the descriptor), source `3dbag`, confidence 0.4: the weakest source on
 *                        the ladder, so any measurement or judgement replaces it. Canal houses have a tall ground storey, which this
 *                        undercounts; the agreement report (scripts/house-specs/agreement.ts) prints how often.
 *
 * Nothing else is stated: BAG has no gable, bay or colour. Pure; the loader of the tiles is in scripts/house-specs/describe.ts.
 */
import { plausibleYear, type DecodedDescriptor } from '../../bagTiles.ts';
import { emptySpec, pandDigits, setSpecField, type HouseSpec } from '../spec.ts';

export const BAG_CONFIDENCE = { year: 0.5, storeys: 0.4 } as const;

export function bagWriter(pandId: string, d: DecodedDescriptor | undefined, date: string | null = null): HouseSpec | null {
  if (!d) return null;
  const spec = emptySpec(pandDigits(pandId));
  const ref = `bag-facts:${pandDigits(pandId)}`;
  if (plausibleYear(d.year)) {
    setSpecField(spec, 'facts/facadeYear', d.year);
    spec.provenance['facts/facadeYear'] = { source: 'bag', confidence: BAG_CONFIDENCE.year, ref, at: date };
  }
  if (d.storeys > 0 && (d.eavesM !== null || d.ridgeM !== null)) {
    setSpecField(spec, 'fronts/0/storeys', d.storeys);
    spec.provenance['fronts/0/storeys'] = { source: '3dbag', confidence: BAG_CONFIDENCE.storeys, ref, at: date };
  }
  return Object.keys(spec.provenance).length ? spec : null;
}
