/**
 * Recipe-tile GLB writers (node/tsx only: gltf-transform + meshoptimizer). The generalisation of
 * `buildingTypes/glb.ts writeInstancedGlb` the plan calls for:
 *
 *   writeMeshTile   building-mesh/16/x/y.glb: the tile's merged uniques (one primitive per city-look variant and side,
 *                   pand ranges in primitive extras) + one EXT_mesh_gpu_instancing node per unit it uses (TRANSLATION,
 *                   ROTATION, SCALE, _PAND) + the pand table in the root extras.
 *   writeBucketUnit units/<hash>.glb from canonical buckets (a recipe part that repeats)
 *   convertGlbUnit  units/<hash>.glb from an installed GLB (building type, landmark): scene flattened into the model
 *                   frame, city-look attributes on every slot primitive, other materials kept as they are.
 *
 * Every city-look vertex carries `_LAYER` (u8, the slot ordinal, look/cityLook.ts `slotLayerOf`) and `_TINT` (u8x4
 * normalised, `slotTintBytes`): the runtime renames them `layer`/`tint` and draws them with the one city-look
 * material, so a tile's uniques are ONE draw whatever their materials.
 *
 * Instance nodes carry a stub mesh (the unit's bounding box, 12 triangles): EXT_mesh_gpu_instancing requires a mesh,
 * and the stub is what a loader without the unit would draw. It is added after quantization so its node keeps an
 * identity transform and the instance TRS stay the true unit → tile matrices.
 */
import {Document, NodeIO, type Material, type Primitive, type Buffer as GltfBuffer, type Node, type Mesh} from '@gltf-transform/core';
import {EXTMeshGPUInstancing, KHRMeshQuantization, EXTMeshoptCompression, KHRMaterialsUnlit} from '@gltf-transform/extensions';
import {clearNodeTransform, dequantize, flatten, join, prune, quantize, reorder, uninstance} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer';
import {slotLayerOf, slotTintBytes} from '../look/cityLook.ts';
import {inferMaterialSlot, isMaterialSlot, linearToSrgbHex} from '../look/materialSlotInference.ts';
import type {MaterialSlot} from '../look/palette.ts';
import {metreBoxUvs} from '../../../scripts/canalhouse-recipes/export-glb.ts';
import {det3, type BucketMap, type Mat4} from './soup.ts';
import type {MeshTileMeta} from './schema.ts';

let ready: Promise<void> | null = null;
/**
 * Meshopt without gltf-transform's `meshopt()` transform: that one also quantizes every POSITION to 14 bits (2.3 cm on a
 * 373 m tile) and folds the quantization into instance TRS. Here quantization is chosen per file before this runs
 * (tiles: normals only; units: positions 16-bit + normals), then vertices are reordered and the buffers encoded.
 */
