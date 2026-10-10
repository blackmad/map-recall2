/**
 * GLB writers for building types (node/tsx only: gltf-transform + meshoptimizer).
 *
 *   writeTypeGlb      one unit mesh (a type at nominal dimensions)
 *   writeBakedGlb     one node per instance, each with its own exact-size mesh (what the game draws today)
 *   writeMergedGlb    every instance baked into world space, one primitive per material (street-chunk style)
 *   writeInstancedGlb one mesh per (type, variant) + EXT_mesh_gpu_instancing transforms (true instancing)
 *
 * World frame: x east, z south, y = NAP height (the 3DBAG ground). Materials carry `materialSlot` + `tint`
 * extras so `buildingRecipe/recipeLook.ts` can dress them at runtime.
 */
import {Document, NodeIO, type Material, type Buffer as GltfBuffer} from '@gltf-transform/core';
import {EXTMeshGPUInstancing, KHRMeshQuantization, EXTMeshoptCompression} from '@gltf-transform/extensions';
import {meshopt, quantize} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer';
import {weld, type MeshBuilder} from './mesh.ts';

export interface PlacedInstance {
  name: string;
  mesh: MeshBuilder;
  /** East, NAP height, south of the local origin. */
  position: [number, number, number];
  /** Rotation about +y (radians) taking the local frame to east/south. */
  yaw: number;
  extras?: Record<string, unknown>;
}

export interface WriteOptions { compress?: 'none' | 'quantize' | 'meshopt'; /** glTF asset-level extras (anchor, chunk ground height). */ rootExtras?: Record<string, unknown> }
export interface GlbResult { bytes: Uint8Array; triangles: number; primitives: number; vertices: number }

const hexRgb = (hex: string): [number, number, number] => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function materialFor(doc: Document, cache: Map<string, Material>, slot: string, tint: string): Material {
  const id = `${slot}|${tint}`;
  let m = cache.get(id);
  if (!m) {
    const [r, g, b] = hexRgb(tint).map(srgbToLinear);
    m = doc.createMaterial(`${slot}_${tint.slice(1)}`).setBaseColorFactor([r, g, b, 1]).setMetallicFactor(0).setRoughnessFactor(0.9).setExtras({materialSlot: slot, tint});
    cache.set(id, m);
  }
  return m;
}

function meshOf(doc: Document, buffer: GltfBuffer, cache: Map<string, Material>, name: string, mb: MeshBuilder) {
  const mesh = doc.createMesh(name);
  let vertices = 0;
  for (const bucket of mb.buckets.values()) {
    if (!bucket.positions.length) continue;
    const w = weld(bucket);
    vertices += w.positions.length / 3;
    mesh.addPrimitive(doc.createPrimitive().setMaterial(materialFor(doc, cache, bucket.key.slot, bucket.key.tint))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(w.positions.length / 3 < 65536 ? Uint16Array.from(w.indices) : w.indices).setBuffer(buffer))
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(w.positions).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(w.normals).setBuffer(buffer))
      .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(w.uvs).setBuffer(buffer)));
  }
  return {mesh, vertices};
}

