/**
 * Geometry acceptance for the civic-20261009b landmarks:
 *   node --import tsx scripts/check-civic-landmark-geometry.ts <id> [maxExtraXZ=1]
 * Decodes the installed GLB, then checks finite vertices, ground contact, footprint overrun
 * against the BAG rings, tallest point against 3DBAG, and the triangle cap.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
const id = process.argv[2]; assert(id, 'model id required');
const extra = Number(process.argv[3] ?? 1);
const source = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
const spec = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-spec.json`, 'utf8'));
await MeshoptDecoder.ready;
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder}).read(`public/canal-drive/models/${id}.glb`);
let tris = 0; const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
const verts: number[][] = [];
for (const node of doc.getRoot().listNodes()) {
  const m = node.getMesh(); if (!m) continue; const M = node.getWorldMatrix();
  for (const p of m.listPrimitives()) {
    const pos = p.getAttribute('POSITION')!; tris += (p.getIndices()?.getCount() ?? pos.getCount()) / 3;
    for (let i = 0; i < pos.getCount(); i++) {
      const r = pos.getElement(i, [0, 0, 0]);
      const v = [M[0]*r[0]+M[4]*r[1]+M[8]*r[2]+M[12], M[1]*r[0]+M[5]*r[1]+M[9]*r[2]+M[13], M[2]*r[0]+M[6]*r[1]+M[10]*r[2]+M[14]];
      for (let k = 0; k < 3; k++) { assert(Number.isFinite(v[k]), 'finite'); min[k] = Math.min(min[k], v[k]); max[k] = Math.max(max[k], v[k]); }
      verts.push(v);
    }
  }
}
const rings: number[][][] = source.pands.map((p: {localRing: number[][]}) => p.localRing);
const inside = (ring: number[][], x: number, z: number) => { let y = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, zi] = ring[i], [xj, zj] = ring[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) y = !y; } return y; };
const dseg = (x: number, z: number, a: number[], b: number[]) => { const dx = b[0]-a[0], dz = b[1]-a[1], t = Math.max(0, Math.min(1, ((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1))); return Math.hypot(x-(a[0]+t*dx), z-(a[1]+t*dz)); };
let worst = 0;
for (const v of verts) {
  if (rings.some(r => inside(r, v[0], v[2]))) continue;
  const d = Math.min(...rings.flatMap(r => r.slice(0, -1).map((a, i) => dseg(v[0], v[2], a, r[i + 1]))));
  worst = Math.max(worst, d);
}
assert(worst <= extra, `vertices overrun the BAG footprint by ${worst.toFixed(2)} m (limit ${extra})`);
const g = source.pands.map((p: {['3dbag']: {b3_h_dak_max: number; b3_h_maaiveld: number}}) => p['3dbag'].b3_h_dak_max - p['3dbag'].b3_h_maaiveld);
const top = Math.max(...g);
assert(max[1] <= top + 1.5 && max[1] >= top - 2.5, `top ${max[1].toFixed(2)} vs 3DBAG max ${top.toFixed(2)}`);
assert(min[1] > -.05 && min[1] < .1, `ground contact ${min[1]}`);
assert(tris > 100 && tris < 25000, `triangles ${tris}`);
for (const o of spec.suppressOsmIds as string[]) assert(o.startsWith('NL.IMBAG.Pand.') || /^[wr]\d+$/.test(o));
console.log(JSON.stringify({id, ok: true, tris, top: +max[1].toFixed(2), threeDbagTop: +top.toFixed(2), worstOverrunM: +worst.toFixed(2), bytes: fs.statSync(`public/canal-drive/models/${id}.glb`).size}));
