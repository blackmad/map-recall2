/**
 * Blind labelling sheets (H4b): numbered tiles with no flags or verdicts, so a human (or a judging session) calls each crop
 * good / marginal / bad by eye. Writes artifacts/house-crops/label/<code>-<n>.png and <code>-draw.json (tile number -> pand id).
 *   node --import tsx scripts/house-crops/label-sheet.ts --buurt AB07 --archive <dir> [--seed 5] [--total 150] [--per-sheet 30] [--include id,id,...] [--tag -1y]
 * `--include` pands go first (the earlier-judged sets), the rest is a seeded random draw from the buurt's made crops.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import { manifestPath, type Manifest } from './manifest.ts';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const code = arg('buurt')!, tag = arg('tag', '') ?? '', archive = path.resolve(arg('archive') ?? process.env.HOUSE_CROPS_ARCHIVE ?? ''), total = Number(arg('total', '150')), per = Number(arg('per-sheet', '30'));
const m: Manifest = JSON.parse(await fs.readFile(manifestPath(code), 'utf8'));
const made = Object.entries(m.pands).filter(([, e]) => e.status === 'ok').map(([id]) => id);
const include = (arg('include', '') ?? '').split(',').filter(Boolean).filter(id => made.includes(id));
const rest = made.filter(id => !include.includes(id)), r = rng(Number(arg('seed', '5')));
for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
const ids = [...include, ...rest.slice(0, Math.max(0, total - include.length))];
const cols = 6, T = 330, out = path.resolve('artifacts/house-crops/label');
await fs.mkdir(out, { recursive: true });
const draw: Record<string, { sheet: number; tile: number; panoIds: string[]; date?: string }> = {};
for (let s = 0; s * per < ids.length; s++) {
  const chunk = ids.slice(s * per, (s + 1) * per), tiles: OverlayOptions[] = [];
  for (const [i, id] of chunk.entries()) {
    const x = (i % cols) * T, y = Math.floor(i / cols) * T, n = s * per + i + 1;
    const img = await sharp(path.join(archive, m.pands[id].archive!, 'front.jpg')).resize(T - 4, T - 4, { fit: 'contain', background: '#1f2328' }).extend({ top: 2, bottom: 2, left: 2, right: 2, background: '#555' }).png().toBuffer();
    const svg = `<svg width="60" height="26" xmlns="http://www.w3.org/2000/svg"><rect width="60" height="26" fill="#000" opacity="0.7"/><text x="6" y="19" font-family="Helvetica" font-size="18" fill="#ffd400">${n}</text></svg>`;
    tiles.push({ input: img, left: x, top: y }, { input: Buffer.from(svg), left: x + 4, top: y + 4 });
    draw[id] = { sheet: s + 1, tile: n, panoIds: m.pands[id].panoIds ?? [], date: m.pands[id].date };
  }
  await sharp({ create: { width: cols * T, height: Math.ceil(chunk.length / cols) * T, channels: 3, background: '#1f2328' } }).composite(tiles).png().toFile(path.join(out, `${code}${tag}-${s + 1}.png`));
}
await fs.writeFile(path.join(out, `${code}${tag}-draw.json`), JSON.stringify(draw, null, 1));
console.log(`${ids.length} tiles in ${Math.ceil(ids.length / per)} sheets under ${out}`);
