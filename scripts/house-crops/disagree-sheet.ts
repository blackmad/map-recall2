/**
 * H4c: contact sheet of the crops where the judge decision and the hand label disagree most (written by evaluate-judge.ts).
 *   node --import tsx scripts/house-crops/disagree-sheet.ts --buurt AB07 --archive <dir>
 * Each tile: number, the label, the judge quality and the decision. NOT blind: it is for the judgement session to re-label.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import { manifestPath, type Manifest } from './manifest.ts';

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const code = arg('buurt')!, archive = path.resolve(arg('archive') ?? process.env.HOUSE_CROPS_ARCHIVE ?? '');
const dis: { id: string; label: string; score: number; picked: boolean }[] = JSON.parse(await fs.readFile(`artifacts/house-crops/${code}-disagree.json`, 'utf8'));
const m: Manifest = JSON.parse(await fs.readFile(manifestPath(code), 'utf8'));
const cols = 5, W = 300, H = 380, tiles: OverlayOptions[] = [];
for (const [i, d] of dis.entries()) {
  const x = (i % cols) * W, y = Math.floor(i / cols) * H;
  const img = await sharp(path.join(archive, m.pands[d.id].archive!, 'front.jpg')).resize(W - 4, H - 44, { fit: 'contain', background: '#1f2328' }).extend({ top: 2, bottom: 42, left: 2, right: 2, background: '#555' }).png().toBuffer();
  const cap = `${i + 1}  label ${d.label}  judge ${d.score.toFixed(2)} ${d.picked ? 'GOOD' : 'not good'}`;
  const svg = `<svg width="${W}" height="38" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="38" fill="${d.picked ? '#7a2e2e' : '#2e4f7a'}"/><text x="6" y="16" font-family="Helvetica" font-size="14" fill="#fff">${cap}</text><text x="6" y="33" font-family="Helvetica" font-size="12" fill="#ddd">${d.id.slice(-8)}</text></svg>`;
  tiles.push({ input: img, left: x, top: y }, { input: Buffer.from(svg), left: x, top: y + H - 40 });
}
const out = `artifacts/house-crops/${code}-disagree.jpg`;
await sharp({ create: { width: cols * W, height: Math.ceil(dis.length / cols) * H, channels: 3, background: '#1f2328' } }).composite(tiles).jpeg({ quality: 80 }).toFile(out);
console.log(`${dis.length} tiles -> ${out}`);
