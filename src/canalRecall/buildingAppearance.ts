/**
 * What colour a building should be, and how much we actually know about it.
 *
 * Two branches have already measured Amsterdam roofs and façades, and both
 * concluded the same thing: measuring a few buildings precisely is low leverage
 * (`ROOF_ENRICHMENT.md`). The city does not look wrong because its 10,578
 * appearance-backed buildings have imperfect colours. It looks wrong because
 * every other building in Amsterdam falls through to a four-stop grey ramp
 * keyed on height, so a 1650 canal house and a 1975 office block are the same
 * beige at the same height.
 *
 * So this module is about coverage, not fidelity. It gives every building a
 * defensible colour and, more importantly, says where that colour came from.
 * A measurement always wins; a construction year is a prior, never a
 * measurement, and it is labelled as one so nothing downstream can launder it
 * into evidence.
 */

import { PERIOD_PRIORS, UNKNOWN_ROOF_HEX, UNKNOWN_WALL_HEX, materialWallDisplayPrior, periodForYear, type Period } from './look/palette.js';

/** Where a colour came from, best evidence first. */
export type AppearanceSource =
  /** An explicit OSM `building:colour` — someone looked at the building. */
  | 'osm-tag'
  /** Sampled from government aerial imagery (`build-satellite-roof-colours`). */
  | 'measured-aerial'
  /** Derived from an OSM `building:material` tag. */
  | 'material-tag'
  /** Inferred from BAG construction year. A model guess, never evidence. */
  | 'era-prior'
  /** Nothing was known; the theme default applies. */
  | 'none';

/** True when the source is an observation of this building, not a guess. */
export function isMeasured(source: AppearanceSource): boolean {
  return source === 'osm-tag' || source === 'measured-aerial';
}

export interface Era {
  /** The renderer's period (look/palette.ts, the one era scheme: 1860 / 1915 / 1945). */
  period: Period;
  /** Short label, used in review sheets and the coverage report. */
  label: string;
  /** Representative wall colour. */
  wall: string;
  /** Representative roof colour where nothing was measured. */
  roof: string;
}

/**
 * The era a construction year falls in, or undefined when the year is unusable.
 *
 * Eras are the renderer's periods (`PERIOD_FROM` in look/palette.ts), not a
 * second scheme: canal houses before 1860, the 19th-century ring 1860-1914,
 * the Amsterdamse School 1915-1944, post-war and contemporary from 1945. The
 * colours are the palette's own representatives (`PERIOD_PRIORS`), so a
 * coverage report and the city name the same colour for the same period.
 * Priors over a housing stock, never claims about one building. (The
 * six-era 1800/1900/1945/1975/2000 scheme that used to live here had no
 * runtime consumer and was deleted in the 2026-10-13 palette merge.)
 */
export function eraForYear(year: number | undefined | null): Era | undefined {
  // BAG uses 1005 and similar placeholders for "older than the register", and
  // a year in the future is a data error, not a building.
  if (typeof year !== 'number' || !Number.isFinite(year)) return undefined;
  if (year < 1100 || year > new Date().getUTCFullYear() + 5) return undefined;
  const period = periodForYear(year);
  return { period, ...PERIOD_PRIORS[period] };
}

export interface AppearanceInput {
  /** OSM `building:colour`, already validated as a CSS colour. */
  osmColour?: string;
  /** OSM `building:material`. */
  osmMaterial?: string;
  /** A roof colour sampled from aerial imagery. */
  measuredRoofColour?: string;
  /** BAG `oorspronkelijkbouwjaar`. */
  constructionYear?: number;
}

export interface ResolvedAppearance {
  wallColour: string;
  roofColour: string;
  wallSource: AppearanceSource;
  roofSource: AppearanceSource;
  /** The era label when a prior was used, for the coverage report. */
  era?: string;
}

/**
 * Resolve one building's appearance, best evidence first.
 *
 * Walls and roofs are resolved separately and can disagree about how well they
 * are known: the aerial sampler measures roofs and cannot see walls at all, so
 * the common outcome for a well-covered building is a measured roof over a
 * prior wall. Reporting one confidence for the pair would hide exactly that.
 */
export function resolveAppearance(input: AppearanceInput): ResolvedAppearance {
  const era = eraForYear(input.constructionYear);
  // The runtime's material table (look/palette.ts): a material suggests a hue, never a measured colour.
  const material = materialWallDisplayPrior(input.osmMaterial) ?? undefined;

  const wall = input.osmColour
    ? { colour: input.osmColour, source: 'osm-tag' as const }
    : material
      ? { colour: material, source: 'material-tag' as const }
      : era
        ? { colour: era.wall, source: 'era-prior' as const }
        : { colour: UNKNOWN_WALL_HEX, source: 'none' as const };

  const roof = input.measuredRoofColour
    ? { colour: input.measuredRoofColour, source: 'measured-aerial' as const }
    : era
      ? { colour: era.roof, source: 'era-prior' as const }
      : { colour: UNKNOWN_ROOF_HEX, source: 'none' as const };

  return {
    wallColour: wall.colour, wallSource: wall.source,
    roofColour: roof.colour, roofSource: roof.source,
    ...(era ? { era: era.label } : {}),
  };
}

/**
 * A building's height in metres from 3DBAG's measured roof and ground levels.
 *
 * `build-osm-building-appearance.ts` currently falls back to `levels * 3` or a
 * flat 9 m, so a large part of the skyline is invented. 3DBAG derives both
 * numbers from AHN laser altimetry, so this is a measurement — but only when
 * both are present and the result is plausible. A negative or absurd height is
 * a reconstruction failure, and inventing 9 m again would hide it.
 */
export function measuredHeight(
  roofPercentile: number | undefined,
  groundLevel: number | undefined,
): number | undefined {
  if (typeof roofPercentile !== 'number' || typeof groundLevel !== 'number') return undefined;
  const height = roofPercentile - groundLevel;
  if (!Number.isFinite(height) || height < 1.5 || height > 200) return undefined;
  return Math.round(height * 10) / 10;
}
