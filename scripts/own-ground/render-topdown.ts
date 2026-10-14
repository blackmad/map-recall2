// Top-down raster of built own-ground cells (the worker's code path, offline):
// every ground layer's triangles z-buffered as a camera straight above sees
// them, the water-mask discard applied as the shader does. For reviewing road
// drawing at a named spot without the game.
//
//   npx tsx scripts/own-ground/render-topdown.ts <lng> <lat> [halfM=120] [mPerPx=0.25] [out.png] [--lod=1] [--bgt]
//
// `--bgt` also writes `<out>-bgt.png`: the BGT wegdeel polygons of the same
// view (ground truth; tiles from fetch-bgt.ts under BGT_DIR or the source-data archive).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync, deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { buildCell, maskChannelAt, DRAW_RANK, GROUND_LAYERS, type BuiltCell, type GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';

const COLOURS: Record<GroundLayer, [number, number, number]> = {
  land: [150, 142, 130], park: [92, 122, 66], wood: [70, 96, 52], square: [176, 166, 150], parking: [92, 92, 96],
  asphalt: [72, 74, 78], klinker: [128, 82, 66], cycle: [160, 70, 62], paving: [190, 182, 170], gravel: [170, 156, 128],
  kerb: [235, 230, 220], paint: [255, 255, 255], water: [48, 75, 77], quay: [110, 100, 90], deckBody: [120, 110, 100], deckTop: [140, 130, 120],
  tram: [30, 30, 34], bollard: [120, 40, 30],
  // Park surfaces (parks-v1), a shade apart from the OSM park fill so a review can tell survey from fill.
  lawn: [110, 150, 80], bed: [130, 110, 80], shrub: [70, 110, 60], bark: [110, 80, 60], sand: [210, 195, 150], parkGravel: [180, 170, 140], parkPath: [120, 120, 120], pond: [60, 95, 100], hedge: [50, 90, 45], furniture: [80, 80, 80],
} as Record<GroundLayer, [number, number, number]>;
// The game's polygon-offset ranks (groundCell DRAW_RANK, park surfaces included): a park surface 15 mm over the land wins as on screen.
const RANK: Partial<Record<string, number>> = DRAW_RANK;
const CUT: Partial<Record<string, 0 | 1>> = { land: 0, park: 0, wood: 0, square: 0, parking: 0, lawn: 0, bed: 0, shrub: 0, bark: 0, sand: 0, parkGravel: 0, parkPath: 0, pond: 0, asphalt: 1, klinker: 1, cycle: 1, paving: 1, gravel: 1, kerb: 1, paint: 1, tram: 1 };

