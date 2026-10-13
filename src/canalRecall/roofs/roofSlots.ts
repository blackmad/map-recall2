/**
 * Roof slots from the open aerial photo: the pure part.
 *
 * `scripts/roofs/build-roof-facts.ts` samples the PDOK orthophoto (Beeldmateriaal Nederland, CC BY 4.0)
 * inside each pand's eroded outline and calls `classifyRoof`; the runtime reads the result from the
 * `roof-facts/14/x/y.json.gz` sidecar (same z14 grid as `bag-facts`) through `roofFactsEnricher`.
 * This module decides *which* slot a roof gets; `look/palette.ts` `ROOF_SLOT_TONES` decides how a
 * slot looks, and `roofSlotHex` keeps every measured tint inside its slot's luma band.
 *
 * Classification is colour heuristics, explainable and bounded:
 *   1. per pixel: shadow (dark relative to the roof's own bright half), vegetation (excess green),
 *      solar (dark, blue over red), red tile, warm brown, white, timber (warm, light);
 *   2. per roof: shares of those classes among the lit pixels decide the slot; the 3DBAG roof type
 *      (flat / pitched) picks between the flat and pitched readings of the neutral greys
 *      (dark: bitumen-dark or slate; mid: gravel or slate; light: bitumen-light or zinc).
 * Accuracy is measured against a hand-labelled 100 (`scripts/roofs/fixtures/roof-labels-100.json`).
 */
import { ROOF_SLOTS, ROOF_SLOT_TONES, hexToRgb, lumaOf, rgbToHex, rgbToHsl, hslToRgb, type RGB, type RoofSlot } from '../look/palette.js';

export { ROOF_SLOTS, ROOF_SLOT_TONES, type RoofSlot };

/** 3DBAG `b3_dak_type` as bag-tiles carry it: 0 unknown, 1 flat, 2 several flats, 3 pitched. */
export const isPitchedCode = (roof: number): boolean => roof === 3;

/** Appearance families used for hand labels (coarser than slots, roof-type independent). */
export type RoofFamily = 'R' | 'B' | 'D' | 'M' | 'L' | 'W' | 'G' | 'S' | 'T' | 'X';

export type PixelClass = 'shadow' | 'green' | 'solar' | 'red' | 'brown' | 'white' | 'timber' | 'neutral';

/** Luma below which a pixel is shadow, given the roof's 75th-percentile luma. */
export const shadowLuma = (p75: number): number => Math.min(72, Math.max(34, p75 * 0.5));

export function pixelClass(r: number, g: number, b: number, shadowBelow: number): PixelClass {
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (2 * g - r - b > 18 && g > r + 4 && g >= b) return 'green';
  if (y < shadowBelow) return b > r + 14 && y > 22 ? 'solar' : 'shadow';
  if (r - g > 16 && r - b > 22) return 'red';
  if (y < 92 && b > r + 10 && b >= g + 2) return 'solar';
  if (y > 196 && Math.max(r, g, b) - Math.min(r, g, b) < 30) return 'white';
  if (r - b > 22 && r - g > 5 && y >= 125) return 'timber';
  if (r - b > 9 && r - g > 3 && y < 125) return 'brown';
  return 'neutral';
}

export type RoofReading = {
  slot: RoofSlot;
  family: RoofFamily;
  /** Median colour of the pixels that won, sRGB. */
  rgb: RGB;
  /** 0..1: winning share times sample sufficiency. */
  confidence: number;
  /** Share of lit roof pixels that read as solar panels. */
  solarShare: number;
  /** Timber decking or clutter on a flat roof: a roof terrace. */
  terrace: boolean;
  /** Lit pixels used. */
  n: number;
  shares: Partial<Record<PixelClass, number>>;
  /** Median luma of the winning pixels (cast removed). */
  luma: number;
};

const median = (values: number[]): number => { if (!values.length) return 0; const s = values.slice().sort((a, b) => a - b); return s[s.length >> 1]; };
const medianRgb = (rgb: ArrayLike<number>, idx: number[]): RGB => [median(idx.map(i => rgb[i * 3])), median(idx.map(i => rgb[i * 3 + 1])), median(idx.map(i => rgb[i * 3 + 2]))];

