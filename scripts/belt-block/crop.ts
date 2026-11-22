/** Crop a horizontal span of a PNG and scale it (block-pilot viewing helper). Usage: crop.ts <src> <x> <w> <out> [scale] [y] [h] */
import sharp from 'sharp';
const [, , src, x, w, out, scale, y, h] = process.argv;
const m = await sharp(src).metadata();
const top = y ? +y : 0, height = h ? +h : m.height! - top;
await sharp(src).extract({ left: +x, top, width: +w, height }).flatten({ background: '#ffffff' }).resize(Math.round(+w * (+(scale ?? 0.5)))).png().toFile(out);
