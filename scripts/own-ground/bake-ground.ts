// Ground v2 bake (lane G2a #372): one clipped, draped partition per cell, written as GRD2 files to a staging dir.
// Design docs/handoffs/ground-v2-design-20261110.md; the integrator publishes reviewed cells to
// public/data/extracts/amsterdam/ground-v2/ (`--publish` prints the copy, it never writes the extract tree itself).
import '../world/useBrowserMath.js'; // first: the browser's Math.cos/sin, so the bake's frame and rects match the runtime's
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { MeshoptEncoder } from 'meshoptimizer';
import { GAME_FRAME_SCALE, GAME_ORIGIN, GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { bakeSurface, LOD0_OPTIONS, LOD1_OPTIONS, type BakedSurface, type SurfaceBakeOptions } from '../../src/canalRecall/ownGround/groundPartition.ts';
import { partitionSources } from '../../src/canalRecall/ownGround/groundV2Sources.ts';
import { encodeGrd2, frameOf, tileOfUnits, type Grd2Content, type Grd2Group, GRID_Q } from '../../src/canalRecall/ownGround/groundV2Format.ts';
import { GROUND_LAYERS } from '../../src/canalRecall/ownGround/groundCell.ts';
import { GROUND_V2_PLACES, GROUND_V2_SEAM_PIN } from '../../src/canalRecall/ownGround/groundV2Places.ts';
import { RIDE_PRIORITY_GEBIEDEN } from '../../src/canalRecall/ridePriority.ts';

const HELP = `npm run ground:bake -- [options]     (npx tsx scripts/own-ground/bake-ground.ts)

Bakes ground v2 cells (GRD2, gzip) into a staging directory and writes a report.
  --cells=a,b        these cell keys
  --near=lng,lat     the cell holding this point
  --set=priority     the ride-priority set: every G0 named place's cell, the seam pin pair, and every cell of the
                     ride-priority gebieden (canal belt and inner ring, src/canalRecall/ridePriority.ts)
  --set=all          every cell the ground draws (do not: the judgement ruled bake-by-priority; for projections only)
  --sample=N         with --set=all, every Nth cell only (byte projections)
  --lod=0|1          level of detail (default 0)
  --tol-flat=M       Steiner tolerance on flat land classes, metres (default 0.075; ruling 3's mitigation; 0.05 = none)
  --tol-road=M       Steiner tolerance on road classes, metres (default 0.05)
  --no-kerb          no kerb band (rank 3)
  --out=DIR          staging dir (default artifacts/ground-v2/staging; a variant: artifacts/ground-v2/variants/<name>)
  --changed          skip cells whose meta inputs and code hashes match
  --shard=i/n        bake every nth cell starting at i (run n processes for parallelism)
  --no-write         measure only
  --list             print the cell keys and exit
  --help             this text
Output: <out>/<key>.lod<L>.bin.gz, <out>/meta/<key>.lod<L>.json, <out>/report-lod<L>.json, <out>/index.json (on full runs).`;

const args = process.argv.slice(2);
if (args.includes('--help')) { console.log(HELP); process.exit(0); }
const opt = (name: string): string | undefined => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const flag = (name: string) => args.includes(`--${name}`);

const ROOT = 'public/data/extracts/amsterdam';
const read = async (p: string) => { const f = join(ROOT, p); if (!existsSync(f)) throw new Error(`${p}: missing`); const b = readFileSync(f); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
const store = new GroundStore(read, { parks: true, roads: true, rails: true, deterministic: true });
await store.init();

const lod = (Number(opt('lod') ?? 0) === 1 ? 1 : 0) as 0 | 1;
const base: SurfaceBakeOptions = lod === 0 ? LOD0_OPTIONS : LOD1_OPTIONS;
const bakeOpt: SurfaceBakeOptions = { ...base, tolFlatM: Number(opt('tol-flat') ?? (lod === 0 ? 0.075 : base.tolFlatM)), tolRoadM: Number(opt('tol-road') ?? base.tolRoadM) };
const out = opt('out') ?? 'artifacts/ground-v2/staging';
const write = !flag('no-write');
const frame = frameOf(GAME_ORIGIN, GAME_FRAME_SCALE);

/** Cells of the ride-priority gebieden: buurt polygons sampled on a 50 m grid. */
function priorityCells(): string[] {
  const bu = JSON.parse(readFileSync(`${ROOT}/coverage-v1/buurten.json`, 'utf8')) as { features: { properties: { gebied?: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] };
  const keys = new Set<string>();
  const inRing = (r: number[][], x: number, y: number) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > y) !== (r[j][1] > y) && x < r[j][0] + (y - r[j][1]) * (r[i][0] - r[j][0]) / (r[i][1] - r[j][1])) c = !c; return c; };
  for (const f of bu.features) {
    if (!f.properties.gebied || !RIDE_PRIORITY_GEBIEDEN.has(f.properties.gebied)) continue;
    const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
    for (const poly of polys) {
      const local = poly.map(r => r.map(([lng, lat]) => toLocal(lng, lat)));
      const xs = local[0].map(p => p[0]), ys = local[0].map(p => p[1]);
      for (let x = Math.min(...xs); x <= Math.max(...xs); x += 50) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 50)
        if (inRing(local[0], x, y) && !local.slice(1).some(h => inRing(h, x, y))) keys.add(store.cellAt(x, y));
      for (const [x, y] of local[0]) keys.add(store.cellAt(x, y));
    }
  }
  for (const p of GROUND_V2_PLACES) { const [x, y] = toLocal(p.at[0], p.at[1]); keys.add(store.cellAt(x, y)); }
  keys.add(GROUND_V2_SEAM_PIN.a); keys.add(GROUND_V2_SEAM_PIN.b);
  return [...keys].filter(k => store.covers(k)).sort();
}

