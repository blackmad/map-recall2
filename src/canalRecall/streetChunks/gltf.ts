/**
 * Chunk GLB writer: ONE mesh, one primitive per material, houses laid out in
 * street order inside each primitive so a pand is a contiguous index range.
 * The ranges, BAG ids and recipe provenance go into glTF extras:
 *   node.extras.streetChunk        = {version, name, pands[] (with ranges), frame}
 *   primitive.extras.pandRanges    = [[pandIndex, firstTriangle, triangleCount], ...]
 * Vertices are welded per primitive (identical position/normal/uv only), so a
 * range never depends on a shared vertex being owned by one pand.
 */
import {Document, NodeIO} from '@gltf-transform/core';
import {KHRMeshQuantization} from '@gltf-transform/extensions';
import {quantize} from '@gltf-transform/functions';
import type {BucketMap, PandMeta} from './types.ts';

export interface ChunkGlbInput {
  name: string;
  houses: {buckets: BucketMap}[];
  /** Filled in: per house, ranges per primitive. */
  pands: PandMeta[];
  frame: unknown;
  maxBytes?: number;
}

const SLOT_ORDER = ['brick', 'accent', 'stone', 'frame', 'door', 'glass', 'roofTile', 'slate', 'bitumen'];

export async function writeChunkGlb(input: ChunkGlbInput): Promise<{bytes: Uint8Array; triangles: number; primitives: number; quantized: boolean}> {
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene(input.name), mesh = doc.createMesh(input.name);
  doc.getRoot().setDefaultScene(scene);
  const keys = new Map<string, {slot: string; tint: string; surface: string}>();
  for (const h of input.houses) for (const b of h.buckets.values()) if (!keys.has(b.key)) keys.set(b.key, {slot: b.slot, tint: b.tint, surface: b.surface});
  const ordered = [...keys.entries()].sort(([ka, a], [kb, b]) => (SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot)) || ka.localeCompare(kb));
  for (const p of input.pands) p.ranges = [];
  let triangles = 0;
  ordered.forEach(([key, info], primitiveIndex) => {
    const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [], seen = new Map<string, number>();
    const ranges: number[][] = [];
    input.houses.forEach((house, hi) => {
      const b = house.buckets.get(key);
      if (!b || !b.positions.length) return;
      const first = indices.length / 3, count = b.positions.length / 9;
      for (let t = 0; t < count; t++) for (let k = 0; k < 3; k++) {
        const v = t * 3 + k, p = b.positions.slice(v * 3, v * 3 + 3), n = b.normals.slice(v * 3, v * 3 + 3), u = b.uvs.slice(v * 2, v * 2 + 2);
        const f32 = Float32Array.from([...p, ...n, ...u]), id = Array.from(f32).join(',');
        let index = seen.get(id);
        if (index === undefined) { index = positions.length / 3; seen.set(id, index); positions.push(f32[0], f32[1], f32[2]); normals.push(f32[3], f32[4], f32[5]); uvs.push(f32[6], f32[7]); }
        indices.push(index);
      }
      ranges.push([hi, first, count]);
      input.pands[hi].ranges.push({primitive: primitiveIndex, firstTriangle: first, triangleCount: count});
      triangles += count;
    });
    const c = key.split('_')[0], rgb = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255);
    const material = doc.createMaterial(key).setExtras({canalhouseSurface: info.surface, materialSlot: info.slot, tint: info.tint}).setBaseColorFactor([rgb[0], rgb[1], rgb[2], 1]).setMetallicFactor(0).setRoughnessFactor(0.9);
    const primitive = doc.createPrimitive().setMaterial(material).setExtras({pandRanges: ranges})
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(positions.length / 3 < 65536 ? Uint16Array.from(indices) : Uint32Array.from(indices)).setBuffer(buffer))
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(Float32Array.from(positions)).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(Float32Array.from(normals)).setBuffer(buffer))
      .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(Float32Array.from(uvs)).setBuffer(buffer));
    mesh.addPrimitive(primitive);
  });
  for (const p of input.pands) p.triangles = p.ranges.reduce((s, r) => s + r.triangleCount, 0);
  const node = doc.createNode(input.name).setMesh(mesh).setExtras({streetChunk: {version: 1, name: input.name, frame: input.frame, pands: input.pands}});
  scene.addChild(node);
  const io = new NodeIO().registerExtensions([KHRMeshQuantization]);
  let bytes = await io.writeBinary(doc), quantized = false;
  if (bytes.length > (input.maxBytes ?? 1_500_000)) {
    await doc.transform(quantize({pattern: /^NORMAL$/, quantizeNormal: 8}));
    bytes = await io.writeBinary(doc); quantized = true;
  }
  return {bytes, triangles, primitives: ordered.length, quantized};
}
