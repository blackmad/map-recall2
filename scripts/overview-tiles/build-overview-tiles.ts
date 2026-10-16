/**
 * The overview tiles: the own ground's cells, built by the worker's code path and rasterised from straight above,
 * in the ground look's flat tones, as Web-Mercator PNG tiles (src/canalRecall/overviewTiles/).
 *
 *   npx tsx scripts/overview-tiles/build-overview-tiles.ts [--stage=artifacts/overview-tiles/staging]
 *     [--cells=-2_0,-1_0] [--maxzoom=16] [--minzoom=11] [--k=3] [--look=bright] [--colours=128] [--publish]
 *
 * Phase 1 (resumable): every covered cell's region raster of layer ids at 0.5 m (its 3×3 neighbourhood built, so
 * ways that reach in from a neighbour draw, z-buffered as on screen) → <stage>/regions/<key>.bin.gz.
 * Phase 2: tiles at maxzoom from the region rasters (k×k sub-samples per pixel), the pyramid down to minzoom by
 * 2×2 means, PNGs quantised to a palette → <stage>/tiles/{z}/{x}/{y}.png, <stage>/manifest.json, <stage>/report.json.
 * `--publish` copies the staged tiles and manifest to public/data/extracts/amsterdam/overview-tiles-v1/ (review first).
 */
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import sharp from 'sharp';
import { GroundStore, toLocal, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, GROUND_LAYERS, type BuiltCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { groundPalette, GROUND_LOOK_DEFAULT, type GroundLook } from '../../src/canalRecall/ownGround/groundLook.ts';
import { rasterLayerIds, layerOfId } from '../../src/canalRecall/overviewTiles/raster.ts';
import { overviewLayerColours, OVERVIEW_SKIPPED } from '../../src/canalRecall/overviewTiles/layerColours.ts';
import { renderTile, parentTile, isEmptyTile, tileOf, lngLatOfTile, TILE_PX } from '../../src/canalRecall/overviewTiles/tiles.ts';
import { OVERVIEW_TILES_DIR, type OverviewTilesManifest } from '../../src/canalRecall/overviewTiles/tileset.ts';
import type { RGB } from '../../src/canalRecall/look/palette.ts';

const arg = (n: string, d?: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const ROOT = 'public/data/extracts/amsterdam';
const stage = arg('stage', 'artifacts/overview-tiles/staging')!;
const maxzoom = Number(arg('maxzoom', '16')), minzoom = Number(arg('minzoom', '11')), K = Number(arg('k', '3'));
const look = (arg('look', GROUND_LOOK_DEFAULT) as GroundLook), paletteColours = Number(arg('colours', '128'));
const RES = 0.5;
const BUILD_CACHE = 40, REGION_CACHE = 80;

const store = new GroundStore(async p => { const b = fs.readFileSync(path.join(ROOT, p)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, { roads: true });
await store.init();
const only = arg('cells')?.split(',');
const keys = [...store.osmCells].filter(k => store.covers(k) && (!only || only.includes(k)))
  .sort((a, b) => { const [ax, ay] = a.split('_').map(Number), [bx, by] = b.split('_').map(Number); return by - ay || ax - bx; });
fs.mkdirSync(path.join(stage, 'regions'), { recursive: true });

// ---------------------------------------------------------------- phase 1: region rasters
const built = new Map<string, BuiltCell | null>();
async function cellBuilt(key: string): Promise<BuiltCell | null> {
  if (built.has(key)) { const c = built.get(key)!; built.delete(key); built.set(key, c); return c; }
  const c = store.covers(key) ? buildCell(await store.cellInput(key, 0)) : null;
  built.set(key, c);
  while (built.size > BUILD_CACHE) built.delete(built.keys().next().value!);
  return c;
}
interface RegionMeta { key: string; x0: number; y0: number; w: number; h: number; res: number }
const regionFile = (key: string) => path.join(stage, 'regions', `${key}.bin.gz`);
const t0 = Date.now();
let done = 0;
for (const key of keys) {
  done++;
  if (fs.existsSync(regionFile(key))) continue;
  const [x0, y0, x1, y1] = store.cellRect(key), w = Math.ceil((x1 - x0) / RES), h = Math.ceil((y1 - y0) / RES);
  const cells = (await Promise.all(GroundStore.neighbours(key).map(cellBuilt))).filter((c): c is BuiltCell => !!c);
  const ids = rasterLayerIds(cells, x0, y0, w, h, RES, OVERVIEW_SKIPPED);
  const meta: RegionMeta = { key, x0, y0, w, h, res: RES };
  const head = Buffer.from(JSON.stringify(meta).padEnd(256));
  fs.writeFileSync(regionFile(key), gzipSync(Buffer.concat([head, Buffer.from(ids.buffer, ids.byteOffset, ids.byteLength)]), { level: 6 }));
  store.forgetCells(new Set(keys.slice(Math.max(0, done - 60), done + 60).flatMap(k => GroundStore.neighbours(k))));
  console.log(`region ${key} (${done}/${keys.length}) ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
built.clear();

// ---------------------------------------------------------------- phase 2: tiles
const regions = new Map<string, { meta: RegionMeta; ids: Uint8Array }>();
function region(key: string): { meta: RegionMeta; ids: Uint8Array } | null {
  const hit = regions.get(key);
  if (hit) { regions.delete(key); regions.set(key, hit); return hit; }
  if (!fs.existsSync(regionFile(key))) return null;
  const raw = gunzipSync(fs.readFileSync(regionFile(key)));
  const meta = JSON.parse(raw.subarray(0, 256).toString().trim()) as RegionMeta;
  const r = { meta, ids: new Uint8Array(raw.buffer, raw.byteOffset + 256, meta.w * meta.h) };
  regions.set(key, r);
  while (regions.size > REGION_CACHE) regions.delete(regions.keys().next().value!);
  return r;
}
const colours = overviewLayerColours(groundPalette(look), GROUND_LAYERS);
const byId: (RGB | null)[] = [null, ...GROUND_LAYERS.map(l => colours[l] ?? null)];
const keySet = new Set(keys);
const sample = (lng: number, lat: number): RGB | null => {
  const [x, y] = toLocal(lng, lat), key = store.cellAt(x, y);
  if (!keySet.has(key)) return null;
  const r = region(key);
  if (!r) return null;
  const { x0, y0, w, h, res } = r.meta, px = Math.floor((x - x0) / res), py = Math.floor((y0 + h * res - y) / res);
  if (px < 0 || py < 0 || px >= w || py >= h) return null;
  return byId[r.ids[py * w + px]];
};

// Tiles at maxzoom touching a covered cell.
const want = new Set<string>();
for (const key of keys) {
  const [x0, y0, x1, y1] = store.cellRect(key);
  const [w, s] = fromLocal(x0, y0), [e, n] = fromLocal(x1, y1);
  const [tx0, ty0] = tileOf(w, n, maxzoom), [tx1, ty1] = tileOf(e, s, maxzoom);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) want.add(`${tx}/${ty}`);
}
const order = [...want].map(s => s.split('/').map(Number) as [number, number]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
const tilesDir = path.join(stage, 'tiles');
fs.rmSync(tilesDir, { recursive: true, force: true });
const levels = new Map<number, Map<string, Uint8ClampedArray>>();
const top = new Map<string, Uint8ClampedArray>();
let n = 0;
for (const [tx, ty] of order) {
  const rgba = renderTile(maxzoom, tx, ty, K, sample);
  if (!isEmptyTile(rgba)) top.set(`${tx}/${ty}`, rgba);
  if (++n % 200 === 0) console.log(`z${maxzoom} ${n}/${order.length} ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
levels.set(maxzoom, top);
for (let z = maxzoom - 1; z >= minzoom; z--) {
  const child = levels.get(z + 1)!, parents = new Set<string>(), out = new Map<string, Uint8ClampedArray>();
  for (const k of child.keys()) { const [x, y] = k.split('/').map(Number); parents.add(`${x >> 1}/${y >> 1}`); }
  for (const p of parents) {
    const [x, y] = p.split('/').map(Number);
    const c = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => child.get(`${x * 2 + dx}/${y * 2 + dy}`) ?? null) as [Uint8ClampedArray | null, Uint8ClampedArray | null, Uint8ClampedArray | null, Uint8ClampedArray | null];
    out.set(p, parentTile(c));
  }
  levels.set(z, out);
}

const report: Record<string, unknown> = { look, k: K, res: RES, cells: keys.length, zooms: {} as Record<number, unknown> };
let bytes = 0, tiles = 0, maxBytes = 0, maxTile = '';
let bounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
for (const [z, m] of [...levels.entries()].sort((a, b) => a[0] - b[0])) {
  let zb = 0, zmax = 0;
  for (const [k, rgba] of m) {
    const [x, y] = k.split('/').map(Number);
    const png = await sharp(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength), { raw: { width: TILE_PX, height: TILE_PX, channels: 4 } })
      .png({ palette: true, colours: paletteColours, dither: 0, effort: 10, compressionLevel: 9 }).toBuffer();
    const file = path.join(tilesDir, String(z), String(x), `${y}.png`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, png);
    zb += png.length; zmax = Math.max(zmax, png.length);
    if (png.length > maxBytes) { maxBytes = png.length; maxTile = `${z}/${k}`; }
    if (z === maxzoom) {
      const [w, nn] = lngLatOfTile(x, y, z), [e, s] = lngLatOfTile(x + 1, y + 1, z);
      bounds = [Math.min(bounds[0], w), Math.min(bounds[1], s), Math.max(bounds[2], e), Math.max(bounds[3], nn)];
    }
  }
  bytes += zb; tiles += m.size;
  (report.zooms as Record<number, unknown>)[z] = { tiles: m.size, bytes: zb, maxBytes: zmax, meanBytes: Math.round(zb / Math.max(1, m.size)) };
  console.log(`z${z}: ${m.size} tiles, ${(zb / 1e6).toFixed(2)} MB, max ${(zmax / 1e3).toFixed(1)} KB`);
}
const manifest: OverviewTilesManifest = {
  version: 1, look, colours: Object.fromEntries(Object.entries(colours)) as OverviewTilesManifest['colours'],
  minzoom, maxzoom, bounds: bounds.map(v => +v.toFixed(6)) as OverviewTilesManifest['bounds'], tiles, bytes,
  built: new Date().toISOString(),
  attribution: '© OpenStreetMap contributors (ODbL); BGT © Kadaster (CC0); AHN',
};
Object.assign(report, { tiles, bytes, maxBytes, maxTile, seconds: Math.round((Date.now() - t0) / 1000) });
fs.writeFileSync(path.join(tilesDir, 'manifest.json'), JSON.stringify(manifest, null, 1));
fs.writeFileSync(path.join(stage, 'report.json'), JSON.stringify(report, null, 1));
console.log(`total ${tiles} tiles, ${(bytes / 1e6).toFixed(2)} MB, max tile ${(maxBytes / 1e3).toFixed(1)} KB (${maxTile})`);

if (process.argv.includes('--publish')) {
  const dest = path.join(ROOT, OVERVIEW_TILES_DIR);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(tilesDir, dest, { recursive: true });
  console.log(`published to ${dest}`);
}
