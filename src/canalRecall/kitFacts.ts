/**
 * Measured facts for the generic school, cinema and worship kits (publicBuildingFacts.ts, written by
 * scripts/landmarks/build-public-facts.ts) and the rules that turn them into kit parts. Shared by publicBuildings.ts
 * and worshipBuildings.ts, which import it rather than each other.
 *
 * Kit review round 3 (GitHub #36, 2026-10-24): cinema and church kits were one era colour whatever the photo (25 holds:
 * white render, buff brick, panels), windowless shells where the photo has window rows (14), flat where a steep roof
 * shows or hipped where the photo is flat (14), schools without the white window frames the photos show (10). Now the
 * crops' wall colour, window rows and frame colour, the LoD2.2 roof form (facade/roofPitch.ts) and the orthophoto's
 * roof tint reach those kits too. Every rule is opt in on a measurement: a pand with no reading keeps its old kit.
 */
import type { KitWindowRow, KitWindows } from './landmarkKits.js';
import { labToRgb, rgbToLab } from './look/brickTone.js';
import { cityStuccoTint, cityWallTint, hexToRgb, rgbToHex } from './look/palette.js';
import { wallFamily } from './facade/materials.js';
import { PUBLIC_FACTS, type PublicFactsEntry } from './publicBuildingFacts.js';

export type KitEra = 'o' | 'e' | 'm';
export type RoofForm = 'flat' | 'mixed' | 'pitched' | 'mono';

/** One pand's facts: BAG year, 3DBAG roof code, tile eaves and ridge, measured wall colour, crop glazing, top band,
 *  and (round 3) LoD2.2 roof form with its eaves and ridge, measured roof tint, measured window frame colour. */
export type SchoolFacts = {
  year: number | null; roof: 0 | 1 | 2 | 3; eavesM: number | null; ridgeM: number | null; wallHex: string | null; roofFits: boolean;
  /** As the crops read it (facade/cropWallColour.ts glazingProfile): ribbon, punched, or unknown. */
  glazing?: 'ribbon' | 'punched' | null;
  /** The pale band under the eaves, measured, or null. */
  topBandHex?: string | null;
  /** The crops read enough of the wall and found no window rows (cinema and worship only). */
  blank?: boolean;
  /** The LoD2.2 roof form, null when the pand is not in the cached blades. */
  pitch?: RoofForm | null;
  /** The pitched planes' median eaves and ridge above ground. */
  pitchEavesM?: number | null; pitchRidgeM?: number | null;
  /** The pitched roof's colour as the city draws it (roofs/roofSlots.ts roofSlotHex over the orthophoto reading). */
  roofHex?: string | null;
  /** Pale window frames read in the crops' window rows (raw, white-balanced), or null. */
  frameHex?: string | null;
};
const FORMS: (RoofForm | null)[] = [null, 'flat', 'mixed', 'pitched', 'mono'];
const dm = (v: number | undefined) => (v ? v / 10 : null);
export const schoolFacts = ([, year, roof, eavesDm, ridgeDm, wallHex, roofFits, glazing, topBandHex, pitch, pitchEavesDm, pitchRidgeDm, roofHex, frameHex]: PublicFactsEntry): SchoolFacts => ({
  year: year || null, roof, eavesM: eavesDm ? eavesDm / 10 : null, ridgeM: ridgeDm ? ridgeDm / 10 : null, wallHex, roofFits: roofFits === 1,
  glazing: glazing === 2 ? 'ribbon' : glazing === 1 ? 'punched' : null, topBandHex,
  ...(glazing === 3 ? { blank: true } : {}),
  ...(pitch !== undefined ? { pitch: FORMS[pitch] ?? null, pitchEavesM: dm(pitchEavesDm), pitchRidgeM: dm(pitchRidgeDm), roofHex: roofHex ?? null, frameHex: frameHex ?? null } : {}),
});
export const KIT_FACTS: ReadonlyMap<string, SchoolFacts> = new Map(PUBLIC_FACTS.map(e => [e[0], schoolFacts(e)]));

/**
 * The municipal panoramas draw brick yellower than it is (publicBuildings.ts history, kit review 2): a mid or dark
 * brick (L* under `maxL`, some chroma) keeps its hue up to `from`; past it the hue is pulled back by `(1 - keep)`.
 */
