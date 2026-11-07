// Writes `<id>.lod1.glb` beside each curated landmark GLB: ~15% of the
// triangles by meshoptimizer simplification, same materials, meshopt-compressed.
// Resumable: a model is rebuilt only when its source GLB's fingerprint (or the
// build version) differs from the one recorded in the manifest's `lod1` field.
//
// And `<id>.lod2.glb` (lane R4-B #244): every primitive merged into one, the
// material colour baked into COLOR_0, ~2 % of the triangles under a 0.5 m error
// bound (landmarkLod.ts LOD2_*), for the landmarks seen from the air. Models whose
// materials take the recipe look at runtime (explicit material slots) get none:
// their colour is not the GLB's.
//
//   npm run build:landmark-lods [-- --force] [-- --only=id,id] [-- --lod1-only | --lod2-only]
//   ... --lod2-out=<dir> [--lod2-ratio=0.02] [--lod2-error-m=1] [--lod2-cap=3000]   stage a lod2 sweep: writes only there, no records
//
// Also writes src/canalRecall/landmarks/modelLods.json (id -> lod1 record, plus
// `lod2`), the small table the browser bundle uses to know which levels exist.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { Document, NodeIO, type Material } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, normals, prune, simplify, textureCompress, unweld, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

import {
  LOD1_BUILD_VERSION, LOD1_MAX_TEXTURE_SIZE, LOD1_MIN_SOURCE_TRIANGLES, LOD2_BUILD_VERSION, LOD2_CAP_ERROR_M, LOD2_GUARD_M, LOD2_GUARD_SHARE, LOD2_MAX_ERROR_M, LOD2_MAX_ERROR_M_BY_ID, LOD2_MAX_TRIANGLES, LOD2_MIN_ALPHA, LOD2_TOWER_ERROR_M,
  lod1IsCurrent, lod1SimplifyOptions, lod1Url, lod2IsCurrent, lod2SimplifyOptions, lod2Url,
  type LandmarkLodEntry, type LandmarkLodRecord,
} from '../../src/canalRecall/landmarks/landmarkLod';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MODELS = path.join(ROOT, 'public', 'canal-drive', 'models');
const MANIFEST = path.join(MODELS, 'signature-landmarks.json');
const TABLE = path.join(ROOT, 'src', 'canalRecall', 'landmarks', 'modelLods.json');

function triangles(document: Document): number {
  let total = 0;
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    const indices = primitive.getIndices();
    total += (indices ? indices.getCount() : primitive.getAttribute('POSITION')?.getCount() ?? 0) / 3;
  }
  return Math.round(total);
}

const sha = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);

type Io = NodeIO;
type Manifest = { models: Record<string, any> };

/** 4x4 column-major multiply of a point. */
function transformPoint(m: ArrayLike<number>, p: ArrayLike<number>, out: Float32Array, at: number): void {
  const [x, y, z] = [p[0], p[1], p[2]];
  out[at] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[at + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[at + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
}

/** Whether a model's materials take the recipe look at runtime (explicit slots): its lod2 colours would be wrong. */
export function hasRecipeSlots(document: Document): boolean {
  return document.getRoot().listMaterials().some(m => {
    const extras = m.getExtras() as { materialSlot?: unknown; materialSlotSource?: unknown };
    return !!extras?.materialSlot && extras.materialSlotSource !== 'inferred';
  });
}

export type Faces = { positions: number[]; colours: number[]; indices: number[]; faceMaterials: (Material | null)[] };

/**
 * Every triangle of the model in the scene's space, with its material's base colour per vertex (glTF factors are
 * linear, as three's vertex colours are) and its material per face. Faint glass (BLEND below LOD2_MIN_ALPHA) is left
 * out: from the air it reads as the hall behind it.
 */
export function collectFaces(source: Document): Faces {
  const positions: number[] = [], colours: number[] = [], indices: number[] = [], faceMaterials: (Material | null)[] = [];
  const tmp = new Float32Array(3), p: number[] = [0, 0, 0];
  for (const node of source.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const world = node.getWorldMatrix();
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMode() !== 4) continue;
      const material = primitive.getMaterial();
      const factor = material?.getBaseColorFactor() ?? [1, 1, 1, 1];
      if (material?.getAlphaMode() === 'BLEND' && factor[3] < LOD2_MIN_ALPHA) continue;
      const position = primitive.getAttribute('POSITION');
      if (!position) continue;
      const base = positions.length / 3;
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, p);
        transformPoint(world, p, tmp, 0);
        positions.push(tmp[0], tmp[1], tmp[2]);
        colours.push(factor[0], factor[1], factor[2]);
      }
      const index = primitive.getIndices();
      const count = index ? index.getCount() : position.getCount();
      for (let i = 0; i < count; i++) indices.push(base + (index ? index.getScalar(i) : i));
      for (let t = 0; t < count / 3; t++) faceMaterials.push(material);
    }
  }
  return { positions, colours, indices, faceMaterials };
}