/**
 * The orthophoto's colour cast by luma: [luma, r - y, g - y, b - y] medians over a city-wide roof
 * sample (`scripts/roofs/calibrate-cast.mts`, 735 roofs, PDOK Actueel_ortho25 at L14, 2026-10-13).
 * Dark roofs read teal and light roofs yellow in this mosaic; most roofs are neutral, so the median
 * is the cast. Subtracted before classifying; a real red or green stays far from it.
 */
export type OrthoCast = ReadonlyArray<readonly [number, number, number, number]>;
export const ORTHO25_CAST: OrthoCast = [[52, -15.5, 3.7, 10.1], [60, -15.2, 3.7, 7.5], [68, -14.2, 3.6, 3.4], [76, -12.2, 3.4, 2.2], [84, -9.7, 3, -1.2], [92, -9.3, 2.9, -2.7], [100, -9.2, 2.9, -3.3], [108, -8.4, 2.8, -5], [116, -7.3, 2.8, -5.6], [124, -7.1, 2.7, -6.2], [132, -4.9, 2.3, -8.1], [140, -3.9, 2.1, -9.9], [148, -2.1, 1.9, -11.7], [156, -1.1, 1.6, -12.6], [164, -0.8, 1.4, -13.1], [172, -0.4, 1.3, -13.1], [180, -0.2, 1.3, -12.8], [188, -0.6, 1.3, -12.1], [196, -0.6, 1.2, -12], [204, -0.8, 1.4, -10.4], [212, -0.6, 1.2, -11.1], [220, -0.6, 1.1, -7.2], [228, -0.8, 0.8, -7.2], [236, -0.6, 0.8, -5.9], [244, -0.2, 0.6, -4.9], [252, 0, 0.2, -2.1]];
export function castAt(cast: OrthoCast, y: number): [number, number, number] {
  if (y <= cast[0][0]) return [cast[0][1], cast[0][2], cast[0][3]];
  for (let i = 1; i < cast.length; i++) if (y <= cast[i][0]) {
    const a = cast[i - 1], b = cast[i], t = (y - a[0]) / (b[0] - a[0]);
    return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
  }
  const z = cast[cast.length - 1]; return [z[1], z[2], z[3]];
}
export function removeCast(rgb: ArrayLike<number>, n: number, cast: OrthoCast): Uint8Array {
  const out = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2], [cr, cg, cb] = castAt(cast, 0.2126 * r + 0.7152 * g + 0.0722 * b);
    out[i * 3] = Math.max(0, Math.min(255, Math.round(r - cr))); out[i * 3 + 1] = Math.max(0, Math.min(255, Math.round(g - cg))); out[i * 3 + 2] = Math.max(0, Math.min(255, Math.round(b - cb)));
  }
  return out;
}

/** The neutral surface tone is this percentile of its lumas (skylights and kit lift a median), and the D/M/L cuts on it. */
export let SURFACE_PERCENTILE = 0.3, DARK_BELOW = 116, LIGHT_FROM = 158;
export function tuneNeutral(p: number, dark: number, light: number) { SURFACE_PERCENTILE = p; DARK_BELOW = dark; LIGHT_FROM = light; }

/** Minimum lit pixels for a reading at all. */
export const MIN_PIXELS = 12;

/**
 * Classify one roof from its sampled pixels (`rgb` = n RGB triples) and its 3DBAG roof code.
 * Returns null when there is not enough lit roof to say anything.
 */
