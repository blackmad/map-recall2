/**
 * BAG writer (house line H5): what the BAG and 3DBAG tiles state about a pand. Reads the compact `bag-facts` descriptor
 * (bagTiles.ts `decodeDescriptor`: storeys, roof, eaves, ridge, year, terraced) and writes a partial HouseSpec.
 *
 *   facts/facadeYear     BAG construction year, source `bag`. A pand's year is the building's, not necessarily its street front's, so
 *                        it is recorded at 0.5; the register's dated facade (monument-text, 0.7) outranks it.
 *   fronts/0/storeys     NOT WRITTEN since H5h (#351, `BAG_WRITES_STOREYS`). Measured against the photo-read hand set (AB07, 47 pands
 *                        with a read storey count, docs/house-line.md §4c): eaves / 3 m agreed 20/47 = 0.43 (one too many on 25); with
 *                        the ruling's offsets (-1 pitched crown, -1 register souterrain) 26/47 = 0.55, under the 0.80 the ruling set for
 *                        keeping BAG as the fallback storeys writer. `bagStoreys` keeps the arithmetic for the scorer. BAG stays the
 *                        source for heights (eaves, ridge: the bag-facts descriptor the generic path reads, not this writer).
 *
 * Nothing else is stated: BAG has no gable, bay or colour. Pure; the loader of the tiles is in scripts/house-specs/describe.ts.
 */
import { plausibleYear, type DecodedDescriptor } from '../../bagTiles.ts';
import { emptySpec, pandDigits, setSpecField, type HouseSpec } from '../spec.ts';

export const BAG_CONFIDENCE = { year: 0.5, storeys: 0.4 } as const;
/** Off by measurement (H5h #351): see the header. Turning it on restores the eaves / 3 m count at confidence 0.4, source `3dbag`. */
export const BAG_WRITES_STOREYS = false;

/**
 * The BAG storey count with the offsets of the H5h ruling (#351): -1 when the roof facts say a pitched crown (roof code 3, `slanted`:
 * the eaves height still holds the tall ground storey and the attic), -1 when a souterrain is flagged (it sits in the eaves height but
 * is not a street-facing storey: docs/house-line.md STOREYS_DEFINITION). Never below 1. Undefined when the descriptor has no height.
 */
export function bagStoreys(d: DecodedDescriptor | undefined, o: { pitched?: boolean; souterrain?: boolean } = {}): number | undefined {
  if (!d || !(d.storeys > 0) || (d.eavesM === null && d.ridgeM === null)) return undefined;
  return Math.max(1, d.storeys - (o.pitched && d.roof === 3 ? 1 : 0) - (o.souterrain ? 1 : 0));
}

export function bagWriter(pandId: string, d: DecodedDescriptor | undefined, date: string | null = null): HouseSpec | null {
  if (!d) return null;
  const spec = emptySpec(pandDigits(pandId));
  const ref = `bag-facts:${pandDigits(pandId)}`;
  if (plausibleYear(d.year)) {
    setSpecField(spec, 'facts/facadeYear', d.year);
    spec.provenance['facts/facadeYear'] = { source: 'bag', confidence: BAG_CONFIDENCE.year, ref, at: date };
  }
  const storeys = BAG_WRITES_STOREYS ? bagStoreys(d) : undefined;
  if (storeys !== undefined) {
    setSpecField(spec, 'fronts/0/storeys', storeys);
    spec.provenance['fronts/0/storeys'] = { source: '3dbag', confidence: BAG_CONFIDENCE.storeys, ref, at: date };
  }
  return Object.keys(spec.provenance).length ? spec : null;
}
