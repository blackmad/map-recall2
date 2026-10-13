// Compact Gaussian-splat container for sculptures ("MRSPLAT1").
//
// One statue is tens of thousands of splats; the generic formats are either
// big (.ply, 248 B/splat with SH; antimatter .splat, 32 B) or need a decoder
// library (SOG, SPZ). This is 17 B/splat, column-major so gzip/brotli on the
// wire does well, and decodes with typed-array loops and no dependencies.
//
// Coordinates are already in the sculpture's own frame: metres, x east,
// y north, z up, origin at the anchor on the ground (scripts/sculptures/
// ply-to-splat.ts bakes the alignment). Only degree-0 colour is kept: view-
// dependent SH from a few dozen street photos is mostly noise.
//
// Layout (little endian):
//   0  'MRSPLAT1'                 8 bytes
//   8  u32 count
//  12  u32 reserved (0)
//  16  f32 min[3], f32 max[3]     position bounds
//  40  f32 logScaleMin, logScaleMax
//  48  u16 position[3·n]          quantised in [min, max]
//      u8  logScale[3·n]          quantised in [logScaleMin, logScaleMax]
//      u8  rgba[4·n]              sRGB colour, alpha = opacity
//      u8  quat[4·n]              (w, x, y, z) · 127.5 + 127.5, normalised

export const SPLAT_MAGIC = 'MRSPLAT1';
export const SPLAT_HEADER_BYTES = 48;
export const SPLAT_BYTES_PER = 17;

export type SplatCloud = {
  count: number;
  /** xyz per splat, metres. */
  positions: Float32Array;
  /** Linear scale (σ) per axis, metres. */
  scales: Float32Array;
  /** Unit quaternion (w, x, y, z) per splat. */
  rotations: Float32Array;
  /** sRGB colour + opacity, 0–255. */
  colors: Uint8Array;
};

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function encodeSplats(cloud: SplatCloud): Uint8Array {
  const n = cloud.count;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let lsMin = Infinity, lsMax = -Infinity;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      const p = cloud.positions[i * 3 + k];
      if (p < min[k]) min[k] = p;
      if (p > max[k]) max[k] = p;
      const ls = Math.log(Math.max(1e-6, cloud.scales[i * 3 + k]));
      if (ls < lsMin) lsMin = ls;
      if (ls > lsMax) lsMax = ls;
    }
  }
  if (!n) { min.fill(0); max.fill(0); lsMin = 0; lsMax = 0; }
  const out = new Uint8Array(SPLAT_HEADER_BYTES + n * SPLAT_BYTES_PER);
  const view = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) out[i] = SPLAT_MAGIC.charCodeAt(i);
  view.setUint32(8, n, true);
  view.setUint32(12, 0, true);
  for (let k = 0; k < 3; k++) { view.setFloat32(16 + k * 4, min[k], true); view.setFloat32(28 + k * 4, max[k], true); }
  view.setFloat32(40, lsMin, true);
  view.setFloat32(44, lsMax, true);
  let o = SPLAT_HEADER_BYTES;
  for (let i = 0; i < n * 3; i++, o += 2) {
    const k = i % 3, span = max[k] - min[k];
    view.setUint16(o, span > 0 ? Math.round(((cloud.positions[i] - min[k]) / span) * 65535) : 0, true);
  }
  const lsSpan = lsMax - lsMin;
  for (let i = 0; i < n * 3; i++) out[o++] = lsSpan > 0 ? Math.round(((Math.log(Math.max(1e-6, cloud.scales[i])) - lsMin) / lsSpan) * 255) : 0;
  out.set(cloud.colors.subarray(0, n * 4), o);
  o += n * 4;
  for (let i = 0; i < n; i++) {
    const q = cloud.rotations.subarray(i * 4, i * 4 + 4);
    const len = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
    const sign = q[0] < 0 ? -1 : 1; // keep w ≥ 0 (q and −q are the same rotation)
    for (let k = 0; k < 4; k++) out[o++] = Math.round(clamp((sign * q[k]) / len, -1, 1) * 127.5 + 127.5);
  }
  return out;
}

