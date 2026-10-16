// Before | after sheet for the sunny look, with the region numbers of scripts/look/sunny-frames.ts.
//   npx tsx scripts/look/sunny-sheet.ts <before> <after> <out.jpg> [--zoom=<place>:<x>,<y>,<w>,<h>;...] [--zoom-out=out.jpg]
// <before>/<after> hold <place>.png and the stats JSON written by sunny-frames.ts --json (after.json carries both).
import fs from 'node:fs';
import sharp from 'sharp';

const [beforeDir, afterDir, out] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const statsFile = process.argv.find(a => a.startsWith('--stats='))?.slice(8);
const zoomArg = process.argv.find(a => a.startsWith('--zoom='))?.slice(7);
const zoomOut = process.argv.find(a => a.startsWith('--zoom-out='))?.slice(11);
const stats = statsFile ? JSON.parse(fs.readFileSync(statsFile, 'utf8')) : null;
const places = ['singelgracht', 'kinkerstraat', 'janevertsen', 'prinsengracht', 'entrepotdok', 'apollolaan', 'horizon'];
const TW = 520, TH = 325, LABEL = 22, PAD = 6;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const label = (text: string, w: number) => Buffer.from(`<svg width="${w}" height="${LABEL}"><rect width="100%" height="100%" fill="#111"/><text x="6" y="16" font-family="Helvetica" font-size="13" fill="#eee">${esc(text)}</text></svg>`);
const line = (s: any) => (s ? `${s.luma}/${s.chroma}` : '–');
const summary = (side: 'before' | 'after', p: string) => {
  const s = stats?.[side]?.[p]; if (!s) return '';
  return `wall ${line(s.wall)} · roof ${line(s.roof)} · paved ${line(s.paved)} · water ${line(s.water)}${s.sky ? ` · sky ${line(s.sky)}` : ''} · frame ${line(s.frame)}`;
};
const composites: sharp.OverlayOptions[] = [];
let y = 0;
for (const p of places) {
  for (const [i, dir, side] of [[0, beforeDir, 'before'], [1, afterDir, 'after']] as const) {
    const x = i * (TW + PAD);
    composites.push({ input: label(`${p} — ${side === 'before' ? 'before (legacy light)' : 'after (sunny)'}   ${summary(side, p)}`, TW), left: x, top: y });
    composites.push({ input: await sharp(`${dir}/${p}.png`).resize(TW, TH).toBuffer(), left: x, top: y + LABEL });
  }
  y += LABEL + TH + PAD;
}
await sharp({ create: { width: TW * 2 + PAD, height: y, channels: 3, background: '#000' } }).composite(composites).jpeg({ quality: 66, mozjpeg: true }).toFile(out);
console.log(out, fs.statSync(out).size);

// 2x zoom crops of facades: before | after per crop, from the full-resolution frames.
if (zoomArg && zoomOut) {
  const rows: sharp.OverlayOptions[] = [];
  let zy = 0, width = 0;
  for (const spec of zoomArg.split(';')) {
    const [p, box] = spec.split(':'), [cx, cy, cw, ch] = box.split(',').map(Number);
    for (const [i, dir, side] of [[0, beforeDir, 'before'], [1, afterDir, 'after']] as const) {
      const img = await sharp(`${dir}/${p}.png`).extract({ left: cx, top: cy, width: cw, height: ch }).resize(cw * 2, ch * 2, { kernel: 'nearest' }).toBuffer();
      rows.push({ input: label(`${p} 2x — ${side}`, cw * 2), left: i * (cw * 2 + PAD), top: zy });
      rows.push({ input: img, left: i * (cw * 2 + PAD), top: zy + LABEL });
      width = Math.max(width, 2 * (cw * 2) + PAD);
    }
    zy += LABEL + ch * 2 + PAD;
  }
  await sharp({ create: { width, height: zy, channels: 3, background: '#000' } }).composite(rows).jpeg({ quality: 78, mozjpeg: true }).toFile(zoomOut);
  console.log(zoomOut, fs.statSync(zoomOut).size);
}
