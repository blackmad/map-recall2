// G2-design spike (#370): today's buildCell per layer for a cell — triangles, compact GPU bytes, and what the same
// meshes would cost on the wire if baked as-is (compactMesh buffers, gzip -9). Splits partition layers (replaced by
// ground v2) from overlay layers (kept: paint, kerbs, tram, track, bollards, hedges, furniture, deck bodies, quays).
//   npx tsx scripts/spikes/ground-v2-today-bytes.ts <key> [key …]
import { readFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, type GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';
import { compactMesh, gpuMeshBytes } from '../../src/canalRecall/ownGround/compactMesh.ts';
const ROOT = 'public/data/extracts/amsterdam';
const store = new GroundStore(async (p: string) => { const b = readFileSync(join(ROOT, p)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, { roads: true });
await store.init();
const OVERLAY = new Set<GroundLayer>(['kerb', 'paint', 'tram', 'bollard', 'hedge', 'furniture', 'deckBody', 'deckTop', 'quay', 'track', 'ballast', 'water']);
for (const key of process.argv.slice(2)) {
  const cell = buildCell(await store.cellInput(key, 0));
  const rows: Record<string, { tris: number; gpuKB: number; gzKB: number }> = {}; const tot = { part: { tris: 0, gpu: 0, gz: 0 }, over: { tris: 0, gpu: 0, gz: 0 } };
  for (const [layer, m] of Object.entries(cell.layers)) {
    if (!m) continue; const c = compactMesh(m); const gz = gzipSync(Buffer.concat([Buffer.from(c.positions.buffer), Buffer.from(c.normals.buffer), Buffer.from(c.indices.buffer), ...(c.colors ? [Buffer.from(c.colors.buffer)] : [])]), { level: 9 }).length;
    const t = m.indices.length / 3, g = gpuMeshBytes(c); rows[layer] = { tris: t, gpuKB: Math.round(g / 1024), gzKB: Math.round(gz / 1024) };
    const b = OVERLAY.has(layer as GroundLayer) ? tot.over : tot.part; b.tris += t; b.gpu += g; b.gz += gz;
  }
  const mb = (n: number) => +(n / 1048576).toFixed(2);
  console.log(JSON.stringify({ key, buildMs: cell.stats.buildMs, partitionLayers: { tris: tot.part.tris, gpuMB: mb(tot.part.gpu), gzMB: mb(tot.part.gz) }, overlayLayers: { tris: tot.over.tris, gpuMB: mb(tot.over.gpu), gzMB: mb(tot.over.gz) }, rows }));
}
