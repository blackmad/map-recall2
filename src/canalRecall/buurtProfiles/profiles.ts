/**
 * Per-buurt parameters for the generic facade generator (GitHub #102).
 *
 * Two layers: the city-wide mechanics (bayLook.ts: how walls, white accents and window presets are drawn from a
 * building's facts) and, here, the parameters each neighbourhood feeds them, so an 1890s street in De Pijp and one in
 * Oud-West stop looking alike. The parameters are data (`buurt-profiles.json`, written by
 * scripts/buurt-profiles/derive.ts from measured panorama walls, the block-face strips and the BAG year mix); a profile
 * change needs no code change, only the bundles rebuilt. A building outside every profiled buurt, or with no profile
 * for its era, keeps the city default exactly as before. Every pick is deterministic, hashed by pand id.
 */
import type { Period } from '../look/palette.js';
import { rgbToLab } from '../look/brickTone.js';

/** A swatch and its weight in the buurt's measured distribution. */
export type WeightedHex = readonly [hex: string, weight: number];

/** What the buurt's fronts of one construction period look like (each field optional: absent = city default). */
export interface EraProfile {
  /** Fronts measured for this era (photo walls and block-face houses together). */
  n: number;
  /** Wall colours, brick and painted, calibrated to the city palette's lightness (photo look). */
  walls?: readonly WeightedHex[];
  /** Share of fronts with painted or rendered (not bare brick) walls; informative, already inside `walls`. */
  paintedShare?: number;
  /** Share of fronts with white accents (bands, sills, surrounds, cornices). */
  paleAccentShare?: number;
  /** Share of fronts whose window frames are dark, not white. */
  darkFrameShare?: number;
  /** Share of fronts with arched or segmental window heads. */
  archShare?: number;
  /** Share of fronts whose windows are tall sashes (vs balanced or wide). */
  tallShare?: number;
}

export interface BuurtProfile {
  /** Gebieden code of the area the parameters were pooled over (a buurt like "K24", or a wijk like "K"). */
  code: string;
  name: string;
  level: 'buurt' | 'wijk';
  /** Fronts measured in total, and how far to trust the profile (sample size). */
  n: number;
  confidence: 'high' | 'medium' | 'low';
  eras: Partial<Record<Period, EraProfile>>;
  /** BAG pands per period in the area (all of them, measured or not). */
  yearMix: Partial<Record<Period, number>>;
  /** The period most of the area was built in: the fallback archetype for a pand with no construction year. */
  dominantEra?: Period;
  /** Share of block-face houses with a trading ground floor (used only when the shopfront extract is absent). */
  shopShare?: number;
  /** Crown mix of the measured fronts (cornice, flat, gable, dormer); informative, not yet drawn by the mechanics. */
  crowns?: Partial<Record<'cornice' | 'flat' | 'gable' | 'dormer', number>>;
}

/** Profile index per grid cell (0 = no profile), run-length encoded as "count:index" pairs, row-major from south-west. */
export interface ProfileGrid { west: number; south: number; dLng: number; dLat: number; cols: number; rows: number; rle: string }

export interface BuurtProfileSet {
  schemaVersion: 1;
  revision: string;
  profiles: readonly BuurtProfile[];
  grid: ProfileGrid;
}

const HEX = /^#[0-9a-f]{6}$/i;
const share = (v: unknown) => v === undefined || (typeof v === 'number' && v >= 0 && v <= 1);

