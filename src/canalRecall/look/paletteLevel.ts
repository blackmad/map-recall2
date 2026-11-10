// Palette level (lane palette-level, 2026-11-09, brief docs/handoffs/lane-palette-level-20261107.md).
//
// One city-wide levelling of the wall tints, in CIE LCH: L* shifted by PALETTE_LEVEL.dL, C* scaled by
// PALETTE_LEVEL.chroma, hue untouched. The two numbers are the negated medians of (rendered - measured) over the
// buurt profiles' wall swatches, per scripts/look/palette-level-table.ts; the unit test pins the medians to zero.
// `?paletteLevel=0` turns it off for the before. Pure: no I/O, no DOM beyond the optional location read.

import { labToRgb, rgbToLab } from './brickTone.js';
import { hexToRgb, rgbToHex } from './palette.js';

/** The levelling: L* added, C* multiplied. Identity = off. */
export type PaletteLevel = { readonly dL: number; readonly chroma: number };
export const PALETTE_LEVEL_OFF: PaletteLevel = { dL: 0, chroma: 1 };
/** The measured constants (see HISTORY.md, palette level). */
export const PALETTE_LEVEL: PaletteLevel = { dL: -1, chroma: 0.91 };

/** Opt-in: `?paletteLevel=1` (kept off 2026-11-10: a ~2 dE darker, less saturated shift against the user's brighter-palette priority). */
export function paletteLevelEnabled(search?: string): boolean {
  const g = globalThis as { location?: { search?: string }; __canalRecallPaletteLevel?: string };
  const s = search ?? g.location?.search ?? '';
  const m = /[?&]paletteLevel=([\w.-]+)/.exec(s);
  return (m?.[1] ?? g.__canalRecallPaletteLevel) === '1';
}

/** Level one colour (sRGB bytes) by `level`. */
export function levelRgb(rgb: readonly number[], level: PaletteLevel = PALETTE_LEVEL): [number, number, number] {
  if (level.dL === 0 && level.chroma === 1) return [rgb[0], rgb[1], rgb[2]];
  const [L, a, b] = rgbToLab(rgb);
  return labToRgb([Math.max(0, Math.min(100, L + level.dL)), a * level.chroma, b * level.chroma]);
}

/** The levelled wall tint for a wall hex; the identity when the flag is off or the constants are neutral. */
export function levelWallHex(hex: string, level: PaletteLevel = paletteLevelEnabled() ? PALETTE_LEVEL : PALETTE_LEVEL_OFF): string {
  if (level.dL === 0 && level.chroma === 1) return hex;
  return rgbToHex(levelRgb(hexToRgb(hex), level));
}

// ---------------------------------------------------------------------------
// The browser-measured transfer of a wall tint (tests/e2e/palette-level.spec.ts), for the Node table.
// ---------------------------------------------------------------------------

/** Median rendered sRGB of the sun-facing wall pixels for one test tint (the shade side is derived, see `applyTransfer`). */
export type TransferRow = { sun: number[] };
export type ChannelFit = { gain: number; off: number };
export type TransferFit = { sun: ChannelFit[]; error: number };

const lin = (v: number) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const unlin = (c: number) => 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const clampB = (v: number) => Math.max(0, Math.min(255, v));

/** CIE76 distance between two sRGB colours. */
export function deltaE76(p: readonly number[], q: readonly number[]): number {
  const a = rgbToLab(p), b = rgbToLab(q);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Per-channel least squares of rendered = gain * tint + off on the sun side, on the tints whose output is not clipped; `error` = mean dE76 over them. */
export function fitTransfer(rows: Record<string, TransferRow>): TransferFit {
  const usable = Object.entries(rows).filter(([hex, r]) => hex !== '#000000' && hex !== '#ffffff' && r.sun.every(v => v < 250));
  const sun = [0, 1, 2].map(c => {
    const pts = usable.map(([hex, r]) => [parseInt(hex.slice(1 + 2 * c, 3 + 2 * c), 16), r.sun[c]] as const);
    const n = pts.length, sx = pts.reduce((s, p) => s + p[0], 0), sy = pts.reduce((s, p) => s + p[1], 0);
    const sxx = pts.reduce((s, p) => s + p[0] * p[0], 0), sxy = pts.reduce((s, p) => s + p[0] * p[1], 0);
    const gain = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    return { gain, off: (sy - gain * sx) / n };
  });
  const fit: TransferFit = { sun, error: 0 };
  fit.error = usable.reduce((s, [hex, r]) => s + deltaE76(applyTransfer(fit, hex, 'sun'), r.sun), 0) / usable.length;
  return fit;
}

/**
 * The rendered sRGB of a wall tint on the sun side (measured), the shade side (the sun side at SHADE_RATIO of its linear
 * light: the rig's design ratio, look/sunny.ts SUNNY_SHADE_RATIO 0.55; not measured by the transfer frames) or the
 * equal-light mix of both.
 */
export const SHADE_RATIO = 0.55;
export function applyTransfer(fit: TransferFit, hex: string, side: 'sun' | 'shade' | 'mix'): [number, number, number] {
  const sun = [0, 1, 2].map(c => clampB(fit.sun[c].gain * parseInt(hex.slice(1 + 2 * c, 3 + 2 * c), 16) + fit.sun[c].off));
  if (side === 'sun') return sun as [number, number, number];
  const k = side === 'shade' ? SHADE_RATIO : (1 + SHADE_RATIO) / 2;
  return sun.map(v => unlin(lin(v) * k)) as [number, number, number];
}
