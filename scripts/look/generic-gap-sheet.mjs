// Contact sheet for the generic-uplift spots: per spot the panorama, then each game run's rider-height frame (tests/e2e/generic-gap-strip.spec.ts).
//   node scripts/look/generic-gap-sheet.mjs <spots.json> <panoDir> <out.jpg> <runDir>[=label] ...
// Two spots per row, thumbnails 400x250, label under each spot.
import fs from 'node:fs';
import sharp from 'sharp';

const [spotsFile, panoDir, out, ...runs] = process.argv.slice(2);
const spots = JSON.parse(fs.readFileSync(spotsFile, 'utf8'));
const W = 400, H = 250, LH = 22, PER = 2, cols = 1 + runs.length;
const runDirs = runs.map(r => { const [dir, label] = r.split('='); return { dir, label: label || dir.split('/').pop() }; });
const thumb = async (file, crop) => {
  if (!fs.existsSync(file)) return sharp({ create: { width: W, height: H, channels: 3, background: '#444' } }).png().toBuffer();
  let img = sharp(file);
  if (crop) { const m = await img.metadata(); img = sharp(file).extract({ left: Math.round(m.width * 0.12), top: Math.round(m.height * 0.12), width: Math.round(m.width * 0.76), height: Math.round(m.height * 0.6) }); }
  return img.resize(W, H, { fit: 'cover' }).png().toBuffer();
};
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const rows = Math.ceil(spots.length / PER), cellW = cols * W, comps = [];
for (const [i, s] of spots.entries()) {
  const x0 = (i % PER) * (cellW + 10), y0 = Math.floor(i / PER) * (H + LH);
  const imgs = [await thumb(`${panoDir}/${s.slug}.jpg`, false), ...await Promise.all(runDirs.map(r => thumb(`${r.dir}/${s.slug}.png`, false)))];
  imgs.forEach((b, k) => comps.push({ input: b, left: x0 + k * W, top: y0 }));
  const label = `${i + 1}. ${s.name} — photo | ${runDirs.map(r => r.label).join(' | ')}`;
  comps.push({ input: Buffer.from(`<svg width="${cellW}" height="${LH}"><rect width="100%" height="100%" fill="#111"/><text x="6" y="16" font-family="Helvetica" font-size="14" fill="#fff">${esc(label)}</text></svg>`), left: x0, top: y0 + H });
}
await sharp({ create: { width: PER * cellW + 10, height: rows * (H + LH), channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 82 }).toFile(out);
console.log(out);
