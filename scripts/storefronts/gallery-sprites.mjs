// Packs gallery tiles into 50-row sprite sheets (an artifact publish holds at most 255 files).
import fs from 'node:fs';
import sharp from 'sharp';
const A = 'tmp/storefronts/artifact', data = JSON.parse(fs.readFileSync(`${A}/data.json`, 'utf8'));
const W = 640, H = 304, PER = 50;
async function pack(items, file, prefix) {
  const sheets = [];
  for (let s = 0; s * PER < items.length; s++) {
    const chunk = items.slice(s * PER, (s + 1) * PER), comps = [];
    for (const [k, it] of chunk.entries()) {
      const m = await sharp(file(it)).metadata(), sc = Math.min(W / m.width, H / m.height);
      it.fit = { x0: (W - m.width * sc) / 2 / W, w: m.width * sc / W };
      const input = await sharp(file(it)).resize(W, H, { fit: 'contain', background: '#222' }).toBuffer();
      comps.push({ input, top: k * H, left: 0 });
      it.sprite = { sheet: `${prefix}-${s}.jpg`, row: k, rows: chunk.length };
    }
    await sharp({ create: { width: W, height: H * chunk.length, channels: 3, background: '#222' } }).composite(comps).jpeg({ quality: 70 }).toFile(`${A}/${prefix}-${s}.jpg`);
    sheets.push(`${prefix}-${s}.jpg`);
  }
  return sheets;
}
const b = await pack(data.built, it => `${A}/built/${it.slug}.jpg`, 'built');
const r = await pack(data.skipped.filter(s => s.image), it => `${A}/${it.image}`, 'review');
fs.writeFileSync(`${A}/data.json`, JSON.stringify(data));
console.log([...b, ...r].join(' '));