/** One primitive for the whole model, colours per vertex (see collectFaces). */
export function mergeForLod2(source: Document): Document | null {
  const { positions, colours, indices } = collectFaces(source);
  if (!indices.length) return null;
  const out = new Document();
  const buffer = out.createBuffer();
  const material = out.createMaterial('lod2').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(1).setDoubleSided(true);
  const primitive = out.createPrimitive()
    .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer))
    .setAttribute('COLOR_0', out.createAccessor().setType('VEC3').setArray(new Float32Array(colours)).setBuffer(buffer))
    .setIndices(out.createAccessor().setType('SCALAR').setArray(new Uint32Array(indices)).setBuffer(buffer))
    .setMaterial(material);
  const node = out.createNode('lod2').setMesh(out.createMesh('lod2').addPrimitive(primitive));
  out.createScene('lod2').addChild(node);
  return out;
}

/** Squared distance from p to triangle abc (Ericson, Real-Time Collision Detection 5.1.5). */
export function pointTriangleDistanceSq(p: ArrayLike<number>, a: ArrayLike<number>, b: ArrayLike<number>, c: ArrayLike<number>): number {
  const sub = (u: ArrayLike<number>, v: ArrayLike<number>) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
  const dot = (u: number[], v: number[]) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  const at = (q: number[]) => { const d = sub(p, q); return dot(d, d); };
  const lerp = (u: ArrayLike<number>, w: number[], t: number) => [u[0] + w[0] * t, u[1] + w[1] * t, u[2] + w[2] * t];
  if (d1 <= 0 && d2 <= 0) return at([a[0], a[1], a[2]]);
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return at([b[0], b[1], b[2]]);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return at(lerp(a, ab, d1 / (d1 - d3)));
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return at([c[0], c[1], c[2]]);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return at(lerp(a, ac, d2 / (d2 - d6)));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const bc = sub(c, b); return at(lerp(b, bc, (d4 - d3) / ((d4 - d3) + (d5 - d6)))); }
  const denom = 1 / (va + vb + vc), v = vb * denom, w = vc * denom;
  return at([a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]);
}