let keys: string[];
const set = opt('set');
if (opt('cells')) keys = opt('cells')!.split(',');
else if (opt('near')) { const [lng, lat] = opt('near')!.split(',').map(Number); const [x, y] = toLocal(lng, lat); keys = [store.cellAt(x, y)]; }
else if (set === 'priority') keys = priorityCells();
else if (set === 'all') { keys = [...store.osmCells].filter(k => store.covers(k)).sort(); const n = Number(opt('sample') ?? 1); keys = keys.filter((_, i) => i % n === 0); }
else { console.log(HELP); process.exit(1); }
const shard = opt('shard');
if (shard) { const [i, n] = shard.split('/').map(Number); keys = keys.filter((_, k) => k % n === i); }
if (flag('list')) { console.log(keys.length, keys.join(' ')); process.exit(0); }

const CODE = ['src/canalRecall/ownGround/groundPartition.ts', 'src/canalRecall/ownGround/groundV2Sources.ts', 'src/canalRecall/ownGround/groundV2Format.ts', 'scripts/own-ground/bake-ground.ts'];
const codeHash = createHash('sha256'); for (const f of CODE) codeHash.update(readFileSync(f)); codeHash.update(JSON.stringify(bakeOpt));
const codeDigest = codeHash.digest().subarray(0, 16);

await MeshoptEncoder.ready;

/** Order triangles by (kind, layer, tile), each group's triangles in vertex-cache order, vertices in first-use order. */
export function toContent(b: BakedSurface, reorder: boolean): Grd2Content {
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
  return { key: b.key, lod, levels: lod === 0 ? 2 : 1, frame, rect: b.rect, u, v: vv, zMm, oct, indices: idx, groups, seams, codeHash: codeDigest };
}
let groupsLayer: import('../../src/canalRecall/ownGround/groundCell.ts').GroundLayer[] = [];

/**
 * The cell's input with the 5×5 neighbourhood's surface sources (cellInput carries the 3×3): a polygon or kerb run
 * owned by a cell two away can still cross a seam, and both neighbours must see it (seam determinism).
 */
