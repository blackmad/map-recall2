/** Print pixel colours: node --import tsx scripts/haparandaweg/px.ts <image> x,y x,y ... */
import sharp from 'sharp';

const { data, info } = await sharp(process.argv[2]).removeAlpha().raw().toBuffer({ resolveWithObject: true });
for (const a of process.argv.slice(3)) {
  const [x, y] = a.split(',').map(Number), o = (y * info.width + x) * 3;
  console.log(a, data[o], data[o + 1], data[o + 2]);
}
