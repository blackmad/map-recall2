/**
 * BAG-keyed base tiles: the pure parts.
 *
 * The base building layer already draws every pand under its BAG id
 * (`NL.IMBAG.Pand.*`, 335 123 of 347 040 features; the rest are OSM-only
 * outlines BAG does not hold). What it lacks is everything a mid-LOD facade or
 * a join needs: the 3DBAG eave and ridge heights, the construction year, the
 * roof type, and the OSM ids that describe the same building. This module is
 * the format and the arithmetic for those, so the build script, the covers
 * join, the runtime reader and the tests agree on one definition.
 *
 * Three artefacts, one key (the BAG pand id):
 *   bag-tiles/14/x/y.geojson.gz  the existing tile feature + `eaves ridge roof year osm`
 *   bag-facts/14/x/y.json.gz     the ~40-byte mid descriptor per pand (this file's `MidDescriptor`)
 *   covers.json                  installed model -> the pands it stands on
 *
 * Nothing here touches the network or the DOM.
 */

import { eraForYear } from './buildingAppearance.js';
import { pointInRing, ringBbox, type Bbox, type Ring } from './buildingLadder.js';

/** The BAG prefix is constant, so files carry the 16-digit tail only. */
export const PAND_PREFIX = 'NL.IMBAG.Pand.';
export const isPandId = (id: string): boolean => id.startsWith(PAND_PREFIX);
export const shortPandId = (id: string): string => (isPandId(id) ? id.slice(PAND_PREFIX.length) : id);
export const fullPandId = (id: string): string => (/^\d{16}$/.test(id) ? `${PAND_PREFIX}${id}` : id);

/** An OSM way/relation overlaps a pand when this share of the smaller one lies inside the other. */
export const OSM_MATCH_SHARE = 0.6;
/** A model covers a pand when this share of the pand lies inside the model footprint. */
export const COVER_SHARE = 0.5;

// ---------------------------------------------------------------------------
// Overlap
// ---------------------------------------------------------------------------

const insideAny = (point: readonly [number, number], rings: readonly Ring[]): boolean => {
  for (const ring of rings) if (pointInRing(point as [number, number], ring)) return true;
  return false;
};

const unionBbox = (rings: readonly Ring[]): Bbox =>
  rings.map(ringBbox).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] as Bbox);

/**
 * The share (0..1) of `subject`'s area that lies inside `container`.
 *
 * A fixed sampling grid over the subject's bounding box: deterministic, and
 * about 1 m cells for a 24 m house, which is finer than the disagreement
 * between OSM and BAG outlines it has to see through. Subjects are unions of
 * their outer rings (courtyards are inside a pand's mass for this purpose).
 */
export function shareInside(subject: readonly Ring[], container: readonly Ring[], grid = 24): number {
  if (!subject.length || !container.length) return 0;
  const [w, s, e, n] = unionBbox(subject);
  const [cw, cs, ce, cn] = unionBbox(container);
  if (!(cw < e && ce > w && cs < n && cn > s)) return 0;
  let total = 0;
  let inside = 0;
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      const p: [number, number] = [w + ((i + 0.5) / grid) * (e - w), s + ((j + 0.5) / grid) * (n - s)];
      if (!insideAny(p, subject)) continue;
      total++;
      if (insideAny(p, container)) inside++;
    }
  }
  return total === 0 ? 0 : inside / total;
}

/** The larger of the two directional shares: a part inside a pand and a pand inside a bigger outline both match. */
export const mutualShare = (a: readonly Ring[], b: readonly Ring[], grid = 24): number =>
  Math.max(shareInside(a, b, grid), shareInside(b, a, grid));

export type OsmCandidate = { osmId: string; rings: Ring[] };

/** OSM ids describing the same building as a pand, sorted, with the share that matched. */
export function matchOsm(pandRings: readonly Ring[], candidates: readonly OsmCandidate[], minShare = OSM_MATCH_SHARE): string[] {
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.osmId)) continue;
    if (mutualShare(pandRings, candidate.rings) >= minShare) seen.add(candidate.osmId);
  }
  return [...seen].sort();
}

/**
 * Does a model footprint cover a pand? Either half the pand's area is under
 * the footprint, or the footprint holds the pand's centroid (a small annex
 * under a big model whose sampled share is low only through rasterisation).
 */
