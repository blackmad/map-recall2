/**
 * Palette level: the raw panorama wall colours (pand-reference-walls, the 571-pand archive derive.ts reads as its
 * `pano` source) per era x family, beside the same eras' rendered sun-side wall, in L* and C*.
 *
 *   node --import tsx scripts/look/palette-level-photos.ts [--walls=<source-data>/pand-reference-walls] [--out=artifacts/palette-level/photos.json]
 *
 * The buurt profiles' swatches are not raw photos: derive.ts brings every source onto the thumbnails' frame and then
 * multiplies the brick chroma by the city palette's (BRICK_CHROMA_SHARE), so the table of palette-level-table.ts
 * (rendered minus swatch) starts one transform downstream of the photos. This reads the photos themselves: the best
 * rectified street wall per pand, white-balanced on its light trim (facade/cropWallColour.ts), brick tone
 * (look/brickTone.ts), family by derive.ts `photoPainted` / near-neutral stone. Era from the BAG year (bag-tiles z14).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';
import { measureBrickTone, rgbToLab } from '../../src/canalRecall/look/brickTone.ts';
import { cropNormaliser, masonryFamily, lch } from '../../src/canalRecall/facade/cropWallColour.ts';
import { periodForYear } from '../../src/canalRecall/look/palette.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const WALLS = arg('walls', path.join(process.env.MAP_RECALL_SOURCE_DATA ?? path.join(process.env.HOME ?? '', 'Code/map-recall2-source-data'), 'pand-reference-walls'));
const years = new Map<string, number>();
const tileRoot = 'public/data/extracts/amsterdam/bag-tiles/14';
for (const x of fs.readdirSync(tileRoot)) for (const f of fs.readdirSync(path.join(tileRoot, x))) {
  if (!f.endsWith('.geojson.gz')) continue;
  for (const feat of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(tileRoot, x, f))).toString()).features ?? []) {
    const id = String(feat.properties?.id ?? '').replace('NL.IMBAG.Pand.', ''), y = Number(feat.properties.year);
    if (/^\d{16}$/.test(id) && Number.isFinite(y) && y > 1200 && y < 2100) years.set(id, y);
  }
}
const photoPainted = (rgb: readonly number[]) => { const c = lch(rgb); return (c.L >= 62 && c.C < 14) || (c.L >= 40 && c.h > 100 && c.h < 250 && c.C < 12); };
const rows: { pand: string; era: string; family: string; L: number; C: number; hex: string }[] = [];
for (const dir of fs.readdirSync(WALLS)) {
  const file = path.join(WALLS, dir, 'walls.json'); if (!fs.existsSync(file)) continue;
  const year = years.get(dir); if (!year) continue;
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const wall = (doc.walls as any[]).filter(w => w.crop && !w.washedOut && (w.foliage ?? 0) < 0.3 && (w.missingFraction ?? 0) < 0.3 && w.ppm && fs.existsSync(path.join(WALLS, dir, `${w.tag}.jpg`)))
    .sort((a, b) => (a.obliquityDeg ?? 0) - (b.obliquityDeg ?? 0) || b.lengthM - a.lengthM)[0];
  if (!wall) continue;
  const { data, info } = await sharp(path.join(WALLS, dir, `${wall.tag}.jpg`)).resize({ width: 240 }).raw().toBuffer({ resolveWithObject: true });
  const maskFile = path.join(WALLS, dir, `${wall.tag}.mask.png`);
  const mask = fs.existsSync(maskFile) ? await sharp(maskFile).resize(info.width, info.height, { kernel: 'nearest' }).greyscale().raw().toBuffer() : null;
  const norm = cropNormaliser(data, info.width, info.height, info.channels, wall.ppm * info.width / wall.widthPx);
  const px: number[] = [];
  for (let i = 0, k = 0; i < data.length; i += info.channels, k++) { if (mask && mask[k] < 128) continue; const rgb = norm.apply([data[i], data[i + 1], data[i + 2]]); px.push(rgb[0], rgb[1], rgb[2]); }
  const tone = measureBrickTone(px, 3); if (!tone) continue;
  const painted = photoPainted(tone.wall), rgb = painted ? tone.wall : tone.brick;
  if (!painted && !masonryFamily(tone.wall)) continue;
  const c = lch(rgb);
  rows.push({ pand: dir, era: periodForYear(year), family: painted ? 'painted' : c.C < 6 ? 'stone' : 'brick', L: c.L, C: c.C, hex: '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('') });
}
fs.mkdirSync(path.dirname(arg('out', 'artifacts/palette-level/photos.json')), { recursive: true });
fs.writeFileSync(arg('out', 'artifacts/palette-level/photos.json'), JSON.stringify(rows));
const med = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN; };
console.log('panorama walls', rows.length);
for (const era of ['canal', 'c19', 'school', 'modern', 'all']) for (const fam of ['brick', 'painted', 'stone', 'all']) {
  const r = rows.filter(x => (era === 'all' || x.era === era) && (fam === 'all' || x.family === fam));
  if (r.length) console.log(`${era}|${fam}`.padEnd(16), String(r.length).padStart(4), 'L', med(r.map(x => x.L)).toFixed(1), 'C', med(r.map(x => x.C)).toFixed(1));
}
