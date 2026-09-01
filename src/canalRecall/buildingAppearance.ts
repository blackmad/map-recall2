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
  /** First construction year this era covers. */
  from: number;
  /** Short label, used in review sheets and the coverage report. */
  label: string;
  /** Representative wall colour. */
  wall: string;
  /** Representative roof colour where nothing was measured. */
  roof: string;
}

/**
 * Amsterdam's building periods, as the street actually reads them.
 *
 * These are priors over a housing stock, not claims about any one building.
 * The boundaries are the ones that changed what buildings were made of:
 *
 *  - Before 1800 the centre is hand-made red-brown brick under red clay
 *    pantile, weathered dark.
 *  - The 19th-century ring (1800-1900) is machine brick, lighter and more
 *    uniform, still under clay tile.
 *  - 1900-1940 is the Amsterdamse School: deep orange-red brick, expressive
 *    and dark-roofed, the Pijp and Oud-West.
 *  - 1945-1975 reconstruction is pale brick, concrete panel and flat grey
 *    bitumen — the Westelijke Tuinsteden and Buitenveldert.
 *  - 1975-2000 returns to a browner brick at smaller scale.
 *  - After 2000 is mixed glass, panel and pale brick: IJburg, Zuidas,
 *    Houthavens.
 */
export const AMSTERDAM_ERAS: readonly Era[] = [
  { from: 0,    label: 'pre-1800 centre',        wall: '#8C6A57', roof: '#7C4A3A' },
  { from: 1800, label: '19th-century ring',      wall: '#A8836B', roof: '#7E5344' },
  { from: 1900, label: 'Amsterdamse School',     wall: '#9C5B45', roof: '#5E4238' },
  { from: 1945, label: 'post-war reconstruction',wall: '#C3B7A6', roof: '#6E6A64' },
  { from: 1975, label: 'late-century brick',     wall: '#A98A73', roof: '#6A625A' },
  { from: 2000, label: 'contemporary',           wall: '#B9B4AE', roof: '#77736E' },
] as const;

/** The era a construction year falls in, or undefined when the year is unusable. */
export function eraForYear(year: number | undefined | null): Era | undefined {
  // BAG uses 1005 and similar placeholders for "older than the register", and
  // a year in the future is a data error, not a building.
  if (typeof year !== 'number' || !Number.isFinite(year)) return undefined;
  if (year < 1100 || year > new Date().getUTCFullYear() + 5) return undefined;
  let match: Era | undefined;
  for (const era of AMSTERDAM_ERAS) if (year >= era.from) match = era;
  return match;
}

/** Colours for OSM `building:material`, which describes a real surface. */
const MATERIAL_COLOURS: Record<string, string> = {
  brick: '#A5674F', red_brick: '#9C5B45', concrete: '#C6BEB2', cement_block: '#B3B0A9',
  glass: '#7E93A5', wood: '#9A7048', stone: '#B0A692', metal: '#A9A9A4',
  plaster: '#D6D0C4', stucco: '#D6D0C4', masonry: '#A5674F', sandstone: '#C4AE8C',
};

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
  const material = input.osmMaterial ? MATERIAL_COLOURS[input.osmMaterial.toLocaleLowerCase()] : undefined;

  const wall = input.osmColour
    ? { colour: input.osmColour, source: 'osm-tag' as const }
    : material
      ? { colour: material, source: 'material-tag' as const }
      : era
        ? { colour: era.wall, source: 'era-prior' as const }
        : { colour: '#B4ADA3', source: 'none' as const };

  const roof = input.measuredRoofColour
    ? { colour: input.measuredRoofColour, source: 'measured-aerial' as const }
    : era
      ? { colour: era.roof, source: 'era-prior' as const }
      : { colour: '#7A756E', source: 'none' as const };

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