export function coversPand(
  footprint: { contains(p: readonly [number, number]): boolean },
  pandRings: readonly Ring[],
  centroid: readonly [number, number],
  grid = 24,
): boolean {
  if (footprint.contains(centroid)) return true;
  return sampleShare(pandRings, footprint, grid) >= COVER_SHARE;
}

function sampleShare(subject: readonly Ring[], footprint: { contains(p: readonly [number, number]): boolean }, grid: number): number {
  const [w, s, e, n] = unionBbox(subject);
  let total = 0;
  let inside = 0;
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      const p: [number, number] = [w + ((i + 0.5) / grid) * (e - w), s + ((j + 0.5) / grid) * (n - s)];
      if (!insideAny(p, subject)) continue;
      total++;
      if (footprint.contains(p)) inside++;
    }
  }
  return total === 0 ? 0 : inside / total;
}

// ---------------------------------------------------------------------------
// Facts and the mid descriptor
// ---------------------------------------------------------------------------

/** The 3DBAG facts one pand carries into a tile. All heights are metres above local ground. */
export type PandFacts = {
  heightM: number | null;
  eavesM: number | null;
  ridgeM: number | null;
  roofType: string | null;
  year: number | null;
  storeys: number | null;
  groundAreaM2: number | null;
  partyWallAreaM2: number | null;
};

/** 0 unknown, 1 flat, 2 several flats, 3 pitched. Matches 3DBAG's `b3_dak_type`. */
export type RoofCode = 0 | 1 | 2 | 3;
export function roofCode(roofType: string | null | undefined): RoofCode {
  switch (roofType) {
    case 'horizontal': return 1;
    case 'multiple horizontal': return 2;
    case 'slanted': return 3;
    default: return 0;
  }
}

/** BAG uses 1005 and similar placeholders; a year is only a fact inside this window. */
export const plausibleYear = (year: number | null | undefined): year is number =>
  typeof year === 'number' && Number.isFinite(year) && year >= 1100 && year <= 2100;

/**
 * Coarse archetype guesses. A prior from era, size and shape, never a claim
 * about one building (the housing stock repeats; the individual does not).
 */
export const ARCHETYPES = [
  'unknown', 'canal-house', 'c19-terrace', 'c19-house', 'school-block', 'modern-block',
  'modern-house', 'tower', 'large-flat', 'outbuilding',
] as const;
export type Archetype = (typeof ARCHETYPES)[number];

const STOREY_M = 3;

/** Storeys from the eave (a pitched roof's wall height) or the roof height (a flat one), at 3 m a storey. */
export function storeysOf(facts: Pick<PandFacts, 'eavesM' | 'heightM' | 'ridgeM' | 'roofType' | 'storeys'>): number {
  if (facts.storeys !== null && facts.storeys > 0) return Math.min(60, Math.round(facts.storeys));
  const wall = facts.roofType === 'slanted' ? facts.eavesM : (facts.heightM ?? facts.eavesM);
  const basis = wall ?? facts.heightM ?? facts.ridgeM;
  return basis === null ? 1 : Math.max(1, Math.min(60, Math.round(basis / STOREY_M)));
}

export function archetypeGuess(facts: PandFacts): Archetype {
  const height = facts.heightM ?? facts.ridgeM ?? facts.eavesM ?? 0;
  const area = facts.groundAreaM2 ?? 0;
  const terraced = (facts.partyWallAreaM2 ?? 0) > 0;
  const era = plausibleYear(facts.year) ? eraForYear(facts.year)?.period : undefined;
  if (height >= 30) return 'tower';
  if (area > 0 && area < 25) return 'outbuilding';
  if (area >= 1500 && facts.roofType !== 'slanted') return 'large-flat';
  switch (era) {
    case 'canal': return terraced && area < 300 ? 'canal-house' : 'c19-house';
    case 'c19': return terraced ? 'c19-terrace' : 'c19-house';
    case 'school': return 'school-block';
    case 'modern': return terraced || height > 12 ? 'modern-block' : 'modern-house';
    default: return facts.roofType === 'slanted' && terraced ? 'c19-terrace' : 'unknown';
  }
}

