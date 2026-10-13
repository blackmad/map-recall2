/**
 * Reading what the compiler wrote and what the recipe compilers produce (node/tsx: gltf-transform).
 *
 *   chunkPandBuckets   a street-chunk GLB (blockFace / compileChunk output) → per-pand buckets in the chunk frame
 *   decodeMeshTile     a mesh tile + its units → per-pand triangles in the tile frame, rebuilt exactly as the runtime
 *                      draws them (uniques by `pandRanges`, units through their instance TRS and node transform)
 *   compareTriangles   the "instanced ≡ merged" gate: the decoded pand against the source soup
 */
import {type Document, type Node} from '@gltf-transform/core';
import type {BucketMap} from './soup.ts';
import {apply, mul, type Mat4} from './soup.ts';
import {tileIO} from './writeTile.ts';
import {slotLayerOf} from '../look/cityLook.ts';
import {isMaterialSlot} from '../look/materialSlotInference.ts';
import type {MaterialSlot} from '../look/palette.ts';
import type {MeshTileMeta} from './schema.ts';

/** Per-pand buckets of a chunk GLB (`primitive.extras.pandRanges`, material extras `materialSlot`/`tint`). */
export async function chunkPandBuckets(glb: Uint8Array, pandCount: number): Promise<{pands: BucketMap[]; minY: number}> {
  const doc = await (await tileIO()).readBinary(glb);
  const pands: BucketMap[] = Array.from({length: pandCount}, () => new Map());
  let minY = Infinity;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const world = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')!, nor = prim.getAttribute('NORMAL'), uv = prim.getAttribute('TEXCOORD_0'), idx = prim.getIndices()!, mat = prim.getMaterial()!;
      const ex = (mat.getExtras() ?? {}) as any, key = mat.getName(), p: number[] = [], n: number[] = [], t: number[] = [];
      for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, p); minY = Math.min(minY, apply(world, p[0], p[1], p[2])[1]); }
      for (const [pand, first, count] of ((prim.getExtras() as any)?.pandRanges ?? []) as number[][]) {
        let b = pands[pand].get(key);
        if (!b) pands[pand].set(key, b = {key, slot: ex.materialSlot, tint: ex.tint, surface: ex.canalhouseSurface, positions: [], normals: [], uvs: []});
        for (let k = first * 3; k < (first + count) * 3; k++) {
          const v = idx.getScalar(k);
          pos.getElement(v, p); b.positions.push(...apply(world, p[0], p[1], p[2]));
          if (nor) { nor.getElement(v, n); const l = Math.hypot(n[0], n[1], n[2]) || 1; b.normals.push(n[0] / l, n[1] / l, n[2] / l); } else b.normals.push(0, 1, 0);
          if (uv) { uv.getElement(v, t); b.uvs.push(t[0], t[1]); } else b.uvs.push(0, 0);
        }
      }
    }
  }
  return {pands, minY};
}

/** One decoded triangle: 9 position floats (tile frame) and the city-look slot ordinal (-1: a kept material). */
export interface DecodedTri { p: number[]; layer: number }

const nodeWorld = (n: Node): Mat4 => Array.from(n.getWorldMatrix());

function primTriangles(doc: Document, onPrim: (node: Node, triangles: DecodedTri[]) => void, filter: (node: Node) => boolean = () => true) {
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || !filter(node)) continue;
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')!, idx = prim.getIndices(), layer = prim.getAttribute('_LAYER'), out: DecodedTri[] = [], p: number[] = [];
      const count = idx ? idx.getCount() : pos.getCount();
      for (let k = 0; k < count; k += 3) {
        const tri: number[] = [];
        for (let j = 0; j < 3; j++) { pos.getElement(idx ? idx.getScalar(k + j) : k + j, p); tri.push(p[0], p[1], p[2]); }
        out.push({p: tri, layer: layer ? layer.getScalar(idx ? idx.getScalar(k) : k) : -1});
      }
      onPrim(node, out);
    }
  }
}

/** Unit triangles in the unit's model frame (its node transform — the dequantization — applied). */
export async function decodeUnit(bytes: Uint8Array): Promise<DecodedTri[]> {
  const doc = await (await tileIO()).readBinary(bytes), out: DecodedTri[] = [];
  primTriangles(doc, (node, tris) => {
    const w = nodeWorld(node);
    for (const t of tris) out.push({layer: t.layer, p: [0, 3, 6].flatMap(o => apply(w, t.p[o], t.p[o + 1], t.p[o + 2]))});
  });
  return out;
}

