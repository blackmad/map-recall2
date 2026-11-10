/**
 * Register writer (house line H5): the monuments register's published facts for one pand (monument-facts.json `buildings[id]`,
 * facade/registerFacts.ts) through `fromRegisterFacts` (adapters.ts). Source `monument-text`: gable 0.8, facade year 0.7 (a period 0.5),
 * finish 0.7, hoist beam / stoop / elements 0.6. No crop is needed, so this writer runs for every listed pand, crop or not.
 */
import type { PublishedFacts } from '../../facade/registerRecipe.ts';
import { fromRegisterFacts } from '../adapters.ts';
import { pandDigits, type HouseSpec } from '../spec.ts';

/** `facts`: the extract's `buildings` map (keys are full BAG ids, `NL.IMBAG.Pand.<16 digits>`). */
export function registerWriter(pandId: string, facts: ReadonlyMap<string, PublishedFacts> | Record<string, PublishedFacts>): HouseSpec | null {
  const digits = pandDigits(pandId), key = `NL.IMBAG.Pand.${digits}`;
  const f = facts instanceof Map ? facts.get(key) : (facts as Record<string, PublishedFacts>)[key];
  if (!f) return null;
  const spec = fromRegisterFacts(f, f.nr, digits);
  return Object.keys(spec.provenance).length || spec.schemaLimits?.length ? spec : null;
}
