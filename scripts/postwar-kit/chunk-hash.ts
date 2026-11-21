/**
 * Byte-identity and cost check for the post-1965 kit: buildFeatureChunk ('walls' and 'extras') over the sampled members'
 * z14 tiles, photo look. Prints a hash of every chunk's buffers and the triangle counts.
 *   node --import tsx scripts/postwar-kit/chunk-hash.ts [--on]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
if (process.argv.includes('--on')) (globalThis as { __canalRecallPostwarKit?: boolean }).__canalRecallPostwarKit = true;
const { gameChain, loadTile } = await import('../world/pipeline.ts');
const { buildFeatureChunk } = await import('../../src/canalRecall/threeBuildingFeatures.ts');
const OUT = path.resolve(import.meta.dirname, '../../artifacts/postwar-kit');
// Round 2: round 1's sample.json is gone with its pruned worktree; SAMPLE=sample-all.json picks tiles from the full sample.
const sample = JSON.parse(fs.readFileSync(path.join(OUT, process.env.SAMPLE ?? 'sample.json'), 'utf8')) as Record<string, any>;
const tileOf = (lng: number, lat: number) => { const n = 2 ** 14; return `${Math.floor((lng + 180) / 360 * n)}/${Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n)}`; };
const tiles = [...new Set(Object.values(sample).filter((r: any) => r.photo).map((r: any) => tileOf(r.centroid[0], r.centroid[1])))].sort().slice(0, Number(process.env.TILES ?? 12));
const chain = gameChain();
const h = createHash('sha1');
const tris: Record<string, number> = { walls: 0, extras: 0 };
const t0 = performance.now();
for (const t of tiles) {
  const features = (await loadTile(t, chain)).map(r => r.styled);
  for (const mode of ['walls', 'extras'] as const) {
    const chunk = buildFeatureChunk(features as never, 'photo', mode) as any;
    for (const [k, v] of Object.entries(chunk).sort()) {
      if (ArrayBuffer.isView(v)) { h.update(k); h.update(new Uint8Array((v as ArrayBufferView).buffer, (v as ArrayBufferView).byteOffset, (v as ArrayBufferView).byteLength)); }
      else if (v && typeof v === 'object' && !Array.isArray(v)) for (const [k2, v2] of Object.entries(v).sort()) if (ArrayBuffer.isView(v2)) { h.update(k + k2); h.update(new Uint8Array((v2 as ArrayBufferView).buffer, (v2 as ArrayBufferView).byteOffset, (v2 as ArrayBufferView).byteLength)); }
    }
    const pos = chunk.positions ?? chunk.position;
    tris[mode] += chunk.indices ? chunk.indices.length / 3 : 0;
  }
}
console.log(JSON.stringify({ tiles: tiles.length, hash: h.digest('hex'), triangles: tris, ms: Math.round(performance.now() - t0) }));
