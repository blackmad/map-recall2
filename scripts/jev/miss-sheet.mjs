/** Contact sheet of the spike's worst misses: node scripts/jev/miss-sheet.mjs <dir> <scores.json> <out.jpg> */
import sharp from 'sharp'; import fs from 'node:fs'; import path from 'node:path';
const [,, dir, scoresFile, out] = process.argv;
const misses = JSON.parse(fs.readFileSync(scoresFile)).worstMisses, W = 260, H = 520, cols = 5;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const tiles = await Promise.all(misses.map(async (m, i) => {
  const img = await sharp(path.join(dir, 'crops', `${m.pandId}.jpg`)).resize(W, H - 56, {fit: 'contain', background: '#222'}).toBuffer();
  const label = Buffer.from(`<svg width="${W}" height="56"><rect width="100%" height="100%" fill="#000"/><text x="4" y="18" font-size="14" fill="#fff" font-family="sans-serif">${i + 1}. ${esc(m.field)} (${m.conf.toFixed(2)})</text><text x="4" y="34" font-size="13" fill="#9f9" font-family="sans-serif">truth ${esc(JSON.stringify(m.truth))}</text><text x="4" y="50" font-size="13" fill="#f99" font-family="sans-serif">jev ${esc(JSON.stringify(m.pred[0]))} · ${esc((m.address ?? m.pandId).slice(0, 22))}</text></svg>`);
  return [{input: img, left: (i % cols) * W, top: Math.floor(i / cols) * H}, {input: label, left: (i % cols) * W, top: Math.floor(i / cols) * H + H - 56}];
}));
await sharp({create: {width: cols * W, height: Math.ceil(misses.length / cols) * H, channels: 3, background: '#111'}}).composite(tiles.flat()).jpeg({quality: 80}).toFile(out);
