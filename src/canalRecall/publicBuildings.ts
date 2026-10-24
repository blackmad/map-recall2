// The generic public building (2026-10-03, "keep going balancing hand models with new category
// treatments"): large cinemas and theatres, schools and, later, stations and offices that no
// hand-modelled kit covers.
//
// Before this, every non-landmark building took the house generator's facade: a canal gable or
// period bays, house windows and stoops. Pathe City (24 m, 1,222 m2) wore a canal front, a 1920s
// public school a row of front doors. Now each one, listed by scripts/build-public-buildings.ts
// into publicBuildingData.ts, is drawn as a small kit (landmarkKits.ts): a cinema or theatre as plain
// walls and a flat lid (no windows, no gable: a film house is a windowless box), a school in its
// era's brick (or buff concrete) with a grid of large classroom windows, no doors, no stoops, and a
// pitched roof only where the footprint is a plain rectangle in a pre-1930 building.

//
// Kit review 1 (2026-10-24, docs/handoffs/kit-gaps.md "Landmark kits (review 1)"): every post-1960 school was one
// fixed beige (#b5a68e) whatever the photo, none of 16 reviewed photos matched it (10 red/brown brick); pre-war
// schools whose 3DBAG roof rises 10 m stood flat-roofed; cinemas drew no geometry of their own. Now a school's wall is
// its own measured colour (publicBuildingFacts.ts, from its panorama crops) or else its BAG year's period palette; a
// flat pre-1940 school the 3DBAG says is roofed gets a hipped roof round its footprint; a cinema's plain body gets
// a coping and plinth (landmarkKits.ts KitTrim).

import type { Kit, KitWindowRow } from './landmarkKits.js';
import { plainBodyTrim } from './worshipBuildings.js';
import { PUBLIC_BUILDINGS, type PublicEntry } from './publicBuildingData.js';
import { PUBLIC_FACTS, type PublicFactsEntry } from './publicBuildingFacts.js';
import { PERIOD_WALLS, ROOF_TONES, cityStuccoTint, cityWallTint, hexToRgb, periodForYear } from './look/palette.js';
import { wallFamily } from './facade/materials.js';

export type PublicKind = 'c' | 's' | 'f' | 'p' | 'h' | 'o';
export type PublicEra = 'o' | 'e' | 'm';
/** `p` plain walls and a flat lid, `f` windowed walls under the flat lid, `h` windowed walls under a fitted pitched roof. */
export type PublicPlan = { mode: 'p' | 'f' | 'h'; eavesM: number; riseM: number; era: PublicEra };
export type PublicInput = { kind: PublicKind; heightM: number; year: number | null; areaM2: number; rect: { len: number; wid: number; coverage: number; maxDev: number } | null; roofShape?: string; osmPart?: boolean };

/** Wall colour per kind and era: school brick before 1960 and buff concrete after; cinema brick before 1945-ish, grey after. */
export const PUBLIC_WALL: Record<'c' | 's', Record<PublicEra, string>> = {
  c: { o: '#8a6350', e: '#8f6b58', m: '#a8a6a0' },
  s: { o: '#8a4a38', e: '#955a45', m: '#b5a68e' },
};

/** A cinema or theatre part this big (footprint) or this tall gets plain walls; smaller ones in old buildings stay houses. */
export const CINEMA_MIN_AREA_M2 = 800, CINEMA_MIN_HEIGHT_M = 20;
/** Taller than this and the footprint is a tower or office block that merely holds a screen or a stage. */
export const CINEMA_MAX_HEIGHT_M = 30;
/** A roofed school needs a rectangle covering this much of the footprint, with no vertex further out than the deviation. */
export const SCHOOL_FIT_COVERAGE = 0.78, SCHOOL_FIT_MAX_DEV_M = 6;
export const SCHOOL_MIN_AREA_M2 = 250, SCHOOL_MIN_HEIGHT_M = 3.2;
/** Schools from these years get the look; undated ones and the glass-and-colour blocks since the mid-1990s keep the generic rules. */
export const SCHOOL_MIN_YEAR = 1850, SCHOOL_MAX_YEAR = 1994;
/** A footprint this big is a campus or a complex that merely contains the use: left alone. */
export const PUBLIC_MAX_AREA_M2 = 8000;

const round1 = (v: number) => Math.round(v * 10) / 10;
const eraOf = (year: number | null): PublicEra => (year === null || year < 1930 ? 'o' : year < 1960 ? 'e' : 'm');
const PITCHED = /gabled|hipped|gambrel|mansard|saltbox|pitched|skillion/;

