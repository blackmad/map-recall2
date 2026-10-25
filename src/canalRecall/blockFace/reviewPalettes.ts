/**
 * Reviewer palette pins for auto-placement (Helmersbuurt 2026-10-25, issue #81).
 *
 * Auto-place measures each pand's wall off its strip (`measuredPalette`). A hazy or flat strip can misread it: Eerste
 * Helmersstraat 55 came out a greenish grey (#666865) beside 57's brown brick of the same row, and Eerste 122's
 * painted-black front came out a plum brick. A reviewer who has looked at the strip pins the pand's palette, with the
 * measurement, in `scripts/block-face/buurten/<buurt>-review-palettes.json`. A pin becomes the placement's
 * `paletteOverrides` (houseType.ts: over the named and measured palette, reported as a type deviation). A pin for a pand
 * placed with another type is left alone. Pure.
 */
import type {Decision} from './autoPlace.ts';
import {PALETTE_OVERRIDE_KEYS} from './houseType.ts';
import type {PaletteIntent} from '../buildingRecipe/intent.ts';

export interface PalettePin {
  pandId: string;
  /** The type the pin is for: a pand placed with another type is left alone. */
  type: string;
  /** House-palette fields (PALETTE_OVERRIDE_KEYS); values are checked by the house intent validation. */
  palette: Partial<PaletteIntent>;
  /** The measurement: strip, span, and how the colour was referenced. */
  reason: string;
}

/** Problems with a pins file. */
export function palettePinProblems(pins: PalettePin[], types: {id: string}[]): string[] {
  const p: string[] = [];
  pins.forEach((pin, k) => {
    const at = `palette pin ${k}`;
    if (!/^\d{16}$/.test(pin.pandId ?? '')) p.push(`${at}: pandId must be a 16-digit BAG pand id`);
    if (!pin.reason) p.push(`${at}: reason required (the strip measurement)`);
    if (!types.some(t => t.id === pin.type)) p.push(`${at}: unknown type ${pin.type}`);
    const keys = pin.palette && typeof pin.palette === 'object' && !Array.isArray(pin.palette) ? Object.keys(pin.palette) : [];
    if (!keys.length) p.push(`${at}: palette must be an object of house-palette fields`);
    for (const key of keys) if (!(PALETTE_OVERRIDE_KEYS as readonly string[]).includes(key)) p.push(`${at}: palette.${key} is not a house-palette field (${PALETTE_OVERRIDE_KEYS.join(', ')})`);
    if (pins.findIndex(x => x.pandId === pin.pandId) !== k) p.push(`${at}: pand ${pin.pandId} pinned twice`);
  });
  return p;
}

/** Apply the pins to one face's decisions (in place); returns the pands changed. */
export function applyPalettePins(decisions: Decision[], pins: PalettePin[]): string[] {
  const changed: string[] = [];
  for (const d of decisions) {
    if (d.kind !== 'placed' || !d.house.type) continue;
    const pin = pins.find(x => x.pandId === d.pandId && x.type === d.typeId);
    if (!pin) continue;
    d.house.type.paletteOverrides = {...d.house.type.paletteOverrides, ...pin.palette};
    d.notes = [...d.notes, `palette pinned: ${pin.reason}`];
    changed.push(d.pandId);
  }
  return changed;
}

/**
 * Reviewer gate floors (`<buurt>-review-accepts.json`, Helmersbuurt 2026-10-25): a pand whose sheet a reviewer judged
 * like the photo, on a strip whose haze puts the edge NCC near the 0.15 gate (Eerste Helmersstraat 120: 0.11-0.19 with
 * the palette and crown band alone), is gated at a lower `minNcc` (never under ACCEPT_FLOOR: some structural agreement
 * stays required). Only for the pinned type; the reason names the sheet that was judged.
 */
export const ACCEPT_FLOOR = 0.08;
export interface AcceptPin { pandId: string; type: string; minNcc: number; reason: string }

export function acceptPinProblems(pins: AcceptPin[], types: {id: string}[]): string[] {
  const p: string[] = [];
  pins.forEach((pin, k) => {
    const at = `accept pin ${k}`;
    if (!/^\d{16}$/.test(pin.pandId ?? '')) p.push(`${at}: pandId must be a 16-digit BAG pand id`);
    if (!types.some(t => t.id === pin.type)) p.push(`${at}: unknown type ${pin.type}`);
    if (!(typeof pin.minNcc === 'number' && pin.minNcc >= ACCEPT_FLOOR && pin.minNcc < 0.15)) p.push(`${at}: minNcc ${ACCEPT_FLOOR}..0.15 (under the gate, over the floor)`);
    if (!pin.reason) p.push(`${at}: reason required (the sheet judged)`);
    if (pins.findIndex(x => x.pandId === pin.pandId) !== k) p.push(`${at}: pand ${pin.pandId} pinned twice`);
  });
  return p;
}

/** The gate's minNcc for one placed pand: the pin's floor for its type, else undefined (the default gate). */
export function acceptFloorFor(pandId: string, typeId: string, pins: AcceptPin[]): number | undefined {
  return pins.find(x => x.pandId === pandId && x.type === typeId)?.minNcc;
}
