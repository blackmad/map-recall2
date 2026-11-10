// Ground v2: one cell from the store to GRD2 bytes (lane G2a #372). Shared by bake-ground.ts and check-ground-v2.ts.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { MeshoptEncoder } from 'meshoptimizer';
import { GAME_FRAME_SCALE, GAME_ORIGIN, type GroundStore } from '../../src/canalRecall/ownGround/groundStore.ts';
import { bakeSurface, type BakedSurface, type SurfaceBakeOptions } from '../../src/canalRecall/ownGround/groundPartition.ts';
import { partitionSources, type PartitionSources } from '../../src/canalRecall/ownGround/groundV2Sources.ts';
import { encodeGrd2, frameOf, tileOfUnits, type Grd2Content, type Grd2Group, GRID_Q } from '../../src/canalRecall/ownGround/groundV2Format.ts';
import { GROUND_LAYERS, type GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';

export const frame = frameOf(GAME_ORIGIN, GAME_FRAME_SCALE);
/** The bake's own sources: a change rebakes every cell (--changed) and its neighbours. */
export const CODE = ['src/canalRecall/ownGround/groundPartition.ts', 'src/canalRecall/ownGround/groundV2Sources.ts', 'src/canalRecall/ownGround/groundV2Format.ts', 'scripts/own-ground/groundV2BakeCell.ts'];
export function codeDigest(opt: SurfaceBakeOptions): Uint8Array {
  const h = createHash('sha256'); for (const f of CODE) h.update(readFileSync(f)); h.update(JSON.stringify(opt)); return h.digest().subarray(0, 16);
}

/** Order triangles by (kind, layer, tile), each group's triangles in vertex-cache order, vertices in first-use order. */
export function toContent(b: BakedSurface, groupsLayer: readonly GroundLayer[], lod: 0 | 1, reorder: boolean, codeHash?: Uint8Array): Grd2Content {
  type Tri = { a: number; b: number; c: number; layer: number; kind: 0 | 1; tile: number };
  const tris: Tri[] = [];
  const tileOf = (a: number, bb: number, c: number) => tileOfUnits((b.u[a] + b.u[bb] + b.u[c]) / 3, (b.v[a] + b.v[bb] + b.v[c]) / 3);
  // Counter-clockwise in the game frame (x east, y north): three.js front faces, normals up.
  const ccw = (a: number, bb: number, c: number) => (b.u[bb] - b.u[a]) * (b.v[c] - b.v[a]) - (b.u[c] - b.u[a]) * (b.v[bb] - b.v[a]) >= 0;
  for (let k = 0; k < b.triGroup.length; k++) {
    let [p, q, r] = [b.tris[3 * k], b.tris[3 * k + 1], b.tris[3 * k + 2]];
    if (!ccw(p, q, r)) [q, r] = [r, q];
    tris.push({ a: p, b: q, c: r, layer: GROUND_LAYERS.indexOf(groupsLayer[b.triGroup[k]]), kind: 0, tile: tileOf(p, q, r) });
  }
  for (let k = 0; k < b.stepLayer.length; k++) { const [p, q, r] = [b.steps[3 * k], b.steps[3 * k + 1], b.steps[3 * k + 2]]; tris.push({ a: p, b: q, c: r, layer: GROUND_LAYERS.indexOf(b.stepLayer[k]), kind: 1, tile: tileOf(p, q, r) }); }
  tris.sort((x, y) => x.kind - y.kind || x.layer - y.layer || x.tile - y.tile);
  const groups: Grd2Group[] = [];
  for (let i = 0; i < tris.length;) {
    let j = i; while (j < tris.length && tris[j].kind === tris[i].kind && tris[j].layer === tris[i].layer && tris[j].tile === tris[i].tile) j++;
    groups.push({ layer: GROUND_LAYERS[tris[i].layer], kind: tris[i].kind, tile: tris[i].tile, first: i, count: j - i });
    i = j;
  }
  let idx = new Uint32Array(tris.length * 3); tris.forEach((t, i) => { idx[3 * i] = t.a; idx[3 * i + 1] = t.b; idx[3 * i + 2] = t.c; });
  if (reorder) {
    // Vertex-cache order within each group (meshopt), then every vertex renumbered by first use (vertex-fetch order).
    for (const g of groups) {
      const sub = idx.slice(g.first * 3, (g.first + g.count) * 3);
      const used = [...new Set(sub)].sort((p, q) => p - q), local = new Map(used.map((v, i) => [v, i]));
      const loc = Uint32Array.from(sub, v => local.get(v)!);
      const [remap] = MeshoptEncoder.reorderMesh(loc, true, false);
      const inv = new Uint32Array(used.length); for (let i = 0; i < used.length; i++) if (remap[i] !== 0xffffffff) inv[remap[i]] = used[i];
      for (let i = 0; i < loc.length; i++) idx[g.first * 3 + i] = inv[loc[i]];
    }
  }
  const V = b.u.length, newId = new Int32Array(V).fill(-1); let n = 0;
  const order: number[] = [];
  if (reorder) { for (let i = 0; i < idx.length; i++) if (newId[idx[i]] < 0) { newId[idx[i]] = n++; order.push(idx[i]); } }
  for (let v = 0; v < V; v++) if (newId[v] < 0) { newId[v] = n++; order.push(v); }
  idx = idx.map(v => newId[v]);
  const u = Uint16Array.from(order, v => b.u[v]), vv = Uint16Array.from(order, v => b.v[v]), zMm = Int32Array.from(order, v => b.zMm[v]);
  const oct = new Int8Array(2 * V); order.forEach((v, i) => { oct[2 * i] = b.oct[2 * v]; oct[2 * i + 1] = b.oct[2 * v + 1]; });
  // Seams: per side, the vertex ids in order along it (by the other coordinate, then z).
  const side = (test: (i: number) => boolean, along: (i: number) => number) => { const ids: number[] = []; for (let i = 0; i < V; i++) if (test(i)) ids.push(i); ids.sort((p, q) => along(p) - along(q) || zMm[p] - zMm[q]); return Uint32Array.from(ids); };
  const seams: Grd2Content['seams'] = [side(i => u[i] === 0, i => vv[i]), side(i => u[i] === GRID_Q, i => vv[i]), side(i => vv[i] === 0, i => u[i]), side(i => vv[i] === GRID_Q, i => u[i])];
  return { key: b.key, lod, levels: lod === 0 ? 2 : 1, frame, rect: b.rect, u, v: vv, zMm, oct, indices: idx, groups, seams, ...(codeHash ? { codeHash } : {}) };
}

/**
 * The cell's input with the 5×5 neighbourhood's surface sources (cellInput carries the 3×3): a polygon or kerb run
 * owned by a cell two away can still cross a seam, and both neighbours must see it (seam determinism).
 */
export async function widenedInput(store: GroundStore, key: string) {
  const input = await store.cellInput(key, 0);
  const [cx, cy] = key.split('_').map(Number), ring: string[] = [];
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) === 2) ring.push(`${cx + dx}_${cy + dy}`);
  const [roads, parks, yards, open, osm, water] = await Promise.all([
    Promise.all(ring.map(k => store.roadCell(k))), Promise.all(ring.map(k => store.parkCell(k))), Promise.all(ring.map(k => store.courtyardCell(k))),
    Promise.all(ring.map(k => store.openGroundCell(k))), Promise.all(ring.map(k => store.osmCell(k))), Promise.all(ring.map(k => store.waterCell(k))),
  ]);
  return { ...input, roadsAround: [...(input.roadsAround ?? []), ...roads], parksAround: [...(input.parksAround ?? []), ...parks], courtyardsAround: [...(input.courtyardsAround ?? []), ...yards],
    openGroundAround: [...(input.openGroundAround ?? []), ...open], osmAround: [...input.osmAround, ...osm.filter((o): o is NonNullable<typeof o> => !!o)], waterAround: [...input.waterAround, ...water.filter((w): w is NonNullable<typeof w> => !!w)] };
}

