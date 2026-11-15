/**
 * The sun's shadow map (lane node-world-frames): the shared frame's DirectionalLight shadow (rendererShared/lightRig.ts,
 * shadowFit.ts) as a node-frame lookup. An orthographic depth map along the sun, `mapSize` square over a box of
 * `halfSizeM` about the focus (shadowHalfSizeForZoom of the view's zoom), the casters' front and back faces both
 * written (three's shadow pass draws with the material's side; the city's chunks are closed, so either works), then
 * three's lookup: the receiver moved `normalBias` metres along its normal, its depth biased by `bias` x (far - near),
 * compared against the map with three's PCF (five bilinear Vogel taps).
 */
import { fitShadowCamera, lightBasis, shadowHalfSizeForZoom } from '../rendererShared/shadowFit.ts';
import type { ShadowFn } from './chunkMaterial.ts';
import type { WorldDraw } from './worldRaster.ts';

export type ShadowMap = { lookup: ShadowFn; ms: number; triangles: number };

export function shadowMap(casters: readonly WorldDraw[], toSun: readonly [number, number, number], focus: readonly [number, number, number], zoom: number, opts: { mapSize?: number; bias?: number; normalBias?: number } = {}): ShadowMap {
  const t0 = performance.now();
  const size = opts.mapSize ?? 2048, half = shadowHalfSizeForZoom(zoom);
  const fit = fitShadowCamera({ focusAbs: [focus[0], focus[1], focus[2]], toSun: [toSun[0], toSun[1], toSun[2]], halfSizeM: half, mapSize: size });
  const { right, up, forward } = lightBasis([toSun[0], toSun[1], toSun[2]]);
  const L = fit.lightAbs, near = fit.near, far = fit.far, range = far - near;
  const bias = (opts.bias ?? -0.0005) * range, normalBias = opts.normalBias ?? 0.25;
  const depth = new Float32Array(size * size).fill(Infinity);
  const toMap = (x: number, y: number, z: number, out: Float64Array, o: number) => {
    const dx = x - L[0], dy = y - L[1], dz = z - L[2];
    out[o] = ((dx * right[0] + dy * right[1] + dz * right[2]) + half) / (2 * half) * size;
    out[o + 1] = (half - (dx * up[0] + dy * up[1] + dz * up[2])) / (2 * half) * size;
    out[o + 2] = -(dx * forward[0] + dy * forward[1] + dz * forward[2]);
  };
  const v = new Float64Array(9);
  let tris = 0;
  for (const d of casters) {
    const P = d.positions, I = d.indices, nt = Math.floor(I.length / 3);
    for (let t = 0; t < nt; t++) {
      if (d.keep && !d.keep(t)) continue;
      for (let k = 0; k < 3; k++) { const a = I[t * 3 + k] * 3; toMap(P[a], P[a + 1], P[a + 2], v, k * 3); }
      const x0 = Math.max(0, Math.floor(Math.min(v[0], v[3], v[6]))), x1 = Math.min(size - 1, Math.ceil(Math.max(v[0], v[3], v[6])));
      const y0 = Math.max(0, Math.floor(Math.min(v[1], v[4], v[7]))), y1 = Math.min(size - 1, Math.ceil(Math.max(v[1], v[4], v[7])));
      if (x0 > x1 || y0 > y1) continue;
      const area = (v[3] - v[0]) * (v[7] - v[1]) - (v[6] - v[0]) * (v[4] - v[1]);
      if (Math.abs(area) < 1e-12) continue;
      tris++;
      const inv = 1 / area;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w1 = ((px - v[0]) * (v[7] - v[1]) - (v[6] - v[0]) * (py - v[1])) * inv, w2 = ((v[3] - v[0]) * (py - v[1]) - (px - v[0]) * (v[4] - v[1])) * inv, w0 = 1 - w1 - w2;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * v[2] + w1 * v[5] + w2 * v[8], i = y * size + x;
        if (z < depth[i]) depth[i] = z;
      }
    }
  }
  const q = new Float64Array(3);
  // three's PCFShadowMap: five Vogel-disk taps of radius 1 texel, each a bilinear (hardware) 2 x 2 compare. The disk's
  // per-pixel rotation (interleaved gradient noise) is fixed here: the frame is a still, not an average over frames.
  const TAPS = [0, 1, 2, 3, 4].map(k => { const r = Math.sqrt((k + 0.5) / 5), th = k * 2.399963; return [r * Math.cos(th) - 0.5, r * Math.sin(th) - 0.5]; });
  const tx0 = TAPS.map(t => t[0]), ty0 = TAPS.map(t => t[1]), last = size - 1;
  const lookup: ShadowFn = (x, y, z, nx, ny, nz) => {
    toMap(x + nx * normalBias, y + ny * normalBias, z + nz * normalBias, q, 0);
    const zr = q[2] + bias;
    if (q[0] < 0 || q[1] < 0 || q[0] >= size || q[1] >= size || zr > far) return 1;
    let lit = 0;
    for (let k = 0; k < 5; k++) {
      const fx = q[0] + tx0[k], fy = q[1] + ty0[k], ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      // Outside the map reads as lit (three clamps to the border; the box is far larger than the view near the rider).
      const xa = ix < 0 ? -1 : ix, xb = ix + 1 > last ? -1 : ix + 1, ya = iy < 0 ? -1 : iy * size, yb = iy + 1 > last ? -1 : (iy + 1) * size;
      const a = xa >= 0 && ya >= 0 && zr > depth[ya + xa] ? 0 : 1, b = xb >= 0 && ya >= 0 && zr > depth[ya + xb] ? 0 : 1;
      const c = xa >= 0 && yb >= 0 && zr > depth[yb + xa] ? 0 : 1, e = xb >= 0 && yb >= 0 && zr > depth[yb + xb] ? 0 : 1;
      lit += (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + e * tx) * ty;
    }
    return lit / 5;
  };
  return { lookup, ms: performance.now() - t0, triangles: tris };
}
