/**
 * Triangle soups of the recipe-tile compiler (pure: no three.js, no node APIs).
 *
 * A soup is the streetChunks `BucketMap` shape (one bucket per `<colour>_<slot>` material, 9/9/6 floats per triangle)
 * so faces, house recipes and large recipes all meet in one representation:
 *   compile (blockFace / compileChunk / compileBuilding) → per-pand buckets in the source frame
 *   → split into roles (ground / body / crown / roof / rear / party / signage) in that frame
 *   → canonicalise + hash each instanceable role → instanced unit or merged into the tile mesh.
 */
import type {Bucket, BucketMap} from '../streetChunks/types.ts';
import {INSTANCEABLE_ROLES, type PartRole} from './schema.ts';

export type {Bucket, BucketMap};

export type Mat4 = number[];
export const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Column-major product a * b. */
export function mul(a: ArrayLike<number>, b: ArrayLike<number>): Mat4 {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}
export const translation = (x: number, y: number, z: number): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
export const scaling = (x: number, y: number, z: number): Mat4 => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
/** Rotation about +y by `a` radians (glTF: +x towards -z for positive a, right-handed). */
export const rotationY = (a: number): Mat4 => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; };
export const rotationX = (a: number): Mat4 => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; };
export const rotationZ = (a: number): Mat4 => { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; };
export const det3 = (m: ArrayLike<number>) => m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]);
export function apply(m: ArrayLike<number>, x: number, y: number, z: number): [number, number, number] {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
}
export function invert(m: ArrayLike<number>): Mat4 {
  // General 4x4 inverse (cofactors).
  const a = Array.from(m), inv = new Array(16);
  inv[0] = a[5] * a[10] * a[15] - a[5] * a[11] * a[14] - a[9] * a[6] * a[15] + a[9] * a[7] * a[14] + a[13] * a[6] * a[11] - a[13] * a[7] * a[10];
  inv[4] = -a[4] * a[10] * a[15] + a[4] * a[11] * a[14] + a[8] * a[6] * a[15] - a[8] * a[7] * a[14] - a[12] * a[6] * a[11] + a[12] * a[7] * a[10];
  inv[8] = a[4] * a[9] * a[15] - a[4] * a[11] * a[13] - a[8] * a[5] * a[15] + a[8] * a[7] * a[13] + a[12] * a[5] * a[11] - a[12] * a[7] * a[9];
  inv[12] = -a[4] * a[9] * a[14] + a[4] * a[10] * a[13] + a[8] * a[5] * a[14] - a[8] * a[6] * a[13] - a[12] * a[5] * a[10] + a[12] * a[6] * a[9];
  inv[1] = -a[1] * a[10] * a[15] + a[1] * a[11] * a[14] + a[9] * a[2] * a[15] - a[9] * a[3] * a[14] - a[13] * a[2] * a[11] + a[13] * a[3] * a[10];
  inv[5] = a[0] * a[10] * a[15] - a[0] * a[11] * a[14] - a[8] * a[2] * a[15] + a[8] * a[3] * a[14] + a[12] * a[2] * a[11] - a[12] * a[3] * a[10];
  inv[9] = -a[0] * a[9] * a[15] + a[0] * a[11] * a[13] + a[8] * a[1] * a[15] - a[8] * a[3] * a[13] - a[12] * a[1] * a[11] + a[12] * a[3] * a[9];
  inv[13] = a[0] * a[9] * a[14] - a[0] * a[10] * a[13] - a[8] * a[1] * a[14] + a[8] * a[2] * a[13] + a[12] * a[1] * a[10] - a[12] * a[2] * a[9];
  inv[2] = a[1] * a[6] * a[15] - a[1] * a[7] * a[14] - a[5] * a[2] * a[15] + a[5] * a[3] * a[14] + a[13] * a[2] * a[7] - a[13] * a[3] * a[6];
  inv[6] = -a[0] * a[6] * a[15] + a[0] * a[7] * a[14] + a[4] * a[2] * a[15] - a[4] * a[3] * a[14] - a[12] * a[2] * a[7] + a[12] * a[3] * a[6];
  inv[10] = a[0] * a[5] * a[15] - a[0] * a[7] * a[13] - a[4] * a[1] * a[15] + a[4] * a[3] * a[13] + a[12] * a[1] * a[7] - a[12] * a[3] * a[5];
  inv[14] = -a[0] * a[5] * a[14] + a[0] * a[6] * a[13] + a[4] * a[1] * a[14] - a[4] * a[2] * a[13] - a[12] * a[1] * a[6] + a[12] * a[2] * a[5];
  inv[3] = -a[1] * a[6] * a[11] + a[1] * a[7] * a[10] + a[5] * a[2] * a[11] - a[5] * a[3] * a[10] - a[9] * a[2] * a[7] + a[9] * a[3] * a[6];
  inv[7] = a[0] * a[6] * a[11] - a[0] * a[7] * a[10] - a[4] * a[2] * a[11] + a[4] * a[3] * a[10] + a[8] * a[2] * a[7] - a[8] * a[3] * a[6];
  inv[11] = -a[0] * a[5] * a[11] + a[0] * a[7] * a[9] + a[4] * a[1] * a[11] - a[4] * a[3] * a[9] - a[8] * a[1] * a[7] + a[8] * a[3] * a[5];
  inv[15] = a[0] * a[5] * a[10] - a[0] * a[6] * a[9] - a[4] * a[1] * a[10] + a[4] * a[2] * a[9] + a[8] * a[1] * a[6] - a[8] * a[2] * a[5];
  const d = a[0] * inv[0] + a[1] * inv[4] + a[2] * inv[8] + a[3] * inv[12];
  if (!d) throw Error('singular matrix');
  return inv.map(v => v / d);
}

