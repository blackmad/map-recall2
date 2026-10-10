/**
 * Triangle soups: a compiled house group baked into the chunk frame and
 * bucketed by material, the way `canalhouseGroupToGlb` buckets one house, so a
 * chunk's materials are exactly the recipe look's materials.
 */
import * as T from 'three';
import {canalhouseRoofUvs} from '../canalhouseRoofMaterials.ts';
import {metreBoxUvs, paneUvs} from '../../../scripts/canalhouse-recipes/export-glb.ts';
import type {CanalHouseIntent} from '../buildingRecipe/intent.ts';
import type {Bucket, BucketMap} from './types.ts';

/** Material slot of a compiled mesh (brick, roofTile, slate, bitumen, stone, frame, door, glass, accent). */
export function recipeSlotFor(intent: CanalHouseIntent) {
  const roofSlot = ['slate', 'zinc', 'bitumen', 'copper'].includes(intent.roof.material) ? 'slate' : 'roofTile';
  const wallSlot = intent.palette.wallMaterial === 'stucco' ? 'stucco' : 'brick';
  return (mesh: T.Mesh): string => {
    const surface = mesh.userData.surface as string;
    if (surface === 'roof') return (mesh.material as T.MeshStandardMaterial).color.getHSL({h: 0, s: 0, l: 0}).l > 0.36 ? 'bitumen' : roofSlot;
    return ({wall: wallSlot, accent: 'accent', stone: 'stone', trim: 'frame', joinery: 'frame', door: 'door', shop: 'door', awning: 'door', sign: 'door', glass: 'glass'} as Record<string, string>)[surface] ?? 'brick';
  };
}

/** Bake `group` through `toFrame` (recipe-local → chunk frame) into material buckets. */
export function groupToBuckets(group: T.Object3D, toFrame: T.Matrix4, slotFor: (mesh: T.Mesh) => string): BucketMap {
  group.updateMatrixWorld(true);
  const buckets: BucketMap = new Map();
  group.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    if (Array.isArray(object.material)) throw Error('Chunk export requires one material per mesh');
    const material = object.material as T.MeshStandardMaterial;
    const surface = object.userData.surface as string, slot = slotFor(object);
    const key = `${material.color.getHexString()}_${slot}`;
    let bucket = buckets.get(key);
    if (!bucket) { bucket = {key, slot, tint: '#' + material.color.getHexString(), surface, positions: [], normals: [], uvs: []}; buckets.set(key, bucket); }
    const geometry: T.BufferGeometry = (object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone())
      .applyMatrix4(new T.Matrix4().multiplyMatrices(toFrame, object.matrixWorld));
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
    const positions = geometry.getAttribute('position').array;
    if (slot === 'glass') bucket.uvs.push(...paneUvs(positions));
    else if (surface === 'roof') bucket.uvs.push(...Array.from(canalhouseRoofUvs(geometry, 1).array));
    else bucket.uvs.push(...metreBoxUvs(positions));
    bucket.positions.push(...Array.from(positions));
    bucket.normals.push(...Array.from(geometry.getAttribute('normal').array));
    geometry.dispose();
  });
  return buckets;
}

export const triangleCount = (buckets: BucketMap): number => [...buckets.values()].reduce((s, b) => s + b.positions.length / 9, 0);

export function boundsOf(buckets: BucketMap): {min: number[]; max: number[]} {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const b of buckets.values()) for (let i = 0; i < b.positions.length; i++) {
    const k = i % 3; min[k] = Math.min(min[k], b.positions[i]); max[k] = Math.max(max[k], b.positions[i]);
  }
  return {min: min.map(v => +v.toFixed(3)), max: max.map(v => +v.toFixed(3))};
}
