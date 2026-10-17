/**
 * Brick tone from a photo crop: the colour of the brick itself, not of the wall around it.
 *
 * Why (2026-10-17, user: the Tropenmuseum "reads tan-brown in game; the card photo shows a rosier red brick"). The
 * fourth pass took #a2856c (Lab hue 67) from the median of three panorama crops. Re-measured brick-only over 18
 * panorama crops and 17 boxes in 11 Wikimedia Commons photos (scripts/landmarks/tropenmuseum-brick-tone.json), the
 * brick is a low-chroma rose brown (Lab C* ~10 at L* ~50) whose hue follows the light: 55-65 in sun and in the
 * panoramas, 2-35 in diffuse light under a neutral trim. #a2856c was a sunlit reading; the rig's warm key added the
 * sun a second time, and the shade sides (both street fronts at the default sun) drew it as tan. The rig itself keeps
 * a measured hue within 3 deg on a chromatic brick (scripts/look/brick-tone-frames.ts reads the screen).
 * `cropLight` and `brickAlbedo` (below) are the method fix: diffuse crops only, one vote per camera system.
 *
 * Per crop:
 *  1. drop sky (blue over red), leaves (green over red and blue) and burnt-out pixels;
 *  2. find the wall's luma as the mode of the warm pixels' luma histogram (brick dominates a wall even when
 *     windows and stone take half the crop), and drop pixels far under it (glass, reveals, deep shadow) or far over
 *     it (stone, frames, white paint);
 *  3. split what is left into brick and joint by saturation (Otsu), when the two classes are really distinct
 *     (mortar or a pale band reads less saturated and lighter); at panorama scale a joint is under a pixel and the
 *     split usually finds nothing, which is reported;
 *  4. report the brick's per-channel median and its HSL hue and saturation, the whole-wall median beside it, and the
 *     crop's neutral light trim (pale, low-chroma pixels) as a cast check: a light trim that is not neutral says the
 *     crop's white balance, not the brick, set the hue.
 * `combineBrickTones` takes a robust centre over several crops in Lab (median L, median chroma, circular-median hue),
 * so one hazy or flared crop cannot drag the hue.
 */

export type Rgb = [number, number, number];

export interface BrickToneOptions {
  /** Pixels under this share of the wall luma are openings or shadow. */
  darkShare?: number;
  /** Pixels over this share of the wall luma are stone, frames or paint. */
  brightShare?: number;
  /** Smallest gap in mean HSV saturation between the two Otsu classes for a brick/joint split. */
  minSplitGap?: number;
}

export interface BrickTone {
  /** Per-channel median of the brick pixels, sRGB. */
  brick: Rgb;
  /** Per-channel median of every wall pixel (brick and joint), sRGB. */
  wall: Rgb;
  /** Median of the pale, low-chroma pixels (stone, frames), sRGB, or null when the crop has none. */
  lightTrim: Rgb | null;
  /** HSL of `brick` (h in degrees, s and l 0..1). */
  hsl: [number, number, number];
  /** Wall luma the trims were taken from (Rec. 709, sRGB bytes). */
  wallLuma: number;
  counts: { total: number; sky: number; leaf: number; dark: number; bright: number; joint: number; brick: number };
  /** Whether a brick/joint split was found (false: `brick` = `wall`). */
  split: boolean;
}

export const luma = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

export function rgbToHsl([r, g, b]: readonly number[]): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255, max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2, d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === R ? ((G - B) / d + (G < B ? 6 : 0)) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s, l];
}

const hsvSat = (r: number, g: number, b: number) => { const max = Math.max(r, g, b); return max ? (max - Math.min(r, g, b)) / max : 0; };
const median = (a: number[]) => { if (!a.length) return NaN; const s = a.slice().sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const medianRgb = (px: number[][]): Rgb => [0, 1, 2].map(i => Math.round(median(px.map(p => p[i])))) as Rgb;

/** Otsu threshold of values in [0, 1] (64 bins). */
export function otsu01(values: readonly number[], bins = 64): number {
  const hist = new Array(bins).fill(0);
  for (const v of values) hist[Math.min(bins - 1, Math.max(0, Math.floor(v * bins)))]++;
  const total = values.length; let sum = 0; for (let i = 0; i < bins; i++) sum += i * hist[i];
  let wB = 0, sumB = 0, best = -1, at = bins >> 1;
  for (let t = 0; t < bins; t++) {
    wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break;
    sumB += t * hist[t]; const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; at = t; }
  }
  return (at + 1) / bins;
}

/** Sky: blue over red and green; leaves: green over red and blue; plus burnt-out highlights. */
export function pixelKind(r: number, g: number, b: number): 'sky' | 'leaf' | 'burnt' | 'candidate' {
  if (r >= 250 && g >= 250 && b >= 250) return 'burnt';
  if (b > r + 6 && b >= g) return 'sky';
  if (g > r + 3 && g > b + 3) return 'leaf';
  return 'candidate';
}

