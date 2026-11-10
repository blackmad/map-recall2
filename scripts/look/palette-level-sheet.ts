/**
 * Palette level strips: before | after pairs from the strips run (tests/e2e/palette-level.spec.ts, PALETTE_LEVEL=strips).
 *
 *   node --import tsx scripts/look/palette-level-sheet.ts [--dir=artifacts/palette-level/strips] [--width=560]
 *
 * Writes <dir>/sheet-12.png (the 12 generic-gap spots, before left, after right, two spots per row) and
 * <dir>/pair-<spot>.png for the user poses (da-costakade-user, s3-slab-user) and the landmark (westerkerk).
 */
import fs from 'node:fs';
import sharp from 'sharp';
const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const dir = arg('dir', 'artifacts/palette-level/strips'), W = Number(arg('width', '560'));
const names = fs.readdirSync(dir).filter(f => f.endsWith('-before.png')).map(f => f.replace('-before.png', '')).filter(n => fs.existsSync(`${dir}/${n}-after.png`));
const USER = ['da-costakade-user', 's3-slab-user', 'westerkerk'];
async function pair(name: string) {
  const [a, b] = await Promise.all(['before', 'after'].map(async v => sharp(`${dir}/${name}-${v}.png`).resize({ width: W }).toBuffer({ resolveWithObject: true })));
  const h = Math.max(a.info.height, b.info.height), label = (t: string) => Buffer.from(`<svg width="${W}" height="22"><rect width="${W}" height="22" fill="#000" opacity="0.6"/><text x="6" y="16" font-family="monospace" font-size="14" fill="#fff">${name} ${t}</text></svg>`);
  return sharp({ create: { width: W * 2 + 4, height: h, channels: 3, background: '#222' } })
    .composite([{ input: a.data, left: 0, top: 0 }, { input: b.data, left: W + 4, top: 0 }, { input: label('before (?paletteLevel=0)'), left: 0, top: 0 }, { input: label('after'), left: W + 4, top: 0 }]).png().toBuffer({ resolveWithObject: true });
}
const gap = names.filter(n => !USER.includes(n));
for (const n of names.filter(n => USER.includes(n))) fs.writeFileSync(`${dir}/pair-${n}.png`, (await pair(n)).data);
const cells = await Promise.all(gap.map(pair));
const colW = cells[0].info.width, rows = Math.ceil(cells.length / 2), rowH = Math.max(...cells.map(c => c.info.height));
fs.writeFileSync(`${dir}/sheet-12.png`, await sharp({ create: { width: colW * 2 + 8, height: rows * (rowH + 4), channels: 3, background: '#111' } })
  .composite(cells.map((c, i) => ({ input: c.data, left: (i % 2) * (colW + 8), top: Math.floor(i / 2) * (rowH + 4) }))).png().toBuffer());
console.log('sheet-12.png with', gap.length, 'spots; pairs', names.filter(n => USER.includes(n)).join(', '));