export interface BakedCellFile { key: string; lod: 0 | 1; baked: BakedSurface; src: PartitionSources; inputsHash: Uint8Array; fileGz: Buffer; rawGz: number; meshoptGz: number; inputMs: number; bakeMs: number }

/** Bake one cell to its gzipped GRD2 file, measuring the byte variants (raw u16 + gzip, meshopt without and with the reorder). */
export async function bakeCellFile(store: GroundStore, key: string, lod: 0 | 1, opt: SurfaceBakeOptions, o: { kerbBand: boolean; codeHash: Uint8Array; skipIfInputs?: (hash: Uint8Array) => boolean }): Promise<BakedCellFile | null> {
  await MeshoptEncoder.ready;
  const t0 = performance.now();
  const input = await widenedInput(store, key);
  const src = partitionSources(input, { kerbBand: o.kerbBand && lod === 0, levels: lod === 0 });
  const inHash = createHash('sha256'); inHash.update(JSON.stringify([src.groups, src.features.map(f => [f.group, f.id, f.rings])]));
  { const [x0, y0, x1, y1] = input.rect; const zs: number[] = []; for (let x = x0; x <= x1; x += 16) for (let y = y0; y <= y1; y += 16) zs.push(Math.round(input.surface.relief(x, y) * 1000)); inHash.update(Int32Array.from(zs)); }
  const inputsHash = inHash.digest().subarray(0, 16);
  if (o.skipIfInputs?.(inputsHash)) return null;
  const t1 = performance.now();
  const baked = bakeSurface({ key, rect: input.rect, groups: src.groups, features: src.features, restGroup: src.restGroup, height: input.surface.relief, levelZ: src.levelZ }, opt);
  const t2 = performance.now();
  const layers = src.groups.map(g => g.layer ?? 'water');
  const plain = toContent(baked, layers, lod, false), re = toContent(baked, layers, lod, true, o.codeHash);
  const rawGz = gzipSync(encodeGrd2(plain), { level: 9 }).length;
  const meshoptGz = gzipSync(encodeGrd2(plain, MeshoptEncoder), { level: 9 }).length;
  const fileGz = gzipSync(encodeGrd2({ ...re, inputsHash }, MeshoptEncoder), { level: 9 });
  return { key, lod, baked, src, inputsHash, fileGz, rawGz, meshoptGz, inputMs: Math.round(t1 - t0), bakeMs: Math.round(t2 - t1) };
}