async function compress(doc: Document): Promise<void> {
  await coders();
  await doc.transform(reorder({encoder: MeshoptEncoder, target: 'size'}));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method: EXTMeshoptCompression.EncoderMethod.FILTER});
}
const coders = () => (ready ??= Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]).then(() => undefined));
export async function tileIO(): Promise<NodeIO> {
  await coders();
  return new NodeIO().registerExtensions([KHRMeshQuantization, EXTMeshoptCompression, EXTMeshGPUInstancing, KHRMaterialsUnlit])
    .registerDependencies({'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder});
}

/** City-look primitive variants: authored metre UVs or box projection in the shader; front or double sided. */
export type CityVariant = {uv: 'uv' | 'box'; doubleSided: boolean};
export const variantName = (v: CityVariant) => `city-${v.uv}-${v.doubleSided ? 'double' : 'front'}`;

function cityMaterial(doc: Document, cache: Map<string, Material>, v: CityVariant): Material {
  const name = variantName(v);
  let m = cache.get(name);
  if (!m) cache.set(name, m = doc.createMaterial(name).setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(1).setDoubleSided(v.doubleSided).setExtras({cityLook: {uv: v.uv}}));
  return m;
}

/** Per-vertex arrays of one city-look primitive under construction (welded within a pand only). */
class CityPrim {
  positions: number[] = []; normals: number[] = []; uvs: number[] = []; layers: number[] = []; tints: number[] = []; indices: number[] = [];
  ranges: number[][] = [];
  private seen = new Map<string, number>();
  constructor(readonly withUv: boolean) {}
  beginPand() { this.seen.clear(); }
  vertex(p: number[], n: number[], uv: number[] | null, layer: number, tint: number[]): number {
    const f = Float32Array.from([...p, ...n, ...(uv ?? [])]), key = `${Array.from(f).join(',')}|${layer}|${tint.join(',')}`;
    let i = this.seen.get(key);
    if (i === undefined) {
      i = this.positions.length / 3; this.seen.set(key, i);
      this.positions.push(f[0], f[1], f[2]); this.normals.push(f[3], f[4], f[5]);
      if (this.withUv) this.uvs.push(f[6], f[7]);
      this.layers.push(layer); this.tints.push(...tint);
    }
    return i;
  }
  get triangles() { return this.indices.length / 3; }
}

/** Append buckets (one pand) to a city primitive; returns the triangles added. */
function appendBuckets(prim: CityPrim, b: BucketMap): number {
  prim.beginPand();
  const before = prim.triangles;
  for (const x of b.values()) {
    const slot = (isMaterialSlot(x.slot) ? x.slot : 'brick') as MaterialSlot, layer = slotLayerOf(slot), tint = slotTintBytes(slot, x.tint);
    for (let v = 0; v < x.positions.length / 3; v++) prim.indices.push(prim.vertex(x.positions.slice(v * 3, v * 3 + 3), x.normals.slice(v * 3, v * 3 + 3), prim.withUv ? x.uvs.slice(v * 2, v * 2 + 2) : null, layer, tint));
  }
  return prim.triangles - before;
}

function primitiveOf(doc: Document, buffer: GltfBuffer, prim: CityPrim, material: Material): Primitive {
  const n = prim.positions.length / 3, acc = () => doc.createAccessor().setBuffer(buffer);
  const out = doc.createPrimitive().setMaterial(material)
    .setIndices(acc().setType('SCALAR').setArray(n < 65536 ? Uint16Array.from(prim.indices) : Uint32Array.from(prim.indices)))
    .setAttribute('POSITION', acc().setType('VEC3').setArray(Float32Array.from(prim.positions)))
    .setAttribute('NORMAL', acc().setType('VEC3').setArray(Float32Array.from(prim.normals)))
    .setAttribute('_LAYER', acc().setType('SCALAR').setArray(Uint8Array.from(prim.layers)))
    .setAttribute('_TINT', acc().setType('VEC4').setArray(Uint8Array.from(prim.tints)).setNormalized(true));
  if (prim.withUv) out.setAttribute('TEXCOORD_0', acc().setType('VEC2').setArray(Float32Array.from(prim.uvs)));
  return out;
}

export interface WriteResult { bytes: Uint8Array; triangles: number; primitives: number; vertices: number }

/** Tile → glTF TRS: translation, quaternion (x, y, z, w), scale. Throws on shear (it cannot be an instance). */
export function decomposeTRS(m: ArrayLike<number>, tolerance = 1e-6): {t: [number, number, number]; r: [number, number, number, number]; s: [number, number, number]} {
  const col = (i: number) => [m[i * 4], m[i * 4 + 1], m[i * 4 + 2]];
  const len = (v: number[]) => Math.hypot(v[0], v[1], v[2]);
  const sx0 = len(col(0)), sy = len(col(1)), sz = len(col(2)), sx = det3(m) < 0 ? -sx0 : sx0;
  const r = [col(0).map(v => v / sx), col(1).map(v => v / sy), col(2).map(v => v / sz)]; // columns
  // orthonormal check
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (Math.abs(dot(r[0], r[1])) > tolerance || Math.abs(dot(r[0], r[2])) > tolerance || Math.abs(dot(r[1], r[2])) > tolerance) throw Error('instance matrix has shear');
  const [m00, m10, m20] = r[0], [m01, m11, m21] = r[1], [m02, m12, m22] = r[2], trace = m00 + m11 + m22;
  let q: [number, number, number, number];
  if (trace > 0) { const s = 0.5 / Math.sqrt(trace + 1); q = [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s]; }
  else if (m00 > m11 && m00 > m22) { const s = 2 * Math.sqrt(1 + m00 - m11 - m22); q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
  else if (m11 > m22) { const s = 2 * Math.sqrt(1 + m11 - m00 - m22); q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]; }
  else { const s = 2 * Math.sqrt(1 + m22 - m00 - m11); q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]; }
  const ql = Math.hypot(...q);
  return {t: [m[12], m[13], m[14]], r: q.map(v => v / ql) as [number, number, number, number], s: [sx, sy, sz]};
}

/** One unit's instances in a tile. */
export interface TileInstances {
  hash: string;
  /** Unit bounds in its own frame, for the stub box. */
  bounds: {min: number[]; max: number[]};
  items: {matrix: Mat4; pand: number}[];
}

/**
 * Write a mesh tile. `uniques[i]` are the merged buckets of pand index `pand` (tile frame). Positions stay float32
 * (a 16-bit grid over a 373 m tile is 6 mm, coarser than the 5 mm insets of the recipe library); normals are 8-bit.
 */
export async function writeMeshTile(meta: MeshTileMeta, uniques: {pand: number; buckets: BucketMap}[], instances: TileInstances[]): Promise<WriteResult> {
  const io = await tileIO();
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene(`tile-${meta.tile.join('-')}`), cache = new Map<string, Material>();
  doc.getRoot().setDefaultScene(scene);
  const prim = new CityPrim(true);
  for (const u of [...uniques].sort((a, b) => a.pand - b.pand)) {
    const first = prim.triangles, count = appendBuckets(prim, u.buckets);
    if (count) prim.ranges.push([u.pand, first, count]);
  }
  let triangles = prim.triangles, primitives = 0, vertices = prim.positions.length / 3;
  if (prim.triangles) {
    const mesh = doc.createMesh('uniques').addPrimitive(primitiveOf(doc, buffer, prim, cityMaterial(doc, cache, {uv: 'uv', doubleSided: false})).setExtras({pandRanges: prim.ranges}));
    scene.addChild(doc.createNode('uniques').setMesh(mesh));
    primitives++;
  }
  doc.getRoot().setExtras({recipeTile: meta});
  await doc.transform(quantize({pattern: /^NORMAL$/, quantizeNormal: 8}));
  // Instance nodes after quantization (see the module comment).
  const ext = doc.createExtension(EXTMeshGPUInstancing), stubMaterial = doc.createMaterial('unit-stub').setBaseColorFactor([0.7, 0.68, 0.64, 1]).setMetallicFactor(0).setRoughnessFactor(1);
  for (const u of [...instances].sort((a, b) => (a.hash < b.hash ? -1 : 1))) {
    const trs = u.items.map(i => decomposeTRS(i.matrix));
    const acc = (type: 'VEC3' | 'VEC4' | 'SCALAR', data: ArrayLike<number>, ctor: Float32ArrayConstructor | Uint16ArrayConstructor = Float32Array) => doc.createAccessor().setType(type).setArray(ctor.from(data as any) as any).setBuffer(buffer);
    const inst = ext.createInstancedMesh()
      .setAttribute('TRANSLATION', acc('VEC3', trs.flatMap(x => x.t)))
      .setAttribute('ROTATION', acc('VEC4', trs.flatMap(x => x.r)))
      .setAttribute('SCALE', acc('VEC3', trs.flatMap(x => x.s)))
      // float32, not uint16: a 2-byte stride does not survive the meshopt vertex codec (4-byte strides only).
      .setAttribute('_PAND', acc('SCALAR', u.items.map(i => i.pand)));
    scene.addChild(doc.createNode(`unit:${u.hash}`).setMesh(stubMesh(doc, buffer, stubMaterial, u.bounds)).setExtension('EXT_mesh_gpu_instancing', inst).setExtras({unit: u.hash}));
  }
  await compress(doc);
  return {bytes: await io.writeBinary(doc), triangles, primitives, vertices};
}

function stubMesh(doc: Document, buffer: GltfBuffer, material: Material, b: {min: number[]; max: number[]}): Mesh {
  const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
  const p = [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]];
  const positions = p.flat(), idx = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 1, 4, 7, 1, 7, 2, 5, 0, 3, 5, 3, 6, 3, 2, 7, 3, 7, 6, 5, 4, 1, 5, 1, 0];
  return doc.createMesh('stub').addPrimitive(doc.createPrimitive().setMaterial(material)
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(Float32Array.from(positions)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint16Array.from(idx)).setBuffer(buffer)));
}