export const triangles = (b: BucketMap): number => [...b.values()].reduce((s, x) => s + x.positions.length / 9, 0);

/** Copy of `b` with positions through `m` and normals through its inverse-transpose; a mirroring `m` keeps the winding outward. */
export function transformBuckets(b: BucketMap, m: ArrayLike<number>): BucketMap {
  const out: BucketMap = new Map(), flip = det3(m) < 0;
  const inv = invert(m), nm = [inv[0], inv[1], inv[2], inv[4], inv[5], inv[6], inv[8], inv[9], inv[10]]; // (M^-1)^T row r = column r of M^-1
  for (const [key, x] of b) {
    const positions = new Array(x.positions.length), normals = new Array(x.normals.length), uvs = x.uvs.slice();
    for (let v = 0; v < x.positions.length / 3; v++) {
      const p = apply(m, x.positions[v * 3], x.positions[v * 3 + 1], x.positions[v * 3 + 2]);
      const nx = x.normals[v * 3], ny = x.normals[v * 3 + 1], nz = x.normals[v * 3 + 2];
      const r = [nm[0] * nx + nm[1] * ny + nm[2] * nz, nm[3] * nx + nm[4] * ny + nm[5] * nz, nm[6] * nx + nm[7] * ny + nm[8] * nz], l = Math.hypot(r[0], r[1], r[2]) || 1;
      positions[v * 3] = p[0]; positions[v * 3 + 1] = p[1]; positions[v * 3 + 2] = p[2];
      normals[v * 3] = r[0] / l; normals[v * 3 + 1] = r[1] / l; normals[v * 3 + 2] = r[2] / l;
    }
    if (flip) for (let t = 0; t < positions.length / 9; t++) {
      // swap vertices 1 and 2 of every triangle (positions, normals, uvs)
      for (const [arr, n] of [[positions, 3], [normals, 3], [uvs, 2]] as const) for (let k = 0; k < n; k++) {
        const i1 = t * 3 * n + n + k, i2 = t * 3 * n + 2 * n + k, tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp;
      }
    }
    out.set(key, {...x, positions, normals, uvs});
  }
  return out;
}