/** Throws on a malformed set, so a bad data file fails the build's checks, not a rider's frame. */
export function validateProfileSet(set: BuurtProfileSet): BuurtProfileSet {
  if (set?.schemaVersion !== 1 || !Array.isArray(set.profiles)) throw Error('buurt profiles: schema');
  for (const p of set.profiles) {
    if (typeof p.code !== 'string' || !p.code || !Number.isFinite(p.n)) throw Error(`buurt profiles: ${p.code} header`);
    for (const [era, e] of Object.entries(p.eras ?? {}) as [string, EraProfile | undefined][]) {
      if (!e || !Number.isFinite(e.n)) throw Error(`buurt profiles: ${p.code} ${era} n`);
      if (e.walls && (!e.walls.length || e.walls.some(([hex, w]) => !HEX.test(hex) || !(w > 0)))) throw Error(`buurt profiles: ${p.code} ${era} walls`);
      for (const k of ['paintedShare', 'paleAccentShare', 'darkFrameShare', 'archShare', 'tallShare'] as const) if (!share(e[k])) throw Error(`buurt profiles: ${p.code} ${era} ${k}`);
    }
    if (!share(p.shopShare)) throw Error(`buurt profiles: ${p.code} shopShare`);
  }
  const g = set.grid, cells = g.cols * g.rows;
  let total = 0;
  for (const pair of g.rle ? g.rle.split(',') : []) {
    const [count, index] = pair.split(':').map(Number);
    if (!(count > 0) || !(index >= 0 && index <= set.profiles.length)) throw Error('buurt profiles: grid run');
    total += count;
  }
  if (total !== cells) throw Error(`buurt profiles: grid covers ${total} of ${cells} cells`);
  return set;
}

/** A point lookup over a decoded set. */
export class BuurtProfileIndex {
  private readonly cells: Uint16Array;
  constructor(readonly set: BuurtProfileSet) {
    const g = set.grid;
    this.cells = new Uint16Array(g.cols * g.rows);
    let at = 0;
    for (const pair of g.rle ? g.rle.split(',') : []) {
      const [count, index] = pair.split(':').map(Number);
      this.cells.fill(index, at, at + count); at += count;
    }
  }
  /** The profile at a point, or null outside every profiled area. */
  at(lng: number, lat: number): BuurtProfile | null {
    const g = this.set.grid, c = Math.floor((lng - g.west) / g.dLng), r = Math.floor((lat - g.south) / g.dLat);
    if (!(c >= 0 && c < g.cols && r >= 0 && r < g.rows)) return null;
    const index = this.cells[r * g.cols + c];
    return index ? this.set.profiles[index - 1] : null;
  }
}

/** Weighted deterministic pick: `unit` in [0, 1). */
export function pickWeighted(items: readonly WeightedHex[], unit: number): string {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = unit * total;
  for (const [hex, w] of items) { if (x < w) return hex; x -= w; }
  return items[items.length - 1][0];
}

/** A pand-stable unit draw per purpose (independent salts so traits do not correlate). */
export function unitDraw(id: string, salt: string): number {
  let hash = 2166136261;
  const s = `${salt}|${id}`;
  for (let i = 0; i < s.length; i++) { hash ^= s.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  hash ^= hash >>> 15; hash = Math.imul(hash, 0x2c1b3c6d); hash ^= hash >>> 12;
  return (hash >>> 0) / 2 ** 32;
}

/** The traits a profiled building draws (each null when the profile has no opinion). */
export interface ProfileTraits { wall: string | null; pale: boolean | null; dark: boolean | null; arch: boolean | null; tall: boolean | null }

export function profileTraits(id: string, era: EraProfile | undefined): ProfileTraits {
  const draw = (key: keyof EraProfile, salt: string) => { const v = era?.[key]; return typeof v === 'number' ? unitDraw(id, salt) < v : null; };
  return {
    wall: era?.walls?.length ? pickWeighted(era.walls, unitDraw(id, 'wall')) : null,
    pale: draw('paleAccentShare', 'pale'), dark: draw('darkFrameShare', 'dark'), arch: draw('archShare', 'arch'), tall: draw('tallShare', 'tall'),
  };
}

/** A light, near-neutral swatch (white or cream paint, render): what derive.ts calls painted. */
export function isPaintedHex(hex: string): boolean {
  const [L, a, b] = rgbToLab([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);
  return L >= 62 && Math.hypot(a, b) < 14;
}

/**
 * Whether a profiled wall replaces an OSM `building:material` display prior (palette.ts MATERIAL_WALL_COLOURS): the
 * prior is one hue per material family for the whole city, the profile the buurt's measured spread, so the profile wins
 * when it agrees on the family (a brick prior takes a brick swatch, a plaster or stucco prior a painted one).
 */
export function profileWallBeatsMaterial(material: unknown, wall: string): boolean {
  const key = typeof material === 'string' ? material.trim().toLowerCase() : '';
  if (key === 'brick') return !isPaintedHex(wall);
  if (key === 'plaster' || key === 'stucco') return isPaintedHex(wall);
  return false;
}