/** A unit from canonical recipe buckets (one city primitive). */
export async function writeBucketUnit(hash: string, b: BucketMap, extras: Record<string, unknown> = {}): Promise<WriteResult & {bounds: {min: number[]; max: number[]}}> {
  const io = await tileIO();
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene(hash), cache = new Map<string, Material>();
  doc.getRoot().setDefaultScene(scene);
  const prim = new CityPrim(true);
  appendBuckets(prim, b);
  const mesh = doc.createMesh(hash).addPrimitive(primitiveOf(doc, buffer, prim, cityMaterial(doc, cache, {uv: 'uv', doubleSided: false})));
  scene.addChild(doc.createNode(hash).setMesh(mesh));
  doc.getRoot().setExtras({unit: {hash, ...extras}});
  const bounds = boundsOf(prim.positions);
  await doc.transform(quantize({pattern: /^(POSITION|NORMAL)$/, quantizePosition: 16, quantizeNormal: 8}));
  await compress(doc);
  return {bytes: await io.writeBinary(doc), triangles: prim.triangles, primitives: 1, vertices: prim.positions.length / 3, bounds};
}

export function boundsOf(positions: ArrayLike<number>): {min: number[]; max: number[]} {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) { min[i % 3] = Math.min(min[i % 3], positions[i]); max[i % 3] = Math.max(max[i % 3], positions[i]); }
  return {min, max};
}