export function classifyRoof(raw: ArrayLike<number>, n: number, roofCode: number, cast: OrthoCast | null = ORTHO25_CAST): RoofReading | null {
  if (n < MIN_PIXELS) return null;
  const rgb = cast ? removeCast(raw, n, cast) : raw;
  const lumas: number[] = [];
  for (let i = 0; i < n; i++) lumas.push(0.2126 * rgb[i * 3] + 0.7152 * rgb[i * 3 + 1] + 0.0722 * rgb[i * 3 + 2]);
  const sorted = lumas.slice().sort((a, b) => a - b), p75 = sorted[Math.floor(n * 0.75)];
  const below = shadowLuma(p75);
  const by: Record<PixelClass, number[]> = { shadow: [], green: [], solar: [], red: [], brown: [], white: [], timber: [], neutral: [] };
  for (let i = 0; i < n; i++) by[pixelClass(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2], below)].push(i);
  const lit = n - by.shadow.length;
  if (lit < MIN_PIXELS) return null;
  const share = (k: PixelClass) => by[k].length / lit;
  const shares: RoofReading['shares'] = {};
  for (const k of Object.keys(by) as PixelClass[]) if (k !== 'shadow' && by[k].length) shares[k] = +share(k).toFixed(3);
  shares.shadow = +(by.shadow.length / n).toFixed(3);
  const pitched = isPitchedCode(roofCode);
  const sufficiency = Math.min(1, lit / 80);
  const solarShare = share('solar');
  const timber = share('timber');
  const finish = (slot: RoofSlot, family: RoofFamily, idx: number[], win: number, terrace = false): RoofReading =>
    ({ slot, family, rgb: medianRgb(rgb, idx.length ? idx : by.neutral), confidence: +(Math.min(1, win) * sufficiency).toFixed(2), solarShare: +solarShare.toFixed(2), terrace, n: lit, shares, luma: Math.round(median((idx.length ? idx : by.neutral).map(i => lumas[i]))) });

  // Vegetation: a sedum roof when flat; over a pitched roof it is a tree canopy, so read what is left.
  const green = share('green');
  if (green > 0.45 && !pitched) return finish('sedum', 'G', by.green, green);
  if (solarShare > 0.42) return finish('solar', 'S', by.solar, solarShare);
  const red = share('red');
  if (red > 0.25) return finish('pantile-red', 'R', by.red, red / 0.6);
  const white = share('white');
  if (white > 0.45) return finish('white-membrane', 'W', by.white, white);
  const brown = share('brown') + (pitched ? timber : 0);
  if (brown > 0.3) return finish('pantile-dark', 'B', [...by.brown, ...(pitched ? by.timber : [])], brown);
  const clutter = !pitched && timber > 0.12 && share('neutral') < 0.75;
  if (!pitched && timber > 0.4) return finish('terrace', 'T', by.timber, timber, true);
  // Neutral greys (the rest, plus small minorities of anything else).
  const rest = [...by.neutral, ...by.white, ...by.timber, ...by.brown];
  const restLumas = rest.map(i => lumas[i]).sort((a, b) => a - b), y = restLumas[Math.floor(restLumas.length * SURFACE_PERCENTILE)] ?? 0;
  const neutralShare = rest.length / lit;
  if (y < DARK_BELOW) return finish(pitched ? 'slate' : 'bitumen-dark', 'D', rest, neutralShare, clutter);
  if (y < LIGHT_FROM) return finish(pitched ? 'slate' : 'gravel', 'M', rest, neutralShare, clutter);
  return finish(pitched ? 'zinc' : 'bitumen-light', 'L', rest, neutralShare, clutter);
}

/** The slot a hand label means, given the roof type (for accuracy against the labelled 100). */
export function slotForFamily(family: RoofFamily, roofCode: number): RoofSlot | null {
  const pitched = isPitchedCode(roofCode);
  switch (family) {
    case 'R': return 'pantile-red';
    case 'B': return 'pantile-dark';
    case 'D': return pitched ? 'slate' : 'bitumen-dark';
    case 'M': return pitched ? 'slate' : 'gravel';
    case 'L': return pitched ? 'zinc' : 'bitumen-light';
    case 'W': return 'white-membrane';
    case 'G': return pitched ? null : 'sedum';
    case 'S': return 'solar';
    case 'T': return 'terrace';
    case 'X': return 'glass';
  }
}

/**
 * The display colour for a measured roof: the slot's base moved halfway toward the measured
 * colour (orthophotos are hazy and blue-shifted, so the photo alone is not the paint), then pulled
 * into the slot's luma band. With no measurement, the slot's base.
 */
