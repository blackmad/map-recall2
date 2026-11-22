/**
 * Block pilot export (lane belt-block-pilot-20261122): runs a block builder over its source (prepare.ts) and writes one
 * GLB for the whole block, the way build-manual-landmarks.ts save() writes a landmark: one mesh, one primitive per
 * material, weld/dedup/prune and meshopt, material extras from the slot inference with the stated colour kept
 * (`tintSource: 'measured'`). Colours are `<word>:<#hex>` keys (see row-kit.ts), one material each.
 *
 *   node --import tsx scripts/belt-block/build.ts herengracht-50-90
 *
 * Writes scripts/belt-block/out/<id>.glb and <id>.stats.json (triangles, materials, bytes, per-pand triangles).
 * Frame: x east, y up, z south, metres from the source's anchorRD (the recipe GLB convention, so house preview's
 * recipeToEnu places it). Nothing is installed: no catalogue, covers or chunk files are touched.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import {Document, NodeIO} from '@gltf-transform/core';
import {dedup, prune, weld, meshopt} from '@gltf-transform/functions';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptEncoder} from 'meshoptimizer';
import {inferredSlotExtras} from '../../src/canalRecall/look/materialSlotInference';
import type {Sink} from './row-kit.ts';

export type Bucket = Map<string, T.BufferGeometry[]>;
export const sinkOf = (bucket: Bucket, tag: () => string, perTag: Map<string, number>): Sink => ({
  add(g, colour) {
    const k = colour.includes(':') ? colour : `wall:${colour}`;
    (bucket.get(k) ?? bucket.set(k, []).get(k)!).push(g.index ? g.toNonIndexed() : g);
    const n = g.index ? g.index.count / 3 : g.getAttribute('position').count / 3;
    perTag.set(tag(), (perTag.get(tag()) ?? 0) + n);
  },
});

export async function writeGlb(id: string, bucket: Bucket, file: string) {
  await MeshoptEncoder.ready;
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene(id), mesh = doc.createMesh(id);
  doc.getRoot().setDefaultScene(scene);
  for (const [key, gs] of [...bucket.entries()].sort()) {
    const [word, hex] = key.split(':'), name = `${word}-${hex.slice(1)}`;
    const pos: number[] = [], nor: number[] = [];
    for (const g of gs) {
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      pos.push(...(g.getAttribute('position').array as ArrayLike<number>));
      nor.push(...(g.getAttribute('normal').array as ArrayLike<number>));
    }
    const rgb = new T.Color(hex);
    const base = inferredSlotExtras(name, hex), extras = word === 'glass' ? base : {...base, tint: hex, tintSource: 'measured'};
    const mat = doc.createMaterial(name).setBaseColorFactor([rgb.r, rgb.g, rgb.b, 1]).setMetallicFactor(0).setRoughnessFactor(0.9).setDoubleSided(true).setExtras(extras);
    mesh.addPrimitive(doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(Float32Array.from(pos)).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(Float32Array.from(nor)).setBuffer(buffer))
      .setMaterial(mat));
  }
  scene.addChild(doc.createNode(id).setMesh(mesh));
  await doc.transform(weld(), dedup(), prune(), meshopt({encoder: MeshoptEncoder, level: 'medium'}));
  fs.mkdirSync(path.dirname(file), {recursive: true});
  await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder': MeshoptEncoder}).write(file, doc);
  const tris = doc.getRoot().listMeshes().flatMap(m => m.listPrimitives()).reduce((s, p) => s + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')!.getCount()) / 3, 0);
  return {triangles: tris, materials: doc.getRoot().listMaterials().length, primitives: mesh.listPrimitives().length, bytes: fs.statSync(file).size};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const id = process.argv[2] ?? 'herengracht-50-90';
  const mod = await import(`./${id}-builder.ts`) as {buildBlock: (S: (tag: string) => Sink, src: unknown) => void};
  const src = JSON.parse(fs.readFileSync(`scripts/belt-block/${id}-source.json`, 'utf8'));
  const bucket: Bucket = new Map(), perTag = new Map<string, number>();
  let cur = '';
  const sink = sinkOf(bucket, () => cur, perTag);
  const t0 = performance.now();
  mod.buildBlock(tag => { cur = tag; return sink; }, src);
  const out = `scripts/belt-block/out/${id}.glb`, stats = await writeGlb(id, bucket, out);
  const all = {id, ...stats, buildMs: Math.round(performance.now() - t0), trianglesBeforeWeld: [...perTag.values()].reduce((a, b) => a + b, 0), perTag: Object.fromEntries([...perTag.entries()].map(([k, v]) => [k, Math.round(v)]))};
  fs.writeFileSync(`scripts/belt-block/out/${id}.stats.json`, JSON.stringify(all, null, 1) + '\n');
  console.log(JSON.stringify({...all, perTag: undefined}));
}
