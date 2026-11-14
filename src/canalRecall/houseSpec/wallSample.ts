/**
 * Wall sample v2 (lane d1-wall-colour, 2026-11-14; docs/house-line.md "Wall sample v2"). Flag `WALL_SAMPLE=2` at staging
 * (`?wallSample=2` is read the same way for tools that run in a page); default `1`, the D1 staging as before, byte-identical.
 *
 * The D1 belt tranche staged the W1 wall sample of one pinned capture (stage.ts wallBrickFromSample). Most pinned captures
 * are overcast winter panoramas: the samples sit at OKLab L ~0.40, C ~0.012, often with a blue cast (hue 200-270), so the
 * fit parked most belt fronts on the city brick floor and the game drew red-brown, pale and stucco fronts in one
 * near-black blue-grey. v2 replaces the sample by an estimate of the wall in a standard capture and stages the brick whose
 * DRAWN pixel lands on it:
 *
 *  1. Per capture (`correctCapture`): exposure gain g = sceneTarget / Y(scene median), clamped to [gainMin, gainMax], and a
 *     grey-world white balance on the same scene median (street, pavement and fronts are near-neutral on average), each
 *     channel's factor clamped to [1/wbMax, wbMax], applied at `wbShare` and kept luminance-neutral. Both act on the
 *     sample's linear RGB, so the wall's chromaticity is kept apart from the cast (a dull overcast brick regains chroma as
 *     it regains lightness).
 *  2. Across captures (`estimateWall`): the per-OKLab-axis median of the corrected captures of the pand (distinct days).
 *     One capture: its corrected value. The change against the pinned raw sample is capped at `maxDL` in L.
 *  3. Drawn (`drawnForPixel`, `brickForDrawn`): the game draws a staged brick through specWallDisplay (decorate.ts), the
 *     city tint, the brick cell and the lit look. Measured on the D1 belt rule-10 frames (scripts/house-specs/wall-sample/
 *     transfer.ts): pixel L = kL x drawn L + cL, pixel (a, b) = kC x drawn (a, b) + cast. The brick is that transfer
 *     inverted, then specWallDisplay inverted (bisection on L; the display keeps hue and chroma under the default
 *     `?wallChroma`), capped below the pale-warm guard (wallColour.ts PALE_WARM) so a warm brick is not held.
 * Every step is a receipt (`WallSampleFact`, staged as `facts/wallSample`; never drawn).
 * Pure: no DOM, no fs.
 */
import { hexToOklab, oklabToHex, PALE_WARM, specWallDisplay } from './wallColour.ts';
import { hexToRgb, rgbToHex } from '../look/palette.ts';

type Vec3 = [number, number, number];
/** A capture's references on the game-lens cut (scripts/house-specs/wall-sample/captures.ts sampleRefs), linear RGB 0..1:
 *  `white` the 90-97 % luminance band of the wall grid, `scene` the 40-60 % band of the whole cut without sky. */
export type SampleRefs = { white: Vec3; scene: Vec3; n: number };
/** One capture's W1 sample (analyse.ts wallLab hex) with its references. */
export type CaptureSample = { hex: string; captured?: string; panoId?: string; refs: SampleRefs | null; pinned?: boolean };

export const WALL_SAMPLE = {
  /** Linear Y the capture's scene median is brought to (calibration: transfer.ts). */
  sceneTarget: 0.085,
  /** Exposure gain exponent: g = (sceneTarget / Y(scene))^gainPow (1 = full normalisation). */
  gainPow: 1,
  /** Exposure gain clamp (linear). */
  gainMin: 0.7,
  gainMax: 2.6,
  /** White balance: the reference it reads (`scene` grey world, `white` the wall's bright parts, `none`), the per-channel
   *  factor clamp and the share applied (0 = none, 1 = full). */
  wbFrom: 'none' as 'none' | 'scene' | 'white',
  wbMax: 1.25,
  wbShare: 1,
  /** OKLab chroma gain on the estimate: what an exposure gain cannot return of an overcast capture's chroma (calibration:
   *  calibrate.ts exposure, against the rule-10 photos). */
  chromaGain: 1.8,
  /** Cap on the OKLab L change against the pinned raw sample. */
  maxDL: 0.22,
  /** The render transfer, drawn wall (decorate's specRecipe.wallHex) -> rule-10 pixel (W1 wallLab), measured on the belt frames. */
  render: { kL: 0.649, cL: 0.141, kC: 0.62, cast: [-0.002, -0.004] as readonly [number, number] },
  /** Highest drawn L a warm brick may take: under PALE_WARM.minL, so the guard does not hold it. */
  maxDrawnWarmL: PALE_WARM.minL - 0.01,
  /** Highest drawn chroma (a sane brick). */
  maxDrawnC: 0.11,
};
export type WallSampleParams = typeof WALL_SAMPLE;

