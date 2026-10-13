// Usage: node scripts/landmarks/backlog-sheets.mjs <id> <frontAz> <threeQuarterAz> <az1,az2,az3,az4> [refFile]
// Writes artifacts/landmark-lanes/<id>/contact.png (reference | front | 3/4 | in game) and sides.png (four card-size views).
import sharp from 'sharp';
import fs from 'node:fs';
const [id, a1, a2, sides, ref] = process.argv.slice(2);
const d = `artifacts/landmark-lanes/${id}`, H = 450;
const tile = async (f, h = H) => fs.existsSync(f) ? sharp(f).resize({height: h}).png().toBuffer() : sharp({create: {width: 600, height: h, channels: 3, background: '#ccc'}}).png().toBuffer();
async function row(files, out) {
  const tiles = [];
  for (const f of files) { const buf = await tile(f); tiles.push({buf, w: (await sharp(buf).metadata()).width}); }
  let x = 0;
  const comp = tiles.map(t => { const c = {input: t.buf, left: x, top: 0}; x += t.w; return c; });
  await sharp({create: {width: x, height: H, channels: 3, background: '#fff'}}).composite(comp).png().toFile(out);
  console.log(out, x, H);
}
await row([ref ?? `${d}/ref.jpg`, `${d}/${id}-az${a1}.png`, `${d}/${id}-az${a2}.png`, `${d}/game.png`], `${d}/contact.png`);
await row(sides.split(',').map(a => `${d}/${id}-az${a}.png`), `${d}/sides.png`);