function unitNormal(p: ArrayLike<number>, i0: number, i1: number, i2: number): [number, number, number] {
  const ux = p[i1 * 3] - p[i0 * 3], uy = p[i1 * 3 + 1] - p[i0 * 3 + 1], uz = p[i1 * 3 + 2] - p[i0 * 3 + 2];
  const vx = p[i2 * 3] - p[i0 * 3], vy = p[i2 * 3 + 1] - p[i0 * 3 + 1], vz = p[i2 * 3 + 2] - p[i0 * 3 + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

/**
 * A colour for each simplified triangle: the colour of the nearest source triangle to its centroid that faces the same
 * way (|cos| >= 0.5; double-sided, so either winding), else of the nearest at all. The simplifier ran on positions
 * alone (colour edges would have been seams it may not cross, which kept ~20 % of the triangles), so the colours are
 * put back afterwards. A uniform grid over the source triangles keeps it to milliseconds per model.
 */
export function recolourFaces(source: { positions: ArrayLike<number>; indices: ArrayLike<number>; colours: ArrayLike<number> },
  out: { positions: ArrayLike<number>; indices: ArrayLike<number> }): Float32Array {
  const nearest = nearestSourceFaces(source, out), colours = new Float32Array(nearest.length * 3);
  for (let f = 0; f < nearest.length; f++) {
    const i = source.indices[nearest[f] * 3] * 3;
    colours[f * 3] = source.colours[i]; colours[f * 3 + 1] = source.colours[i + 1]; colours[f * 3 + 2] = source.colours[i + 2];
  }
  return colours;
}

/** For each simplified face, the source face under it (see recolourFaces). */
export function nearestSourceFaces(source: { positions: ArrayLike<number>; indices: ArrayLike<number> },
  out: { positions: ArrayLike<number>; indices: ArrayLike<number> }, classOf?: (sourceFace: number) => number): Int32Array {
  const sp = source.positions, si = source.indices, triangles = si.length / 3;
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < sp.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], sp[i + k]); max[k] = Math.max(max[k], sp[i + k]); }
  const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 1e-6);
  const cell = Math.max(extent / 48, 0.5);
  const dims = [0, 1, 2].map(k => Math.max(1, Math.ceil((max[k] - min[k]) / cell) + 1));
  const key = (x: number, y: number, z: number) => (z * dims[1] + y) * dims[0] + x;
  const grid = new Map<number, number[]>();
  const cellOf = (v: number, k: number) => Math.min(dims[k] - 1, Math.max(0, Math.floor((v - min[k]) / cell)));
  const normals = new Float32Array(triangles * 3);
  for (let t = 0; t < triangles; t++) {
    const i0 = si[t * 3], i1 = si[t * 3 + 1], i2 = si[t * 3 + 2];
    normals.set(unitNormal(sp, i0, i1, i2), t * 3);
    const lo = [0, 1, 2].map(k => cellOf(Math.min(sp[i0 * 3 + k], sp[i1 * 3 + k], sp[i2 * 3 + k]), k));
    const hi = [0, 1, 2].map(k => cellOf(Math.max(sp[i0 * 3 + k], sp[i1 * 3 + k], sp[i2 * 3 + k]), k));
    for (let z = lo[2]; z <= hi[2]; z++) for (let y = lo[1]; y <= hi[1]; y++) for (let x = lo[0]; x <= hi[0]; x++) {
      const k = key(x, y, z); let list = grid.get(k); if (!list) grid.set(k, list = []); list.push(t);
    }
  }
  const vertex = (t: number, j: number) => { const i = si[t * 3 + j] * 3; return [sp[i], sp[i + 1], sp[i + 2]]; };
  const op = out.positions, oi = out.indices, faces = oi.length / 3, result = new Int32Array(faces);
  const seen = new Int32Array(triangles).fill(-1);
  let stamp = 0;
  const nearest = (centre: number[], n: number[]): number => {
    const f = stamp++;
    const home = [0, 1, 2].map(k => cellOf(centre[k], k));
    let bestAligned = -1, bestAlignedD = Infinity, bestAny = -1, bestAnyD = Infinity;
    for (let ring = 0; ring <= Math.max(...dims); ring++) {
      for (let z = home[2] - ring; z <= home[2] + ring; z++) for (let y = home[1] - ring; y <= home[1] + ring; y++) for (let x = home[0] - ring; x <= home[0] + ring; x++) {
        if (Math.max(Math.abs(x - home[0]), Math.abs(y - home[1]), Math.abs(z - home[2])) !== ring) continue;
        if (x < 0 || y < 0 || z < 0 || x >= dims[0] || y >= dims[1] || z >= dims[2]) continue;
        for (const t of grid.get(key(x, y, z)) ?? []) {
          if (seen[t] === f) continue;
          seen[t] = f;
          const d = pointTriangleDistanceSq(centre, vertex(t, 0), vertex(t, 1), vertex(t, 2));
          if (d < bestAnyD) { bestAnyD = d; bestAny = t; }
          const cos = Math.abs(n[0] * normals[t * 3] + n[1] * normals[t * 3 + 1] + n[2] * normals[t * 3 + 2]);
          if (cos >= 0.5 && d < bestAlignedD) { bestAlignedD = d; bestAligned = t; }
        }
      }
      // Every triangle closer than `ring` cells has been seen; stop once the aligned best is inside that.
      const reach = ring * cell;
      if (bestAligned >= 0 && bestAlignedD <= reach * reach) break;
      if (bestAligned < 0 && bestAny >= 0 && ring >= 2 && bestAnyD <= reach * reach) break;
    }
    const t = bestAligned >= 0 && bestAlignedD <= Math.max(bestAnyD, (2 * cell) ** 2) ? bestAligned : bestAny;
    return Math.max(0, t);
  };
  // With `classOf` (the material), a face takes the class most of seven points on it land on (centroid, three
  // towards the corners, three towards the edges; the centroid breaks ties): one centroid over a window recess
  // painted a whole simplified tower face dark (Westerkerk, lane R4-B strips).
  const WEIGHTS = [[1 / 3, 1 / 3, 1 / 3], [0.6, 0.2, 0.2], [0.2, 0.6, 0.2], [0.2, 0.2, 0.6], [0.4, 0.4, 0.2], [0.2, 0.4, 0.4], [0.4, 0.2, 0.4]];
  for (let f = 0; f < faces; f++) {
    const a = oi[f * 3], b = oi[f * 3 + 1], c = oi[f * 3 + 2];
    const n = unitNormal(op, a, b, c);
    const at = (w: number[]) => [0, 1, 2].map(k => op[a * 3 + k] * w[0] + op[b * 3 + k] * w[1] + op[c * 3 + k] * w[2]);
    const centroid = nearest(at(WEIGHTS[0]), n);
    if (!classOf) { result[f] = centroid; continue; }
    const votes = new Map<number, { count: number; face: number }>();
    for (let w = 0; w < WEIGHTS.length; w++) {
      const t = w === 0 ? centroid : nearest(at(WEIGHTS[w]), n), cls = classOf(t);
      const v = votes.get(cls); if (v) v.count++; else votes.set(cls, { count: 1, face: t });
    }
    const mine = classOf(centroid);
    let best = votes.get(mine)!, bestCls = mine;
    for (const [cls, v] of votes) if (v.count > best.count) { best = v; bestCls = cls; }
    result[f] = bestCls === mine ? centroid : best.face;
  }
  return result;
}

