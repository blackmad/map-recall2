// Window sharpness inside a facade band for PNG frames (src/canalRecall/look/sharpness.ts, lane R1-B #224):
//   tsx scripts/look/sharpness.mts [--rect=x0,y0,x1,y1] a.png [b.png …]
// rect in fractions of the frame (default the whole frame); prints one JSON line per file.
import sharp from 'sharp';
import { frameSharpness, type Rect } from '../../src/canalRecall/look/sharpness.ts';

const args = process.argv.slice(2);
const rectArg = args.find(a => a.startsWith('--rect='));
const [x0, y0, x1, y1] = (rectArg?.slice(7) ?? '0,0,1,1').split(',').map(Number);
const rect: Rect = { x0, y0, x1, y1 };
for (const file of args.filter(a => !a.startsWith('--'))) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const s = frameSharpness(data, info.width, info.height, info.channels, rect);
  console.log(JSON.stringify({ file, rect, laplacianVar: +s.laplacianVar.toFixed(1), edge: +s.edge.toFixed(2), acutance: +s.acutance.toFixed(1), pixels: s.pixels }));
}