/** The generic plan for one public footprint, or null when it keeps whatever the city's rules give it. */
export function planPublic(input: PublicInput): PublicPlan | null {
  const { kind, heightM, year, areaM2, rect } = input, era = eraOf(year);
  if (areaM2 > PUBLIC_MAX_AREA_M2) return null;
  if (kind === 'c') {
    if ((areaM2 < CINEMA_MIN_AREA_M2 && heightM < CINEMA_MIN_HEIGHT_M) || heightM > CINEMA_MAX_HEIGHT_M) return null;
    return { mode: 'p', eavesM: round1(heightM), riseM: 0, era };
  }
  if (kind === 's') {
    if (areaM2 < SCHOOL_MIN_AREA_M2 || heightM < SCHOOL_MIN_HEIGHT_M || year === null || year < SCHOOL_MIN_YEAR || year > SCHOOL_MAX_YEAR) return null;
    const flat: PublicPlan = { mode: 'f', eavesM: round1(heightM), riseM: 0, era };
    // Pitched only for a pre-1930 school that the tiles do not mark flat, on a plain rectangle.
    const wantsRoof = era === 'o' && input.roofShape !== 'flat' && (input.roofShape === undefined || PITCHED.test(input.roofShape));
    if (!wantsRoof || !rect || rect.coverage < SCHOOL_FIT_COVERAGE || rect.maxDev > SCHOOL_FIT_MAX_DEV_M || rect.wid > 22) return flat;
    // The tile height is the 3D BAG's 70th percentile of the roof: 70% of the way from eaves to ridge.
    const share = input.osmPart ? 1 : 0.7;
    let rise = Math.min(5, Math.max(2.5, 0.3 * rect.wid));
    if (heightM - share * rise < 6) rise = (heightM - 6) / share;
    if (rise < 2) return flat;
    return { mode: 'h', eavesM: round1(heightM - share * rise), riseM: round1(rise), era };
  }
  return null;
}

/**
 * One row of classroom windows per storey: tall panes with a stone surround before 1960, a
 * near-continuous ribbon after. Floors come from the eaves height; the top row clears the eaves.
 */
export function schoolWindows(eavesM: number, era: PublicEra): KitWindowRow[] {
  const floorH = era === 'o' ? 4 : era === 'e' ? 3.6 : 3.4;
  const floors = Math.max(1, Math.min(5, Math.round(eavesM / floorH)));
  const step = eavesM / floors, rows: KitWindowRow[] = [];
  const winH = era === 'o' ? 2.5 : era === 'e' ? 2.2 : 1.7, sill = era === 'o' ? 0.9 : 0.8;
  const widthM = era === 'o' ? 2 : era === 'e' ? 2.2 : 3, bayM = era === 'o' ? 3.1 : era === 'e' ? 3.3 : 3.5;
  for (let i = 0; i < floors; i++) {
    const z0 = i * step + sill, z1 = Math.min(z0 + winH, (i + 1) * step - 0.3);
    if (z1 - z0 < 1.2) continue;
    rows.push({ z0: round1(z0), z1: round1(z1), widthM, bayM, head: 'flat' });
  }
  return rows;
}

const KIND_NAME: Record<PublicKind, string> = { c: 'cinema', s: 'school', f: 'fire station', p: 'police station', h: 'hospital', o: 'civic office' };

/** One school's facts (publicBuildingFacts.ts): BAG year, 3DBAG roof type, eaves and ridge, measured wall colour. */
export type SchoolFacts = { year: number | null; roof: 0 | 1 | 2 | 3; eavesM: number | null; ridgeM: number | null; wallHex: string | null; roofFits: boolean };
export const schoolFacts = ([, year, roof, eavesDm, ridgeDm, wallHex, roofFits]: PublicFactsEntry): SchoolFacts =>
  ({ year: year || null, roof, eavesM: eavesDm ? eavesDm / 10 : null, ridgeM: ridgeDm ? ridgeDm / 10 : null, wallHex, roofFits: roofFits === 1 });
const FACTS: ReadonlyMap<string, SchoolFacts> = new Map(PUBLIC_FACTS.map(e => [e[0], schoolFacts(e)]));

/** FNV-1a pick, stable per footprint id (look/palette.ts uses the same hash for its contextual priors). */
const stablePick = <T>(id: string, values: readonly T[]): T => {
  let hash = 2166136261;
  for (const char of id) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return values[(hash >>> 0) % values.length];
};