export function decodeSplats(buffer: ArrayBuffer | Uint8Array): SplatCloud {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < SPLAT_HEADER_BYTES) throw new Error('splat file too short');
  for (let i = 0; i < 8; i++) if (bytes[i] !== SPLAT_MAGIC.charCodeAt(i)) throw new Error('not an MRSPLAT1 file');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = view.getUint32(8, true);
  if (bytes.length < SPLAT_HEADER_BYTES + n * SPLAT_BYTES_PER) throw new Error(`splat file truncated (${n} splats declared)`);
  const min = [0, 1, 2].map(k => view.getFloat32(16 + k * 4, true));
  const max = [0, 1, 2].map(k => view.getFloat32(28 + k * 4, true));
  const lsMin = view.getFloat32(40, true), lsMax = view.getFloat32(44, true);
  const positions = new Float32Array(n * 3), scales = new Float32Array(n * 3), rotations = new Float32Array(n * 4);
  let o = SPLAT_HEADER_BYTES;
  for (let i = 0; i < n * 3; i++, o += 2) { const k = i % 3; positions[i] = min[k] + (view.getUint16(o, true) / 65535) * (max[k] - min[k]); }
  for (let i = 0; i < n * 3; i++) scales[i] = Math.exp(lsMin + (bytes[o++] / 255) * (lsMax - lsMin));
  const colors = bytes.slice(o, o + n * 4);
  o += n * 4;
  for (let i = 0; i < n; i++) {
    let len = 0;
    for (let k = 0; k < 4; k++) { const v = (bytes[o++] - 127.5) / 127.5; rotations[i * 4 + k] = v; len += v * v; }
    len = Math.sqrt(len) || 1;
    for (let k = 0; k < 4; k++) rotations[i * 4 + k] /= len;
  }
  return { count: n, positions, scales, rotations, colors };
}

/**
 * Upper triangle of Σ = R S Sᵀ Rᵀ per splat: (xx, xy, xz, yy, yz, zz).
 * The renderer projects this with the Jacobian of the full clip transform.
 */
export function covariances(cloud: SplatCloud): Float32Array {
  const out = new Float32Array(cloud.count * 6);
  for (let i = 0; i < cloud.count; i++) {
    const [w, x, y, z] = cloud.rotations.subarray(i * 4, i * 4 + 4);
    const sx = cloud.scales[i * 3], sy = cloud.scales[i * 3 + 1], sz = cloud.scales[i * 3 + 2];
    // Rotation matrix rows, then M = R·S.
    const r00 = 1 - 2 * (y * y + z * z), r01 = 2 * (x * y - w * z), r02 = 2 * (x * z + w * y);
    const r10 = 2 * (x * y + w * z), r11 = 1 - 2 * (x * x + z * z), r12 = 2 * (y * z - w * x);
    const r20 = 2 * (x * z - w * y), r21 = 2 * (y * z + w * x), r22 = 1 - 2 * (x * x + y * y);
    const m00 = r00 * sx, m01 = r01 * sy, m02 = r02 * sz;
    const m10 = r10 * sx, m11 = r11 * sy, m12 = r12 * sz;
    const m20 = r20 * sx, m21 = r21 * sy, m22 = r22 * sz;
    const o = i * 6;
    out[o] = m00 * m00 + m01 * m01 + m02 * m02;
    out[o + 1] = m00 * m10 + m01 * m11 + m02 * m12;
    out[o + 2] = m00 * m20 + m01 * m21 + m02 * m22;
    out[o + 3] = m10 * m10 + m11 * m11 + m12 * m12;
    out[o + 4] = m10 * m20 + m11 * m21 + m12 * m22;
    out[o + 5] = m20 * m20 + m21 * m21 + m22 * m22;
  }
  return out;
}
