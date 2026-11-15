/**
 * A 2D texture as the GPU samples it (lane node-world-frames): RGBA bytes, rows bottom-up (v = 0 is row 0, as a
 * CanvasTexture with flipY or a glTF texture after its own convention), a box-filtered mip chain, and trilinear
 * sampling with repeat or clamp wrapping. `lod` is log2(texels per pixel), chosen by the caller (anisotropy included).
 */
import { mipChain } from './atlas.ts';

export type Texture2D = { size: [number, number]; levels: { w: number; h: number; data: Uint8Array }[]; clamp: boolean };

/** RGBA bytes given top-down (a canvas, a decoded PNG); `flipY` turns them to GL rows (CanvasTexture default). */
export function texture2D(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number, flipY = true, clamp = false): Texture2D {
  const base = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) base.set(rgba.subarray((flipY ? h - 1 - y : y) * w * 4, ((flipY ? h - 1 - y : y) + 1) * w * 4), y * w * 4);
  const levels: Texture2D['levels'] = [{ w, h, data: base }];
  if (w === h && (w & (w - 1)) === 0) {
    const chain = mipChain(base, w, 1, 4);
    for (let i = 1; i < chain.length; i++) levels.push({ w: w >> i, h: h >> i, data: chain[i] });
  } else {
    let cw = w, ch = h, prev = base;
    while (cw > 1 || ch > 1) {
      const nw = Math.max(1, cw >> 1), nh = Math.max(1, ch >> 1), d = new Uint8Array(nw * nh * 4);
      for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) for (let c = 0; c < 4; c++) {
        const x0 = Math.min(cw - 1, 2 * x), x1 = Math.min(cw - 1, 2 * x + 1), y0 = Math.min(ch - 1, 2 * y), y1 = Math.min(ch - 1, 2 * y + 1);
        d[(y * nw + x) * 4 + c] = (prev[(y0 * cw + x0) * 4 + c] + prev[(y0 * cw + x1) * 4 + c] + prev[(y1 * cw + x0) * 4 + c] + prev[(y1 * cw + x1) * 4 + c] + 2) >> 2;
      }
      levels.push({ w: nw, h: nh, data: d }); prev = d; cw = nw; ch = nh;
    }
  }
  return { size: [w, h], levels, clamp };
}

function level(t: Texture2D, l: number, u: number, v: number, k: number, out: Float64Array): void {
  const L = t.levels[l], w = L.w, h = L.h, d = L.data;
  let fx: number, fy: number;
  if (t.clamp) { fx = Math.min(1, Math.max(0, u)) * w - 0.5; fy = Math.min(1, Math.max(0, v)) * h - 0.5; }
  else { fx = (u - Math.floor(u)) * w - 0.5; fy = (v - Math.floor(v)) * h - 0.5; }
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  let xa: number, xb: number, ya: number, yb: number;
  if (t.clamp) { xa = Math.max(0, Math.min(w - 1, x0)); xb = Math.max(0, Math.min(w - 1, x0 + 1)); ya = Math.max(0, Math.min(h - 1, y0)); yb = Math.max(0, Math.min(h - 1, y0 + 1)); }
  else { xa = ((x0 % w) + w) % w; xb = (xa + 1) % w; ya = ((y0 % h) + h) % h; yb = (ya + 1) % h; }
  const a = (ya * w + xa) * 4, b = (ya * w + xb) * 4, c = (yb * w + xa) * 4, e = (yb * w + xb) * 4;
  const w00 = (1 - tx) * (1 - ty) * k / 255, w10 = tx * (1 - ty) * k / 255, w01 = (1 - tx) * ty * k / 255, w11 = tx * ty * k / 255;
  for (let ch = 0; ch < 4; ch++) out[ch] += d[a + ch] * w00 + d[b + ch] * w10 + d[c + ch] * w01 + d[e + ch] * w11;
}

/** Trilinear RGBA (0..1, as stored: sRGB bytes stay sRGB) into out[0..3]. */
export function sample2D(t: Texture2D, u: number, v: number, lod: number, out: Float64Array): void {
  out[0] = out[1] = out[2] = out[3] = 0;
  const max = t.levels.length - 1, l = lod < 0 ? 0 : lod > max ? max : lod, l0 = Math.floor(l), f = l - l0;
  level(t, l0, u, v, 1 - f, out);
  if (f > 0 && l0 < max) level(t, l0 + 1, u, v, f, out);
}