/** Measure the brick tone of a crop (`data`: interleaved 8-bit pixels with `channels` per pixel, alpha ignored). */
export function measureBrickTone(data: ArrayLike<number>, channels: number, opts: BrickToneOptions = {}): BrickTone | null {
  const darkShare = opts.darkShare ?? 0.6, brightShare = opts.brightShare ?? 1.45, minSplitGap = opts.minSplitGap ?? 0.07;
  const counts = { total: 0, sky: 0, leaf: 0, dark: 0, bright: 0, joint: 0, brick: 0 };
  const cand: number[][] = [];
  for (let i = 0; i + 2 < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2]; counts.total++;
    const k = pixelKind(r, g, b);
    if (k === 'sky' || k === 'burnt') counts.sky++; else if (k === 'leaf') counts.leaf++; else cand.push([r, g, b]);
  }
  if (cand.length < 50) return null;
  // Wall luma: mode of the warm pixels' luma histogram (4-level bins, smoothed over 3).
  const hist = new Array(64).fill(0);
  for (const p of cand) if (p[0] > p[2] + 2) hist[Math.min(63, Math.floor(luma(p) / 4))]++;
  let mode = -1, modeAt = 0;
  for (let i = 0; i < 64; i++) { const s = (hist[i - 1] ?? 0) + 2 * hist[i] + (hist[i + 1] ?? 0); if (s > mode) { mode = s; modeAt = i; } }
  if (mode <= 0) return null;
  const wallLuma = modeAt * 4 + 2;
  const wall: number[][] = [], pale: number[][] = [];
  for (const p of cand) {
    const y = luma(p);
    if (y < wallLuma * darkShare) counts.dark++;
    else if (y > wallLuma * brightShare) { counts.bright++; if (hsvSat(p[0], p[1], p[2]) < 0.2) pale.push(p); }
    else wall.push(p);
  }
  if (wall.length < 30) return null;
  // Brick vs joint: Otsu on HSV saturation; a split only when the classes are far apart and the low one is lighter.
  const sats = wall.map(p => hsvSat(p[0], p[1], p[2])), t = otsu01(sats);
  const lo = wall.filter((_, i) => sats[i] < t), hi = wall.filter((_, i) => sats[i] >= t);
  const meanOf = (px: number[][], f: (p: number[]) => number) => px.reduce((s, p) => s + f(p), 0) / Math.max(1, px.length);
  const gap = meanOf(hi, p => hsvSat(p[0], p[1], p[2])) - meanOf(lo, p => hsvSat(p[0], p[1], p[2]));
  const split = lo.length > wall.length * 0.05 && hi.length > wall.length * 0.3 && gap >= minSplitGap && meanOf(lo, luma) >= meanOf(hi, luma) - 2;
  const brickPx = split ? hi : wall;
  counts.joint = split ? lo.length : 0; counts.brick = brickPx.length;
  const brick = medianRgb(brickPx);
  return { brick, wall: medianRgb(wall), lightTrim: pale.length >= 20 ? medianRgb(pale) : null, hsl: rgbToHsl(brick), wallLuma, counts, split };
}

// ---------------------------------------------------------------------------
// Combining crops
// ---------------------------------------------------------------------------

const lin = (v: number) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const unlin = (c: number) => 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

