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
//
// Kit colour round 2 (2026-10-24, GitHub #34): crops are white-balanced on their light trim and leaf shade is masked
// before the wall is read (facade/cropWallColour.ts); a wall outside every masonry family (a mural) is dropped; the
// panoramas' yellow brick hue is pulled back for display (panoramaBrickHue); the fallback for an unmeasured school is
// the measured walls of its period (SCHOOL_PERIOD_WALLS), not the city prior; ribbon glazing and a white top band
// where the crops show them.

import type { Kit, KitWindowRow, KitWindows } from './landmarkKits.js';
import { plainBodyTrim } from './worshipBuildings.js';
import { applyKitFacade } from './kitFacades.js';
import { PUBLIC_BUILDINGS, type PublicEntry } from './publicBuildingData.js';
import { NOT_PUBLIC_FORM, PUBLIC_RETYPE } from './kitTypeOverrides.js';
import { SCHOOL_PERIOD_WALLS } from './publicBuildingFacts.js';
import { PERIOD_WALLS, ROOF_TONES, cityStuccoTint, periodForYear } from './look/palette.js';
import { KIT_FACTS as FACTS, PANORAMA_BRICK, RIBBON_FRAME, RIBBON_MULLION_M, SASH, measuredFrame, measuredOpenings, measuredRows, measuredWallDisplay, panoramaBrickHue, pitchedHip, schoolFacts, storeyWindows, type SchoolFacts } from './kitFacts.js';

export { PANORAMA_BRICK, panoramaBrickHue, schoolFacts, type SchoolFacts };
/** A raw panorama wall reading lifted into the city's display range (kitFacts.ts measuredWallDisplay). */
export const schoolWallDisplay = measuredWallDisplay;

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
/**
 * Under this footprint a cinema-tagged part is a lift core, a pylon or a sign, whatever its height: the height escape
 * above (CINEMA_MIN_HEIGHT_M) took the Bijlmerbios complex's 20 m2, 30 m part w1488019256 as a film house (kit review
 * round 4, GitHub #43, row 316: a free-standing windowless pillar). kitTypeOverrides.ts drops it from the published data.
 */
export const CINEMA_MIN_PART_AREA_M2 = 50;
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
    if ((areaM2 < CINEMA_MIN_AREA_M2 && heightM < CINEMA_MIN_HEIGHT_M) || heightM > CINEMA_MAX_HEIGHT_M || areaM2 < CINEMA_MIN_PART_AREA_M2) return null;
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


/** One row of classroom windows per storey (kitFacts.ts storeyWindows). */
export const schoolWindows = storeyWindows;

const KIND_NAME: Record<PublicKind, string> = { c: 'cinema', s: 'school', f: 'fire station', p: 'police station', h: 'hospital', o: 'civic office' };


/** FNV-1a pick, stable per footprint id (look/palette.ts uses the same hash for its contextual priors). */
const stablePick = <T>(id: string, values: readonly T[]): T => {
  let hash = 2166136261;
  for (const char of id) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return values[(hash >>> 0) % values.length];
};



/**
 * A school's wall colour and where it came from: its own panorama reading (publicBuildingFacts.ts) lifted for display,
 * else a stable pick from the measured walls of schools of its BAG period (SCHOOL_PERIOD_WALLS, lifted the same way),
 * else from the city's period palette (look/palette.ts PERIOD_WALLS.photo), else the coarse era brick.
 */
