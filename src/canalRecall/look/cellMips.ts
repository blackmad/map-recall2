// A sharper mip chain for the facade colour array (lane R3-B #231, user shot S2 "windows and trim look fuzzy" at
// Da Costakade, Mac DPR 2). Round two measured the owner: the near quay walls sit at 4-16 texels per device pixel, so
// windows are drawn from mips 2-4, and GL's generateMipmap is a 2x2 box per level: by mip 3 a painted frame 2.5-6
// texels wide has been averaged into the glass three times over (a box passes 71 % at half Nyquist per level, 35 %
// after three). Here levels 1..N are built on the CPU instead:
//   - each level from the one above by a Lanczos-3 2:1 kernel (12 taps per axis, separable, wrapped like the
//     RepeatWrapping sampler), which keeps ~95 % at half Nyquist and cuts above it, in linear light (sRGB bytes are
//     decoded, filtered and re-encoded, so a white frame on dark glass keeps its brightness instead of greying);
//     cascaded rather than from level 0 directly, because a direct 2^L kernel costs 6 x size^2 taps per level and layer
//     (~3.5 G multiply-adds for the 222-layer atlas, seconds of main thread) where the cascade is ~0.7 G;
//   - a mild unsharp step on non-wall texels only (the tint mask's R channel, 0 on windows, frames, doors and shutters),
//     so the window edges keep their contrast and the brick does not ring;
//   - the last level (1 x 1) is the exact mean of level 0's bytes, as the facade tier reads it (roofTier.ts textureLod 12):
//     the far colour of every layer is unchanged.
// The alpha channel (the packed accent, look/maskPacking.ts) is filtered linearly without the unsharp step. The tint
// mask array keeps GL's own mips. `?cellMips=0` restores generateMipmap for the colour array too.

export type CellMipOptions = {
  /** Unsharp amount on non-wall texels (0 = none). */
  sharpen?: number;
  /** Filter in linear light (true) or on the sRGB bytes. */
  linear?: boolean;
  /** The 2:1 kernel's lobes: 3 (Lanczos-3, 12 taps) or 2 (Lanczos-2, 8 taps, softer, less ringing). */
  lobes?: 2 | 3;
};

export const CELL_MIP_DEFAULTS: Required<CellMipOptions> = { sharpen: 0.5, linear: true, lobes: 3 };

function pageParam(param: string): string | null {
  try {
    return typeof URLSearchParams === 'function' ? new URLSearchParams((globalThis as { location?: { search?: string } }).location?.search ?? '').get(param) : null;
  } catch { return null; }
}

/** Unasked, the page builds the custom chain when this is true (set from the measured A/B, see the lane's hand-back). */
export const CELL_MIPS_DEFAULT = false;

/** `?cellMips=1|0` (or `window.__canalRecallCellMips = true | false`); unasked CELL_MIPS_DEFAULT. */
export function cellMipsEnabled(): boolean {
  const asked = (globalThis as Record<string, unknown>).__canalRecallCellMips ?? pageParam('cellMips');
  if (asked === false || asked === '0' || asked === 'false' || asked === 'off') return false;
  if (asked === true || asked === '1' || asked === 'true' || asked === 'on') return true;
  return CELL_MIPS_DEFAULT;
}

/**
 * `?cellLodBias=-0.5` (or `window.__canalRecallCellLodBias`): a mip bias on the facade cell sample (roofTier.ts
 * CELL_LOD_BIAS), the cheap alternative to the custom chain; null (no define, no uniform) unless asked.
 */
export function cellLodBiasFlag(): number | null {
  const asked = (globalThis as Record<string, unknown>).__canalRecallCellLodBias ?? pageParam('cellLodBias');
  if (asked == null || asked === '') return null;
  const v = Number(asked);
  return Number.isFinite(v) && v >= -4 && v <= 4 ? v : null;
}

