/**
 * Street-tree crown lobes for the realLook trees lever (look/realLook.ts, `?realLook=trees`, realLook round 2).
 *
 * Today every crown lobe is one icosahedron (20 triangles below zoom 18, 80 at and above it), flat-shaded: a faceted
 * gem. Round 1 smoothed its normals, which made a soft ball. An Amsterdam street elm or plane reads as an irregular
 * rounded mass with bulging lobes, notches where the sky shows through and a flatter, lifted underside.
 *
 * Here the same icosahedron (same detail, so the same triangle count: 1.0x of today, inside the 1.3x budget) is
 * displaced radially per vertex: a few broad bulges (sub-lobes) and narrower dents (gaps in the outline), a flatter
 * underside, and a slight upward taper. Normals are the area-weighted smooth normals of the displaced surface, so the
 * lumps catch light and shade. One shape per (detail, variant); the layer keeps one instanced draw per shape, and each
 * lobe instance already carries its tree's own rotation and scale, so a row never repeats a silhouette side by side.
 *
 * Pure: positions and normals as typed arrays, non-indexed triangles (three's IcosahedronGeometry layout), no THREE.
 */

export type CrownMesh = { positions: Float32Array; normals: Float32Array; triangles: number };

/** Shape parameters (unitless, on the unit lobe). */
export const CROWN_SHAPE = {
  /** Broad bulges: count, amplitude range and angular width (radians of 1 - cos). */
  bulges: 6, bulgeAmp: [0.10, 0.24] as const, bulgeWidth: 0.3,
  /** Dents that notch the outline: count, depth range, width. */
  dents: 6, dentAmp: [0.16, 0.3] as const, dentWidth: 0.16,
  /** Underside: below z = flatFrom the radius shrinks by up to `flatten` (a lifted, flatter crown base). */
  flatFrom: -0.25, flatten: 0.3,
  /** Never displace inside this radius or past this one (keeps the lobe closed and its bounds sane). */
  minR: 0.62, maxR: 1.3,
} as const;

type V3 = [number, number, number];
const norm = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/** The icosahedron, subdivided `detail` times (0: 20 faces, 1: 80), vertices on the unit sphere, triangles as vertex triples. */
export function icosphere(detail: 0 | 1): V3[][] {
  const t = (1 + Math.sqrt(5)) / 2;
  const v: V3[] = ([[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]] as V3[]).map(norm);
  const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  let tris: V3[][] = f.map(([a, b, c]) => [v[a], v[b], v[c]]);
  for (let d = 0; d < detail; d++) tris = tris.flatMap(([a, b, c]) => {
    const ab = norm([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]), bc = norm([(b[0] + c[0]) / 2, (b[1] + c[1]) / 2, (b[2] + c[2]) / 2]), ca = norm([(c[0] + a[0]) / 2, (c[1] + a[1]) / 2, (c[2] + a[2]) / 2]);
    return [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]];
  });
  return tris;
}

/** A small deterministic generator (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const randDir = (r: () => number, zMin = -1): V3 => { const z = zMin + (1 - zMin) * r(), a = 2 * Math.PI * r(), s = Math.sqrt(1 - z * z); return [s * Math.cos(a), s * Math.sin(a), z]; };

/** The radius the crown surface has in unit direction `d` for a variant. */
export function crownRadius(d: V3, variant: number): number {
  const r = rng(0x9e3779b1 ^ Math.imul(variant + 1, 0x85ebca6b)), S = CROWN_SHAPE;
  let k = 1;
  // Bulges sit on the upper and outer crown, dents anywhere above the underside.
  for (let i = 0; i < S.bulges; i++) { const c = randDir(r, -0.2), amp = S.bulgeAmp[0] + (S.bulgeAmp[1] - S.bulgeAmp[0]) * r(); k += amp * Math.exp(-(1 - (d[0] * c[0] + d[1] * c[1] + d[2] * c[2])) / S.bulgeWidth); }
  for (let i = 0; i < S.dents; i++) { const c = randDir(r, -0.3), amp = S.dentAmp[0] + (S.dentAmp[1] - S.dentAmp[0]) * r(); k -= amp * Math.exp(-(1 - (d[0] * c[0] + d[1] * c[1] + d[2] * c[2])) / S.dentWidth); }
  if (d[2] < S.flatFrom) k *= 1 - S.flatten * Math.min(1, (S.flatFrom - d[2]) / (1 + S.flatFrom));
  return Math.max(S.minR, Math.min(S.maxR, k));
}

/** The displaced lobe: non-indexed triangles, smooth area-weighted normals shared by coincident vertices. */
export function crownLobe(detail: 0 | 1, variant: number): CrownMesh {
  const tris = icosphere(detail);
  const key = (p: V3) => `${p[0].toFixed(5)},${p[1].toFixed(5)},${p[2].toFixed(5)}`;
  const moved = new Map<string, V3>(), acc = new Map<string, V3>();
  const at = (p: V3): V3 => { const k = key(p); let m = moved.get(k); if (!m) { const rr = crownRadius(p, variant); m = [p[0] * rr, p[1] * rr, p[2] * rr]; moved.set(k, m); acc.set(k, [0, 0, 0]); } return m; };
  for (const [a, b, c] of tris) {
    const A = at(a), B = at(b), C = at(c);
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n: V3 = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    for (const p of [a, b, c]) { const s = acc.get(key(p))!; s[0] += n[0]; s[1] += n[1]; s[2] += n[2]; }
  }
  const positions = new Float32Array(tris.length * 9), normals = new Float32Array(tris.length * 9);
  tris.forEach((tri, i) => tri.forEach((p, j) => { const m = moved.get(key(p))!, n = norm(acc.get(key(p))!); positions.set(m, i * 9 + j * 3); normals.set(n, i * 9 + j * 3); }));
  return { positions, normals, triangles: tris.length };
}
