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

import type { Kit, KitWindowRow } from './landmarkKits.js';
import { PUBLIC_BUILDINGS, type PublicEntry } from './publicBuildingData.js';

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

export function publicKit([id, kind, mode, eavesM, riseM, era]: PublicEntry): Kit {
  const name = `Generic ${KIND_NAME[kind]} ${id}`;
  if (kind === 'c' || mode === 'p') {
    return { name, wall: { plain: true, hex: PUBLIC_WALL.c[era] }, tiers: [], stacks: [], roofs: [], body: [id] };
  }
  const rows = schoolWindows(eavesM, era);
  const windows = { rows, glassHex: '#3a4650', frameHex: era === 'm' ? undefined : '#d8d2c4', plinth: era === 'm' ? undefined : { z1: 0.8, hex: '#8c877d' } };
  return {
    name, wall: { plain: true, hex: PUBLIC_WALL.s[era] }, tiers: [], stacks: [], roofs: [],
    halls: [{ id, widthM: 0, anchor: [0, 0], fit: mode === 'h', eavesM, riseM, mat: 'tile', windows }],
  };
}

export const GENERIC_PUBLIC_KITS: Kit[] = PUBLIC_BUILDINGS.map(publicKit);
