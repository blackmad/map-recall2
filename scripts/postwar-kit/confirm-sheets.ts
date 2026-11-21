/**
 * Round 2 (lane postwar-kit-r2-20261121): sheets of the 2024-2025 captures (recent-photos.ts) of pands whose feature read
 * came from an older capture, each captioned with the read's claim, for a confirmation pass
 * (artifacts/postwar-kit/confirm-sheets/NN.jpg, index.json).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const ROOT = path.resolve(import.meta.dirname, '../..'), OUT = path.join(ROOT, 'artifacts/postwar-kit');
const recent = JSON.parse(fs.readFileSync(path.join(OUT, 'sample-recent.json'), 'utf8')) as Record<string, any>;
const FEAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/canalRecall/postwarKit/feature-reads.json'), 'utf8')).features as Record<string, any>;
const claim = (f: any) => [f.balcony && `balcony ${f.balcony} (${f.balconyTone})`, f.stair && `stair ${f.stair} x${f.stairCount}`, f.erker && `erker ${f.erker} ${f.erkerPlan} x${f.erkerCount}`].filter(Boolean).join('; ');
const ids = Object.keys(recent).filter(id => recent[id].photo).sort();
const dir = path.join(OUT, 'confirm-sheets'); fs.mkdirSync(dir, { recursive: true });
const S = 520, L = 52, esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
for (let p = 0; p * 6 < ids.length; p++) {
  const comps: sharp.OverlayOptions[] = [];
  for (const [i, id] of ids.slice(p * 6, p * 6 + 6).entries()) {
    const r = recent[id], x = (i % 3) * (S + 6), y = Math.floor(i / 3) * (S + L + 6);
    comps.push({ input: await sharp(path.join(OUT, r.photo)).resize(S, S, { fit: 'contain', background: '#222' }).toBuffer(), left: x, top: y + L });
    comps.push({ input: Buffer.from(`<svg width="${S}" height="${L}"><rect width="100%" height="100%" fill="#000"/><text x="6" y="20" font-family="Helvetica" font-size="16" fill="#fff">${p * 6 + i + 1}. ${esc(String(r.address).slice(0, 40))} ${r.panoDate}</text><text x="6" y="43" font-family="Helvetica" font-size="15" fill="#ffd21f">${esc(claim(FEAT[id]))}</text></svg>`), left: x, top: y });
  }
  await sharp({ create: { width: 3 * (S + 6), height: 2 * (S + L + 6), channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 82 }).toFile(path.join(dir, `${String(p + 1).padStart(2, '0')}.jpg`));
}
fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(ids.map((id, i) => ({ n: i + 1, id, address: recent[id].address, panoDate: recent[id].panoDate, claim: FEAT[id] })), null, 1));
console.log(ids.length, Math.ceil(ids.length / 6));