export function schoolWall(id: string, era: PublicEra, facts: SchoolFacts | undefined = FACTS.get(id)): { hex: string; source: 'measured' | 'period' | 'era' } {
  if (facts?.wallHex) return { hex: schoolWallDisplay(facts.wallHex), source: 'measured' };
  const period = facts?.year ? periodForYear(facts.year) : null;
  const measured = period ? SCHOOL_PERIOD_WALLS[period] : undefined;
  if (measured?.length) return { hex: schoolWallDisplay(stablePick(id, measured)), source: 'period' };
  const walls = period ? PERIOD_WALLS.photo[period] : null;
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

/** Ribbon glazing (a school whose crops read ribbon windows): mullions this far apart, white frames as the photos show
 *  them (kit review rows 8, 18, 33, 37, 38). */
export const SCHOOL_RIBBON_MULLION_M = RIBBON_MULLION_M, SCHOOL_RIBBON_FRAME = RIBBON_FRAME;
/** Depth of the white top band: the 1920s-30s schools' deep parapet band (rows 37, 38: ~1.4 m), the later fascia. */
export const SCHOOL_TOP_BAND_M = { o: 1.2, m: 0.7 } as const;

/**
 * The roof a school's facts call for. A pand with a LoD2.2 roof form (round 3, GitHub #36) is hipped only where its
 * planes are pitched (any year; two storeys under a pre-1940 roof, one after), so a flat Amsterdam School front stays
 * flat (rows 301, 304) and a pitched 1979 pavilion is roofed (row 520). A pand outside the cached blades keeps the
 * kit review 1 rule (schoolHipRoof).
 */
export function schoolRoof(facts: SchoolFacts | undefined, heightM: number): { eavesM: number; riseM: number; pitchDeg?: number } | null {
  if (facts?.pitch === undefined || facts.pitch === null) return schoolHipRoof(facts, heightM);
  return pitchedHip(facts, heightM, (facts.year ?? 0) < SCHOOL_HIP_BEFORE ? SCHOOL_HIP_MIN_EAVES_M : SCHOOL_PITCHED_MIN_EAVES_M);
}
/** A post-1940 pitched school stands one storey under its eaves at least. */
export const SCHOOL_PITCHED_MIN_EAVES_M = 3;

/**
 * A generic cinema or theatre: plain walls in its measured colour (else the era's), the crops' window rows when they
 * read any (round 3: rows 300, 306, 318, 320, 355, 364, 372), and a hipped roof over a pre-1960 house whose LoD2.2
 * planes are pitched (rows 305, 363). With no measurement it is the plain body it was.
 */
function cinemaKit(name: string, id: string, eavesM: number, era: PublicEra, facts: SchoolFacts | undefined): Kit {
  const hex = facts?.wallHex ? measuredWallDisplay(facts.wallHex) : PUBLIC_WALL.c[era];
  const hip = era !== 'm' && facts?.roofFits !== false ? pitchedHip(facts, eavesM, 4) : null;
  const eaves = hip?.eavesM ?? eavesM, windows = measuredOpenings(eaves, era, facts, '#3a434c');
  if (!hip && !windows) return { name, wall: { plain: true, hex }, tiers: [], stacks: [], roofs: [], body: [id], trim: plainBodyTrim(era) };
  if (windows && era !== 'm') windows.plinth = { z1: 0.6, hex: '#8c877d' };
  return {
    name, wall: { plain: true, hex }, tiers: [], stacks: [], roofs: [],
    halls: [{ id, widthM: 0, anchor: [0, 0], ...(hip ? { hip: true, roofHex: facts?.roofHex ?? SCHOOL_HIP_TILE, ...(hip.pitchDeg ? { pitchDeg: hip.pitchDeg } : {}) } : {}), eavesM: eaves, riseM: hip?.riseM ?? 0, mat: 'slate', ...(windows ? { windows } : {}) }],
  };
}

export function publicKit([id, kind, mode, eavesM, riseM, era]: PublicEntry, facts: SchoolFacts | undefined = FACTS.get(id)): Kit {
  const name = `Generic ${KIND_NAME[kind]} ${id}`;
  if (kind === 'c' || mode === 'p') return cinemaKit(name, id, eavesM, era, facts);
  // Kit review round 4 (GitHub #43, rows 161, 172): planPublic roofs a pre-1930 rectangle from the tile roof code alone;
  // where the LoD2.2 planes say flat or only partly pitched (the rule schoolRoof applies to flat plans), the school is
  // drawn flat at its tile height (eaves + the 70th-percentile share of the planned rise, as planPublic split it).
  if (mode === 'h' && (facts?.pitch === 'flat' || facts?.pitch === 'mixed')) {
    const share = /^w\d+$/.test(id) ? 1 : 0.7;
    return publicKit([id, kind, 'f', round1(eavesM + share * riseM), 0, era], facts);
  }
  // A hip whose ring folds on this footprint (publicBuildingFacts.ts roofFits) keeps the flat roof at full height.
  const hip = mode === 'f' && facts?.roofFits !== false ? schoolRoof(facts, eavesM) : null;
  const eaves = hip?.eavesM ?? eavesM, rise = hip?.riseM ?? riseM;
  const ribbon = facts?.glazing === 'ribbon', frame = measuredFrame(facts);
  // Round 4 (GitHub #43): only the storeys where light-walled crops saw windows (kitFacts.ts measuredRows).
  const rows = measuredRows(ribbon ? schoolWindows(eaves, era).map(r => ({ ...r, ribbon: true, bayM: SCHOOL_RIBBON_MULLION_M })) : schoolWindows(eaves, era), facts);
  const windows: KitWindows = { rows, glassHex: '#3a4650', frameHex: ribbon ? SCHOOL_RIBBON_FRAME : frame ?? (era === 'm' ? undefined : '#d8d2c4'), plinth: era === 'm' ? undefined : { z1: 0.8, hex: '#8c877d' } };
  // Round 3 (rows 337, 344, 345, 482, 488, 491, 494, 495, 519): punched windows whose crops read pale frames are framed
  // in that colour and divided into panes.
  if (frame && !ribbon) windows.sash = { hex: frame, ...SASH };
  // The measured pale band under the eaves, on a flat-roofed school (a hipped roof's eaves have no parapet band).
  // Window rows give way to it: a row whose head would run into the band is cut under it, or dropped when too short.
  if (facts?.topBandHex && !hip && mode === 'f') {
    const m = era === 'o' ? SCHOOL_TOP_BAND_M.o : SCHOOL_TOP_BAND_M.m, top = round1(eaves - m - 0.2);
    windows.topBand = { m, hex: cityStuccoTint(facts.topBandHex) };
    windows.rows = rows.map(r => (r.z1 > top ? { ...r, z1: top } : r)).filter(r => r.z1 - r.z0 >= 1);
  }
  // A light wall the crops read blank (round 4: no measured row survives) and nothing else to draw: the plain body.
  if (!windows.rows.length && !hip && mode === 'f' && !windows.topBand) return { name, wall: { plain: true, hex: schoolWall(id, era, facts).hex }, tiers: [], stacks: [], roofs: [], body: [id], trim: plainBodyTrim(era) };
  // The orthophoto's tint on a pitched school roof, where measured (round 3, review A rows 117-285: salmon where the
  // photo is dark slate); else the dark pantile.
  const roofHex = hip || mode === 'h' ? facts?.roofHex ?? (hip ? SCHOOL_HIP_TILE : undefined) : undefined;
  return {
    name, wall: { plain: true, hex: schoolWall(id, era, facts).hex }, tiers: [], stacks: [], roofs: [],
    halls: [{ id, widthM: 0, anchor: [0, 0], fit: mode === 'h', ...(hip ? { hip: true } : {}), ...(hip?.pitchDeg ? { pitchDeg: hip.pitchDeg } : {}), ...(roofHex ? { roofHex } : {}), eavesM: eaves, riseM: rise, mat: 'tile', windows }],
  };
}

// Wrong-form footprints (kitTypeOverrides.ts) are dropped or drawn as the kind they look like.
// Cladding and curtain-wall facades read off the crops by hand (kitFacades.ts, GitHub #49) replace the measured walls.
export const GENERIC_PUBLIC_KITS: Kit[] = PUBLIC_BUILDINGS.filter(e => !NOT_PUBLIC_FORM[e[0]])
  .map(e => { const r = PUBLIC_RETYPE[e[0]]; return applyKitFacade(r ? publicKit(r.entry, r.facts) : publicKit(e), e[0], (r?.entry ?? e)[3]); });