/** sRGB bytes -> CIE Lab (D65). */
export function rgbToLab(c: readonly number[]): Rgb {
  const [r, g, b] = c.map(lin);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
/** CIE Lab (D65) -> sRGB bytes (clamped). */
export function labToRgb([L, a, b]: readonly number[]): Rgb {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  const x = inv(fx) * 0.95047, y = inv(fy), z = inv(fz) * 1.08883;
  const r = 3.2406 * x - 1.5372 * y - 0.4986 * z, g = -0.9689 * x + 1.8758 * y + 0.0415 * z, bb = 0.0557 * x - 0.204 * y + 1.057 * z;
  return [r, g, bb].map(v => Math.round(Math.max(0, Math.min(255, unlin(Math.max(0, v)))))) as Rgb;
}

/** Lab hue angle (degrees, 0..360) and chroma of an sRGB colour. */
export function labHueChroma(c: readonly number[]): { hue: number; chroma: number; L: number } {
  const [L, a, b] = rgbToLab(c);
  return { hue: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360, chroma: Math.hypot(a, b), L };
}

/**
 * A robust centre of several crops' brick colours: median L*, median chroma and the median hue (hues are close for
 * one brick, so a plain median of angles unwrapped around their circular mean). One hazy crop moves none of the three
 * past the middle crop.
 */
export function combineBrickTones(colours: readonly (readonly number[])[]): Rgb {
  if (!colours.length) throw new Error('no colours');
  const lch = colours.map(labHueChroma);
  const hue = circularMedian(lch.map(c => c.hue)), L = median(lch.map(c => c.L)), C = median(lch.map(c => c.chroma));
  return labToRgb([L, C * Math.cos(hue * Math.PI / 180), C * Math.sin(hue * Math.PI / 180)]);
}

/** Median of angles (degrees): unwrapped around their circular mean, so 355 and 5 average to 0, not 180. */
function circularMedian(hues: readonly number[]): number {
  const mx = hues.reduce((s, h) => s + Math.cos(h * Math.PI / 180), 0), my = hues.reduce((s, h) => s + Math.sin(h * Math.PI / 180), 0);
  const centre = Math.atan2(my, mx) * 180 / Math.PI;
  return (median(hues.map(h => centre + (((h - centre) % 360) + 540) % 360 - 180)) + 360) % 360;
}

// ---------------------------------------------------------------------------
// Albedo: which crops say what the brick is, and how they are pooled
// ---------------------------------------------------------------------------

/**
 * How a crop was lit, from its light trim (2026-10-17, Tropenmuseum). A low-chroma brick (Lab C* under ~15) takes its
 * hue from the light: the Tropenmuseum brick reads Lab hue 55-65 in sun (Commons 2007/2009/2017) and 2-35 in diffuse
 * light under a neutral trim (Commons 2011, 2014, 2020, 2024), where the red-orange Oosterparkkerk brick reads ~50
 * either way. A sunlit crop carries the sun's warmth into the albedo, and the rig's warm key then adds it again.
 * Sunlit (or cast): no light trim (burnt out), a clipped trim, or a trim outside DIFFUSE_TRIM_RB red/blue.
 * (Balancing the brick to its trim does not remove the cast: the trim mixes cream stone and white frames.)
 */
export const DIFFUSE_TRIM_RB: readonly [number, number] = [0.95, 1.08];
export function cropLight(tone: Pick<BrickTone, 'lightTrim'>): 'diffuse' | 'sunlit' {
  const t = tone.lightTrim;
  if (!t || Math.max(...t) >= 250) return 'sunlit';
  const rb = t[0] / Math.max(1, t[2]);
  return rb >= DIFFUSE_TRIM_RB[0] && rb <= DIFFUSE_TRIM_RB[1] ? 'diffuse' : 'sunlit';
}

/** One crop's brick reading, tagged with the camera system it came from (the panorama fleet is one system). */
export interface BrickSample { system: string; tone: Pick<BrickTone, 'brick' | 'lightTrim'> }

export interface BrickAlbedo {
  /** The albedo: `lightness`'s L*, the pooled hue, and the pooled C*:L* times that L*. */
  hex: string;
  rgb: Rgb;
  hue: number;
  chroma: number;
  /** Per system: diffuse crops used, their median hue and C*:L*. */
  systems: { system: string; crops: number; hue: number; chromaPerL: number }[];
  /** Systems with no diffuse crop (only sunlit ones), left out. */
  sunlitOnly: string[];
}

/**
 * The brick's albedo chromaticity from diffuse-lit crops, pooled one vote per camera system (a system's median over
 * its crops, then the median over systems), so forty frames from one panorama camera do not outvote four independent
 * photographers; the lightness is kept from `lightness` (the exposure-calibrated measurement: the panorama tint at the
 * sunlit white, look/sunny.ts), since a Commons photo's exposure is arbitrary. Chroma travels as C*:L* (a darker crop
 * of the same brick has proportionally less chroma). Null when no system has a diffuse crop.
 */
export function brickAlbedo(samples: readonly BrickSample[], lightness: string): BrickAlbedo | null {
  const bySystem = new Map<string, BrickSample[]>();
  for (const s of samples) bySystem.set(s.system, [...(bySystem.get(s.system) ?? []), s]);
  const systems: BrickAlbedo['systems'] = [], sunlitOnly: string[] = [];
  for (const [system, list] of bySystem) {
    const diffuse = list.filter(s => cropLight(s.tone) === 'diffuse').map(s => labHueChroma(s.tone.brick)).filter(c => c.L > 5);
    if (!diffuse.length) { sunlitOnly.push(system); continue; }
    systems.push({ system, crops: diffuse.length, hue: +circularMedian(diffuse.map(c => c.hue)).toFixed(1), chromaPerL: +median(diffuse.map(c => c.chroma / c.L)).toFixed(4) });
  }
  if (!systems.length) return null;
  const hue = circularMedian(systems.map(s => s.hue)), perL = median(systems.map(s => s.chromaPerL));
  const n = parseInt(lightness.replace('#', ''), 16), L = rgbToLab([(n >> 16) & 255, (n >> 8) & 255, n & 255])[0], C = perL * L;
  const rgb = labToRgb([L, C * Math.cos(hue * Math.PI / 180), C * Math.sin(hue * Math.PI / 180)]);
  return { hex: '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join(''), rgb, hue: +hue.toFixed(1), chroma: +C.toFixed(2), systems, sunlitOnly };
}
