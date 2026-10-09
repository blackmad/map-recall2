/** Shared, texture-free GLB export for compiled canalhouse recipes.
 * Used by the legacy batch builder (build.ts) and the intent pipeline
 * (scripts/building-recipes/compile.ts). Survey positions stay Float32 exact. */
import * as T from 'three';
import {Document, NodeIO} from '@gltf-transform/core';
import {dedup, prune, weld, quantize} from '@gltf-transform/functions';
import {KHRMeshQuantization} from '@gltf-transform/extensions';
import {canalhouseRoofUvs, canalhouseRoofMaterialPresets, type CanalhouseRoofMaterialPreset} from '../../src/canalRecall/canalhouseRoofMaterials.ts';

export interface CanalhouseGlbOptions {
  roofPreset?: CanalhouseRoofMaterialPreset;
  /** Hard byte budget; normals are quantized before failing. */
  maxBytes?: number;
}
export interface CanalhouseGlb { bytes: Uint8Array; triangles: number; materials: number }

/** Bucket every mesh by colour, bake world transforms, and write one-mesh GLB bytes. */
export async function canalhouseGroupToGlb(id: string, group: T.Object3D, options: CanalhouseGlbOptions = {}): Promise<CanalhouseGlb> {
  group.updateMatrixWorld(true);
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene(id), mesh = doc.createMesh(id);
  doc.getRoot().setDefaultScene(scene);
  const roofPreset = options.roofPreset;
  if (roofPreset && !canalhouseRoofMaterialPresets[roofPreset]) throw Error('Unknown roof material preset');
  const buckets = new Map<string, {material: T.MeshStandardMaterial; positions: number[]; normals: number[]; uvs: number[]; surface: string; roofPreset?: CanalhouseRoofMaterialPreset}>();
  group.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    if (Array.isArray(object.material)) throw Error('Assembly export requires one material per mesh');
    const material = object.material as T.MeshStandardMaterial;
    if (material.map) throw Error('Canalhouse originals must be texture-free');
    const surface = object.userData.surface as string, preset = surface === 'roof' ? roofPreset : undefined;
    const key = material.color.getHexString() + (preset ? '_roof' : ''), bucket = buckets.get(key) ?? {material, positions: [], normals: [], uvs: [], surface, roofPreset: preset};
    buckets.set(key, bucket);
    const geometry: T.BufferGeometry = (object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()).applyMatrix4(object.matrixWorld);
    // Baking a reflected facade basis must also reverse its triangle winding.
    if (object.matrixWorld.determinant() < 0) for (const attribute of Object.values(geometry.attributes)) {
      for (let i = 0; i < attribute.count; i += 3) for (let axis = 0; axis < attribute.itemSize; axis++) {
        const values = attribute.array, a = (i + 1) * attribute.itemSize + axis, b = (i + 2) * attribute.itemSize + axis, temp = values[a]; values[a] = values[b]; values[b] = temp;
      }
    }
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
    if (preset) bucket.uvs.push(...Array.from(canalhouseRoofUvs(geometry, canalhouseRoofMaterialPresets[preset].widthM).array));
    bucket.positions.push(...Array.from(geometry.getAttribute('position').array));
    bucket.normals.push(...Array.from(geometry.getAttribute('normal').array)); geometry.dispose();
  });
  for (const [key, bucket] of buckets) {
    const c = bucket.material.color;
    const material = doc.createMaterial(key).setExtras({canalhouseSurface: bucket.surface}).setBaseColorFactor([c.r, c.g, c.b, 1]).setMetallicFactor(0).setRoughnessFactor(.9);
    const primitive = doc.createPrimitive().setMaterial(material)
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(Float32Array.from(bucket.positions)).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(Float32Array.from(bucket.normals)).setBuffer(buffer));
    if (bucket.uvs.length) primitive.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(Float32Array.from(bucket.uvs)).setBuffer(buffer));
    mesh.addPrimitive(primitive);
  }
  scene.addChild(doc.createNode(id).setMesh(mesh));
  await doc.transform(weld(), dedup(), prune({keepAttributes: !!roofPreset}));
  const io = new NodeIO().registerExtensions([KHRMeshQuantization]);
  let bytes = await io.writeBinary(doc);
  const maxBytes = options.maxBytes ?? 500000;
  // Keep surveyed positions exact. Larger shared owners can compact only their
  // shading normals, following the existing manual-asset export convention.
  if (bytes.length > maxBytes) {
    await doc.transform(quantize({pattern: /^NORMAL$/, quantizeNormal: 8}), weld(), dedup(), prune({keepAttributes: !!roofPreset}));
    bytes = await io.writeBinary(doc);
  }
  const triangles = doc.getRoot().listMeshes().flatMap(m => m.listPrimitives()).reduce((s, p) => s + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')!.getCount()) / 3, 0);
  return {bytes, triangles, materials: doc.getRoot().listMaterials().length};
}