function extentOf(document: Document): number {
  const position = document.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION')!;
  const min = position.getMinNormalized([]), max = position.getMaxNormalized([]);
  return Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
}

/** Bakes one lod2 to `output`; returns its triangle count and bytes, or null when the model has nothing to merge. */
/**
 * Cuts the per-material JSON a lod2 carries: the colour rounded to 1e-4, roughness at its default (a speck at
 * 500 m), no name. The slot, tint and slot-source extras the city look reads stay as they are.
 */
export function trimMaterials(document: Document): void {
  for (const material of document.getRoot().listMaterials()) {
    const c = material.getBaseColorFactor();
    material.setName('').setRoughnessFactor(1)
      .setBaseColorFactor(c.map(v => Math.round(v * 1e4) / 1e4) as [number, number, number, number]);
  }
}

/** Rewrites a mesh's primitives to share one POSITION and one NORMAL accessor, each keeping its own indices. */
export function shareVertexStreams(document: Document, mesh: ReturnType<Document['createMesh']>): void {
  const prims = mesh.listPrimitives();
  if (prims.length < 2) return;
  const first = { p: prims[0].getAttribute('POSITION')!, n: prims[0].getAttribute('NORMAL')! };
  const same = (a: typeof first.p, b: typeof first.p) => a.getComponentType() === b.getComponentType() && a.getNormalized() === b.getNormalized() && a.getElementSize() === b.getElementSize();
  if (!prims.every(prim => same(prim.getAttribute('POSITION')!, first.p) && same(prim.getAttribute('NORMAL')!, first.n))) return;
  const pos: number[] = [], nor: number[] = [], lists: number[][] = [];
  const ps = first.p.getElementSize(), ns = first.n.getElementSize();
  for (const prim of prims) {
    const p = prim.getAttribute('POSITION')!.getArray()!, n = prim.getAttribute('NORMAL')!.getArray()!, base = pos.length / ps;
    for (let i = 0; i < p.length; i++) pos.push(p[i]);
    for (let i = 0; i < n.length; i++) nor.push(n[i]);
    const idx = prim.getIndices();
    lists.push(idx ? Array.from(idx.getArray()!, v => v + base) : Array.from({ length: p.length / ps }, (_, i) => base + i));
  }
  const buffer = document.getRoot().listBuffers()[0];
  const typed = (a: typeof first.p, v: number[]) => new (a.getArray()!.constructor as Float32ArrayConstructor)(v);
  const P = document.createAccessor().setType(first.p.getType()).setArray(typed(first.p, pos)).setNormalized(first.p.getNormalized()).setBuffer(buffer);
  const N = document.createAccessor().setType(first.n.getType()).setArray(typed(first.n, nor)).setNormalized(first.n.getNormalized()).setBuffer(buffer);
  const count = pos.length / ps;
  prims.forEach((prim, i) => {
    prim.setAttribute('POSITION', P).setAttribute('NORMAL', N)
      .setIndices(document.createAccessor().setType('SCALAR').setArray(count > 65535 ? new Uint32Array(lists[i]) : new Uint16Array(lists[i])).setBuffer(buffer));
  });
}

