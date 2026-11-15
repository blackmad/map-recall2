/**
 * Modern rebuilds behind old years (centrum-looks round 2, 2026-11-16): a signal that does not come from BAG's year.
 *
 * The Jordaan judges named Boomstraat 0363100012172664 a flat modern block drawn with a register neck gable: the register
 * (monument 669, "XVIIIc" neck gable) states a facade year of about 1762, which kept the pand in the look, but BAG says 1990
 * and the measured roof is flat (3DBAG roof code 2, no ridge; the AHN front band's top within 0.1 m of its p90). Lane D hit
 * the same fault in the belt (Keizersgracht 171508: bell gables with domes on a tall flat block).
 *
 * BAG's year cannot be the signal (bag-facts' `modern-block` archetype and building-facts' start_date are both BAG's year).
 * The measured roof can: a gable needs a rise, so a front whose 3DBAG roof is flat with no ridge over its eaves, and whose
 * AHN street band (when measured) has no bump over its p90, has no gable standing on it, whatever a register or a donor
 * says. Over the Jordaan's drawn pands the register-gable fronts are nearly all slanted (370 of 377); 2 of them read flat
 * by all three measures, and 19 register-silent fronts do.
 *
 * Pure: no fs.
 */
import type { AhnFront } from './ahnFront.ts';

/** A measured flat top: an AHN front band with less than `ahnBumpM` between its p90 and max; a 3DBAG ridge less than
 *  `ridgeRiseM` over the eaves (or none). */
export const FLAT_TOP = { ahnBumpM: 0.4, ridgeRiseM: 1 } as const;
export interface RoofMeasures { roofCode?: number | null; eavesM: number | null; ridgeM: number | null }

/** The pand's measured roof is flat: 3DBAG roof code 1 (flat) or 2 (several flats), no ridge rising `ridgeRiseM` over its
 *  eaves, and, when the AHN street band is measured, no bump over its p90 (a gable's apex would stand there). */
export function measuredFlatTop(p: RoofMeasures, a?: AhnFront | null): boolean {
  if (p.roofCode !== 1 && p.roofCode !== 2) return false;
  if (p.ridgeM !== null && p.eavesM !== null && p.ridgeM - p.eavesM >= FLAT_TOP.ridgeRiseM) return false;
  return !a || a.max - a.p90 < FLAT_TOP.ahnBumpM;
}

/**
 * A modern rebuild behind an older stated year: BAG builds the pand after `maxYear`, a register states an older facade
 * year, and the measured roof is flat. The register record then describes a front that no longer stands (or another
 * front of the register object); BAG's year stands and the pand is a later period. Null when the rule does not apply.
 */
export function modernBehindRegister(p: RoofMeasures & { year: number | null }, statedYear: number | null | undefined, maxYear: number, a?: AhnFront | null): string | null {
  if (p.year === null || p.year <= maxYear || statedYear == null || statedYear > maxYear) return null;
  if (!measuredFlatTop(p, a)) return null;
  return `BAG ${p.year} over register ${statedYear}, measured flat top (3DBAG roof ${p.roofCode}, ridge ${p.ridgeM ?? 'none'}${a ? `, AHN band max-p90 ${(a.max - a.p90).toFixed(2)} m` : ''})`;
}

/**
 * A cornice front's wall top when the AHN street band climbs a roof slope (centrum-looks round 2: Boomstraat
 * 0363100012172663, band p50 13.27 / p90 15.13 under a 15.5 m ridge, drawn at the p90 about 2 m over the photo's front;
 * Noordermarkt 167756, p50 11.65 / p90 12.7, judged ~10.5-11 m): the band's p50 when p90 - p50 exceeds `spreadM` on a
 * slanted 3DBAG roof whose ridge stands at least `ridgeOverP50M` over the p50; else null (the p90 stands).
 */
export const SLOPED_BAND = { spreadM: 1.2, ridgeOverP50M: 1.5 } as const;
export function slopedBandTop(p: RoofMeasures, a?: AhnFront | null): number | null {
  if (!a || p.roofCode !== 3 || p.ridgeM === null) return null;
  if (a.p90 - a.p50 <= SLOPED_BAND.spreadM || p.ridgeM - a.p50 < SLOPED_BAND.ridgeOverP50M) return null;
  return a.p50;
}

/**
 * A roof storey over a cornice front from the measured roof (centrum-looks round 2: the Jordaan judges asked for dormers
 * over the cornice on Marnixstraat 172599-173362 and Noordermarkt 167756): a slanted 3DBAG roof whose ridge stands at
 * least `riseM` over the drawn front top has a pitched roof storey behind the cornice; the look states a roof storey
 * (statedDormer: one plain dormer), as the register's dakkapel does.
 */
export const ROOF_STOREY = { riseM: 2 } as const;
export function roofStoreyOverCornice(p: RoofMeasures, topM: number | null): boolean {
  return p.roofCode === 3 && p.ridgeM !== null && topM !== null && p.ridgeM - topM >= ROOF_STOREY.riseM;
}
