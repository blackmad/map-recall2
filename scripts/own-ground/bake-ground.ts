// Ground v2 bake (lane G2a #372): one clipped, draped partition per cell, written as GRD2 files to a staging dir.
// Design docs/handoffs/ground-v2-design-20261110.md; the integrator publishes reviewed cells to
// public/data/extracts/amsterdam/ground-v2/ (`--publish` prints the copy, it never writes the extract tree itself).
import '../world/useBrowserMath.js'; // first: the browser's Math.cos/sin, so the bake's frame and rects match the runtime's
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { LOD0_OPTIONS, LOD1_OPTIONS, type SurfaceBakeOptions } from '../../src/canalRecall/ownGround/groundPartition.ts';
import { bakeCellFile, codeDigest, frame } from './groundV2BakeCell.ts';
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
  --index            write <out>/index.json (the loader's manifest) from the baked files and exit
  --help             this text
Output: <out>/<key>.lod<L>.bin.gz, <out>/meta/<key>.lod<L>.json, <out>/report-lod<L>[-<shard>].json; --index writes index.json.`;

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
else if (flag('index')) keys = [];
else { console.log(HELP); process.exit(1); }
const shard = opt('shard');
if (shard) { const [i, n] = shard.split('/').map(Number); keys = keys.filter((_, k) => k % n === i); }
if (flag('index')) {
  // The manifest the loader reads (ground-v2/index.json): every baked cell in the out dir, its files' bytes and hashes.
  const { readdirSync } = await import('node:fs');
  const cells: Record<string, Record<string, { bytes: number; sha256: string }>> = {};
  for (const f of readdirSync(out).filter(f => /\.lod[01]\.bin\.gz$/.test(f)).sort()) {
    const [key, l] = f.replace('.bin.gz', '').split('.'); const b = readFileSync(join(out, f));
    (cells[key] ??= {})[l] = { bytes: b.length, sha256: createHash('sha256').update(b).digest('hex').slice(0, 16) };
  }
  writeFileSync(join(out, 'index.json'), JSON.stringify({ version: 1, format: 'GRD2', formatVersion: 1, frame, cells }, null, 1));
  console.log(`index.json: ${Object.keys(cells).length} cells, ${Object.values(cells).reduce((s, c) => s + (c.lod0?.bytes ?? 0) + (c.lod1?.bytes ?? 0), 0)} bytes`);
  process.exit(0);
}
if (flag('list')) { console.log(keys.length, keys.join(' ')); process.exit(0); }

const codeHash = codeDigest(bakeOpt);
const rows: Record<string, unknown>[] = [];
if (write) mkdirSync(join(out, 'meta'), { recursive: true });
for (const key of keys) {
  const t0 = performance.now();
  const metaPath = join(out, 'meta', `${key}.lod${lod}.json`);
  const prev = flag('changed') && existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) as { inputsHash: string; codeHash: string } : null;
  const r = await bakeCellFile(store, key, lod, bakeOpt, { kerbBand: !flag('no-kerb'), codeHash, skipIfInputs: h => !!prev && prev.inputsHash === Buffer.from(h).toString('hex') && prev.codeHash === Buffer.from(codeHash).toString('hex') });
  if (!r) { console.error(`${key}: unchanged`); continue; }
  const { baked, src, inputsHash, fileGz } = r;
  if (write) {
    writeFileSync(join(out, `${key}.lod${lod}.bin.gz`), fileGz);
    writeFileSync(metaPath, JSON.stringify({ key, lod, inputsHash: Buffer.from(inputsHash).toString('hex'), codeHash: Buffer.from(codeHash).toString('hex'), bytes: fileGz.length, options: bakeOpt, counts: src.counts, groups: src.groups.map(g => g.name), stats: baked.stats }, null, 1));
  }
  const s = baked.stats;
  const row = { key, ms: Math.round(performance.now() - t0), inputMs: r.inputMs, bakeMs: r.bakeMs, phases: s.ms, V: s.vertices, T: s.triangles, steps: s.stepTriangles, steiner: s.steiner, refine: s.refineAdded,
    bytes: { rawGz: r.rawGz, meshoptGz: r.meshoptGz, meshoptReorderGz: fileGz.length },
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
