/**
 * Minimal triangle mesh builder for building types: flat-shaded, one bucket
 * per material (slot + tint), UVs in metres (box projection) so the runtime
 * recipe look can dress `materialSlot` materials with its shared textures.
 */
export type V3 = [number, number, number];

/** Material slots understood by `buildingRecipe/recipeLook.ts`. */
export type Slot = 'brick' | 'stucco' | 'accent' | 'stone' | 'frame' | 'door' | 'glass' | 'roofTile' | 'slate' | 'bitumen';

export interface MaterialKey { slot: Slot; tint: string }

export interface Bucket {
  key: MaterialKey;
  positions: number[];
  normals: number[];
  uvs: number[];
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export class MeshBuilder {
  readonly buckets = new Map<string, Bucket>();

  private bucket(key: MaterialKey): Bucket {
    const id = `${key.slot}|${key.tint}`;
    let b = this.buckets.get(id);
    if (!b) { b = {key, positions: [], normals: [], uvs: []}; this.buckets.set(id, b); }
    return b;
  }

  /** Triangle, counter-clockwise seen from the front (outside). Degenerate triangles are dropped. */
  tri(key: MaterialKey, a: V3, b: V3, c: V3): void {
    const n = cross(sub(b, a), sub(c, a)), len = Math.hypot(n[0], n[1], n[2]);
    if (len < 1e-9) return;
    const nn: V3 = [n[0] / len, n[1] / len, n[2] / len], bk = this.bucket(key);
    // Box-projected metre UVs: drop the dominant normal axis.
    const ax = Math.abs(nn[0]), ay = Math.abs(nn[1]), az = Math.abs(nn[2]);
    for (const p of [a, b, c]) {
      bk.positions.push(p[0], p[1], p[2]);
      bk.normals.push(nn[0], nn[1], nn[2]);
      if (ay >= ax && ay >= az) bk.uvs.push(p[0], p[2]);
      else if (ax >= az) bk.uvs.push(p[2], p[1]);
      else bk.uvs.push(p[0], p[1]);
    }
  }

  /** Quad a,b,c,d counter-clockwise from the front. */
  quad(key: MaterialKey, a: V3, b: V3, c: V3, d: V3): void { this.tri(key, a, b, c); this.tri(key, a, c, d); }

  get triangles(): number { let n = 0; for (const b of this.buckets.values()) n += b.positions.length / 9; return n; }

  /** Copy of this mesh with every vertex mapped by `f` (rotations and translations only: normals use `fn`). */
  mapped(f: (p: V3) => V3, fn: (n: V3) => V3): MeshBuilder {
    const out = new MeshBuilder();
    for (const [id, b] of this.buckets) {
      const nb: Bucket = {key: b.key, positions: [], normals: [], uvs: [...b.uvs]};
      for (let i = 0; i < b.positions.length; i += 3) {
        const p = f([b.positions[i], b.positions[i + 1], b.positions[i + 2]]), n = fn([b.normals[i], b.normals[i + 1], b.normals[i + 2]]);
        nb.positions.push(...p); nb.normals.push(...n);
      }
      out.buckets.set(id, nb);
    }
    return out;
  }

  /** Append another mesh (same frame). */
  append(other: MeshBuilder): void {
    for (const [id, b] of other.buckets) {
      const t = this.bucket(b.key);
      for (let i = 0; i < b.positions.length; i++) { t.positions.push(b.positions[i]); t.normals.push(b.normals[i]); }
      t.uvs.push(...b.uvs);
      void id;
    }
  }

  bounds(): {min: V3; max: V3} {
    const min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity];
    for (const b of this.buckets.values()) for (let i = 0; i < b.positions.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], b.positions[i + k]); max[k] = Math.max(max[k], b.positions[i + k]); }
    return {min, max};
  }
}

/** Weld flat-shaded triangle soup into indexed arrays (identical position+normal+uv only). */
export function weld(b: Bucket): {positions: Float32Array; normals: Float32Array; uvs: Float32Array; indices: Uint32Array} {
  const seen = new Map<string, number>(), positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const f = (x: number) => Math.fround(x);
  for (let v = 0; v < b.positions.length / 3; v++) {
    const p = [f(b.positions[v * 3]), f(b.positions[v * 3 + 1]), f(b.positions[v * 3 + 2])], n = [f(b.normals[v * 3]), f(b.normals[v * 3 + 1]), f(b.normals[v * 3 + 2])], u = [f(b.uvs[v * 2]), f(b.uvs[v * 2 + 1])];
    const id = `${p}|${n}|${u}`;
    let i = seen.get(id);
    if (i === undefined) { i = positions.length / 3; seen.set(id, i); positions.push(...p); normals.push(...n); uvs.push(...u); }
    indices.push(i);
  }
  return {positions: Float32Array.from(positions), normals: Float32Array.from(normals), uvs: Float32Array.from(uvs), indices: Uint32Array.from(indices)};
}