/** Append triangle `t` of bucket `src` to the bucket with the same key in `into`. */
function pushTri(into: BucketMap, src: Bucket, t: number): void {
  let b = into.get(src.key);
  if (!b) into.set(src.key, b = {key: src.key, slot: src.slot, tint: src.tint, surface: src.surface, positions: [], normals: [], uvs: []});
  for (let i = 0; i < 9; i++) { b.positions.push(src.positions[t * 9 + i]); b.normals.push(src.normals[t * 9 + i]); }
  for (let i = 0; i < 6; i++) b.uvs.push(src.uvs[t * 6 + i]);
}

export function mergeBuckets(...maps: BucketMap[]): BucketMap {
  const out: BucketMap = new Map();
  for (const m of maps) for (const b of m.values()) for (let t = 0; t < b.positions.length / 9; t++) pushTri(out, b, t);
  return out;
}

const ROOF_SLOTS = new Set(['roofTile', 'slate', 'bitumen']), WALL_SLOTS = new Set(['brick', 'stucco']);

/** What the split needs to know about a pand, in its source frame (+x along the street, +y up, +z towards the street). */
export interface SplitContext {
  /** Top of the ground storey (m above the street level). */
  groundTopM: number;
  /** Main front eaves (m). */
  eavesM: number;
  /** How far behind the front plane the street-side zone reaches (m). */
  frontZoneM?: number;
}
export const FRONT_ZONE_M = 1.5;
/** Side faces closer than this to the pand's along-street extent are party walls. */
export const PARTY_BAND_M = 0.3;

/**
 * Split one pand's soup into roles. Street-side parts (ground, body, crown) are the candidates for instancing; roofs
 * (3DBAG-derived), rears, party loops (trimmed per neighbour) and signage (lettering) never instance.
 * Rules (source frame, by triangle centroid): signage = `sign` surface; roof = roof slots; party = wall-slot faces
 * facing along the street within PARTY_BAND_M of the pand's along-street extent; front plane = the most street-ward
 * street-facing wall; rear = more than `frontZoneM` behind it; then by height: ground < groundTopM, crown > eavesM,
 * body between.
 */
export function splitRoles(b: BucketMap, ctx: SplitContext): Map<PartRole, BucketMap> {
  const out = new Map<PartRole, BucketMap>();
  const put = (role: PartRole, src: Bucket, t: number) => { let m = out.get(role); if (!m) out.set(role, m = new Map()); pushTri(m, src, t); };
  let frontZ = -Infinity, minX = Infinity, maxX = -Infinity;
  for (const x of b.values()) for (let t = 0; t < x.positions.length / 9; t++) {
    for (let k = 0; k < 3; k++) { minX = Math.min(minX, x.positions[t * 9 + k * 3]); maxX = Math.max(maxX, x.positions[t * 9 + k * 3]); }
    if (WALL_SLOTS.has(x.slot) && x.normals[t * 9 + 2] > 0.9) for (let k = 0; k < 3; k++) frontZ = Math.max(frontZ, x.positions[t * 9 + k * 3 + 2]);
  }
  const zone = ctx.frontZoneM ?? FRONT_ZONE_M;
  for (const x of b.values()) for (let t = 0; t < x.positions.length / 9; t++) {
    const p = x.positions, c = [0, 1, 2].map(a => (p[t * 9 + a] + p[t * 9 + 3 + a] + p[t * 9 + 6 + a]) / 3), nx = x.normals[t * 9];
    if (x.surface === 'sign') put('signage', x, t);
    else if (ROOF_SLOTS.has(x.slot)) put('roof', x, t);
    else if (WALL_SLOTS.has(x.slot) && Math.abs(nx) > 0.9 && (c[0] - minX < PARTY_BAND_M || maxX - c[0] < PARTY_BAND_M)) put('party', x, t);
    else if (!Number.isFinite(frontZ) || c[2] < frontZ - zone) put('rear', x, t);
    else if (c[1] < ctx.groundTopM) put('ground', x, t);
    else if (c[1] > ctx.eavesM) put('crown', x, t);
    else put('body', x, t);
  }
  return out;
}