async function finish(doc: Document, opt: WriteOptions, triangles: number, vertices: number): Promise<GlbResult> {
  await MeshoptEncoder.ready; await MeshoptDecoder.ready;
  if (opt.rootExtras) doc.getRoot().setExtras(opt.rootExtras);
  const io = new NodeIO().registerExtensions([KHRMeshQuantization, EXTMeshoptCompression, EXTMeshGPUInstancing])
    .registerDependencies({'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder});
  const mode = opt.compress ?? 'meshopt';
  if (mode !== 'none') await doc.transform(quantize({quantizePosition: 14, quantizeNormal: 8, quantizeTexcoord: 12}));
  if (mode === 'meshopt') await doc.transform(meshopt({encoder: MeshoptEncoder, level: 'high'}));
  const primitives = doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().length, 0);
  return {bytes: await io.writeBinary(doc), triangles, primitives, vertices};
}

const quatY = (yaw: number): [number, number, number, number] => [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];

export async function writeTypeGlb(name: string, mb: MeshBuilder, extras: Record<string, unknown>, opt: WriteOptions = {}): Promise<GlbResult> {
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene(name), cache = new Map<string, Material>();
  doc.getRoot().setDefaultScene(scene);
  const {mesh, vertices} = meshOf(doc, buffer, cache, name, mb);
  scene.addChild(doc.createNode(name).setMesh(mesh).setExtras(extras));
  return finish(doc, opt, mb.triangles, vertices);
}

export async function writeBakedGlb(name: string, instances: PlacedInstance[], opt: WriteOptions = {}): Promise<GlbResult> {
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene(name), cache = new Map<string, Material>();
  doc.getRoot().setDefaultScene(scene);
  let triangles = 0, vertices = 0;
  for (const inst of instances) {
    const {mesh, vertices: v} = meshOf(doc, buffer, cache, inst.name, inst.mesh);
    vertices += v; triangles += inst.mesh.triangles;
    scene.addChild(doc.createNode(inst.name).setMesh(mesh).setTranslation(inst.position).setRotation(quatY(inst.yaw)).setExtras(inst.extras ?? {}));
  }
  return finish(doc, opt, triangles, vertices);
}

/** Bake a local mesh into the east/south/NAP world frame. */
export function bakeWorld(mb: MeshBuilder, position: [number, number, number], yaw: number, scale: [number, number, number] = [1, 1, 1]): MeshBuilder {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return mb.mapped(
    p => { const x = p[0] * scale[0], y = p[1] * scale[1], z = p[2] * scale[2]; return [position[0] + c * x + s * z, position[1] + y, position[2] - s * x + c * z]; },
    n => [c * n[0] + s * n[2], n[1], -s * n[0] + c * n[2]],
  );
}

export async function writeMergedGlb(name: string, instances: PlacedInstance[], opt: WriteOptions = {}): Promise<GlbResult> {
  const world = new (instances[0].mesh.constructor as new () => MeshBuilder)();
  for (const inst of instances) world.append(bakeWorld(inst.mesh, inst.position, inst.yaw));
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene(name), cache = new Map<string, Material>();
  doc.getRoot().setDefaultScene(scene);
  const {mesh, vertices} = meshOf(doc, buffer, cache, name, world);
  scene.addChild(doc.createNode(name).setMesh(mesh).setExtras({instances: instances.map(i => i.extras ?? {})}));
  return finish(doc, opt, world.triangles, vertices);
}

export interface InstancedGroup {
  name: string;
  mesh: MeshBuilder;
  instances: {position: [number, number, number]; yaw: number; scale: [number, number, number]; extras?: Record<string, unknown>}[];
}

export async function writeInstancedGlb(name: string, groups: InstancedGroup[], opt: WriteOptions = {}): Promise<GlbResult> {
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene(name), cache = new Map<string, Material>();
  doc.getRoot().setDefaultScene(scene);
  const ext = doc.createExtension(EXTMeshGPUInstancing);
  let triangles = 0, vertices = 0;
  for (const g of groups) {
    const {mesh, vertices: v} = meshOf(doc, buffer, cache, g.name, g.mesh);
    vertices += v; triangles += g.mesh.triangles * g.instances.length;
    const acc = (type: 'VEC3' | 'VEC4', data: number[]) => doc.createAccessor().setType(type).setArray(Float32Array.from(data)).setBuffer(buffer);
    const inst = ext.createInstancedMesh()
      .setAttribute('TRANSLATION', acc('VEC3', g.instances.flatMap(i => i.position)))
      .setAttribute('ROTATION', acc('VEC4', g.instances.flatMap(i => quatY(i.yaw))))
      .setAttribute('SCALE', acc('VEC3', g.instances.flatMap(i => i.scale)));
    scene.addChild(doc.createNode(g.name).setMesh(mesh).setExtension('EXT_mesh_gpu_instancing', inst).setExtras({instances: g.instances.map(i => i.extras ?? {})}));
  }
  return finish(doc, opt, triangles, vertices);
}
