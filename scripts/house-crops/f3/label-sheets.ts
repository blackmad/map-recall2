/**
 * F3 (#381): blind label sheets. Input: a JSON list [{key, file}] (key = whatever the caller wants back; it never appears on a sheet).
 * The crops are shuffled with --seed, drawn 4 x 3 per sheet with only a sheet-local number, and the number -> key map is written beside
 * the sheets (map.json). A labeller reads the sheets and writes {"<sheet>-<n>": "good"|"marginal"|"bad"}.
 *
 *   node --import tsx scripts/house-crops/f3/label-sheets.ts --list items.json --out <dir> [--seed 1] [--per 12]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
export function shuffle<T>(xs: T[], seed: number): T[] {
  let s = seed >>> 0; const r = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a;
}
async function main() {
  const items: { key: string; file: string }[] = JSON.parse(fs.readFileSync(arg('list')!, 'utf8')), out = arg('out')!, per = Number(arg('per', '12')), cols = 4, TW = 300, TH = 400, pad = 8;
  fs.mkdirSync(out, { recursive: true });
  const order = shuffle(items, Number(arg('seed', '1'))), map: Record<string, string> = {};
  for (let s = 0; s * per < order.length; s++) {
    const chunk = order.slice(s * per, (s + 1) * per), rows = Math.ceil(chunk.length / cols), cells: sharp.OverlayOptions[] = [];
    for (let i = 0; i < chunk.length; i++) {
      const id = `${s + 1}-${i + 1}`; map[id] = chunk[i].key;
      const x = (i % cols) * (TW + pad) + pad, y = Math.floor(i / cols) * (TH + pad + 22) + pad;
      const img = await sharp(chunk[i].file).resize({ width: TW, height: TH, fit: 'inside' }).png().toBuffer();
      cells.push({ input: Buffer.from(`<svg width="${TW}" height="22"><text x="2" y="17" font-family="Helvetica, Arial" font-size="16" font-weight="bold" fill="#111">#${id}</text></svg>`), left: x, top: y });
      cells.push({ input: img, left: x, top: y + 22 });
    }
    await sharp({ create: { width: cols * (TW + pad) + pad, height: rows * (TH + pad + 22) + pad, channels: 3, background: '#e8e8e4' } }).composite(cells).jpeg({ quality: 82 }).toFile(path.join(out, `sheet-${String(s + 1).padStart(2, '0')}.jpg`));
  }
  fs.writeFileSync(path.join(out, 'map.json'), JSON.stringify(map, null, 1));
  console.log(`${order.length} crops on ${Math.ceil(order.length / per)} sheets in ${out}`);
}
if (process.argv[1]?.endsWith('f3/label-sheets.ts')) await main();
