/**
 * Which meshes own a house's open edges (the `open-edges` gate, gates.ts `topology`), counted by mesh-name stem.
 *
 *   node --import tsx scripts/building-recipes/open-edge-sources.ts --house=<id>[,<id>...] [--json]
 *
 * Compiles each house (compile.ts `compileHouse`), takes the gate's open-edge samples (up to 16 per house) and finds, for
 * every sample, the meshes of the compiled group that have a triangle edge through its midpoint (2 cm). Prints per house
 * the samples (midpoint, length, surface, mesh) and a table by mesh-name stem, so an emitter that leaves seams shows up as
 * a stem with a count (belt lane Haarlemmerbuurt, #356).
 */
import * as T from 'three';
import {compileHouse} from './compile.ts';
import {topology, type Tri} from '../../src/canalRecall/buildingRecipe/gates.ts';

export const HELP = `open-edge-sources: node --import tsx scripts/building-recipes/open-edge-sources.ts --house=<id>[,<id>...] [--json] [--help]
Names the meshes that own each open edge of a compiled recipe house, and counts them by mesh-name stem.`;

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
if (process.argv.includes('--help')) { console.log(HELP); process.exit(0); }

export interface OpenSource { house: string; mid: number[]; lengthM: number; surface: string; meshes: string[] }

export function ownersOf(group: T.Group, mid: number[], tol = 0.02): string[] {
  group.updateWorldMatrix(true, true);
  const out = new Set<string>(), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
  group.traverse(o => {
    const m = o as T.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute('position'), idx = m.geometry.getIndex();
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const [i0, i1, i2] = idx ? [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)] : [i, i + 1, i + 2];
      a.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld); b.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld); c.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
      for (const [p, q] of [[a, b], [b, c], [c, a]] as const) {
        const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, mz = (p.z + q.z) / 2;
        if (Math.abs(mx - mid[0]) < tol && Math.abs(my - mid[1]) < tol && Math.abs(mz - mid[2]) < tol) out.add(m.name || m.parent?.name || '(unnamed)');
      }
    }
  });
  return [...out];
}

const stem = (name: string) => name.replace(/\/[\w-]*\d[\w-]*$/, '').replace(/[-_]?\d+$/, '');

const ids = (arg('house') ?? '').split(',').filter(Boolean);
if (ids.length) {
  const all: OpenSource[] = [];
  for (const id of ids) {
    const {built, glb} = await compileHouse(id);
    const {decodeTriangles} = await import('./compile.ts');
    const tris: Tri[] = await decodeTriangles(glb.bytes);
    const topo = topology(tris);
    for (const s of topo.openEdgeSamples) all.push({house: id, mid: s.mid, lengthM: s.lengthM, surface: s.surface, meshes: ownersOf(built.group, s.mid)});
    console.log(`${id}: ${topo.openEdges} open edges, ${topo.openEdgeLengthM.toFixed(2)} m`);
  }
  if (process.argv.includes('--json')) console.log(JSON.stringify(all, null, 1));
  else {
    for (const s of all) console.log(`  ${s.house} mid ${s.mid.join(',')} ${s.lengthM} m ${s.surface} <- ${s.meshes.join(' | ') || '?'}`);
    const by = new Map<string, number>();
    for (const s of all) for (const m of s.meshes.length ? s.meshes : ['?']) by.set(stem(m), (by.get(stem(m)) ?? 0) + 1);
    console.log('by mesh stem:', [...by.entries()].sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(', '));
  }
}