/** Models the silhouette guard re-baked at the tower bound in this run (reported at the end). */
export const guarded: string[] = [];

/**
 * Share of sampled source points (up to 6,000 of the source vertices) further than `limitM` from every triangle of
 * the simplified mesh (`positions` indexed by `kept`): a lost part, not ornament. `upper`: of the points in the upper
 * half of the model's height (glTF +Y), where towers, lanterns and spires are. Grid of `limitM` cells over the
 * simplified triangles' boxes, so a point checks only the 27 cells around it.
 */
export function lostSurfaceShare(source: ArrayLike<number>, positions: ArrayLike<number>, kept: ArrayLike<number>, limitM: number): { all: number; upper: number } {
  const cells = new Map<string, number[]>(), key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const v = (i: number) => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
  for (let t = 0; t < kept.length; t += 3) {
    const a = v(kept[t]), b = v(kept[t + 1]), c = v(kept[t + 2]);
    const lo = [0, 1, 2].map(k => Math.floor(Math.min(a[k], b[k], c[k]) / limitM)), hi = [0, 1, 2].map(k => Math.floor(Math.max(a[k], b[k], c[k]) / limitM));
    // A huge triangle spans many cells; cap its registration (its own neighbourhood test still catches it via the corners).
    if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) > 4096) { for (const q of [a, b, c]) { const k = key(...(q.map(x => Math.floor(x / limitM)) as [number, number, number])); (cells.get(k) ?? cells.set(k, []).get(k)!).push(t); } continue; }
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) {
      const k = key(x, y, z); (cells.get(k) ?? cells.set(k, []).get(k)!).push(t);
    }
  }
  const points = source.length / 3, step = Math.max(1, Math.floor(points / 6000)), limit2 = limitM * limitM;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < points; i++) { minY = Math.min(minY, source[i * 3 + 1]); maxY = Math.max(maxY, source[i * 3 + 1]); }
  const midY = (minY + maxY) / 2;
  let sampled = 0, lost = 0, upperSampled = 0, upperLost = 0;
  for (let i = 0; i < points; i += step) {
    sampled++;
    const upper = source[i * 3 + 1] > midY;
    if (upper) upperSampled++;
    const p = [source[i * 3], source[i * 3 + 1], source[i * 3 + 2]], g = p.map(x => Math.floor(x / limitM));
    let near = false;
    for (let dx = -1; dx <= 1 && !near; dx++) for (let dy = -1; dy <= 1 && !near; dy++) for (let dz = -1; dz <= 1 && !near; dz++) {
      for (const t of cells.get(key(g[0] + dx, g[1] + dy, g[2] + dz)) ?? []) {
        if (pointTriangleDistanceSq(p, v(kept[t]), v(kept[t + 1]), v(kept[t + 2])) <= limit2) { near = true; break; }
      }
    }
    if (!near) { lost++; if (upper) upperLost++; }
  }
  return { all: sampled ? lost / sampled : 0, upper: upperSampled ? upperLost / upperSampled : 0 };
}