async function widened(key: string) {
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

const rows: Record<string, unknown>[] = [];
if (write) mkdirSync(join(out, 'meta'), { recursive: true });
for (const key of keys) {
  const t0 = performance.now();
  const input = await widened(key);
  const src = partitionSources(input, { kerbBand: !flag('no-kerb') && lod === 0, levels: lod === 0 });
  const inHash = createHash('sha256'); inHash.update(JSON.stringify([src.groups, src.features.map(f => [f.group, f.id, f.rings])]));
  { const [x0, y0, x1, y1] = input.rect; const zs: number[] = []; for (let x = x0; x <= x1; x += 16) for (let y = y0; y <= y1; y += 16) zs.push(Math.round(input.surface.relief(x, y) * 1000)); inHash.update(Int32Array.from(zs)); }
  const inputsHash = inHash.digest().subarray(0, 16);
  const metaPath = join(out, 'meta', `${key}.lod${lod}.json`);
  if (flag('changed') && existsSync(metaPath)) { const m = JSON.parse(readFileSync(metaPath, 'utf8')); if (m.inputsHash === Buffer.from(inputsHash).toString('hex') && m.codeHash === Buffer.from(codeDigest).toString('hex')) { console.error(`${key}: unchanged`); continue; } }
  const tIn = performance.now() - t0;
  const baked = bakeSurface({ key, rect: input.rect, groups: src.groups, features: src.features, restGroup: src.restGroup, height: input.surface.relief, levelZ: src.levelZ }, bakeOpt);
  groupsLayer = src.groups.map(g => g.layer ?? 'water');
  const tBake = performance.now() - t0 - tIn;
  const plain = toContent(baked, false), re = toContent(baked, true);
  const rawGz = gzipSync(encodeGrd2(plain), { level: 9 }).length;
  const moNoGz = gzipSync(encodeGrd2(plain, MeshoptEncoder), { level: 9 }).length;
  const content = { ...re, inputsHash };
  const file = encodeGrd2(content, MeshoptEncoder), fileGz = gzipSync(file, { level: 9 });
  if (write) {
    writeFileSync(join(out, `${key}.lod${lod}.bin.gz`), fileGz);
    writeFileSync(metaPath, JSON.stringify({ key, lod, inputsHash: Buffer.from(inputsHash).toString('hex'), codeHash: Buffer.from(codeDigest).toString('hex'), bytes: fileGz.length, options: bakeOpt, counts: src.counts, groups: src.groups.map(g => g.name), stats: baked.stats }, null, 1));
  }
  const s = baked.stats;
  const row = { key, ms: Math.round(performance.now() - t0), inputMs: Math.round(tIn), bakeMs: Math.round(tBake), phases: s.ms, V: s.vertices, T: s.triangles, steps: s.stepTriangles, steiner: s.steiner, refine: s.refineAdded,
    bytes: { rawGz, meshoptGz: moNoGz, meshoptReorderGz: fileGz.length },
    closureM2: s.closureM2, unclassified: s.unclassified, unclassifiedM2: s.unclassifiedM2, ambiguous: s.ambiguous, failedEdges: s.failedEdges.length, clipErrors: s.clipErrors.length,
    err: [s.errP50, s.errP99, s.errP999, s.errMax], over5cmM2: s.over5cmM2 };
  rows.push(row);
  console.log(JSON.stringify(row));
}
if (rows.length) {
  const sum = (f: (r: any) => number) => rows.reduce((a, r) => a + f(r), 0);
  const sorted = (f: (r: any) => number) => rows.map(f).sort((a, b) => a - b);
  const p = (a: number[], q: number) => a[Math.min(a.length - 1, Math.floor(a.length * q))];
  const by = sorted(r => r.bytes.meshoptReorderGz), ms = sorted(r => r.ms);
  const summary = { lod, cells: rows.length, options: bakeOpt, kerbBand: !flag('no-kerb') && lod === 0,
    totalBytes: { rawGz: sum(r => r.bytes.rawGz), meshoptGz: sum(r => r.bytes.meshoptGz), meshoptReorderGz: sum(r => r.bytes.meshoptReorderGz) },
    perCell: { p50: p(by, 0.5), p95: p(by, 0.95), max: by[by.length - 1] }, bakeMs: { p50: p(ms, 0.5), p95: p(ms, 0.95), max: ms[ms.length - 1] } };
  console.log(JSON.stringify(summary));
  if (write && !opt('cells') && !opt('near')) writeFileSync(join(out, `report-lod${lod}${shard ? '-' + shard.replace('/', 'of') : ''}.json`), JSON.stringify({ summary, rows }, null, 1));
}
