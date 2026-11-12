/**
 * Report and visual pairs for oudwest-palette.ts (lane #373): measured vs drawn table (today and `?brickLift=v2`), per-archetype
 * summary, dL distributions, the unstated-material side count, and six panorama / swatch pairs. "Drawn" comes from the runtime
 * functions (`drawnToday`: bayLookFor, cityLookTint, photoMatchedWallTint) run twice in one process, with BRICK_LIFT=v1 (the old lift) and
 * the default (v2) (look/brickLift.ts); nothing is re-implemented here.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { drawnToday, lch } from './oudwest-palette.ts';
import { C19_WALLS_V2, resetBrickLiftFlag } from '../../src/canalRecall/look/brickLift.ts';
import { PERIOD_WALLS } from '../../src/canalRecall/look/palette.ts';

const q = (v: number[], p: number) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / Math.max(1, v.length);
const dHue = (a: number, b: number) => ((a - b + 540) % 360) - 180;
const withFlag = <T>(v: string | undefined, f: () => T): T => {
  const prev = process.env.BRICK_LIFT;
  if (v === undefined) delete process.env.BRICK_LIFT; else process.env.BRICK_LIFT = v;
  resetBrickLiftFlag();
  try { return f(); } finally { if (prev === undefined) delete process.env.BRICK_LIFT; else process.env.BRICK_LIFT = prev; resetBrickLiftFlag(); }
};

export async function run(cmd: string, ctx: { STAGE: string; arg: (n: string, d?: string) => string }) {
  const { STAGE } = ctx;
  const m = JSON.parse(fs.readFileSync(path.join(STAGE, 'measured.json'), 'utf8')) as { rows: any[]; skipped: any[] };
  const rows = m.rows.map(r => {
    const off = withFlag('v1', () => drawnToday(r.pandId, r.year, r.heightM, r.lng, r.lat)), on = withFlag(undefined, () => drawnToday(r.pandId, r.year, r.heightM, r.lng, r.lat));
    const me = lch(r.measuredHex), dr = lch(off.drawn), pd = lch(on.drawn);
    return { ...r, ...off, prop: on.drawn, propPeriod: on.periodDrawn, me, dr, pdr: pd, dL: dr.L - me.L, dH: dHue(dr.h, me.h), dC: dr.C - me.C, pdL: pd.L - me.L, pdH: dHue(pd.h, me.h), pdC: pd.C - me.C,
      pDL0: lch(off.periodDrawn).L - me.L, pDL1: lch(on.periodDrawn).L - me.L };
  });
  const f = (x: number, n = 1) => x.toFixed(n);
  const out: string[] = [];
  out.push(`# Oud-West / De Baarsjes palette measurement (${rows.length} brick pands)\n`);
  out.push('| pand | buurt | year | arch | stated | pano date | measured | L | C | h | drawn v1 | L | C | h | dL | dHue | v2 | L | dL v2 | source |');
  out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) out.push(`| ${r.pandId} | ${r.buurt} | ${r.year} | ${r.archetype} | ${r.stated}${r.relaxed ? ' RELAXED' : ''} | ${r.date} | ${r.measuredHex} | ${f(r.me.L)} | ${f(r.me.C)} | ${f(r.me.h, 0)} | ${r.drawn} | ${f(r.dr.L)} | ${f(r.dr.C)} | ${f(r.dr.h, 0)} | ${f(r.dL)} | ${f(r.dH, 0)} | ${r.prop} | ${f(r.pdr.L)} | ${f(r.pdL)} | ${r.profileHex ? 'profile' : 'period'} |`);
  const summ = (label: string, rs: any[], k: string) => `${label}: n ${rs.length}, mean dL ${f(mean(rs.map(r => r[k])))}, median ${f(q(rs.map(r => r[k]), 0.5))}, p10 ${f(q(rs.map(r => r[k]), 0.1))}, p90 ${f(q(rs.map(r => r[k]), 0.9))}, mean |dL| ${f(mean(rs.map(r => Math.abs(r[k]))))}`;
  out.push('\n## Summary by archetype and wall source');
  for (const a of [...new Set(rows.map(r => r.archetype))]) for (const src of ['profile', 'period']) { const rs = rows.filter(r => r.archetype === a && (r.profileHex ? 'profile' : 'period') === src); if (rs.length) { out.push(`- ${a} / ${src} v1: ` + summ('dL', rs, 'dL') + `, mean dHue ${f(mean(rs.map(r => r.dH)), 0)}, mean dC ${f(mean(rs.map(r => r.dC)))}`); out.push(`- ${a} / ${src} v2:    ` + summ('dL', rs, 'pdL') + `, mean dHue ${f(mean(rs.map(r => r.pdH)), 0)}, mean dC ${f(mean(rs.map(r => r.pdC)))}`); } }
  out.push(`- measured mean L ${f(mean(rows.map(r => r.me.L)))} C ${f(mean(rows.map(r => r.me.C)))}; drawn v1 L ${f(mean(rows.map(r => r.dr.L)))} C ${f(mean(rows.map(r => r.dr.C)))}; v2 L ${f(mean(rows.map(r => r.pdr.L)))} C ${f(mean(rows.map(r => r.pdr.C)))}`);
  out.push('\n## v2');
  out.push(`PERIOD_WALLS.photo.c19 v1: ${PERIOD_WALLS.photo.c19!.join(' ')}`); out.push(`C19_WALLS_V2:                 ${C19_WALLS_V2.join(' ')}`);
  out.push('Period pick alone (no profile) against the same measurements:'); out.push('  ' + summ('today', rows, 'pDL0')); out.push('  ' + summ('v2   ', rows, 'pDL1'));
  out.push('Profile + period (what the game draws; all rows here are profiled):'); out.push('  ' + summ('today', rows, 'dL') + `, mean |dHue| ${f(mean(rows.map(r => Math.abs(r.dH))), 0)}`); out.push('  ' + summ('v2   ', rows, 'pdL') + `, mean |dHue| ${f(mean(rows.map(r => Math.abs(r.pdH))), 0)}`);
  const hist = (k: string) => { const bins = new Map<number, number>(); for (const r of rows) { const b = Math.round(r[k] / 5) * 5; bins.set(b, (bins.get(b) ?? 0) + 1); } return [...bins].sort((a, b) => a[0] - b[0]).map(([b, n]) => `${b >= 0 ? '+' : ''}${b}:${n}`).join(' '); };
  out.push(`dL histogram (5 L* bins) v1: ${hist('dL')}`); out.push(`dL histogram v2:                ${hist('pdL')}`);
  out.push('\n## Unstated-material side count (no spec wallMaterial, no register finish)');
  const sk = m.skipped.filter(s => s.kind), unst = (s: any) => s.stated === 'none';
  const nBrick = rows.filter(unst).length, nLight = sk.filter(s => unst(s) && s.kind === 'render-light').length, nGrey = sk.filter(s => unst(s) && s.kind === 'render-grey').length;
  out.push(`unstated, measurable: brick ${nBrick}, pale render/paint (L* >= 62) ${nLight}, grey/neutral (C* < 4) ${nGrey}; share brick ${f(100 * nBrick / Math.max(1, nBrick + nLight + nGrey), 0)} %. Stated brick (spec or register): ${rows.filter(r => !unst(r)).length}. Unmeasurable (washed out, foliage, no pano): ${m.skipped.filter(s => !s.kind && s.why).length}.`);
  fs.writeFileSync(path.join(STAGE, 'report.md'), out.join('\n'));
  fs.writeFileSync(path.join(STAGE, 'report.json'), JSON.stringify({ rows }, null, 1));
  console.log(out.join('\n'));
  if (cmd !== 'pairs') return;
  const dir = ctx.arg('out', path.join(STAGE, 'pairs')); fs.mkdirSync(dir, { recursive: true });
  // six pairs: spread across the measured L range, preferring a viewable thumbnail
  const have = rows.filter(r => fs.existsSync(path.join(STAGE, 'crops', `${r.pandId}-view.jpg`))).sort((a, b) => a.me.L - b.me.L);
  const picks = [0, 0.2, 0.4, 0.6, 0.8, 1].map(t => have[Math.min(have.length - 1, Math.round(t * (have.length - 1)))]).filter((r, i, a) => a.indexOf(r) === i);
  const names: string[] = [];
  for (const r of picks) {
    const photo = await sharp(path.join(STAGE, 'crops', `${r.pandId}-view.jpg`)).resize(560, 560, { fit: 'cover' }).toBuffer();
    const sw = (hex: string, label: string, x: number) => `<rect x="${x}" y="0" width="180" height="560" fill="${hex}"/><text x="${x + 90}" y="520" font-size="18" font-family="Helvetica,Arial" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="0.6">${label}</text><text x="${x + 90}" y="545" font-size="16" font-family="Helvetica,Arial" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="0.6">${hex}</text>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="560">${sw(r.measuredHex, 'measured', 560)}${sw(r.drawn, 'drawn v1', 740)}${sw(r.prop, 'proposed', 920)}</svg>`;
    const file = `${r.pandId}-${r.buurt.replace(/[^A-Za-z]+/g, '-')}.jpg`;
    await sharp({ create: { width: 1100, height: 560, channels: 3, background: '#fff' } }).composite([{ input: photo, left: 0, top: 0 }, { input: Buffer.from(svg), left: 0, top: 0 }]).jpeg({ quality: 82 }).toFile(path.join(dir, file));
    names.push(file);
  }
  console.log('pairs:', names.join(', '));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
  await run(process.argv[2] ?? 'report', { STAGE: path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../staging/oudwest-palette'), arg });
}