export function roofSlotHex(slot: RoofSlot, measured?: RGB | null, weight = 0.5): string {
  const tone = ROOF_SLOT_TONES[slot], base = hexToRgb(tone.hex);
  let c: RGB = measured ? [base[0] + (measured[0] - base[0]) * weight, base[1] + (measured[1] - base[1]) * weight, base[2] + (measured[2] - base[2]) * weight] : base;
  // The photo moves the hue a little, never the saturation far: a flat roof must not turn teal or brick.
  { const [h, s, l] = rgbToHsl(c), cap = rgbToHsl(base)[1] + 0.12; if (s > cap) c = hslToRgb([h, cap, l]); }
  const [lo, hi] = tone.luma;
  for (let k = 0; k < 4; k++) {
    const y = lumaOf(c);
    if (y >= lo && y <= hi) break;
    const target = y < lo ? lo + 1 : hi - 1;
    const [h, s, l] = rgbToHsl(c);
    c = hslToRgb([h, s, Math.max(0, Math.min(1, l * target / Math.max(1, y)))]);
  }
  const hex = rgbToHex(c), y = lumaOf(hexToRgb(hex));
  return y >= lo && y <= hi ? hex : tone.hex;
}

// ---------------------------------------------------------------------------
// Roof furniture (measured placements on a roof)
// ---------------------------------------------------------------------------

export type FurnitureKind = 'chimney' | 'vent' | 'skylight' | 'hvac' | 'overrun' | 'solar' | 'railing';
export const FURNITURE_KINDS: readonly FurnitureKind[] = ['chimney', 'vent', 'skylight', 'hvac', 'overrun', 'solar', 'railing'];
/**
 * One placed item: kind, centre east/north metres from the pand's anchor vertex (the first vertex of
 * its first outer ring, scaled locally like `roofMesh.localOuterRing`), footprint size and yaw.
 */
export type FurnitureItem = { kind: FurnitureKind; e: number; n: number; w: number; l: number; yawDeg: number };

// ---------------------------------------------------------------------------
// Sidecar format: roof-facts/14/x/y.json.gz
// ---------------------------------------------------------------------------

/**
 * Columnar, so gzip sees runs: sorted numeric pand ids delta-encoded, then one array per field.
 * Colours are 5:5:5 (a roof tint does not need more); confidence and solar share in tenths.
 * Only readings at or above `MIN_CONFIDENCE` are stored; `read` counts every roof that was read.
 */
export type RoofFactTile = {
  version: 1;
  licence: string;
  imagery: string;
  slots: readonly RoofSlot[];
  /** Roofs read in this tile (stored or not). */
  read: number;
  /** Sorted numeric BAG pand ids, delta-encoded (first absolute). */
  ids: number[];
  /** Index into `slots`. */
  slot: number[];
  /** Measured colour, cast removed, 5 bits per channel (r << 10 | g << 5 | b). */
  rgb: number[];
  /** Confidence in tenths (4..10). */
  conf: number[];
  /** Sparse: [row, solar share in tenths, ...]. */
  solar: number[];
  /** Rows with a roof terrace. */
  terrace: number[];
  /** Sparse: [row, itemCount, ...items (6 numbers each, `encodeFurniture`)]. */
  furniture: number[];
};
/** Quantum for furniture offsets and sizes: 0.25 m. */
export const FURNITURE_Q = 0.25;

export function encodeFurniture(items: readonly FurnitureItem[]): number[] {
  const out: number[] = [];
  for (const it of items) out.push(FURNITURE_KINDS.indexOf(it.kind), Math.round(it.e / FURNITURE_Q), Math.round(it.n / FURNITURE_Q), Math.max(1, Math.round(it.w / FURNITURE_Q)), Math.max(1, Math.round(it.l / FURNITURE_Q)), Math.round(((it.yawDeg % 180) + 180) % 180 / 5) % 36);
  return out;
}
export function decodeFurniture(flat: readonly number[] | undefined, from = 0, count = Infinity): FurnitureItem[] {
  const out: FurnitureItem[] = [];
  if (!flat) return out;
  for (let i = from, k = 0; i + 5 < flat.length && k < count; i += 6, k++) {
    const kind = FURNITURE_KINDS[flat[i]];
    if (kind) out.push({ kind, e: flat[i + 1] * FURNITURE_Q, n: flat[i + 2] * FURNITURE_Q, w: flat[i + 3] * FURNITURE_Q, l: flat[i + 4] * FURNITURE_Q, yawDeg: flat[i + 5] * 5 });
  }
  return out;
}

