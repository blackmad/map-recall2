// Frame-to-frame colour discontinuity of a camera move (pure; RGBA or RGB byte buffers).
//
// Used by scripts/look/transition-zoom.ts and tests/e2e/overview-transition.spec.ts to measure the
// overview → city switch: per frame the median luma (Rec. 601 Y′ of the sRGB bytes) and median chroma
// (CIELAB C*ab, D65) of the whole frame and of a region; between adjacent frames ΔL (median luma), Δchroma
// (median chroma) and the share of pixels whose colour moved by more than a CIELAB ΔE76 threshold.

export interface Frame { data: Uint8Array | Uint8ClampedArray; width: number; height: number; channels: 3 | 4 }
/** Fractions of the frame, [x0, y0, x1, y1] in 0..1. */
export type Region = readonly [number, number, number, number];

export interface FrameStats { luma: number; chroma: number; meanLuma: number }
/** dLuma / dChroma: change of the per-frame medians; dMeanLuma: of the mean (a median can flip between the modes of a two-tone view). */
export interface JumpStats { dLuma: number; dChroma: number; dMeanLuma: number; overDE: number }

/** The map without the game's canvas HUD (top cards, minimap bottom-left, progress pill): the "whole frame" measure. */
export const VIEW_REGION: Region = [0.23, 0.13, 1, 0.94];
/** The ground region of the measurements: the lower centre of a 16:10 chase frame (the street ahead of the rider). */
export const GROUND_REGION: Region = [0.3, 0.6, 0.7, 0.95];

const LIN = new Float64Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);

/** CIELAB (D65) of an sRGB byte triple. */
export function lab(r: number, g: number, b: number): [number, number, number] {
  const R = LIN[r], G = LIN[g], B = LIN[b];
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const y = 0.2126729 * R + 0.7151522 * G + 0.0721750 * B;
  const z = (0.0193339 * R + 0.1191920 * G + 0.9503041 * B) / 1.08883;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Byte offsets of a region's pixels, sub-sampled every `step` pixels each way. */
function offsets(frame: Frame, region: Region = [0, 0, 1, 1], step = 2): number[] {
  const x0 = Math.floor(region[0] * frame.width), x1 = Math.ceil(region[2] * frame.width);
  const y0 = Math.floor(region[1] * frame.height), y1 = Math.ceil(region[3] * frame.height);
  const out: number[] = [];
  for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) out.push((y * frame.width + x) * frame.channels);
  return out;
}

function median(values: number[]): number {
  if (!values.length) return NaN;
  const s = values.slice().sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Median luma (0–255) and median CIELAB chroma of a region. */
export function frameStats(frame: Frame, region?: Region, step = 2): FrameStats {
  const lumas: number[] = [], chromas: number[] = [], d = frame.data;
  for (const i of offsets(frame, region, step)) {
    lumas.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    const [, a, b] = lab(d[i], d[i + 1], d[i + 2]);
    chromas.push(Math.hypot(a, b));
  }
  return { luma: median(lumas), chroma: median(chromas), meanLuma: lumas.reduce((a, v) => a + v, 0) / (lumas.length || 1) };
}

/** Share (0–1) of a region's pixels whose CIELAB ΔE76 between two same-size frames exceeds `threshold`. */
export function shareOverDeltaE(a: Frame, b: Frame, threshold = 20, region?: Region, step = 2): number {
  if (a.width !== b.width || a.height !== b.height) throw new Error('frames differ in size');
  let n = 0, over = 0;
  const t2 = threshold * threshold;
  for (const i of offsets(a, region, step)) {
    const j = (i / a.channels) * b.channels;
    const p = lab(a.data[i], a.data[i + 1], a.data[i + 2]), q = lab(b.data[j], b.data[j + 1], b.data[j + 2]);
    n++;
    if ((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2 > t2) over++;
  }
  return n ? over / n : 0;
}

/** The jump between two adjacent frames over a region. */
export function jump(a: Frame, b: Frame, region?: Region, threshold = 20): JumpStats {
  const sa = frameStats(a, region), sb = frameStats(b, region);
  return { dLuma: sb.luma - sa.luma, dChroma: sb.chroma - sa.chroma, dMeanLuma: sb.meanLuma - sa.meanLuma, overDE: shareOverDeltaE(a, b, threshold, region) };
}

/** Every adjacent pair's jump (`i` → `i + 1`). */
export function jumps(frames: readonly Frame[], region?: Region, threshold = 20): JumpStats[] {
  const out: JumpStats[] = [];
  for (let i = 0; i + 1 < frames.length; i++) out.push(jump(frames[i], frames[i + 1], region, threshold));
  return out;
}

/** Index of the adjacent pair with the largest ΔE share (the switch), or -1. */
export function worstIndex(js: readonly JumpStats[]): number {
  let best = -1;
  for (let i = 0; i < js.length; i++) if (best < 0 || js[i].overDE > js[best].overDE) best = i;
  return best;
}

/**
 * Motion compensation for a plan-view zoom: `frame` magnified by `k` about the screen point (cx, cy) (bilinear),
 * i.e. what the next frame would show if nothing but the camera height changed. Comparing a frame with the warped
 * previous one leaves the change the transition itself made (plus resampling error on hard edges).
 */
export function zoomWarp(frame: Frame, k: number, cx: number, cy: number): Frame {
  const { width: w, height: h, channels: ch, data } = frame;
  const out = new Uint8Array(w * h * ch);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.min(w - 1.001, Math.max(0, cx + (x - cx) / k)), sy = Math.min(h - 1.001, Math.max(0, cy + (y - cy) / k));
    const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
    const i00 = (y0 * w + x0) * ch, i10 = i00 + ch, i01 = i00 + w * ch, i11 = i01 + ch, o = (y * w + x) * ch;
    for (let c = 0; c < 3; c++) {
      out[o + c] = Math.round((data[i00 + c] * (1 - fx) + data[i10 + c] * fx) * (1 - fy) + (data[i01 + c] * (1 - fx) + data[i11 + c] * fx) * fy);
    }
    if (ch === 4) out[o + 3] = 255;
  }
  return { data: out, width: w, height: h, channels: ch };
}