export const PANORAMA_BRICK = { from: 50, keep: 0.4, maxL: 55, minC: 6 } as const;
export function panoramaBrickHue(hex: string): string {
  const [L, a, b] = rgbToLab(hexToRgb(hex)), C = Math.hypot(a, b), h = (Math.atan2(b, a) * 180) / Math.PI;
  if (L >= PANORAMA_BRICK.maxL || C < PANORAMA_BRICK.minC || h <= PANORAMA_BRICK.from || h > 120) return hex;
  const h2 = ((PANORAMA_BRICK.from + (h - PANORAMA_BRICK.from) * PANORAMA_BRICK.keep) * Math.PI) / 180;
  return rgbToHex(labToRgb([L, C * Math.cos(h2), C * Math.sin(h2)]));
}
/** A raw panorama wall reading lifted into the city's display range: brick by cityWallTint after the panorama hue
 *  correction, a pale or painted wall by cityStuccoTint (so white render stays white). */
export function measuredWallDisplay(raw: string): string {
  return wallFamily(hexToRgb(raw)) === 'brick' ? cityWallTint(panoramaBrickHue(raw)) : cityStuccoTint(raw);
}

/** A pitched roof needs at least this rise between the planes' eaves and ridge, or it is a parapet bump. */
export const PITCHED_MIN_RISE_M = 2.5;
/**
 * The hipped roof a pand's LoD2.2 planes call for, or null: only when the form is pitched, eaves at the pitched
 * planes' median eaves (raised to `minEavesM`, never over the tile height), rising to their median ridge.
 */
export function pitchedHip(facts: SchoolFacts | undefined, heightM: number, minEavesM: number): { eavesM: number; riseM: number } | null {
  if (facts?.pitch !== 'pitched' || facts.pitchEavesM == null || facts.pitchRidgeM == null) return null;
  const eaves = Math.min(Math.max(facts.pitchEavesM, minEavesM), heightM), rise = facts.pitchRidgeM - eaves;
  if (rise < PITCHED_MIN_RISE_M) return null;
  return { eavesM: Math.round(eaves * 10) / 10, riseM: Math.round(rise * 10) / 10 };
}

/**
 * One row of large windows per storey: tall panes before 1930, a near-continuous ribbon after (the school's classroom
 * rows, publicBuildings.ts schoolWindows, which re-exports it). Floors come from the eaves height.
 */
export function storeyWindows(eavesM: number, era: KitEra): KitWindowRow[] {
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const floorH = era === 'o' ? 4 : era === 'e' ? 3.6 : 3.4;
  const floors = Math.max(1, Math.min(5, Math.round(eavesM / floorH)));
  const step = eavesM / floors, rows: KitWindowRow[] = [];
  const winH = era === 'o' ? 2.5 : era === 'e' ? 2.2 : 1.7, sill = era === 'o' ? 0.9 : 0.8;
  const widthM = era === 'o' ? 2 : era === 'e' ? 2.2 : 3, bayM = era === 'o' ? 3.1 : era === 'e' ? 3.3 : 3.5;
  for (let i = 0; i < floors; i++) {
    const z0 = i * step + sill, z1 = Math.min(z0 + winH, (i + 1) * step - 0.3);
    if (z1 - z0 < 1.2) continue;
    rows.push({ z0: r1(z0), z1: r1(z1), widthM, bayM, head: 'flat' });
  }
  return rows;
}

/** Ribbon mullions this far apart, in the white frame the photos show (kit review rows 8, 18, 33, 37, 38). */
export const RIBBON_MULLION_M = 1.5, RIBBON_FRAME = '#e4e0d6';
/** Sash bars on a punched window whose crops read pale frames: one mullion and one transom (a multi-pane window). */
export const SASH = { cols: 2, rows: 2 } as const;

/** The measured window frame for display (pale render tint), or null. */
export const measuredFrame = (facts: SchoolFacts | undefined): string | null => (facts?.frameHex ? cityStuccoTint(facts.frameHex) : null);

/**
 * Windows for a body-only cinema or worship kit from its crops: ribbon rows, punched rows, or none when the crops read
 * a blank wall or nothing at all. Measured pale frames frame the openings and divide them into panes.
 */
export function measuredOpenings(eavesM: number, era: KitEra, facts: SchoolFacts | undefined, glassHex: string): KitWindows | null {
  if (!facts?.glazing) return null;
  const frame = measuredFrame(facts), ribbon = facts.glazing === 'ribbon';
  const rows = ribbon ? storeyWindows(eavesM, era).map(r => ({ ...r, ribbon: true, bayM: RIBBON_MULLION_M })) : storeyWindows(eavesM, era);
  if (!rows.length) return null;
  return { rows, glassHex, frameHex: ribbon ? frame ?? RIBBON_FRAME : frame ?? undefined, ...(frame && !ribbon ? { sash: { hex: frame, ...SASH } } : {}) };
}