/**
 * A school's wall colour and where it came from: its own panorama reading lifted into the city's display range
 * (brick by look/palette.ts cityWallTint, a pale or painted wall by cityStuccoTint, so white stays white), else a
 * stable pick from its BAG year's period palette (look/palette.ts PERIOD_WALLS.photo), else the coarse era brick.
 */
export function schoolWall(id: string, era: PublicEra, facts: SchoolFacts | undefined = FACTS.get(id)): { hex: string; source: 'measured' | 'period' | 'era' } {
  if (facts?.wallHex) {
    const rgb = hexToRgb(facts.wallHex);
    return { hex: wallFamily(rgb) === 'brick' ? cityWallTint(facts.wallHex) : cityStuccoTint(facts.wallHex), source: 'measured' };
  }
  const walls = facts?.year ? PERIOD_WALLS.photo[periodForYear(facts.year)] : null;
  if (walls?.length) return { hex: stablePick(id, walls), source: 'period' };
  return { hex: PUBLIC_WALL.s[era], source: 'era' };
}

/** A school built before this year whose 3DBAG roof rises at least SCHOOL_HIP_MIN_RISE_M gets a hipped roof. */
export const SCHOOL_HIP_BEFORE = 1940, SCHOOL_HIP_MIN_RISE_M = 2.5;
/**
 * The hipped school roof's tile: the darkest of the city's pantiles (look/palette.ts ROOF_TONES), since the reviewed
 * pre-war school roofs read dark red-brown to anthracite (sheet rows 5, 14, 19), never the bright default #b5543a.
 */
export const SCHOOL_HIP_TILE = ROOF_TONES.photo.tile[3];
/** Pre-war schools stand at least two classroom storeys under the eaves (sheet rows 3, 14 and 19 all show two). */
export const SCHOOL_HIP_MIN_EAVES_M = 6;

/**
 * The hipped roof of a flat-planned pre-1940 school whose 3DBAG ridge stands clear of its eaves, or null. The ridge
 * is the 3DBAG ridge. The eaves: the 3DBAG eaves is the lowest roof edge anywhere on the pand (a porch, a lean-to),
 * so it is raised to where the tile height (the 3DBAG 70th percentile, `heightM`) puts the main eaves on a roof
 * rising evenly to the ridge, (h70 - 0.7 ridge) / 0.3, and to two storeys at least.
 */
export function schoolHipRoof(facts: SchoolFacts | undefined, heightM: number): { eavesM: number; riseM: number } | null {
  if (!facts?.year || facts.year >= SCHOOL_HIP_BEFORE || facts.ridgeM === null || facts.eavesM === null) return null;
  const eaves = Math.max(facts.eavesM, (heightM - 0.7 * facts.ridgeM) / 0.3, SCHOOL_HIP_MIN_EAVES_M);
  const rise = facts.ridgeM - eaves;
  if (rise < SCHOOL_HIP_MIN_RISE_M) return null;
  return { eavesM: round1(eaves), riseM: round1(rise) };
}

export function publicKit([id, kind, mode, eavesM, riseM, era]: PublicEntry, facts: SchoolFacts | undefined = FACTS.get(id)): Kit {
  const name = `Generic ${KIND_NAME[kind]} ${id}`;
  if (kind === 'c' || mode === 'p') {
    return { name, wall: { plain: true, hex: PUBLIC_WALL.c[era] }, tiers: [], stacks: [], roofs: [], body: [id], trim: plainBodyTrim(era) };
  }
  // A hip whose ring folds on this footprint (publicBuildingFacts.ts roofFits) keeps the flat roof at full height.
  const hip = mode === 'f' && facts?.roofFits !== false ? schoolHipRoof(facts, eavesM) : null;
  const eaves = hip?.eavesM ?? eavesM, rise = hip?.riseM ?? riseM;
  const rows = schoolWindows(eaves, era);
  const windows = { rows, glassHex: '#3a4650', frameHex: era === 'm' ? undefined : '#d8d2c4', plinth: era === 'm' ? undefined : { z1: 0.8, hex: '#8c877d' } };
  return {
    name, wall: { plain: true, hex: schoolWall(id, era, facts).hex }, tiers: [], stacks: [], roofs: [],
    halls: [{ id, widthM: 0, anchor: [0, 0], fit: mode === 'h', ...(hip ? { hip: true, roofHex: SCHOOL_HIP_TILE } : {}), eavesM: eaves, riseM: rise, mat: 'tile', windows }],
  };
}

export const GENERIC_PUBLIC_KITS: Kit[] = PUBLIC_BUILDINGS.map(e => publicKit(e));