function png(width: number, height: number, rgb: Uint8Array): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (width * 3 + 1)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + y * width * 3, width * 3).copy(raw, y * (width * 3 + 1) + 1); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Rasterise built cells over [x0, y0]–[x0 + w·res, y0 + h·res] (north up). */
export function rasterTopDown(cells: readonly BuiltCell[], x0: number, y0: number, w: number, h: number, res: number): Uint8Array {
  const zbuf = new Float32Array(w * h).fill(-Infinity), rank = new Int8Array(w * h).fill(-1), out = new Uint8Array(w * h * 3).fill(250);
  const layers = [...GROUND_LAYERS, ...(['tram', 'bollard'] as GroundLayer[])];
  for (const cell of cells) for (const layer of layers) {
    const m = cell.layers[layer];
    if (!m) continue;
    const p = m.positions, idx = m.indices, col = COLOURS[layer] ?? [255, 0, 255], rk = RANK[layer] ?? 0, ch = CUT[layer];
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ax = (p[a] - x0) / res, ay = (y0 + h * res - p[a + 1]) / res, bx = (p[b] - x0) / res, by = (y0 + h * res - p[b + 1]) / res, cx = (p[c] - x0) / res, cy = (y0 + h * res - p[c + 1]) / res;
      const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)));
      const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
      if (minX > maxX || minY > maxY) continue;
      const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(d) < 1e-9) continue;
      for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
        const sx = px + 0.5, sy = py + 0.5;
        const u = ((by - cy) * (sx - cx) + (cx - bx) * (sy - cy)) / d, v = ((cy - ay) * (sx - cx) + (ax - cx) * (sy - cy)) / d;
        if (u < 0 || v < 0 || u + v > 1) continue;
        const z = u * p[a + 2] + v * p[b + 2] + (1 - u - v) * p[c + 2];
        const i = py * w + px, zi = zbuf[i];
        if (!(z > zi + 0.02 || (Math.abs(z - zi) <= 0.02 && rk > rank[i]))) continue;
        if (ch !== undefined && cell.mask && maskChannelAt(cell.mask, x0 + sx * res, y0 + h * res - sy * res, ch) < 0.5) continue;
        zbuf[i] = z; rank[i] = rk;
        out[i * 3] = col[0]; out[i * 3 + 1] = col[1]; out[i * 3 + 2] = col[2];
      }
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const lod = process.argv.includes('--lod=1') ? 1 : 0;
  const [lng, lat] = [Number(args[0]), Number(args[1])], half = Number(args[2] ?? 120), res = Number(args[3] ?? 0.25);
  const outPath = args[4] ?? `artifacts/own-ground-roads/topdown-${lng}-${lat}.png`;
  const ROOT = 'public/data/extracts/amsterdam';
  const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
  await store.init();
  const [x, y] = toLocal(lng, lat);
  // Every cell whose ways can reach the view (a way lives in the cell of its midpoint).
  const keys = new Set<string>();
  const pad = half + 150;
  for (let dx = -pad; dx <= pad; dx += 50) for (let dy = -pad; dy <= pad; dy += 50) keys.add(store.cellAt(x + dx, y + dy));
  // A way reaching into the view may belong to a cell whose rectangle does not: take the centre cell's neighbours too.
  for (const k of GroundStore.neighbours(store.cellAt(x, y))) keys.add(k);
  const cells: BuiltCell[] = [];
  for (const k of keys) if (store.covers(k)) cells.push(buildCell(await store.cellInput(k, lod as 0 | 1)));
  const w = Math.round(2 * half / res), h = w;
  const rgb = rasterTopDown(cells, x - half, y - half, w, h, res);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, png(w, h, rgb));
  if (process.argv.includes('--bgt')) {
    const dir = [process.env.BGT_DIR, 'artifacts/own-ground/raw/bgt', join(homedir(), 'Code/map-recall2-source-data/datasets/own-ground-20261013/bgt-wegdeel/tiles')].find(d => d && existsSync(d))!;
    const colour = (f: string): [number, number, number] => /^rijbaan/.test(f) ? COLOURS.asphalt : /^OV-baan|^overweg/.test(f) ? [40, 40, 44] : /^fietspad/.test(f) ? COLOURS.cycle : /^voetpad/.test(f) ? COLOURS.paving : /^voetgangersgebied|^woonerf/.test(f) ? COLOURS.square : /^parkeervlak/.test(f) ? COLOURS.parking : /^inrit/.test(f) ? COLOURS.klinker : [200, 0, 200];
    const truth = new Uint8Array(w * h * 3).fill(250);
    const seen = new Set<string>();
    for (const key of keys) for (let q = 0; q < 4; q++) {
      const file = join(dir, `${key}_${q}.json.gz`);
      if (!existsSync(file)) continue;
      for (const f of JSON.parse(gunzipSync(readFileSync(file)).toString()) as { f: string; h: number; r: [number, number][][] }[]) {
        const id = `${f.f}:${f.r[0][0]}:${f.r[0][1]}:${f.r[0].length}`;
        if (seen.has(id) || f.h < 0) continue;
        seen.add(id);
        const rings = f.r.map(r => r.map(([lo, la]) => { const [px, py] = toLocal(lo, la); return [(px - (x - half)) / res, (y + half - py) / res]; }));
        const c = colour(f.f);
        let y0 = Infinity, y1 = -Infinity;
        for (const r of rings) for (const p of r) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
        for (let py = Math.max(0, Math.floor(y0)); py <= Math.min(h - 1, Math.ceil(y1)); py++) {
          const sy = py + 0.5, xs: number[] = [];
          for (const r of rings) for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; if ((a[1] > sy) !== (b[1] > sy)) xs.push(a[0] + (sy - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
          xs.sort((p, q2) => p - q2);
          for (let k = 0; k + 1 < xs.length; k += 2) for (let px = Math.max(0, Math.ceil(xs[k] - 0.5)); px <= Math.min(w - 1, Math.floor(xs[k + 1] - 0.5)); px++) { const i = (py * w + px) * 3; truth[i] = c[0]; truth[i + 1] = c[1]; truth[i + 2] = c[2]; }
        }
      }
    }
    writeFileSync(outPath.replace(/\.png$/, '-bgt.png'), png(w, h, truth));
  }
  console.log(JSON.stringify({ out: outPath, cells: [...keys], px: [w, h], res }));
}

if (process.argv[1]?.endsWith('render-topdown.ts')) main().catch(e => { console.error(e); process.exit(1); });
