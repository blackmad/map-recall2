/** Ortho crop to PNG: tsx scripts/roofs/ortho-crop.mts <lng> <lat> <halfM> <level> <layer> <out.png> */
import sharp from 'sharp';
import { OrthoMosaic } from './orthoTiles.ts';
import { lngLatToRd } from '../../src/canalRecall/rdCoordinates.ts';
const [lng, lat, half, level, layer, out] = [Number(process.argv[2]), Number(process.argv[3]), Number(process.argv[4]), Number(process.argv[5]), process.argv[6], process.argv[7]];
const [x, y] = lngLatToRd(lng, lat);
const m = new OrthoMosaic(layer, level);
await m.load(x - half, y - half, x + half, y + half);
const n = Math.round(2 * half / m.res), buf = Buffer.alloc(n * n * 3);
for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const p = m.pixel(x - half + (i + .5) * m.res, y + half - (j + .5) * m.res); if (p) buf.set(p, (j * n + i) * 3); }
await sharp(buf, { raw: { width: n, height: n, channels: 3 } }).png().toFile(out);
console.log(n, out);