async function bakeLod2(io: Io, id: string, source: string, output: string, ratio?: number, errorM?: number, capTriangles = LOD2_MAX_TRIANGLES): Promise<{ sourceTriangles: number; triangles: number; bytes: number } | 'recipe' | null> {
  const document = await io.read(source);
  if (hasRecipeSlots(document)) return 'recipe';
  const sourceTriangles = triangles(document);
  const faces = collectFaces(document);
  if (!faces.indices.length) return null;
  // Simplify the whole model on positions alone (welded across materials: colour and material edges would be seams
  // the simplifier may not cross, which kept ~20 % of the triangles).
  const work = new Document();
  const wbuf = work.createBuffer();
  const wprim = work.createPrimitive()
    .setAttribute('POSITION', work.createAccessor().setType('VEC3').setArray(new Float32Array(faces.positions)).setBuffer(wbuf))
    .setIndices(work.createAccessor().setType('SCALAR').setArray(new Uint32Array(faces.indices)).setBuffer(wbuf));
  work.createScene().addChild(work.createNode().setMesh(work.createMesh().addPrimitive(wprim)));
  await work.transform(weld());
  const welded = work.getRoot().listMeshes()[0].listPrimitives()[0];
  const weldedPositions = welded.getAttribute('POSITION')!.getArray() as Float32Array;
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < weldedPositions.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], weldedPositions[i + k]); max[k] = Math.max(max[k], weldedPositions[i + k]); }
  const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const all = Uint32Array.from(welded.getIndices()!.getArray()!);
  const simplifyAt = (bound: number | undefined, capped: boolean): Uint32Array => {
    const options = lod2SimplifyOptions(id, extent, ratio, bound);
    let [out] = MeshoptSimplifier.simplify(all, weldedPositions, 3, Math.floor(all.length * options.ratio / 3) * 3, options.error);
    if (capped && out.length / 3 > capTriangles) {
      // Over the cap (large curved and terraced blocks): to the cap under the relaxed bound, dropping small separate
      // parts first; sloppy (topology-free) clustering only if that still cannot get there.
      const cap = capTriangles * 3, error = Math.min(1, LOD2_CAP_ERROR_M / extent);
      [out] = MeshoptSimplifier.simplify(out, weldedPositions, 3, cap, error, ['Prune']);
      if (out.length > cap) [out] = MeshoptSimplifier.simplifySloppy(out, weldedPositions, 3, null, cap, error);
    }
    return out;
  };
  const override = errorM ?? LOD2_MAX_ERROR_M_BY_ID[id];
  let kept = simplifyAt(errorM, override === undefined);
  const capped = override === undefined && kept.length / 3 >= capTriangles * 0.98;
  // The silhouette guard: meshoptimizer's bound is per collapse, and a slender tower stage can still fold away
  // (Munttoren, Zuiderkerk at 1.25 m). Where the source surface ends up more than LOD2_GUARD_M from the lod2, the
  // model is baked again at the tower bound with no cap.
  // Capped blocks already trade 3 m for the budget and are left as they are.
  const lost = capped ? null : lostSurfaceShare(faces.positions, weldedPositions, kept, LOD2_GUARD_M);
  if (lost && lost.upper > LOD2_GUARD_SHARE && (override ?? LOD2_MAX_ERROR_M) > LOD2_TOWER_ERROR_M) {
    kept = simplifyAt(LOD2_TOWER_ERROR_M, false);
    guarded.push(`${id} ${(lost.upper * 100).toFixed(1)} %`);
  }
  // Unwelded faces, each given the material of the source face under it, one primitive per material: the runtime
  // dresses them as it dresses the full model (city look slots, Lambert), then merges them into one mesh.
  const facePositions = new Float32Array(kept.length * 3);
  for (let i = 0; i < kept.length; i++) facePositions.set(weldedPositions.subarray(kept[i] * 3, kept[i] * 3 + 3), i * 3);
  const materialIds = new Map<Material | null, number>();
  const classOf = (t: number) => { const m = faces.faceMaterials[t]; let id = materialIds.get(m); if (id === undefined) materialIds.set(m, id = materialIds.size); return id; };
  const nearest = nearestSourceFaces(faces, { positions: facePositions, indices: Uint32Array.from({ length: kept.length }, (_, i) => i) }, classOf);
  const byMaterial = new Map<Material | null, number[]>();
  for (let f = 0; f < nearest.length; f++) {
    const m = faces.faceMaterials[nearest[f]];
    let list = byMaterial.get(m); if (!list) byMaterial.set(m, list = []); list.push(f);
  }
  const root = document.getRoot(), buffer = root.listBuffers()[0] ?? document.createBuffer();
  for (const scene of root.listScenes()) for (const child of scene.listChildren()) scene.removeChild(child);
  const mesh = document.createMesh('lod2');
  for (const [material, list] of byMaterial) {
    const p = new Float32Array(list.length * 9);
    list.forEach((f, j) => p.set(facePositions.subarray(f * 9, f * 9 + 9), j * 9));
    const prim = document.createPrimitive().setAttribute('POSITION', document.createAccessor().setType('VEC3').setArray(p).setBuffer(buffer));
    if (material) prim.setMaterial(material);
    mesh.addPrimitive(prim);
  }
  const scene = root.getDefaultScene() ?? root.listScenes()[0] ?? document.createScene();
  scene.addChild(document.createNode('lod2').setMesh(mesh));
  // Flat normals as the full models have, weld what then matches.
  await document.transform(prune(), normals({ overwrite: true }), weld(), prune(), meshopt({ encoder: MeshoptEncoder }));
  // One position and one normal stream for all the primitives (only the index lists differ): less JSON and fewer
  // buffer views per model than a stream set per material. Quantisation is per mesh, so the streams agree.
  shareVertexStreams(document, mesh);
  await document.transform(prune());
  trimMaterials(document);
  await io.write(output, document);
  return { sourceTriangles, triangles: triangles(document), bytes: fs.statSync(output).size };
}

