// Ground v2 runtime costs on desktop Node (lane G2a #372): gunzip, GRD2 decode, the tile meshes G2b uploads, the pose
// index build and queries, CPU and GPU bytes kept, per baked cell. Phones are slower (the 4x throttle rule of thumb);
// G2b measures in the browser.
//   npx tsx scripts/own-ground/bench-ground-v2.ts [--dir=artifacts/ground-v2/staging] [--cells=a,b] [--lod=0]
// gpuMB: the tile layout (grd2TileMeshes: Float32 xyz, Int8 normals, u16 indices per 3×3 tile); gpuFlatMB: one
// buffer with u32 indices (round 1's figure). poseMB: the compact pose index (groundV2Pose.ts).
import { readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { MeshoptDecoder } from 'meshoptimizer';
import { decodeGrd2, grd2TileMeshes, tileMeshBytes } from '../../src/canalRecall/ownGround/groundV2Format.ts';
import { buildPoseIndex, poseHeight, poseIndexBytes } from '../../src/canalRecall/ownGround/groundV2Pose.ts';
const args = process.argv.slice(2), opt = (n: string) => args.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const dir = opt('dir') ?? 'artifacts/ground-v2/staging', lod = Number(opt('lod') ?? 0), suffix = `.lod${lod}.bin.gz`;
const keys = opt('cells')?.split(',') ?? readdirSync(dir).filter(f => f.endsWith(suffix)).map(f => f.slice(0, -suffix.length)).sort();
await MeshoptDecoder.ready;
const rows: Record<string, number | string>[] = [];
for (const k of keys) {
  const gz = readFileSync(join(dir, `${k}${suffix}`));
  const t0 = performance.now(); const raw = gunzipSync(gz); const t1 = performance.now();
  const dec = decodeGrd2(raw, MeshoptDecoder); const t2 = performance.now();
  const tiles = grd2TileMeshes(dec); const t3 = performance.now();
  const pose = buildPoseIndex(dec); const t4 = performance.now();
  const r = dec.header.rect; let hit = 0, s = 0x12345;
  const q0 = performance.now();
  for (let i = 0; i < 100000; i++) { s = (s * 1103515245 + 12345) >>> 0; const x = r[0] + (s / 4294967296) * (r[2] - r[0]); s = (s * 1103515245 + 12345) >>> 0; const y = r[1] + (s / 4294967296) * (r[3] - r[1]); if (poseHeight(pose, x, y) === poseHeight(pose, x, y)) hit++; }
  const q1 = performance.now();
  const flat = dec.u.length * 15 + dec.indices.length * 4;
  const row = { key: k, gzKB: Math.round(gz.length / 1024), triangles: dec.header.triangles, vertices: dec.header.vertices, gunzipMs: +(t1 - t0).toFixed(1), decodeMs: +(t2 - t1).toFixed(1), tilesMs: +(t3 - t2).toFixed(1), poseBuildMs: +(t4 - t3).toFixed(1), poseQueryUs: +((q1 - q0) / 100000 * 1000).toFixed(2), poseMB: +(poseIndexBytes(pose) / 1048576).toFixed(2), gpuMB: +(tileMeshBytes(tiles) / 1048576).toFixed(2), gpuFlatMB: +(flat / 1048576).toFixed(2), wideBuckets: pose.wide.size, covered: +(hit / 100000).toFixed(3) };
  rows.push(row); console.log(JSON.stringify(row));
}
const pct = (f: (r: any) => number, q: number) => { const a = rows.map(f).sort((p, q2) => p - q2); return a[Math.min(a.length - 1, Math.floor(a.length * q))]; };
const sumUp = (q: number) => ({ decodeMs: pct(r => r.decodeMs + r.gunzipMs + r.tilesMs, q), poseBuildMs: pct(r => r.poseBuildMs, q), poseQueryUs: pct(r => r.poseQueryUs, q), poseMB: pct(r => r.poseMB, q), gpuMB: pct(r => r.gpuMB, q), gpuFlatMB: pct(r => r.gpuFlatMB, q) });
console.log(JSON.stringify({ cells: rows.length, p50: sumUp(0.5), p95: sumUp(0.95) }));
