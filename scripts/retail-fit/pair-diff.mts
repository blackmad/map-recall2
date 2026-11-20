// Lane retail-fit: % of pixels that differ (sum |dRGB| > 30) between <a>/<key>/<file> and <b>/<key>/<file> per key.
//   npx tsx scripts/retail-fit/pair-diff.mts <dirA> <dirB> [file=game.png]
import fs from 'node:fs';
import sharp from 'sharp';
const [A, B, file = 'game.png'] = process.argv.slice(2);
for (const k of fs.readdirSync(A).sort()) {
  const a = `${A}/${k}/${file}`, b = `${B}/${k}/${file}`;
  if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
  const [x, y] = await Promise.all([a, b].map(f => sharp(f).removeAlpha().raw().toBuffer()));
  let n = 0; for (let i = 0; i < x.length; i += 3) if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) > 30) n++;
  console.log(k, (100 * n / (x.length / 3)).toFixed(2) + '%');
}
