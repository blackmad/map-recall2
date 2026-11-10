// Orthophoto crops of the open-ground spots with the open-ground-v1 polygons outlined (lane open-ground-look 2026-11-10).
//
//   npx tsx scripts/own-ground/open-ground-ortho-sheet.ts [--dir=artifacts/own-ground/staging/open-ground-v1] [--out=<dir>] [--size=200] [--overlay=0]
//
// One JPEG per OPEN_GROUND_SPOTS spot: the PDOK 8 cm orthophoto (Beeldmateriaal Nederland, CC BY 4.0) at 0.25 m, north up,
// the spot centre marked, each open-ground polygon outlined in its cover's colour (meadow green, shrub dark green,
// bare brown, sand yellow); `--overlay=0` writes the bare crop.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';
import { toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { decodeLine } from '../../src/canalRecall/ownGround/parks.ts';
import type { OpenGroundCell, OpenGroundCover } from '../../src/canalRecall/ownGround/groundSurface.ts';
import { OPEN_GROUND_SPOTS } from '../../src/canalRecall/ownGround/openGroundRegressions.ts';
import { OrthoTiles } from './ortho.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const DIR = arg('dir', 'artifacts/own-ground/staging/open-ground-v1'), OUT = arg('out', 'artifacts/own-ground/open-ground-ortho');
const SIZE = Number(arg('size', '200')), RES = 0.25, overlay = arg('overlay', '1') !== '0';
const COLOUR: Record<OpenGroundCover, string> = { meadow: '#7CFC00', shrub: '#006400', bare: '#C0602A', sand: '#FFD700' };
mkdirSync(OUT, { recursive: true });
const ortho = new OrthoTiles();
for (const spot of OPEN_GROUND_SPOTS) {
  const [cx, cy] = toLocal(spot.lng, spot.lat), x0 = cx - SIZE / 2, y0 = cy - SIZE / 2, n = Math.round(SIZE / RES);
  const rgb = await ortho.crop(x0, y0, n, n, RES);
  const px = (x: number, y: number) => `${((x - x0) / RES).toFixed(1)},${((y0 + SIZE - y) / RES).toFixed(1)}`;
  let svg = '';
  if (overlay) {
    const keys = new Set<string>([spot.cell]);
    for (const k of keys) {
      const f = join(DIR, 'cells', `${k}.json.gz`);
      if (!existsSync(f)) continue;
      const cell = JSON.parse(gunzipSync(readFileSync(f)).toString()) as OpenGroundCell;
      for (const a of cell.areas) for (const r of a.r.map(decodeLine)) svg += `<polygon points="${r.map(p => px(p[0], p[1])).join(' ')}" fill="none" stroke="${COLOUR[a.k]}" stroke-width="2"/>`;
    }
  }
  svg += `<circle cx="${n / 2}" cy="${n / 2}" r="8" fill="none" stroke="#ff00ff" stroke-width="3"/>`;
  svg += `<text x="8" y="24" font-size="20" font-family="sans-serif" fill="#fff" stroke="#000" stroke-width="0.6">${spot.name} ${spot.lat}, ${spot.lng} (${SIZE} m, PDOK luchtfoto CC BY 4.0)</text>`;
  const out = join(OUT, `${spot.name}-ortho${overlay ? '-polygons' : ''}.jpg`);
  await sharp(Buffer.from(rgb), { raw: { width: n, height: n, channels: 3 } }).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}">${svg}</svg>`) }]).jpeg({ quality: 85 }).toFile(out);
  console.log(out);
}