/** `?cellMipSharpen=0.5` overrides the unsharp amount, `?cellMipLinear=0` filters the bytes (A/B knobs). */
export function cellMipOptions(): Required<CellMipOptions> {
  const s = Number(pageParam('cellMipSharpen'));
  const lin = pageParam('cellMipLinear'), lobes = pageParam('cellMipLobes');
  return { sharpen: Number.isFinite(s) && pageParam('cellMipSharpen') != null ? Math.max(0, s) : CELL_MIP_DEFAULTS.sharpen, linear: lin == null ? CELL_MIP_DEFAULTS.linear : lin !== '0', lobes: lobes === '2' ? 2 : lobes === '3' ? 3 : CELL_MIP_DEFAULTS.lobes };
}

/** Lanczos-a 2:1 taps: source offsets -(2a - 0.5) .. (2a - 0.5) around the output texel's centre, normalised. */
export function lanczos2x(a: 2 | 3): Float32Array {
  const sinc = (x: number) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
  const n = 4 * a, w = new Float32Array(n);
  let sum = 0;
  for (let k = 0; k < n; k++) { const d = (k - (n - 1) / 2) / 2; w[k] = sinc(d) * sinc(d / a); sum += w[k]; }
  for (let k = 0; k < n; k++) w[k] /= sum;
  return w;
}
export const LANCZOS3_2X: Float32Array = lanczos2x(3);
const LANCZOS2_2X: Float32Array = lanczos2x(2);

const TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) { const v = i / 255; TO_LINEAR[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
const ENC_STEPS = 4096;
const TO_SRGB = new Uint8Array(ENC_STEPS + 1);
for (let i = 0; i <= ENC_STEPS; i++) { const v = i / ENC_STEPS; TO_SRGB[i] = Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)); }
const encode = (v: number) => TO_SRGB[Math.round(Math.min(1, Math.max(0, v)) * ENC_STEPS)];

/** One 2:1 Lanczos-3 step of a square single-channel plane (wrapped), size -> size / 2. */
export function downsample2x(src: Float32Array, size: number, out = new Float32Array((size >> 1) * (size >> 1)), w: Float32Array = LANCZOS3_2X): Float32Array {
  const half = size >> 1, mask = size - 1, taps = w.length, lead = taps / 2 - 1;
  const rows = new Float32Array(half * size);
  // Horizontal: output column j sits between source columns 2j and 2j+1; taps start (taps/2 - 1) columns left of 2j.
  for (let y = 0; y < size; y++) {
    const row = y * size;
    for (let j = 0; j < half; j++) {
      let acc = 0;
      const base = 2 * j - lead;
      for (let k = 0; k < taps; k++) acc += w[k] * src[row + ((base + k) & mask)];
      rows[y * half + j] = acc;
    }
  }
  for (let i = 0; i < half; i++) {
    const base = 2 * i - lead;
    for (let j = 0; j < half; j++) {
      let acc = 0;
      for (let k = 0; k < taps; k++) acc += w[k] * rows[((base + k) & mask) * half + j];
      out[i * half + j] = acc;
    }
  }
  return out;
}

/** 2:1 box of a square plane (the weight mask's chain). */
function box2x(src: Float32Array, size: number): Float32Array {
  const half = size >> 1, out = new Float32Array(half * half);
  for (let i = 0; i < half; i++) for (let j = 0; j < half; j++) {
    const a = 2 * i * size + 2 * j;
    out[i * half + j] = 0.25 * (src[a] + src[a + 1] + src[a + size] + src[a + size + 1]);
  }
  return out;
}

/** In place: v += amount * weight * (v - blur3x3(v)), wrapped. */
function unsharp(v: Float32Array, size: number, weight: Float32Array, amount: number): void {
  if (amount <= 0 || size < 4) return;
  const copy = v.slice(), mask = size - 1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, wgt = weight[i];
    if (wgt <= 0.01) continue;
    const ym = ((y - 1) & mask) * size, yp = ((y + 1) & mask) * size, yc = y * size, xm = (x - 1) & mask, xp = (x + 1) & mask;
    const blur = (4 * copy[i] + 2 * (copy[yc + xm] + copy[yc + xp] + copy[ym + x] + copy[yp + x]) + copy[ym + xm] + copy[ym + xp] + copy[yp + xm] + copy[yp + xp]) / 16;
    v[i] = copy[i] + amount * wgt * (copy[i] - blur);
  }
}

