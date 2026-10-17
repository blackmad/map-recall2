/**
 * Side-by-side sheets of two overview-colours.ts runs: one row per zoom, before on the left, after on the right.
 *
 *   node --import tsx scripts/look/overview-colours-sheet.ts artifacts/overview-tiles/before artifacts/overview-tiles/after
 *     [--width=960] → <after>/sheet-<spot>.jpg
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [a, b] = process.argv.slice(2).filter(s => !s.startsWith('--'));
const W = Number(process.argv.find(s => s.startsWith('--width='))?.slice(8) ?? '960'), H = Math.round(W * 0.625);
const frames = (dir: string) => fs.readdirSync(dir).filter(f => f.endsWith('.png'));
const spots = [...new Set(frames(b).map(f => f.replace(/-(z[\d.]+|ride)\.png$/, '')))];
const zoomOf = (f: string) => (f.endsWith('-ride.png') ? 99 : Number(/-z([\d.]+)\.png$/.exec(f)![1]));
for (const spot of spots) {
  const rows = frames(b).filter(f => f.startsWith(`${spot}-`) && fs.existsSync(path.join(a, f))).sort((p, q) => zoomOf(p) - zoomOf(q));
  const comps: sharp.OverlayOptions[] = [];
  for (const [i, f] of rows.entries()) {
    for (const [j, dir] of [a, b].entries()) comps.push({ input: await sharp(path.join(dir, f)).resize(W, H).toBuffer(), left: j * (W + 8), top: i * (H + 8) });
    const label = Buffer.from(`<svg width="${2 * W + 8}" height="40"><rect width="330" height="34" fill="rgba(0,0,0,.65)"/><text x="10" y="25" font-size="22" font-family="Helvetica" fill="#fff">${f.replace('.png', '')}  before | after</text></svg>`);
    comps.push({ input: label, left: 0, top: i * (H + 8) + H - 40 });
  }
  const out = path.join(b, `sheet-${spot}.jpg`);
  await sharp({ create: { width: 2 * W + 8, height: rows.length * (H + 8), channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 82 }).toFile(out);
  console.log(out);
}