// ---- flag ---------------------------------------------------------------------------------------------------------------
export type WallSampleMode = 1 | 2;
export const WALL_SAMPLE_DEFAULT: WallSampleMode = 1;
export function wallSampleModeOf(search?: string | null, env?: string | null): WallSampleMode {
  const v = (search ? /[?&]wallSample=(\d)\b/.exec(search)?.[1] : undefined) ?? env ?? undefined;
  return v === '2' ? 2 : v === '1' ? 1 : WALL_SAMPLE_DEFAULT;
}
let cached: WallSampleMode | undefined;
/** The mode as the runtime sees it: the page's query in a browser, WALL_SAMPLE in Node. Read once. */
export function wallSampleMode(): WallSampleMode {
  if (cached !== undefined) return cached;
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  return (cached = wallSampleModeOf(g.location?.search ?? null, g.process?.env?.WALL_SAMPLE ?? null));
}
/** Tests only. */
export const resetWallSampleMode = () => { cached = undefined; };

// ---- colour helpers -----------------------------------------------------------------------------------------------------
const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const unlin = (c: number) => 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const lumY = (v: readonly number[]) => 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const linOf = (hex: string): Vec3 => hexToRgb(hex).map(lin) as Vec3;
const hexOfLin = (v: readonly number[]): string => rgbToHex(v.map(c => Math.round(clamp(unlin(clamp(c, 0, 1)), 0, 255))) as Vec3);
const r3 = (v: number) => +v.toFixed(3);
/** OKLab L, chroma and hue (degrees) of a hex, rounded. */
export const labOf = (hex: string) => { const [L, a, b] = hexToOklab(hex); return { L: r3(L), C: r3(Math.hypot(a, b)), h: Math.round(((Math.atan2(b, a) * 180) / Math.PI + 360) % 360) }; };
const median = (xs: number[]) => { const s = [...xs].sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// ---- 1. per capture -----------------------------------------------------------------------------------------------------
export type CaptureReceipt = { hex: string; out: string; gain: number; wb: Vec3; captured?: string; panoId?: string; pinned?: boolean };
/** One capture's sample brought to the standard capture: exposure gain and grey-world balance from the scene median. */
export function correctCapture(s: CaptureSample, P: WallSampleParams = WALL_SAMPLE): CaptureReceipt {
  const hex = s.hex.toLowerCase(), base = { hex, ...(s.captured ? { captured: s.captured } : {}), ...(s.panoId ? { panoId: s.panoId } : {}), ...(s.pinned ? { pinned: true } : {}) };
  const sc = s.refs?.scene;
  if (!sc || !(lumY(sc) > 1e-4)) return { ...base, out: hex, gain: 1, wb: [1, 1, 1] };
  const Y = lumY(sc), gain = clamp((P.sceneTarget / Y) ** P.gainPow, P.gainMin, P.gainMax);
  const ref = P.wbFrom === 'white' ? s.refs!.white : sc, Yr = lumY(ref);
  const wb = P.wbFrom === 'none' || !(Yr > 1e-4) ? [1, 1, 1] : ref.map(c => clamp(Yr / Math.max(1e-4, c), 1 / P.wbMax, P.wbMax) ** P.wbShare);
  const n = lumY(wb), wbN = wb.map(w => w / n) as Vec3;
  const out = hexOfLin(linOf(hex).map((c, i) => c * gain * wbN[i]));
  return { ...base, out, gain: r3(gain), wb: wbN.map(r3) as Vec3 };
}

// ---- 2. across captures -------------------------------------------------------------------------------------------------
export type WallEstimate = { hex: string; raw: string; captures: CaptureReceipt[]; capped: boolean };
/** The wall in a standard capture: the per-axis OKLab median of the corrected captures; L kept within maxDL of the raw pinned sample. */
export function estimateWall(samples: readonly CaptureSample[], P: WallSampleParams = WALL_SAMPLE): WallEstimate | null {
  if (!samples.length) return null;
  const raw = (samples.find(s => s.pinned) ?? samples[0]).hex.toLowerCase();
  const captures = samples.map(s => correctCapture(s, P)), labs = captures.map(c => hexToOklab(c.out));
  let L = median(labs.map(l => l[0]));
  const a = median(labs.map(l => l[1])) * P.chromaGain, b = median(labs.map(l => l[2])) * P.chromaGain, L0 = hexToOklab(raw)[0];
  const capped = Math.abs(L - L0) > P.maxDL;
  if (capped) L = L0 + Math.sign(L - L0) * P.maxDL;
  return { hex: oklabToHex([L, a, b]), raw, captures, capped };
}

// ---- 3. the brick whose drawn pixel lands on the estimate ---------------------------------------------------------------
/** The drawn wall (decorate's colour) whose rule-10 pixel is `target`: the measured render transfer inverted. */
export function drawnForPixel(target: string, P: WallSampleParams = WALL_SAMPLE): string {
  const [L, a, b] = hexToOklab(target), R = P.render;
  let dL = (L - R.cL) / R.kL, da = (a - R.cast[0]) / R.kC, db = (b - R.cast[1]) / R.kC;
  const C = Math.hypot(da, db), hue = (((Math.atan2(db, da) * 180) / Math.PI) + 360) % 360;
  if (C > P.maxDrawnC) { da *= P.maxDrawnC / C; db *= P.maxDrawnC / C; }
  if (hue >= PALE_WARM.hue[0] && hue <= PALE_WARM.hue[1]) dL = Math.min(dL, P.maxDrawnWarmL);
  return oklabToHex([clamp(dL, 0.05, 0.95), da, db]);
}
/** The staged brick whose specWallDisplay is `drawn` (bisection on L; hue and chroma as drawn, which the display keeps). */
export function brickForDrawn(drawn: string): string {
  const [L, a, b] = hexToOklab(drawn);
  let lo = 0.02, hi = 0.98;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (hexToOklab(specWallDisplay(oklabToHex([m, a, b])))[0] < L) lo = m; else hi = m; }
  return oklabToHex([(lo + hi) / 2, a, b]);
}