async function buildLod1(io: Io, manifest: Manifest, force: boolean, only: string[] | undefined): Promise<void> {
  let built = 0, skipped = 0, tiny = 0, addedBytes = 0;
  for (const [id, entry] of Object.entries(manifest.models)) {
    const source = path.join(MODELS, `${id}.glb`);
    if (!fs.existsSync(source) || (only && !only.includes(id))) continue;
    const output = path.join(MODELS, path.basename(lod1Url(`${id}.glb`)));
    const hash = sha(source);
    if (!force && fs.existsSync(output) && lod1IsCurrent(entry.lod1, hash)) {
      skipped++; addedBytes += entry.lod1.bytes; continue;
    }
    const document = await io.read(source);
    const sourceTriangles = triangles(document);
    if (sourceTriangles < LOD1_MIN_SOURCE_TRIANGLES) {
      tiny++; delete entry.lod1; if (fs.existsSync(output)) fs.unlinkSync(output); continue;
    }
    // The runtime GLBs are flat-shaded: every face has its own normals, so the
    // vertices never merge and the simplifier sees every edge as a seam and
    // removes ~5% of the triangles. Drop the normals, weld on position and UV,
    // simplify, then rebuild flat normals from the result.
    for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) primitive.setAttribute('NORMAL', null);
    await document.transform(
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ...lod1SimplifyOptions(id) }),
      unweld(),
      normals({ overwrite: true }),
      weld(),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [LOD1_MAX_TEXTURE_SIZE, LOD1_MAX_TEXTURE_SIZE] }),
      prune(),
      meshopt({ encoder: MeshoptEncoder }),
    );
    await io.write(output, document);
    const record: LandmarkLodRecord = {
      sourceHash: hash, buildVersion: LOD1_BUILD_VERSION,
      bytes: fs.statSync(output).size, triangles: triangles(document),
    };
    entry.lod1 = record; built++; addedBytes += record.bytes;
    console.log(`${id}: ${sourceTriangles} -> ${record.triangles} triangles, ${record.bytes} B`);
    fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`); // resumable after each model
  }
  console.log(`lod1: built ${built}, up to date ${skipped}, too small ${tiny}; ${(addedBytes / 1e6).toFixed(2)} MB total`);
}

const quantile = (values: number[], q: number) => { const s = [...values].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };

/** lod2 for every model with a GLB. With `stage`, writes only there (a sweep) and records nothing. */
async function buildLod2(io: Io, manifest: Manifest, force: boolean, only: string[] | undefined, stage: string | null, ratio?: number, errorM?: number, cap?: number): Promise<void> {
  const started = Date.now();
  let built = 0, skipped = 0, recipe = 0, empty = 0;
  const bytes: number[] = [], ratios: number[] = [];
  if (stage) fs.mkdirSync(stage, { recursive: true });
  for (const [id, entry] of Object.entries(manifest.models)) {
    const source = path.join(MODELS, `${id}.glb`);
    if (!fs.existsSync(source) || (only && !only.includes(id))) continue;
    const output = path.join(stage ?? MODELS, path.basename(lod2Url(`${id}.glb`)));
    const hash = sha(source);
    if (!stage && !force && fs.existsSync(output) && lod2IsCurrent(entry.lod2, hash)) {
      skipped++; bytes.push(entry.lod2.bytes); continue;
    }
    const result = await bakeLod2(io, id, source, output, ratio, errorM, cap);
    if (result === 'recipe' || result === null) {
      if (result === 'recipe') recipe++; else empty++;
      if (!stage) { delete entry.lod2; if (fs.existsSync(output)) fs.unlinkSync(output); }
      continue;
    }
    built++; bytes.push(result.bytes); ratios.push(result.triangles / Math.max(1, result.sourceTriangles));
    if (!stage) {
      entry.lod2 = { sourceHash: hash, buildVersion: LOD2_BUILD_VERSION, bytes: result.bytes, triangles: result.triangles } satisfies LandmarkLodRecord;
      fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`); // resumable after each model
    }
    if (only || process.argv.includes('--verbose')) console.log(`${id}: ${result.sourceTriangles} -> ${result.triangles} triangles, ${result.bytes} B`);
  }
  const total = bytes.reduce((a, b) => a + b, 0);
  console.log(`lod2${stage ? ` (staged in ${stage})` : ''}: built ${built}, up to date ${skipped}, recipe-look ${recipe}, empty ${empty}; ${(total / 1e6).toFixed(2)} MB total, per model p50 ${quantile(bytes, 0.5)} B p90 ${quantile(bytes, 0.9)} B max ${quantile(bytes, 1)} B; triangle share p50 ${(quantile(ratios, 0.5) * 100).toFixed(1)} % p90 ${(quantile(ratios, 0.9) * 100).toFixed(1)} %; ${((Date.now() - started) / 1000).toFixed(0)} s`);
  if (guarded.length) console.log(`lod2 silhouette guard re-baked ${guarded.length} at ${LOD2_TOWER_ERROR_M} m: ${guarded.join(", ")}`);
}

