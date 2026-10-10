// Per-building bases for street chunks on the own ground (pure).
//
// A street chunk (streetChunks/gltf.ts) is one mesh per material for a whole
// block face, its houses as contiguous triangle ranges (`pandRanges`
// [pandIndex, firstTriangle, triangleCount]). One base at the chunk's anchor
// left the downhill houses floating and the uphill ones sunk; here every pand
// stands on the lowest relief under its own ground-level vertices, the
// buildings' rule (placement.ts footprintBase), by lifting its range alone.
//
// Vertices are welded per primitive, so two houses may share one (identical
// position/normal/uv at a party wall). `separatePands` gives every pand its
// own vertices first, so a lift never drags a neighbour's corner along.

export type PandRange = readonly [pand: number, firstTriangle: number, triangleCount: number];

export interface SeparatedPands {
  /** New triangle index over the separated vertices. */
  index: Uint32Array;
  /** Separated vertex → original vertex (copy every attribute through it). */
  source: Uint32Array;
  /** Separated vertex → pand index (−1: in no range). */
  owner: Int32Array;
  /** Vertices that had to be duplicated (shared by two or more pands). */
  duplicated: number;
}

export function separatePands(index: ArrayLike<number>, vertexCount: number, ranges: readonly PandRange[]): SeparatedPands {
  const triPand = new Int32Array(index.length / 3).fill(-1);
  for (const [pand, first, count] of ranges) for (let t = first; t < first + count && t < triPand.length; t++) triPand[t] = pand;
  const firstOwner = new Int32Array(vertexCount).fill(-2);
  const source: number[] = [], owner: number[] = [];
  for (let v = 0; v < vertexCount; v++) { source.push(v); owner.push(-1); }
  const copies = new Map<number, number>(); // (vertex, pand) → copy
  const out = new Uint32Array(index.length);
  let duplicated = 0;
  for (let k = 0; k < index.length; k++) {
    const v = index[k], pand = triPand[(k / 3) | 0];
    if (firstOwner[v] === -2 || firstOwner[v] === pand) { firstOwner[v] = pand; owner[v] = pand; out[k] = v; continue; }
    const key = v * 65536 + (pand + 1);
    let c = copies.get(key);
    if (c === undefined) { c = source.length; source.push(v); owner.push(pand); copies.set(key, c); duplicated++; }
    out[k] = c;
  }
  return { index: out, source: Uint32Array.from(source), owner: Int32Array.from(owner), duplicated };
}

/** Copy an interleaved-free attribute array through `source` (itemSize components per vertex). */
export function remapAttribute<T extends Float32Array | Uint16Array | Uint8Array | Int16Array | Int8Array | Uint32Array>(array: T, itemSize: number, source: Uint32Array): T {
  const out = new (array.constructor as new (n: number) => T)(source.length * itemSize);
  for (let v = 0; v < source.length; v++) for (let c = 0; c < itemSize; c++) out[v * itemSize + c] = array[source[v] * itemSize + c];
  return out;
}

/**
 * Per pand, its ground-level vertices: within `tolM` of the pand's lowest
 * vertex along the world up axis. `up(i)` gives vertex i's world height in
 * metres. At most `maxPerPand`, spread evenly (the relief is sampled at each).
 */
export function groundVertices(owner: Int32Array, up: (i: number) => number, tolM = 0.3, maxPerPand = 24): Map<number, number[]> {
  const low = new Map<number, number>();
  for (let i = 0; i < owner.length; i++) if (owner[i] >= 0) { const z = up(i); if (!(z >= (low.get(owner[i]) ?? Infinity))) low.set(owner[i], z); }
  const out = new Map<number, number[]>();
  for (let i = 0; i < owner.length; i++) {
    const p = owner[i];
    if (p < 0 || up(i) > low.get(p)! + tolM) continue;
    (out.get(p) ?? out.set(p, []).get(p)!).push(i);
  }
  for (const [p, list] of out) if (list.length > maxPerPand) {
    const step = list.length / maxPerPand;
    out.set(p, Array.from({ length: maxPerPand }, (_, k) => list[Math.floor(k * step)]));
  }
  return out;
}

/**
 * Positions with each pand's vertices moved by `delta(pand)` metres along
 * `dirPerMetre` (the world up axis expressed in the mesh's local space, one
 * metre long). `base` is never modified, so a later surface revision
 * re-lifts from the original.
 */
export function liftPands(base: Float32Array, owner: Int32Array, dirPerMetre: readonly [number, number, number], delta: (pand: number) => number): Float32Array {
  const out = base.slice();
  for (let i = 0; i < owner.length; i++) {
    if (owner[i] < 0) continue;
    const d = delta(owner[i]);
    if (!d) continue;
    out[i * 3] += dirPerMetre[0] * d; out[i * 3 + 1] += dirPerMetre[1] * d; out[i * 3 + 2] += dirPerMetre[2] * d;
  }
  return out;
}
