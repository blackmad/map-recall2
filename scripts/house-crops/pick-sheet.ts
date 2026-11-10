/**
 * H4c: blind numbered sheets of the judge-picked crops that were never labelled (pick differs from the H4b-labelled crop), for hand
 * labelling. Writes artifacts/house-crops/pick/<code>-<n>.jpg and <code>-pick-draw.json (tile -> pand id, year, panorama ids).
 *   node --import tsx scripts/house-crops/pick-sheet.ts --buurt AB07 --archive <dir> [--per-sheet 26]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const code = arg('buurt')!, archive = path.resolve(arg('archive') ?? process.env.HOUSE_CROPS_ARCHIVE ?? ''), per = Number(arg('per-sheet', '26'));
const picks = JSON.parse(await fs.readFile(path.resolve('scripts/house-crops/judge', `${code}-picks.json`), 'utf8')).picks as { pandId: string; best?: { year: number; panoIds: string[] } }[];
const labels = JSON.parse(await fs.readFile(path.resolve('scripts/house-crops/labels', `${code}.json`), 'utf8'));
const todo = picks.filter(p => p.best && !(labels[p.pandId] && [...labels[p.pandId].panoIds].sort().join() === [...p.best.panoIds].sort().join()));
let s0 = 7; const rnd = () => { s0 = (s0 * 1664525 + 1013904223) >>> 0; return s0 / 4294967296; };
for (let i = todo.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [todo[i], todo[j]] = [todo[j], todo[i]]; }
const cols = 6, T = 300, out = path.resolve('artifacts/house-crops/pick');
await fs.mkdir(out, { recursive: true });
const draw: Record<number, { pandId: string; year: number; panoIds: string[] }> = {};
for (let s = 0; s * per < todo.length; s++) {
  const chunk = todo.slice(s * per, (s + 1) * per), tiles: OverlayOptions[] = [];
  for (const [i, p] of chunk.entries()) {
    const x = (i % cols) * T, y = Math.floor(i / cols) * T, n = s * per + i + 1;
    const img = await sharp(path.join(archive, 'pand-crops', p.pandId, 'years', `${p.best!.year}.jpg`)).resize(T - 4, T - 4, { fit: 'contain', background: '#1f2328' }).extend({ top: 2, bottom: 2, left: 2, right: 2, background: '#555' }).png().toBuffer();
    const svg = `<svg width="56" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="56" height="24" fill="#000" opacity="0.7"/><text x="6" y="18" font-family="Helvetica" font-size="17" fill="#ffd400">${n}</text></svg>`;
    tiles.push({ input: img, left: x, top: y }, { input: Buffer.from(svg), left: x + 4, top: y + 4 });
    draw[n] = { pandId: p.pandId, year: p.best!.year, panoIds: p.best!.panoIds };
  }
  await sharp({ create: { width: cols * T, height: Math.ceil(chunk.length / cols) * T, channels: 3, background: '#1f2328' } }).composite(tiles).jpeg({ quality: 82 }).toFile(path.join(out, `${code}-${s + 1}.jpg`));
}
await fs.writeFile(path.join(out, `${code}-pick-draw.json`), JSON.stringify(draw, null, 1));
console.log(`${todo.length} tiles`);