export const isInstanceable = (role: PartRole): boolean => INSTANCEABLE_ROLES.includes(role);

/** Hash quantum for positions (m) and normals. */
export const HASH_POSITION_M = 0.001;
const HASH_NORMAL = 1e-3;

/** Bounding-box minimum (x, z; y stays: height is part of the shape) — the canonical origin of a part. */
export function partOrigin(b: BucketMap): [number, number, number] {
  let x = Infinity, z = Infinity;
  for (const v of b.values()) for (let i = 0; i < v.positions.length; i += 3) { x = Math.min(x, v.positions[i]); z = Math.min(z, v.positions[i + 2]); }
  return [x, 0, z];
}

/**
 * Canonical form of a part: positions relative to `partOrigin`, rounded to 1 mm; normals to 1e-3; buckets sorted by
 * key (colour + slot). Two parts with the same canonical form are the same unit up to a translation. UVs are left out
 * of the identity: metre box UVs follow absolute position, so a unit keeps its master's UV phase (at most one brick
 * tile of shift, which the instanced ≡ merged gate ignores); pane UVs are local and identical anyway.
 */
export function canonicalKey(b: BucketMap): {origin: [number, number, number]; parts: {key: string; ints: Int32Array}[]} {
  const origin = partOrigin(b);
  const parts = [...b.values()].filter(v => v.positions.length).sort((a, c) => (a.key < c.key ? -1 : a.key > c.key ? 1 : 0)).map(v => {
    const ints = new Int32Array(v.positions.length * 2);
    for (let i = 0; i < v.positions.length; i++) {
      ints[i] = Math.round((v.positions[i] - origin[i % 3]) / HASH_POSITION_M);
      ints[v.positions.length + i] = Math.round(v.normals[i] / HASH_NORMAL);
    }
    return {key: v.key, ints};
  });
  return {origin, parts};
}

/** Small deterministic 64-bit FNV-1a over the canonical form (pure; the compiler may also use sha256). */
export function fnv64(chunks: (string | Int32Array)[]): string {
  let h1 = 0x811c9dc5 | 0, h2 = 0x84222325 | 0;
  const byte = (b: number) => { h1 = Math.imul(h1 ^ b, 0x01000193); h2 = Math.imul(h2 ^ b, 0x01000193) ^ (h1 >>> 7); };
  for (const c of chunks) {
    if (typeof c === 'string') for (let i = 0; i < c.length; i++) { const u = c.charCodeAt(i); byte(u & 255); byte(u >>> 8); }
    else for (let i = 0; i < c.length; i++) { const u = c[i]; byte(u & 255); byte((u >>> 8) & 255); byte((u >>> 16) & 255); byte(u >>> 24); }
    byte(0xff);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export function partHash(b: BucketMap): {hash: string; origin: [number, number, number]} {
  const {origin, parts} = canonicalKey(b);
  return {hash: fnv64(parts.flatMap(p => [p.key, p.ints])), origin};
}

/** Order-independent hash of a pand's whole soup in the tile frame (the "triangle hash" the review diff compares). */
export function soupHash(b: BucketMap): string {
  const parts = [...b.values()].filter(v => v.positions.length).sort((a, c) => (a.key < c.key ? -1 : 1)).map(v => {
    const ints = new Int32Array(v.positions.length);
    for (let i = 0; i < v.positions.length; i++) ints[i] = Math.round(v.positions[i] / HASH_POSITION_M);
    return [v.key, ints] as [string, Int32Array];
  });
  return fnv64(parts.flat());
}

/** Translate a part so its canonical origin is at 0 (the unit mesh). */
export const toCanonical = (b: BucketMap, origin: [number, number, number]): BucketMap => transformBuckets(b, translation(-origin[0], -origin[1], -origin[2]));
