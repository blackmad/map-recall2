// Busyness per frame third for PNG frames (src/canalRecall/look/busyness.ts): `tsx scripts/look/busyness.mts a.png [b.png …]`.
import sharp from 'sharp';
import { frameBusyness } from '../../src/canalRecall/look/busyness.ts';

for (const file of process.argv.slice(2)) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const b = frameBusyness(data, info.width, info.height, info.channels);
  const r = (v: number) => v.toFixed(1);
  console.log(JSON.stringify({ file, far: [r(b.far.edge), r(b.far.variance)], mid: [r(b.mid.edge), r(b.mid.variance)], near: [r(b.near.edge), r(b.near.variance)], farOverNear: [b.farOverNear.edge.toFixed(2), b.farOverNear.variance.toFixed(2)] }));
}
