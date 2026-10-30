/**
 * Thumbnail evidence gate over the modern panorama samples (#120; src/canalRecall/buurtProfiles/thumbEvidence.ts).
 *
 *   node --import tsx scripts/buurt-profiles/thumb-gate.ts [--in=staging/buurt-profiles/pano-samples-modern.json] [--spread]
 *     -> annotates every measured sample with `gate: {pass, reasons, pitch, shadow, agree}` in place (staging only);
 *        derive.ts drops modern samples whose gate failed.
 *
 * Thumbnails come from the pand-reference cache (PAND_REFERENCE_CACHE, default .cache/pand-reference); a sample whose
 * thumbnail is not cached is left without a gate. --spread prints the distributions the thresholds were set on.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { lch } from '../../src/canalRecall/facade/cropWallColour.ts';
import { materialAgrees, shadowShare, thumbPainted, thumbVerdict, thumbView, THUMB_EVIDENCE } from '../../src/canalRecall/buurtProfiles/thumbEvidence.ts';

const IN = process.argv.find(a => a.startsWith('--in='))?.slice(5) ?? 'staging/buurt-profiles/pano-samples-modern.json';
const CACHE = path.resolve(process.env.PAND_REFERENCE_CACHE ?? '.cache/pand-reference');
const doc = JSON.parse(fs.readFileSync(IN, 'utf8'));
const rows: any[] = [];
let missing = 0;
for (const s of doc.samples as any[]) {
  if (s.skipped || !s.wall) continue;
  const file = path.join(CACHE, crypto.createHash('sha1').update(s.url).digest('hex') + '.jpg');
  if (!fs.existsSync(file)) { missing++; continue; }
  const { data, info } = await sharp(file).extract({ left: 64, top: 48, width: 192, height: 192 }).raw().toBuffer({ resolveWithObject: true });
  const view = thumbView(s.url)!, { shadow } = shadowShare(data, info.channels);
  const painted = thumbPainted(s.wall, true), agree = materialAgrees(s.family, painted);
  const v = thumbVerdict({ distM: s.distM, pitch: view.pitch, shadow, agree });
  s.gate = { pass: v.pass, reasons: v.reasons, pitch: view.pitch, shadow, agree };
  rows.push({ s, L: lch(painted ? s.wall : s.brick).L, painted });
}
fs.writeFileSync(IN, JSON.stringify(doc));
const pass = rows.filter(r => r.s.gate.pass).length;
console.log(`thumb gate: ${rows.length} measured (${missing} uncached), ${pass} pass, ${rows.length - pass} fail`);
const why: Record<string, number> = {};
for (const r of rows) for (const k of r.s.gate.reasons) { const key = k.replace(/[\d.]+/g, '#'); why[key] = (why[key] ?? 0) + 1; }
console.log('reasons', JSON.stringify(why));
const hh = rows.find(r => r.s.pand === '0363100012185423');
if (hh) console.log('Haarlemmer Houttuinen 0363100012185423:', JSON.stringify(hh.s.gate), 'wall', hh.s.wall, hh.painted ? 'paint' : 'brick');

if (process.argv.includes('--spread')) {
  const med = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b.length ? +b[b.length >> 1].toFixed(1) : NaN; };
  const q = (a: number[], p: number) => { const b = [...a].sort((x, y) => x - y); return +b[Math.min(b.length - 1, Math.floor(p * b.length))].toFixed(3); };
  const table = (label: string, key: (r: any) => number, edges: number[]) => {
    console.log(`\n${label}: bin  n  brick-L(median)  paint-L(median)  shadow(median)  disagree%`);
    for (let i = 0; i + 1 < edges.length; i++) {
      const b = rows.filter(r => key(r) >= edges[i] && key(r) < edges[i + 1]);
      if (!b.length) continue;
      console.log(`  ${edges[i]}-${edges[i + 1]}  ${b.length}  ${med(b.filter(r => !r.painted).map(r => r.L))}  ${med(b.filter(r => r.painted).map(r => r.L))}  ${med(b.map(r => r.s.gate.shadow))}  ${Math.round(100 * b.filter(r => !r.s.gate.agree).length / b.length)}`);
    }
  };
  table('pitch deg', r => r.s.gate.pitch, [5, 15, 20, 25, 30, 35, 40, 46]);
  table('distance m', r => r.s.distM, [4, 6, 8, 10, 12, 15, 20, 26]);
  table('shadow share', r => r.s.gate.shadow, [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.6, 1.01]);
  const sh = rows.map(r => r.s.gate.shadow);
  console.log('\nshadow quantiles p50/p75/p90/p95', [0.5, 0.75, 0.9, 0.95].map(p => q(sh, p)).join(' '), ' thresholds', JSON.stringify(THUMB_EVIDENCE));
}

// --sheet=<out.jpg>: Haarlemmer Houttuinen plus the first rejected and passed samples of its buurt, the measured centre
// box outlined, the gate's numbers and the wall swatch derive would draw under each.
const sheetOut = process.argv.find(a => a.startsWith('--sheet='))?.slice(8);
if (sheetOut) {
  const hh = rows.find(r => r.s.pand === '0363100012185423');
  const buurt = hh?.s.buurt ?? rows[0].s.buurt, inB = rows.filter(r => r.s.buurt === buurt && r !== hh);
  const pick = [...(hh ? [hh] : []), ...inB.filter(r => !r.s.gate.pass).slice(0, 4), ...inB.filter(r => r.s.gate.pass).slice(0, 5)];
  const T = 200, CAP = 70, cols = 5, tiles: sharp.OverlayOptions[] = [];
  for (const [k, r] of pick.entries()) {
    const file = path.join(CACHE, crypto.createHash('sha1').update(r.s.url).digest('hex') + '.jpg');
    const img = await sharp(file).resize(T, T).toBuffer(), sc = T / 320, g = r.s.gate, ok = g.pass;
    const hex = (c: number[]) => `rgb(${c.join(',')})`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${T}" height="${T + CAP}"><rect x="${64 * sc}" y="${48 * sc}" width="${192 * sc}" height="${192 * sc}" fill="none" stroke="${ok ? '#1a9850' : '#d73027'}" stroke-width="2"/>`
      + `<rect x="${T - 34}" y="4" width="30" height="30" fill="${hex(r.painted ? r.s.wall : r.s.brick)}" stroke="#fff"/>`
      + `<text x="2" y="${T + 14}" font-size="12" font-family="Arial" font-weight="bold" fill="${ok ? '#1a9850' : '#d73027'}">${ok ? 'PASS' : 'REJECT'} ${r.s.pand.slice(-6)} (${r.s.year})</text>`
      + `<text x="2" y="${T + 28}" font-size="10" font-family="Arial" fill="#222">${r.s.distM} m, pitch ${g.pitch}, shadow ${Math.round(g.shadow * 100)} %</text>`
      + `<text x="2" y="${T + 41}" font-size="10" font-family="Arial" fill="#222">family ${r.s.family ?? '-'} / derive ${r.painted ? 'paint' : 'brick'}</text>`
      + (ok ? '' : `<text x="2" y="${T + 54}" font-size="9" font-family="Arial" fill="#d73027">${g.reasons.join('; ').replace(/&/g, '&amp;').slice(0, 52)}</text>`) + '</svg>';
    const tile = await sharp({ create: { width: T, height: T + CAP, channels: 3, background: '#ffffff' } }).composite([{ input: img, left: 0, top: 0 }, { input: Buffer.from(svg), left: 0, top: 0 }]).png().toBuffer();
    tiles.push({ input: tile, left: (k % cols) * (T + 8), top: Math.floor(k / cols) * (T + CAP + 8) });
  }
  await sharp({ create: { width: cols * (T + 8), height: Math.ceil(pick.length / cols) * (T + CAP + 8), channels: 3, background: '#ffffff' } }).composite(tiles).jpeg({ quality: 82 }).toFile(sheetOut);
  console.log(`sheet ${sheetOut}: ${pick.length} samples of buurt ${buurt}`);
}
