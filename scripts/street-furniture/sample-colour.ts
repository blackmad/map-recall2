// Median sRGB of rectangles in a measurement crop (lane #170 colour evidence):
//   npx tsx scripts/street-furniture/sample-colour.ts <crop.jpg> <label>:x0,y0,x1,y1 [...]
import sharp from 'sharp';

async function main(): Promise<void> {
  const [file, ...rects] = process.argv.slice(2);
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  for (const r of rects) {
    const [label, box] = r.split(':'); const [x0, y0, x1, y1] = box.split(',').map(Number);
    const ch: number[][] = [[], [], []];
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * info.width + x) * info.channels; for (let c = 0; c < 3; c++) ch[c].push(data[i + c]); }
    const med = ch.map(a => a.sort((p, q) => p - q)[a.length >> 1]);
    console.log(`${label.padEnd(18)} #${med.map(v => v.toString(16).padStart(2, '0')).join('')}  rgb(${med.join(',')})`);
  }
}
void main();