const quatMatrix = (t: number[], q: number[], s: number[]): Mat4 => {
  const [x, y, z, w] = q, x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  return [(1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0, (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0, (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0, t[0], t[1], t[2], 1];
};

/** Instances of a tile: per unit node, the TRS matrix and pand index of each instance. */
export function tileInstances(doc: Document): {unit: string; items: {matrix: Mat4; pand: number}[]}[] {
  const out: {unit: string; items: {matrix: Mat4; pand: number}[]}[] = [];
  for (const node of doc.getRoot().listNodes()) {
    const inst = node.getExtension('EXT_mesh_gpu_instancing') as any;
    if (!inst) continue;
    const T = inst.getAttribute('TRANSLATION'), R = inst.getAttribute('ROTATION'), S = inst.getAttribute('SCALE'), P = inst.getAttribute('_PAND');
    const items = [], n = (T ?? R ?? S).getCount(), a: number[] = [], b: number[] = [], c: number[] = [];
    const world = nodeWorld(node);
    for (let i = 0; i < n; i++) {
      const t = T ? T.getElement(i, a) : [0, 0, 0], r = R ? R.getElement(i, b) : [0, 0, 0, 1], s = S ? S.getElement(i, c) : [1, 1, 1];
      items.push({matrix: mul(world, quatMatrix(t, r, s)), pand: P ? P.getScalar(i) : -1});
    }
    out.push({unit: (node.getExtras() as any).unit, items});
  }
  return out;
}

/** A mesh tile's pands, decoded: per pand index, triangles in the tile frame. */
export async function decodeMeshTile(tile: Uint8Array, loadUnit: (hash: string) => Promise<Uint8Array>): Promise<{meta: MeshTileMeta; pands: DecodedTri[][]; drawPrimitives: number}> {
  const doc = await (await tileIO()).readBinary(tile), meta = (doc.getRoot().getExtras() as any).recipeTile as MeshTileMeta;
  const pands: DecodedTri[][] = meta.pands.map(() => []);
  let drawPrimitives = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || node.getExtension('EXT_mesh_gpu_instancing')) continue;
    const w = nodeWorld(node);
    for (const prim of mesh.listPrimitives()) {
      drawPrimitives++;
      const pos = prim.getAttribute('POSITION')!, idx = prim.getIndices()!, layer = prim.getAttribute('_LAYER'), p: number[] = [];
      for (const [pand, first, count] of ((prim.getExtras() as any)?.pandRanges ?? []) as number[][]) for (let t = first; t < first + count; t++) {
        const tri: number[] = [];
        for (let j = 0; j < 3; j++) { pos.getElement(idx.getScalar(t * 3 + j), p); tri.push(...apply(w, p[0], p[1], p[2])); }
        pands[pand].push({p: tri, layer: layer ? layer.getScalar(idx.getScalar(t * 3)) : -1});
      }
    }
  }
  const units = new Map<string, DecodedTri[]>();
  for (const {unit, items} of tileInstances(doc)) {
    if (!units.has(unit)) units.set(unit, await decodeUnit(await loadUnit(unit)));
    const tris = units.get(unit)!;
    drawPrimitives++;
    for (const {matrix, pand} of items) for (const t of tris) pands[pand].push({layer: t.layer, p: [0, 3, 6].flatMap(o => apply(matrix, t.p[o], t.p[o + 1], t.p[o + 2]))});
  }
  return {meta, pands, drawPrimitives};
}

/** Source triangles of a bucket soup as DecodedTri, with the slot ordinal the writer must have stored. */
export function bucketTris(b: BucketMap): DecodedTri[] {
  const out: DecodedTri[] = [];
  for (const x of b.values()) {
    const layer = slotLayerOf((isMaterialSlot(x.slot) ? x.slot : 'brick') as MaterialSlot);
    for (let t = 0; t < x.positions.length / 9; t++) out.push({p: x.positions.slice(t * 9, t * 9 + 9), layer});
  }
  return out;
}

export interface TriangleComparison { source: number; decoded: number; matched: number; maxDistM: number; pass: boolean }

/**
 * Does the decoded pand draw the same triangles as the source? Every source triangle must find a decoded one whose
 * three vertices (any rotation of the corner order, same winding) lie within `tolM`, one to one. Matching goes through a
 * centroid grid, so it is order-independent (units keep their master's triangle order). When both sides know the
 * city-look slot ordinal it must agree too.
 */
export function compareTriangles(source: DecodedTri[], decoded: DecodedTri[], tolM = 0.004): TriangleComparison {
  const cell = 0.05, key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  const centroid = (p: number[]) => [(p[0] + p[3] + p[6]) / 3, (p[1] + p[4] + p[7]) / 3, (p[2] + p[5] + p[8]) / 3];
  const grid = new Map<string, number[]>();
  decoded.forEach((t, i) => { const c = centroid(t.p), k = key(c[0], c[1], c[2]); (grid.get(k) ?? grid.set(k, []).get(k)!).push(i); });
  const used = new Uint8Array(decoded.length);
  let matched = 0, maxDistM = 0;
  const dist = (a: number[], b: number[], rot: number) => {
    let d = 0;
    for (let v = 0; v < 3; v++) { const w = (v + rot) % 3; d = Math.max(d, Math.hypot(a[v * 3] - b[w * 3], a[v * 3 + 1] - b[w * 3 + 1], a[v * 3 + 2] - b[w * 3 + 2])); }
    return d;
  };
  for (const s of source) {
    const c = centroid(s.p);
    let best = -1, bestD = Infinity;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const i of grid.get(key(c[0] + dx * cell, c[1] + dy * cell, c[2] + dz * cell)) ?? []) {
        if (used[i] || (s.layer >= 0 && decoded[i].layer >= 0 && s.layer !== decoded[i].layer)) continue;
        const d = Math.min(dist(s.p, decoded[i].p, 0), dist(s.p, decoded[i].p, 1), dist(s.p, decoded[i].p, 2));
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    if (best >= 0 && bestD <= tolM) { used[best] = 1; matched++; maxDistM = Math.max(maxDistM, bestD); }
  }
  return {source: source.length, decoded: decoded.length, matched, maxDistM: +maxDistM.toFixed(5), pass: matched === source.length && decoded.length === source.length};
}