/**
 * The mid-tier descriptor inputs, as the wire carries them:
 * `[archetype index, storeys, roof code, eaves dm, ridge dm, year (0 = unknown), terraced 0/1]`.
 * Decimetre integers keep the JSON short (about 25 bytes per pand before gzip).
 */
export type MidDescriptor = [archetype: number, storeys: number, roof: RoofCode, eavesDm: number, ridgeDm: number, year: number, terraced: 0 | 1];

const dm = (metres: number | null): number => (metres === null ? 0 : Math.round(metres * 10));

export function midDescriptor(facts: PandFacts): MidDescriptor {
  return [
    ARCHETYPES.indexOf(archetypeGuess(facts)),
    storeysOf(facts),
    roofCode(facts.roofType),
    dm(facts.eavesM),
    dm(facts.ridgeM),
    plausibleYear(facts.year) ? facts.year : 0,
    (facts.partyWallAreaM2 ?? 0) > 0 ? 1 : 0,
  ];
}

export type DecodedDescriptor = {
  archetype: Archetype; storeys: number; roof: RoofCode; eavesM: number | null; ridgeM: number | null; year: number | null; terraced: boolean;
};
export function decodeDescriptor(row: readonly number[]): DecodedDescriptor {
  return {
    archetype: ARCHETYPES[row[0]] ?? 'unknown',
    storeys: row[1],
    roof: (row[2] as RoofCode) ?? 0,
    eavesM: row[3] > 0 ? row[3] / 10 : null,
    ridgeM: row[4] > 0 ? row[4] / 10 : null,
    year: row[5] > 0 ? row[5] : null,
    terraced: row[6] === 1,
  };
}

/** The tile feature properties added to an existing base-tile feature. Absent facts are left out, like the base tiles do. */
export function tileFactProperties(facts: PandFacts, osmIds: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (facts.eavesM !== null) out.eaves = Math.round(facts.eavesM * 10) / 10;
  if (facts.ridgeM !== null) out.ridge = Math.round(facts.ridgeM * 10) / 10;
  const roof = roofCode(facts.roofType);
  if (roof) out.roof = roof;
  if (plausibleYear(facts.year)) out.year = facts.year;
  if (osmIds.length) out.osm = [...osmIds];
  return out;
}

export type FactsTile = { version: 1; archetypes: readonly string[]; pands: Record<string, MidDescriptor> };
export const FACTS_VERSION = 1;
export const factsTile = (pands: Record<string, MidDescriptor>): FactsTile => ({ version: FACTS_VERSION, archetypes: ARCHETYPES, pands });

// ---------------------------------------------------------------------------
// Covers
// ---------------------------------------------------------------------------

/** One installed model's covered pands, plus any suppressed ids that are not a pand. */
export type CoversEntry = {
  /** Short pand ids (16 digits) the model stands on. */
  p: string[];
  /** Suppressed OSM-only ids (tier 4 outlines BAG does not hold, or unmatched) kept verbatim. */
  o?: string[];
};
export type CoversFile = {
  version: 1;
  generatedAt: string;
  /** Models drawn individually, by model id. */
  models: Record<string, CoversEntry>;
  /** Pands replaced one-to-one by the building-types instancing (always their own pand). */
  buildingTypes: string[];
};
export const COVERS_VERSION = 1;

/**
 * Feature ids to hide for the models currently drawn.
 *
 * This replaces the union of every shown model's `suppressOsmIds`: the ids are
 * pands (what the base tiles are keyed by) plus the OSM-only leftovers.
 */
export function hiddenIdsFor(covers: CoversFile, shownModelIds: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const id of shownModelIds) {
    const entry = covers.models[id];
    if (!entry) continue;
    for (const pand of entry.p) out.add(fullPandId(pand));
    for (const osm of entry.o ?? []) out.add(osm);
  }
  return [...out];
}

/** `?bagTiles=1` (also `true`). Anything else leaves the legacy path untouched. */
export function bagTilesEnabled(search: string): boolean {
  const value = new URLSearchParams(search).get('bagTiles');
  return value === '1' || value === 'true';
}

/** Where a BAG tile lives, beside the legacy `building-tiles`. */
export const bagTileUrl = (tile: { z: number; x: number; y: number }, base: string): string =>
  `${base.replace(/\/$/, '')}/bag-tiles/${tile.z}/${tile.x}/${tile.y}.geojson.gz`;
