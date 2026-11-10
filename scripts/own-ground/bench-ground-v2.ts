// Ground v2 runtime costs on desktop Node (lane G2a #372): gunzip, GRD2 decode, dequantise, pose index build and
// queries, CPU bytes kept, per baked cell. Phones are slower (the 4x throttle rule of thumb); G2b measures in the browser.
//   npx tsx scripts/own-ground/bench-ground-v2.ts [--dir=artifacts/ground-v2/staging] [--cells=a,b]
import { readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { MeshoptDecoder } from 'meshoptimizer';
import { decodeGrd2, grd2Layers } from '../../src/canalRecall/ownGround/groundV2Format.ts';
import { buildPoseIndex, poseHeight, poseIndexBytes } from '../../src/canalRecall/ownGround/groundV2Pose.ts';
const args = process.argv.slice(2), opt = (n: string) => args.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const dir = opt('dir') ?? 'artifacts/ground-v2/staging';
const keys = opt('cells')?.split(',') ?? readdirSync(dir).filter(f => f.endsWith('.lod0.bin.gz')).map(f => f.replace('.lod0.bin.gz', '')).sort();
await MeshoptDecoder.ready;
const rows: Record<string, unknown>[] = [];
for (const k of keys) {
  const gz = readFileSync(join(dir, `${k}.lod0.bin.gz`));
  const t0 = performance.now(); const raw = gunzipSync(gz); const t1 = performance.now();
  const dec = decodeGrd2(raw, MeshoptDecoder); const t2 = performance.now();
  const L = grd2Layers(dec); const t3 = performance.now();
  const surf = dec.groups.filter(g => g.kind === 0), n = surf.reduce((s, g) => s + g.count, 0), idx = new Uint32Array(n * 3); let o = 0;
  for (const g of surf) { idx.set(dec.indices.subarray(g.first * 3, (g.first + g.count) * 3), o); o += g.count * 3; }
  const t4 = performance.now(); const pose = buildPoseIndex(L.positions, idx, dec.header.rect); const t5 = performance.now();
  const r = dec.header.rect; let hit = 0, s = 0x12345;
  const q0 = performance.now();
  for (let i = 0; i < 100000; i++) { s = (s * 1103515245 + 12345) >>> 0; const x = r[0] + (s / 4294967296) * (r[2] - r[0]); s = (s * 1103515245 + 12345) >>> 0; const y = r[1] + (s / 4294967296) * (r[3] - r[1]); if (poseHeight(pose, x, y) === poseHeight(pose, x, y)) hit++; }
  const q1 = performance.now();
  const row = { key: k, gzKB: Math.round(gz.length / 1024), gunzipMs: +(t1 - t0).toFixed(1), decodeMs: +(t2 - t1).toFixed(1), dequantMs: +(t3 - t2).toFixed(1), poseBuildMs: +(t5 - t4).toFixed(1), poseQueryUs: +((q1 - q0) / 100000 * 1000).toFixed(2), poseMB: +(poseIndexBytes(pose) / 1048576).toFixed(2), gpuMB: +((L.positions.byteLength + L.normals.byteLength + dec.indices.byteLength) / 1048576).toFixed(2), covered: +(hit / 100000).toFixed(3) };
  rows.push(row); console.log(JSON.stringify(row));
}
const med = (f: (r: any) => number) => { const a = rows.map(f).sort((p, q) => p - q); return a[a.length >> 1]; };
console.log(JSON.stringify({ cells: rows.length, p50: { decodeMs: med(r => r.decodeMs + r.gunzipMs + r.dequantMs), poseBuildMs: med(r => r.poseBuildMs), poseQueryUs: med(r => r.poseQueryUs), poseMB: med(r => r.poseMB), gpuMB: med(r => r.gpuMB) } }));
