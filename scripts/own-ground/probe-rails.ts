// Rail look probe (lane rail-look 2026-10-31): at a spot, which layers draw over the railway tracks' footprint.
//
//   npx tsx scripts/own-ground/probe-rails.ts <lng> <lat> [halfM=80] [--lod=1]
//
// Rasterises the built cells top-down twice: rails only (the footprint of ballast and rails), and everything. Prints
// per covering layer the share of the rail footprint it wins, and how far above the bed top it stands.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import sharp from 'sharp';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, GROUND_LAYERS, type BuiltCell, type GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';
import { layerOfId, rasterLayerIds } from '../../src/canalRecall/overviewTiles/raster.ts';

const ROOT = 'public/data/extracts/amsterdam';
export const readExtract = async (path: string) => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };

export async function railCells(lng: number, lat: number, half: number, lod: 0 | 1 = 0, opts: Record<string, unknown> = {}): Promise<{ cells: BuiltCell[]; x: number; y: number; store: GroundStore }> {
  const store = new GroundStore(readExtract, { roads: true, ...opts });
  await store.init();
  const [x, y] = toLocal(lng, lat);
  const keys = new Set<string>();
  for (let dx = -half - 100; dx <= half + 100; dx += 50) for (let dy = -half - 100; dy <= half + 100; dy += 50) keys.add(store.cellAt(x + dx, y + dy));
  const cells: BuiltCell[] = [];
  for (const k of keys) if (store.covers(k)) cells.push(buildCell(await store.cellInput(k, lod)));
  return { cells, x, y, store };
}

/** Share of the rail footprint (pixels where the rails-only raster draws ballast or rail) that another layer wins. */
export function railCover(cells: readonly BuiltCell[], x: number, y: number, half: number, res = 0.25, image?: Uint8Array): { footprint: number; covered: number; by: Record<string, number> } {
  const w = Math.round(2 * half / res);
  const others = new Set<GroundLayer>(GROUND_LAYERS.filter(l => l !== 'ballast' && l !== 'track'));
  const railOnly = rasterLayerIds(cells, x - half, y - half, w, w, res, others);
  const all = rasterLayerIds(cells, x - half, y - half, w, w, res);
  let footprint = 0, covered = 0;
  const by: Record<string, number> = {};
  for (let i = 0; i < railOnly.length; i++) {
    if (!railOnly[i]) continue;
    footprint++;
    const l = layerOfId(all[i]);
    if (image) { const c = l === 'ballast' ? [120, 110, 100] : l === 'track' ? [20, 20, 20] : l === 'land' ? [255, 0, 255] : l === 'paving' ? [0, 200, 255] : [255, 160, 0]; image.set(c, i * 3); }
    if (l === 'ballast' || l === 'track') continue;
    covered++;
    by[l ?? 'none'] = (by[l ?? 'none'] ?? 0) + 1;
  }
  return { footprint, covered, by };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const lod = process.argv.includes('--lod=1') ? 1 : 0;
  const [lng, lat, half] = [Number(args[0]), Number(args[1]), Number(args[2] ?? 80)];
  const { cells, x, y } = await railCells(lng, lat, half, lod);
  const w = Math.round(2 * half / 0.25), img = new Uint8Array(w * w * 3).fill(235);
  const c = railCover(cells, x, y, half, 0.25, img);
  const out = process.argv.find(a => a.startsWith('--out='))?.slice(6);
  if (out) await sharp(Buffer.from(img), { raw: { width: w, height: w, channels: 3 } }).png().toFile(out);
  const rails = cells.reduce((s, k) => s + (k.stats.rails?.metres ?? 0), 0);
  const tri = (l: GroundLayer) => cells.reduce((s, k) => s + (k.layers[l]?.indices.length ?? 0) / 3, 0);
  console.log(JSON.stringify({ at: [lng, lat], lod, railMetres: Math.round(rails), footprintM2: c.footprint / 16, coveredShare: +(c.covered / Math.max(1, c.footprint)).toFixed(3), by: Object.fromEntries(Object.entries(c.by).map(([k, v]) => [k, +(v / 16).toFixed(1)])), triangles: { ballast: tri('ballast'), track: tri('track'), deckBody: tri('deckBody') } }));
}

if (process.argv[1]?.endsWith('probe-rails.ts')) main().catch(e => { console.error(e); process.exit(1); });
