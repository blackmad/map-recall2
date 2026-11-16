/**
 * Lane shop-interiors: write the procedural interior atlas (src/canalRecall/shopInteriors/atlas.ts) as a PNG for review,
 * empty mid-plane texels in magenta.
 *   node --import tsx scripts/shop-interiors/atlas-sheet.ts [out.png]
 */
import sharp from 'sharp';
import { ATLAS_H, ATLAS_W, paintInteriorAtlas } from '../../src/canalRecall/shopInteriors/atlas.ts';

const out = process.argv[2] ?? 'artifacts/shop-interiors/atlas.png';
const t0 = performance.now(), img = paintInteriorAtlas();
console.log(`atlas ${ATLAS_W}x${ATLAS_H} painted in ${(performance.now() - t0).toFixed(0)} ms`);
await import('node:fs').then(fs => fs.mkdirSync(out.replace(/[^/]+$/, '') || '.', { recursive: true }));
await sharp(Buffer.from(img.buffer), { raw: { width: ATLAS_W, height: ATLAS_H, channels: 4 } }).flatten({ background: '#ff00ff' }).png().toFile(out);
console.log(out);