export type RoofFact = { slot: RoofSlot; rgb: RGB; confidence: number; solarShare: number; terrace: boolean; furniture: FurnitureItem[] };

const q5 = (v: number) => Math.max(0, Math.min(31, Math.round(v / 255 * 31)));
const d5 = (v: number) => Math.round(v * 255 / 31);

export function encodeRoofFactTile(entries: ReadonlyArray<[string, RoofFact]>, licence: string, imagery: string, minConfidence = MIN_CONFIDENCE): RoofFactTile {
  const kept = entries.filter(([, f]) => f.confidence >= minConfidence).sort((a, b) => Number(a[0]) - Number(b[0]));
  const tile: RoofFactTile = { version: 1, licence, imagery, slots: ROOF_SLOTS, read: entries.length, ids: [], slot: [], rgb: [], conf: [], solar: [], terrace: [], furniture: [] };
  let prev = 0;
  kept.forEach(([id, f], row) => {
    const v = Number(id); tile.ids.push(v - prev); prev = v;
    tile.slot.push(ROOF_SLOTS.indexOf(f.slot));
    tile.rgb.push((q5(f.rgb[0]) << 10) | (q5(f.rgb[1]) << 5) | q5(f.rgb[2]));
    tile.conf.push(Math.round(f.confidence * 10));
    const solar = Math.round(f.solarShare * 10);
    if (solar > 0) tile.solar.push(row, solar);
    if (f.terrace) tile.terrace.push(row);
    if (f.furniture.length) tile.furniture.push(row, f.furniture.length, ...encodeFurniture(f.furniture));
  });
  return tile;
}

/** 16-digit pand id (zero-padded) → fact. Unknown slot names (a newer sidecar) are skipped. */
export function decodeRoofFactTile(tile: RoofFactTile): Map<string, RoofFact> {
  const out = new Map<string, RoofFact>();
  if (!tile || tile.version !== 1 || !Array.isArray(tile.ids) || !Array.isArray(tile.slot) || tile.ids.length !== tile.slot.length) return out;
  const solar = new Map<number, number>(), terrace = new Set(tile.terrace ?? []), furniture = new Map<number, FurnitureItem[]>();
  for (let i = 0; i + 1 < (tile.solar ?? []).length; i += 2) solar.set(tile.solar[i], tile.solar[i + 1] / 10);
  for (let i = 0; i + 1 < (tile.furniture ?? []).length;) {
    const row = tile.furniture[i], count = tile.furniture[i + 1];
    furniture.set(row, decodeFurniture(tile.furniture, i + 2, count));
    i += 2 + count * 6;
  }
  let id = 0;
  for (let row = 0; row < tile.ids.length; row++) {
    id += tile.ids[row];
    const slot = (tile.slots ?? ROOF_SLOTS)[tile.slot[row]];
    if (!slot || !(ROOF_SLOTS as readonly string[]).includes(slot)) continue;
    const c = tile.rgb[row] ?? 0;
    out.set(String(id).padStart(16, '0'), { slot, rgb: [d5((c >> 10) & 31), d5((c >> 5) & 31), d5(c & 31)], confidence: (tile.conf[row] ?? 0) / 10, solarShare: solar.get(row) ?? 0, terrace: terrace.has(row), furniture: furniture.get(row) ?? [] });
  }
  return out;
}


/** Below this confidence a reading keeps the display prior (FLAT_ROOF_GREYS / the planned tone). */
export const MIN_CONFIDENCE = 0.35;
