/**
 * Slim a placed wall relief (round 3, lane sculpture-r3-20261122) so its landmark stays under the 500 KB model cap.
 *
 * r2-relief.ts writes a relief as unindexed triangles. installed-figures.ts then computes normals per triangle, so the
 * landmark exporter cannot weld any vertex and every triangle costs three vertices. Welding the relief here lets
 * installed-figures smooth-shade it and lets the exporter share vertices. Optionally the welded mesh is then simplified
 * (meshoptimizer, border-locked) to a triangle target. Triangles facing into the wall (hidden backs) are dropped.
 *
 *   node --import tsx scripts/sculptures/slim-relief.ts --in=<relief.glb> --out=<relief.glb> [--normal=nx,nz]
 *        [--tris=<n>] [--error=0.01] [--weld=0.001]
 *
 * Tried and dropped (Hoofdbureau arms, 2026-11-22): crease-split normals keep the carving crisper but split so many
 * vertices that the model went back over the cap (509 KB at 3284 triangles); smooth welding read the same at gallery size.
 */
import fs from 'node:fs';
import path from 'node:path';
import {Document, NodeIO} from '@gltf-transform/core';
import {MeshoptSimplifier} from 'meshoptimizer';

const arg = (k: string, d = '') => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const io = new NodeIO();
const src = await io.read(arg('in'));
const pos: number[] = [];
for (const node of src.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  for (const p of mesh.listPrimitives()) {
    const a = p.getAttribute('POSITION')!.getArray()!, idx = p.getIndices()?.getArray();
    const n = idx ? idx.length : a.length / 3;
    for (let i = 0; i < n; i++) { const v = idx ? idx[i] : i; pos.push(a[v * 3], a[v * 3 + 1], a[v * 3 + 2]); }
  }
}
const tol = Number(arg('weld', '0.001'));
const verts: number[] = [], index: number[] = [], seen = new Map<string, number>();
for (let i = 0; i < pos.length; i += 3) {
  const k = `${Math.round(pos[i] / tol)},${Math.round(pos[i + 1] / tol)},${Math.round(pos[i + 2] / tol)}`;
  let v = seen.get(k);
  if (v === undefined) { v = verts.length / 3; seen.set(k, v); verts.push(pos[i], pos[i + 1], pos[i + 2]); }
  index.push(v);
}
// drop degenerate triangles and, given the wall's outward normal, triangles facing into the wall
const normal = arg('normal') ? arg('normal').split(',').map(Number) : null;
let tri: number[] = [];
let back = 0;
for (let t = 0; t < index.length; t += 3) {
  const [a, b, c] = [index[t], index[t + 1], index[t + 2]];
  if (a === b || b === c || a === c) continue;
  if (normal) {
    const P = (v: number) => [verts[v * 3], verts[v * 3 + 1], verts[v * 3 + 2]];
    const [pa, pb, pc] = [P(a), P(b), P(c)];
    const u = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], w = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    const nx = u[1] * w[2] - u[2] * w[1], nz = u[0] * w[1] - u[1] * w[0];
    const ny = u[2] * w[0] - u[0] * w[2], len = Math.hypot(nx, ny, nz) || 1;
    if ((nx * normal[0] + nz * normal[1]) / len < -0.2) { back++; continue; }
  }
  tri.push(a, b, c);
}
const welded = tri.length / 3;
const target = Number(arg('tris', '0'));
if (target && target < welded) {
  await MeshoptSimplifier.ready;
  const [out] = MeshoptSimplifier.simplify(new Uint32Array(tri), new Float32Array(verts), 3, target * 3, Number(arg('error', '0.01')), ['LockBorder']);
  tri = Array.from(out);
}
// compact the vertex list
const remap = new Map<number, number>(), outV: number[] = [];
const outI = tri.map(v => { let r = remap.get(v); if (r === undefined) { r = outV.length / 3; remap.set(v, r); outV.push(verts[v * 3], verts[v * 3 + 1], verts[v * 3 + 2]); } return r; });
const doc = new Document();
const buf = doc.createBuffer();
const mat = doc.createMaterial(src.getRoot().listMaterials()[0]?.getName() ?? 'stone');
const prim = doc.createPrimitive().setMaterial(mat)
  .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(outV)).setBuffer(buf))
  .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(outI)).setBuffer(buf));
const name = path.basename(arg('out'), '.glb');
doc.createScene().addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
fs.mkdirSync(path.dirname(arg('out')), {recursive: true});
await io.write(arg('out'), doc);
console.log(JSON.stringify({in: pos.length / 9, welded, droppedBack: back, triangles: outI.length / 3, vertices: outV.length / 3}));