/** Why a glTF material keeps its own look (the city look cannot draw it); null = slot it. Mirrors cityLook.ts `slotIneligible`. */
export function gltfSlotIneligible(m: Material | null, prim: Primitive): string | null {
  if (!m) return 'no material';
  if (m.getExtension('KHR_materials_unlit') || (m.getExtras() as any)?.unlit) return 'unlit';
  if (m.getAlphaMode() === 'BLEND' || m.getBaseColorFactor()[3] < 1) return 'transparent';
  if (prim.getAttribute('COLOR_0')) return 'vertex colours';
  if (m.getBaseColorTexture()) return 'own texture';
  return null;
}

/** Slot + tint of a glTF material: authored extras, else inferred from its name and colour (cityLook `slotForMaterial`). */
export function gltfSlot(m: Material): {slot: MaterialSlot; tint: string; inferred: boolean; source?: 'measured'} {
  const ex = (m.getExtras() ?? {}) as any;
  if (isMaterialSlot(ex.materialSlot) && typeof ex.tint === 'string') return {slot: ex.materialSlot, tint: ex.tint, inferred: false, ...(ex.tintSource === 'measured' ? {source: 'measured' as const} : {})};
  const [r, g, b] = m.getBaseColorFactor(), tint = linearToSrgbHex(r, g, b), inf = inferMaterialSlot(m.getName(), tint);
  return {slot: inf.slot, tint: inf.tint, inferred: true};
}

export interface ConvertReport { triangles: number; cityTriangles: number; passthrough: {material: string; why: string; triangles: number}[]; inferred: number; bounds: {min: number[]; max: number[]}; primitives: number }

/**
 * An installed GLB as a unit: the scene flattened into its own root frame (what `GLTFLoader` hands the landmark loader
 * as `gltf.scene`), every eligible primitive on a city-look material with `_LAYER`/`_TINT`, then joined (one draw per
 * variant), positions/normals quantized, meshopt.
 */
