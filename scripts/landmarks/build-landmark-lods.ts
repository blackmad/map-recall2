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

import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, normals, prune, simplify, textureCompress, unweld, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

import {
  LOD1_BUILD_VERSION, LOD1_MAX_TEXTURE_SIZE, LOD1_MIN_SOURCE_TRIANGLES, LOD2_BUILD_VERSION, LOD2_CAP_ERROR_M, LOD2_MAX_ERROR_M_BY_ID, LOD2_MAX_TRIANGLES, LOD2_MIN_ALPHA,
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

/**
 * One primitive for the whole model: positions in the scene's space, the material's base colour (glTF factors are
 * linear, as three's vertex colours are) per vertex, triangles only. Faint glass (BLEND below LOD2_MIN_ALPHA) is left
 * out: from the air it reads as the hall behind it.
 */
export function mergeForLod2(source: Document): Document | null {
  const positions: number[] = [], colours: number[] = [], indices: number[] = [];
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
    }
  }
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
  const op = out.positions, oi = out.indices, faces = oi.length / 3, colours = new Float32Array(faces * 3);
  const seen = new Int32Array(triangles).fill(-1);
  for (let f = 0; f < faces; f++) {
    const a = oi[f * 3], b = oi[f * 3 + 1], c = oi[f * 3 + 2];
    const centre = [0, 1, 2].map(k => (op[a * 3 + k] + op[b * 3 + k] + op[c * 3 + k]) / 3);
    const n = unitNormal(op, a, b, c);
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
    const i = si[Math.max(0, t) * 3] * 3;
    colours[f * 3] = source.colours[i]; colours[f * 3 + 1] = source.colours[i + 1]; colours[f * 3 + 2] = source.colours[i + 2];
  }
  return colours;
}

function extentOf(document: Document): number {
  const position = document.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION')!;
  const min = position.getMinNormalized([]), max = position.getMaxNormalized([]);
  return Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
}

/** Bakes one lod2 to `output`; returns its triangle count and bytes, or null when the model has nothing to merge. */
async function bakeLod2(io: Io, id: string, source: string, output: string, ratio?: number, errorM?: number, capTriangles = LOD2_MAX_TRIANGLES): Promise<{ sourceTriangles: number; triangles: number; bytes: number } | 'recipe' | null> {
  const document = await io.read(source);
  if (hasRecipeSlots(document)) return 'recipe';
  const sourceTriangles = triangles(document);
  let merged = mergeForLod2(document);
  if (!merged) return null;
  const extent = extentOf(merged);
  const primitive = merged.getRoot().listMeshes()[0].listPrimitives()[0];
  const source_ = {
    positions: primitive.getAttribute('POSITION')!.getArray()!.slice(),
    indices: primitive.getIndices()!.getArray()!.slice(),
    colours: primitive.getAttribute('COLOR_0')!.getArray()!.slice(),
  };
  // Simplify on positions alone (welded), then give each kept face the colour of the source face under it.
  primitive.setAttribute('COLOR_0', null);
  await merged.transform(weld());
  const welded = merged.getRoot().listMeshes()[0].listPrimitives()[0];
  const weldedPositions = welded.getAttribute('POSITION')!.getArray() as Float32Array;
  let kept = Uint32Array.from(welded.getIndices()!.getArray()!);
  const options = lod2SimplifyOptions(id, extent, ratio, errorM);
  [kept] = MeshoptSimplifier.simplify(kept, weldedPositions, 3, Math.floor(kept.length * options.ratio / 3) * 3, options.error);
  if (LOD2_MAX_ERROR_M_BY_ID[id] === undefined && kept.length / 3 > capTriangles) {
    // Over the cap (large curved and terraced blocks): to the cap under the relaxed bound, dropping small separate
    // parts first; sloppy (topology-free) clustering only if that still cannot get there.
    const cap = capTriangles * 3, error = Math.min(1, LOD2_CAP_ERROR_M / extent);
    [kept] = MeshoptSimplifier.simplify(kept, weldedPositions, 3, cap, error, ['Prune']);
    if (kept.length > cap) [kept] = MeshoptSimplifier.simplifySloppy(kept, weldedPositions, 3, null, cap, error);
  }
  welded.setIndices(merged.createAccessor().setType('SCALAR').setArray(kept).setBuffer(merged.getRoot().listBuffers()[0]));
  await merged.transform(unweld());
  const flat = merged.getRoot().listMeshes()[0].listPrimitives()[0];
  const positions = flat.getAttribute('POSITION')!.getArray()!;
  const count = positions.length / 3;
  const faceColours = recolourFaces(source_, { positions, indices: Uint32Array.from({ length: count }, (_, i) => i) });
  const colours = new Float32Array(count * 3);
  for (let v = 0; v < count; v++) colours.set(faceColours.subarray(Math.floor(v / 3) * 3, Math.floor(v / 3) * 3 + 3), v * 3);
  flat.setAttribute('COLOR_0', merged.createAccessor().setType('VEC3').setArray(colours).setBuffer(merged.getRoot().listBuffers()[0]));
  // Flat normals as the full models have, weld what then matches, and compress.
  await merged.transform(
    normals({ overwrite: true }),
    weld(),
    prune(),
    // 12-bit colour: 8-bit linear bands the dark bricks (0.05 is 13 steps).
    meshopt({ encoder: MeshoptEncoder, quantizeColor: 12 }),
  );
  await io.write(output, merged);
  return { sourceTriangles, triangles: triangles(merged), bytes: fs.statSync(output).size };
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