// ---- receipt ------------------------------------------------------------------------------------------------------------
export type WallSampleFact = {
  v: 2;
  /** the pinned raw W1 sample, the standard-capture estimate, the drawn wall aimed at, and the staged brick */
  raw: string; estimate: string; drawn: string; brick: string;
  /** per capture: sample, corrected, exposure gain, white balance */
  captures: CaptureReceipt[];
  capped: boolean;
};
/** v2 end to end: captures -> estimate -> drawn -> brick, with the receipt. Null without a sample. */
export function wallSampleV2(samples: readonly CaptureSample[], P: WallSampleParams = WALL_SAMPLE): WallSampleFact | null {
  const est = estimateWall(samples, P);
  if (!est) return null;
  const drawn = drawnForPixel(est.hex, P), brick = brickForDrawn(drawn);
  return { v: 2, raw: est.raw, estimate: est.hex, drawn, brick, captures: est.captures, capped: est.capped };
}
const HEX = /^#[0-9a-f]{6}$/i;
export const isWallSampleFact = (v: unknown): v is WallSampleFact => {
  const f = v as WallSampleFact | null;
  return !!f && typeof f === 'object' && f.v === 2 && [f.raw, f.estimate, f.drawn, f.brick].every(x => HEX.test(String(x))) && Array.isArray(f.captures);
};