/** modelLods.json from the manifest's records: lod1 fields at the top (as before), `lod2` beside them. */
export function lodTable(manifest: Manifest): Record<string, LandmarkLodEntry> {
  const table: Record<string, LandmarkLodEntry> = {};
  for (const [id, entry] of Object.entries(manifest.models)) {
    if (!entry.lod1 && !entry.lod2) continue;
    table[id] = { ...(entry.lod1 ?? {}), ...(entry.lod2 ? { lod2: entry.lod2 } : {}) } as LandmarkLodEntry;
  }
  return table;
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const only = arg('only')?.split(',');
  const stage = arg('lod2-out') ? path.resolve(arg('lod2-out')!) : null;
  const ratio = arg('lod2-ratio') ? Number(arg('lod2-ratio')) : undefined;
  const errorM = arg('lod2-error-m') ? Number(arg('lod2-error-m')) : undefined;
  const cap = arg('lod2-cap') ? Number(arg('lod2-cap')) : undefined;
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as Manifest;
  if (stage) { await buildLod2(io, manifest, true, only, stage, ratio, errorM, cap); return; }
  if (!process.argv.includes('--lod2-only')) await buildLod1(io, manifest, force, only);
  if (!process.argv.includes('--lod1-only')) await buildLod2(io, manifest, force, only, null);
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(TABLE, `${JSON.stringify(lodTable(manifest), null, 1)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) main().catch(error => { console.error(error); process.exit(1); });
