// Usage: node scripts/landmarks/crop-image.mjs <in> <out> <x> <y> <w> <h>  (or "auto" for x to trim the flat background)
import sharp from 'sharp';
const [inp, out, x, y, w, h] = process.argv.slice(2);
if (x === 'auto') await sharp(inp).trim({threshold: 8}).extend({top: 20, bottom: 20, left: 20, right: 20, background: '#ffffff'}).toFile(out);
else await sharp(inp).extract({left: +x, top: +y, width: +w, height: +h}).toFile(out);
console.log(out);
