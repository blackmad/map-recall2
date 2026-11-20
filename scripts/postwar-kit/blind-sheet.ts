/**
 * Blind sheet for the post-1965 kit: per held-out pand, photo | A | B with the flag-off and flag-on game frames on a
 * side chosen by a hash (the key stays in artifacts/postwar-kit/blind-key.json, away from the judge).
 *   node --import tsx scripts/postwar-kit/blind-sheet.ts <offDir> <onDir> [<ids.json> <name>]
 * (round 2: the ids file and an output name, e.g. blind2 -> blind2/NN.jpg and blind2-key.json).
 * Writes artifacts/postwar-kit/blind/NN.jpg (one triple each) and blind-key.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const OUT = path.resolve(import.meta.dirname, '../../artifacts/postwar-kit');
const [offDir, onDir, idsFile, name = 'blind'] = process.argv.slice(2);
const split = idsFile ? { blind: JSON.parse(fs.readFileSync(idsFile, 'utf8')) } : JSON.parse(fs.readFileSync(path.join(OUT, 'split.json'), 'utf8'));
const dir = path.join(OUT, name); fs.mkdirSync(dir, { recursive: true });
const W = 640, H = 480, L = 36;
const key: Array<{ n: number; id: string; A: 'off' | 'on'; B: 'off' | 'on' }> = [];
const tile = async (file: string, label: string) => sharp({ create: { width: W, height: H + L, channels: 3, background: '#000' } }).composite([
  { input: await sharp(file).resize(W, H, { fit: 'contain', background: '#111' }).toBuffer(), left: 0, top: L },
  { input: Buffer.from(`<svg width="${W}" height="${L}"><text x="10" y="26" font-family="Helvetica" font-size="22" fill="#fff">${label}</text></svg>`), left: 0, top: 0 }]).png().toBuffer();
let n = 0;
for (const id of split.blind as string[]) {
  const photo = path.join(onDir, id, 'photo.jpg'), off = path.join(offDir, id, 'game.png'), on = path.join(onDir, id, 'game.png');
  if (![photo, off, on].every(f => fs.existsSync(f))) { console.warn(`${id}: missing frames`); continue; }
  n++;
  const onFirst = parseInt(createHash('sha1').update(`postwar-side:${id}`).digest('hex').slice(0, 8), 16) % 2 === 0;
  key.push({ n, id, A: onFirst ? 'on' : 'off', B: onFirst ? 'off' : 'on' });
  const tiles = [await tile(photo, `${n}. photo`), await tile(onFirst ? on : off, 'A'), await tile(onFirst ? off : on, 'B')];
  await sharp({ create: { width: 3 * W + 12, height: H + L, channels: 3, background: '#000' } }).composite(tiles.map((t, i) => ({ input: t, left: i * (W + 6), top: 0 }))).jpeg({ quality: 85 }).toFile(path.join(dir, `${String(n).padStart(2, '0')}.jpg`));
}
fs.writeFileSync(path.join(OUT, `${name}-key.json`), JSON.stringify(key, null, 1));
console.log(n, 'triples');
