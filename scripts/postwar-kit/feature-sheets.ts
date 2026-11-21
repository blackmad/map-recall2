/**
 * Round 2 of the kit (lane postwar-kit-r2-20261121): labelled 3x2 sheets of every sampled member's aimed panorama
 * thumbnail (sample-all.json, Gemeente Amsterdam, CC BY 4.0) for the by-eye feature read (stair towers, arched heads,
 * erkers, curved fronts, balconies): artifacts/postwar-kit/feature-sheets/NN.jpg and index.json.
 *   node --import tsx scripts/postwar-kit/feature-sheets.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const OUT = path.resolve(import.meta.dirname, '../../artifacts/postwar-kit');
const sample = JSON.parse(fs.readFileSync(path.join(OUT, 'sample-all.json'), 'utf8')) as Record<string, any>;
const ids = Object.keys(sample).filter(id => sample[id].photo).sort();
const dir = path.join(OUT, 'feature-sheets'); fs.mkdirSync(dir, { recursive: true });
const S = 520, L = 34, esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
for (let p = 0; p * 6 < ids.length; p++) {
  const part = ids.slice(p * 6, p * 6 + 6), comps: sharp.OverlayOptions[] = [];
  for (const [i, id] of part.entries()) {
    const r = sample[id], x = (i % 3) * (S + 6), y = Math.floor(i / 3) * (S + L + 6);
    comps.push({ input: await sharp(path.join(OUT, r.photo)).resize(S, S, { fit: 'contain', background: '#222' }).toBuffer(), left: x, top: y + L });
    comps.push({ input: Buffer.from(`<svg width="${S}" height="${L}"><rect width="100%" height="100%" fill="#000"/><text x="6" y="23" font-family="Helvetica" font-size="17" fill="#fff">${p * 6 + i + 1}. ${r.year} ${Math.round(r.heightM)}m ${esc(String(r.address).slice(0, 36))}</text></svg>`), left: x, top: y });
  }
  await sharp({ create: { width: 3 * (S + 6), height: 2 * (S + L + 6), channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 82 }).toFile(path.join(dir, `${String(p + 1).padStart(2, '0')}.jpg`));
}
fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(ids.map((id, i) => ({ n: i + 1, id, address: sample[id].address, year: sample[id].year, heightM: sample[id].heightM, wallM: sample[id].wallM, cluster: sample[id].cluster })), null, 1));
console.log(ids.length, 'photos', Math.ceil(ids.length / 6), 'sheets');
