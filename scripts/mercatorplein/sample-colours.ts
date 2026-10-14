/**
 * Median colours of named boxes on a rectified panorama crop (wall brick, pier brick, render band, roof tiles, frames),
 * for the Mercatorplein inventory: the measured colours, not guessed ones.
 *
 *   node --import tsx scripts/mercatorplein/sample-colours.ts <crop.jpg> name:x0,y0,x1,y1 [name:...]
 *
 * Boxes are in crop pixels. Prints per box the per-channel median, the hex and HSL (hue deg, sat, light).
 */
import sharp from 'sharp';
import {rgbToHsl, toHex, type Rgb} from '../../src/canalRecall/blockFace/wallColour.ts';

const [file, ...boxes] = process.argv.slice(2);
const {data, info} = await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject: true});
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
for (const b of boxes) {
  const [name, rest] = b.split(':'), [x0, y0, x1, y1] = rest.split(',').map(Number);
  const ch: number[][] = [[], [], []];
  for (let y = Math.max(0, y0); y < Math.min(info.height, y1); y++) for (let x = Math.max(0, x0); x < Math.min(info.width, x1); x++) {
    const i = (y * info.width + x) * 3;
    for (let k = 0; k < 3; k++) ch[k].push(data[i + k]);
  }
  const rgb = ch.map(median) as Rgb, hsl = rgbToHsl(rgb);
  console.log(JSON.stringify({name, box: [x0, y0, x1, y1], pixels: ch[0].length, rgb, hex: toHex(rgb), hsl: [Math.round(hsl[0]), +hsl[1].toFixed(2), +hsl[2].toFixed(2)]}));
}