export async function convertGlbUnit(source: Uint8Array, extras: Record<string, unknown>): Promise<WriteResult & {report: ConvertReport}> {
  const io = await tileIO();
  const doc = await io.readBinary(source);
  await doc.transform(dequantize(), uninstance(), flatten());
  for (const node of doc.getRoot().listNodes()) if (node.getMesh()) clearNodeTransform(node);
  const cache = new Map<string, Material>(), buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
  const passthrough: ConvertReport['passthrough'] = [];
  let inferred = 0, cityTriangles = 0, triangles = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    if (!pos || (prim.getMode() !== 4)) { prim.dispose(); continue; }
    const tri = (prim.getIndices()?.getCount() ?? pos.getCount()) / 3;
    triangles += tri;
    const m = prim.getMaterial(), why = gltfSlotIneligible(m, prim);
    if (why) { passthrough.push({material: m?.getName() ?? '', why, triangles: tri}); continue; }
    const {slot, tint, inferred: inf, source} = gltfSlot(m!);
    if (inf) inferred++;
    const n = pos.getCount(), layer = slotLayerOf(slot, {source}), bytes = slotTintBytes(slot, tint, source);
    if (!prim.getAttribute('NORMAL')) addFlatNormals(doc, prim);
    for (const sem of prim.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(sem)) prim.setAttribute(sem, null);
    prim.setAttribute('_LAYER', doc.createAccessor().setType('SCALAR').setArray(new Uint8Array(n).fill(layer)).setBuffer(buffer));
    const tints = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) tints.set(bytes, i * 4);
    prim.setAttribute('_TINT', doc.createAccessor().setType('VEC4').setArray(tints).setNormalized(true).setBuffer(buffer));
    prim.setMaterial(cityMaterial(doc, cache, {uv: prim.getAttribute('TEXCOORD_0') ? 'uv' : 'box', doubleSided: !!m!.getDoubleSided()}));
    cityTriangles += tri;
  }
  // keepAttributes: prune would drop TEXCOORD_0 (no texture reads it), but the city-look shader does.
  await doc.transform(join({keepNamed: false}), prune({keepAttributes: true}));
  const all: number[] = [];
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) { const p = prim.getAttribute('POSITION')!; for (let i = 0; i < p.getCount(); i++) all.push(...p.getElement(i, [])); }
  const bounds = boundsOf(all);
  doc.getRoot().setExtras({unit: {...extras, triangles, cityTriangles, passthrough: passthrough.length}});
  // Box-projected primitives take their UVs from `position` in the shader, scaled by the model matrix only; quantized
  // positions put the dequantization in the node transform, which the runtime folds into the instance matrix, so the
  // brick would be laid out in normalised units. Such units keep float positions.
  const box = doc.getRoot().listMaterials().some(m => (m.getExtras() as any)?.cityLook?.uv === 'box');
  await doc.transform(quantize({pattern: box ? /^NORMAL$/ : /^(POSITION|NORMAL)$/, quantizePosition: 16, quantizeNormal: 8}));
  // Gate: a primitive drawn with authored UVs must still have them.
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives())
    if ((prim.getMaterial()?.getExtras() as any)?.cityLook?.uv === 'uv' && !prim.getAttribute('TEXCOORD_0')) throw Error(`unit ${String(extras.source ?? '')}: uv material without TEXCOORD_0`);
  await compress(doc);
  const primitives = doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().length, 0);
  return {bytes: await io.writeBinary(doc), triangles, primitives, vertices: all.length / 3, report: {triangles, cityTriangles, passthrough, inferred, bounds, primitives}};
}

/** Unweld + flat normals for a primitive that has none (some legacy landmark exports). */
function addFlatNormals(doc: Document, prim: Primitive): void {
  const pos = prim.getAttribute('POSITION')!, idx = prim.getIndices(), count = idx ? idx.getCount() : pos.getCount();
  const outP = new Float32Array(count * 3), outN = new Float32Array(count * 3), a: number[] = [], b: number[] = [], c: number[] = [];
  for (let t = 0; t < count / 3; t++) {
    const i = [0, 1, 2].map(k => (idx ? idx.getScalar(t * 3 + k) : t * 3 + k));
    pos.getElement(i[0], a); pos.getElement(i[1], b); pos.getElement(i[2], c);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(n[0], n[1], n[2]) || 1;
    [a, b, c].forEach((p, k) => { outP.set(p.slice(0, 3), (t * 3 + k) * 3); outN.set([n[0] / l, n[1] / l, n[2] / l], (t * 3 + k) * 3); });
  }
  const buffer = pos.getBuffer();
  for (const sem of prim.listSemantics()) if (sem !== 'POSITION') prim.setAttribute(sem, null);
  prim.setIndices(null).setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(outP).setBuffer(buffer)).setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(outN).setBuffer(buffer));
}

/** Box-projected metre UVs for a soup that lacks them (re-exported for the compiler). */
export {metreBoxUvs};
export type {Node};