export type CellMipLevels = { size: number; levels: Uint8Array[] };

/** Number of levels below level 0 for a square power-of-two cell. */
export const mipLevelCount = (size: number) => Math.round(Math.log2(size));

/**
 * Levels 1..N (N = log2 size) of one layer of the RGBA colour array. `colour` holds `layer`'s level-0 bytes at
 * `offset`; `wallMask` (optional) the tint mask R bytes of the same texels (255 = wall, no unsharp).
 */
export function layerMips(colour: Uint8Array, offset: number, size: number, wallMask: Uint8Array | null, maskOffset: number, options: Required<CellMipOptions>): Uint8Array[] {
  const n = size * size, levels: Uint8Array[] = [];
  const planes: Float32Array[] = [];
  const toLin = options.linear ? TO_LINEAR : null;
  for (let c = 0; c < 4; c++) {
    const p = new Float32Array(n);
    for (let i = 0; i < n; i++) { const b = colour[offset + i * 4 + c]; p[i] = c < 3 && toLin ? toLin[b] : b / 255; }
    planes.push(p);
  }
  // The exact level-0 mean (the far colour), in bytes.
  const mean = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) mean[c] += colour[offset + i * 4 + c];
  let weight: Float32Array | null = null;
  if (wallMask && options.sharpen > 0) {
    weight = new Float32Array(n);
    for (let i = 0; i < n; i++) weight[i] = 1 - wallMask[maskOffset + i] / 255;
  }
  let s = size;
  while (s > 1) {
    const h = s >> 1;
    const kernel = options.lobes === 2 ? LANCZOS2_2X : LANCZOS3_2X;
    for (let c = 0; c < 4; c++) planes[c] = downsample2x(planes[c], s, undefined, kernel);
    if (weight) weight = box2x(weight, s);
    s = h;
    const out = new Uint8Array(s * s * 4);
    if (s === 1) {
      for (let c = 0; c < 4; c++) out[c] = Math.round(mean[c] / n);
    } else {
      if (weight) for (let c = 0; c < 3; c++) unsharp(planes[c], s, weight, options.sharpen);
      for (let i = 0; i < s * s; i++) {
        for (let c = 0; c < 3; c++) out[i * 4 + c] = toLin ? encode(planes[c][i]) : Math.round(Math.min(1, Math.max(0, planes[c][i])) * 255);
        out[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, planes[3][i])) * 255);
      }
    }
    levels.push(out);
  }
  return levels;
}

/**
 * Levels 1..N of the whole colour array (`layers` square layers of `size`), each level one buffer of all layers in
 * layer order (the layout texSubImage3D wants). Async: yields to the frame every `sliceMs` of work.
 */
export async function arrayMips(colour: Uint8Array, size: number, layers: number, wallMask: Uint8Array | null, wallChannels: 1 | 2, options = cellMipOptions(), sliceMs = 8, yieldFn: () => Promise<void> = () => new Promise(r => setTimeout(r, 0))): Promise<CellMipLevels> {
  const count = mipLevelCount(size);
  const levels: Uint8Array[] = [];
  for (let l = 1; l <= count; l++) { const s = size >> l; levels.push(new Uint8Array(s * s * 4 * layers)); }
  const n = size * size;
  // The R channel of an RG mask is every other byte: copy it out once per layer.
  let red: Uint8Array | null = wallMask && wallChannels === 1 ? wallMask : null;
  let started = performance.now();
  for (let layer = 0; layer < layers; layer++) {
    let maskOffset = layer * n;
    if (wallMask && wallChannels === 2) { red = new Uint8Array(n); for (let i = 0; i < n; i++) red[i] = wallMask[(layer * n + i) * 2]; maskOffset = 0; }
    const mips = layerMips(colour, layer * n * 4, size, red, maskOffset, options);
    for (let l = 0; l < count; l++) { const s = size >> (l + 1); levels[l].set(mips[l], layer * s * s * 4); }
    if (sliceMs > 0 && performance.now() - started > sliceMs) { await yieldFn(); started = performance.now(); }
  }
  return { size, levels };
}
