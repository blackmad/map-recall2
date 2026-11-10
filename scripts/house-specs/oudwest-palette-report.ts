/**
 * Report and visual pairs for oudwest-palette.ts (lane #373): measured vs drawn table, per-archetype summary, the
 * proposal and its dL distribution, the unstated-material side count, and six panorama / swatch pairs.
 * The proposal is DATA here (`PROPOSAL_BOOST_L`, derived entries); it is applied only through `drawnToday`'s `wallOf`
 * hook, so no runtime default changes.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { drawnToday, lch } from './oudwest-palette.ts';
import { labToRgb, rgbToLab } from '../../src/canalRecall/look/brickTone.ts';
import { PERIOD_WALLS, hexToRgb, rgbToHex, hslToRgb, rgbToHsl } from '../../src/canalRecall/look/palette.ts';
import { scaleLinear } from '../../src/canalRecall/look/sunny.ts';
import { cityLookTint } from '../../src/canalRecall/look/cityLook.ts';
import { photoMatchedWallTint } from '../../src/canalRecall/look/chunkWallExposure.ts';

/** How much brighter than the overcast panorama the game should draw a brick wall (L*): the brighter-palette priority (2026-10-16). */
export const PROPOSAL_BOOST_L = 6;
/** Linear-light gain on a buurt profile's dark brick walls (profile pool mean L* 48 against 30 measured on the same pands). */
export const PROFILE_GAIN = Number(process.env.PROFILE_GAIN ?? 0.4);
const drawToday = (wall: string) => photoMatchedWallTint('brick', cityLookTint('brick', wall), null, null);
/**
 * Proposed lift (non-default, this file only): cityWallTint is l' = clamp(0.12 + 0.9 l, 0.3, 0.6), which maps a dark
 * purple-brown (HSL l 0.2) to 0.30 and cannot draw darker than the 0.3 floor. The proposal keeps order and the saturation
 * clamp but lifts dark brick by a small offset only: l' = clamp(l + LIFT_OFFSET, LIFT_FLOOR, 0.6), applied to walls below
 * PALE_L (0.62); a pale render, white or buff takes today's tint unchanged (byte-identical).
 */
export const LIFT_OFFSET = 0.05, LIFT_FLOOR = 0.14, PALE_L = 0.62;
export function proposedTint(wall: string): string {
  const [h, s, l] = rgbToHsl(hexToRgb(wall));
  if (l >= PALE_L || !isBrickFamily(wall)) return cityLookTint('brick', wall);
  return rgbToHex(hslToRgb([h, Math.min(0.5, Math.max(0.12, s)), Math.min(0.6, Math.max(LIFT_FLOOR, l + LIFT_OFFSET))]));
}
const drawProposed = (wall: string) => photoMatchedWallTint('brick', proposedTint(wall), null, null);
const drawHex = drawProposed;
const labOf = (hex: string) => rgbToLab(hexToRgb(hex));
const q = (v: number[], p: number) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / Math.max(1, v.length);
const dHue = (a: number, b: number) => ((a - b + 540) % 360) - 180;

/** The wall hex whose DRAWN colour (HSL l >= 0.3: below it cityWallTint's floor makes every hex draw alike, so the floor itself limits how dark a palette entry can draw) (the runtime's tint chain) is closest in Lab to `target`. Grid search over HSL. */
export function wallForDrawn(target: [number, number, number]): string {
  let best = '#000000', bd = Infinity;
  for (let h = 0; h < 360; h += 3) for (let s = 0.08; s <= 0.7; s += 0.04) for (let l = 0.3; l <= 0.9; l += 0.01) {
    const hex = rgbToHex(hslToRgb([h, s, l])), d = labOf(drawHex(hex)), e = (d[0] - target[0]) ** 2 + (d[1] - target[1]) ** 2 + (d[2] - target[2]) ** 2;
    if (e < bd) { bd = e; best = hex; }
  }
  return best;
}
/** Pale render, buff and white keep today's wall: the proposal touches only walls darker than HSL l 0.62 (the same PALE_L cut sunlitPeriodWall uses), except light buff (l >= 0.5, h 35-65). */
export const isBrickFamily = (hex: string) => { const [h, s, l] = rgbToHsl(hexToRgb(hex)); return l < 0.62 && !(l >= 0.5 && s >= 0.3 && h >= 35 && h <= 65); };

export async function run(cmd: string, ctx: { STAGE: string; arg: (n: string, d?: string) => string }) {
  const { STAGE } = ctx;
  const m = JSON.parse(fs.readFileSync(path.join(STAGE, 'measured.json'), 'utf8')) as { rows: any[]; skipped: any[] };
  const rows = m.rows.map(r => {
    const d = drawnToday(r.pandId, r.year, r.heightM, r.lng, r.lat), me = lch(r.measuredHex), dr = lch(d.drawn);
    return { ...r, ...d, me, dr, dL: dr.L - me.L, dH: dHue(dr.h, me.h), dC: dr.C - me.C };
  });
  // Proposal A: replace the brick entries of PERIOD_WALLS.photo.c19 by walls drawn at measured quantiles + BOOST (chroma x1.5, haze).
  const c19 = PERIOD_WALLS.photo.c19!, keep = (hex: string) => !isBrickFamily(hex);
  const meas = rows.map(r => ({ L: r.me.L, a: labOf(r.measuredHex)[1], b: labOf(r.measuredHex)[2] })).sort((x, y) => x.L - y.L);
  const slots = c19.map((h, i) => ({ h, i })).filter(x => !keep(x.h));
  const uniq = [...new Set(slots.map(x => x.h))];
  const entries = new Map<string, string>();
  uniq.forEach((h, k) => {
    const p = meas[Math.min(meas.length - 1, Math.floor(((k + 0.5) / uniq.length) * meas.length))];
    entries.set(h, wallForDrawn([p.L + PROPOSAL_BOOST_L, p.a * 1.4, p.b * 1.4]));
  });
  const proposedPeriod = c19.map(h => entries.get(h) ?? h);
  const wallOf = (hex: string, _arch: string, profile: boolean) => profile ? (isBrickFamily(hex) ? scaleLinear(hex, PROFILE_GAIN) : hex) : (entries.get(hex) ?? hex);
  const prop = rows.map(r => {
    const d = drawnToday(r.pandId, r.year, r.heightM, r.lng, r.lat, (hex, a) => wallOf(hex, a, r.profileHex !== null && hex === r.profileHex), drawProposed);
    const dr = lch(d.drawn); return { ...r, prop: d.drawn, pdr: dr, pdL: dr.L - r.me.L, pdH: dHue(dr.h, r.me.h) };
  });
  // Proposal A on its own: the period palette pick with no buurt profile (what a pand outside every profile draws).
  const periodRows = rows.map(r => ({ me: r.me, today: lch(drawToday(r.periodHex)).L, prop: lch(drawProposed(entries.get(r.periodHex) ?? r.periodHex)).L })).map(x => ({ dL0: x.today - x.me.L, dL1: x.prop - x.me.L }));
  // Report
  const f = (x: number, n = 1) => x.toFixed(n);
  const out: string[] = [];
  out.push(`# Oud-West / De Baarsjes palette measurement (${rows.length} brick pands)\n`);
  out.push('| pand | buurt | year | arch | stated | pano date | measured | L | C | h | drawn today | L | C | h | dL | dHue | source |');
  out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) out.push(`| ${r.pandId} | ${r.buurt} | ${r.year} | ${r.archetype} | ${r.stated}${r.relaxed ? ' RELAXED' : ''} | ${r.date} | ${r.measuredHex} | ${f(r.me.L)} | ${f(r.me.C)} | ${f(r.me.h, 0)} | ${r.drawn} | ${f(r.dr.L)} | ${f(r.dr.C)} | ${f(r.dr.h, 0)} | ${f(r.dL)} | ${f(r.dH, 0)} | ${r.profileHex ? 'profile' : 'period'} |`);
  const summ = (label: string, rs: any[], k: 'dL' | 'pdL' = 'dL') => `${label}: n ${rs.length}, mean dL ${f(mean(rs.map(r => r[k])))}, median ${f(q(rs.map(r => r[k]), 0.5))}, p10 ${f(q(rs.map(r => r[k]), 0.1))}, p90 ${f(q(rs.map(r => r[k]), 0.9))}, mean |dL| ${f(mean(rs.map(r => Math.abs(r[k]))))}`;
  out.push('\n## Summary by archetype and wall source (today)');
  for (const a of [...new Set(rows.map(r => r.archetype))]) for (const src of ['profile', 'period']) { const rs = rows.filter(r => r.archetype === a && (r.profileHex ? 'profile' : 'period') === src); if (rs.length) out.push(`- ${a} / ${src}: ` + summ('dL', rs) + `, mean dHue ${f(mean(rs.map(r => r.dH)), 0)}, mean dC ${f(mean(rs.map(r => r.dC)))}`); }
  out.push(`- all: ${summ('dL', rows)}; mean measured L ${f(mean(rows.map(r => r.me.L)))} C ${f(mean(rows.map(r => r.me.C)))}, mean drawn L ${f(mean(rows.map(r => r.dr.L)))} C ${f(mean(rows.map(r => r.dr.C)))}`);
  out.push('\n## Proposal');
  out.push(`PERIOD_WALLS.photo.c19 today:    ${c19.join(' ')}`);
  out.push(`PERIOD_WALLS.photo.c19 proposed: ${proposedPeriod.join(' ')}`);
  out.push('replaced: ' + [...entries].map(([a, b]) => `${a} -> ${b}`).join(', ') + '; untouched: ' + [...new Set(c19.filter(keep))].join(' '));
  out.push(`profile brick walls: linear-light gain ${PROFILE_GAIN} before the lift (pale, buff and grey-pale profile walls untouched).`);
  out.push(`lift: walls below HSL l ${PALE_L} (except light buff) take l' = clamp(l + ${LIFT_OFFSET}, ${LIFT_FLOOR}, 0.6) instead of cityWallTint's clamp(0.12 + 0.9 l, 0.3, 0.6); paler walls keep today's tint.`);
  const sp = (k: 'dL0' | 'dL1') => `n ${periodRows.length}, mean dL ${f(mean(periodRows.map(r => r[k])))}, median ${f(q(periodRows.map(r => r[k]), 0.5))}, p10 ${f(q(periodRows.map(r => r[k]), 0.1))}, p90 ${f(q(periodRows.map(r => r[k]), 0.9))}`;
  out.push('Proposal A alone (period palette pick, no profile) against the same measurements:');
  out.push('  today:    ' + sp('dL0')); out.push('  proposed: ' + sp('dL1'));
  out.push('Proposal A + B (what a profiled pand draws; all 59 here are profiled):');
  out.push(summ('today   ', prop, 'dL') + `, mean |dHue| ${f(mean(prop.map(r => Math.abs(r.dH))), 0)}`);
  out.push(summ('proposed', prop, 'pdL') + `, mean |dHue| ${f(mean(prop.map(r => Math.abs(r.pdH))), 0)}`);
  const hist = (k: 'dL' | 'pdL') => { const bins = new Map<number, number>(); for (const r of prop) { const b = Math.round(r[k] / 5) * 5; bins.set(b, (bins.get(b) ?? 0) + 1); } return [...bins].sort((a, b) => a[0] - b[0]).map(([b, n]) => `${b >= 0 ? '+' : ''}${b}:${n}`).join(' '); };
  out.push(`dL histogram (5 L* bins) today: ${hist('dL')}`); out.push(`dL histogram proposed:          ${hist('pdL')}`);
  // Non-brick drawn colours must not move: stucco, white, buff
  const probes = ['#e2d5ba', '#d9c5a4', '#d3b184', '#f2f2ee', '#e4ddcd', '#d8d8d2', '#c9b79a'];
  out.push('\nunchanged check (drawn today vs proposed for stucco / white / buff walls): ' + probes.map(h => `${h} ${drawToday(h)} -> ${drawHex(wallOf(h, 'c19', false))}${drawToday(h) === drawHex(wallOf(h, 'c19', false)) ? ' same' : ' CHANGED'}`).join('; '));
  // Side count: unstated material
  out.push('\n## Unstated-material side count (no spec wallMaterial, no register finish)');
  const sk = m.skipped.filter(s => s.kind), unst = (s: any) => s.stated === 'none';
  const nBrick = rows.filter(unst).length, nLight = sk.filter(s => unst(s) && s.kind === 'render-light').length, nGrey = sk.filter(s => unst(s) && s.kind === 'render-grey').length;
  const other = m.skipped.filter(s => !s.kind && s.why);
  out.push(`unstated, measurable: brick ${nBrick}, pale render/paint (L* >= 62) ${nLight}, grey/neutral (C* < 4) ${nGrey}; share brick ${f(100 * nBrick / Math.max(1, nBrick + nLight + nGrey), 0)} %. Stated brick (spec or register): ${rows.filter(r => !unst(r)).length}. Unmeasurable (washed out, foliage, no pano): ${other.length}.`);
  fs.writeFileSync(path.join(STAGE, 'report.md'), out.join('\n'));
  fs.writeFileSync(path.join(STAGE, 'report.json'), JSON.stringify({ rows: prop, entries: [...entries], proposedPeriod }, null, 1));
  console.log(out.join('\n'));
  if (cmd !== 'pairs') return;
  const dir = ctx.arg('out', path.join(STAGE, 'pairs')); fs.mkdirSync(dir, { recursive: true });
  // six pairs: spread across the measured L range, preferring a viewable thumbnail
  const have = prop.filter(r => fs.existsSync(path.join(STAGE, 'crops', `${r.pandId}-view.jpg`))).sort((a, b) => a.me.L - b.me.L);
  const picks = [0, 0.2, 0.4, 0.6, 0.8, 1].map(t => have[Math.min(have.length - 1, Math.round(t * (have.length - 1)))]).filter((r, i, a) => a.indexOf(r) === i);
  const names: string[] = [];
  for (const r of picks) {
    const photo = await sharp(path.join(STAGE, 'crops', `${r.pandId}-view.jpg`)).resize(560, 560, { fit: 'cover' }).toBuffer();
    const sw = (hex: string, label: string, x: number) => `<rect x="${x}" y="0" width="180" height="560" fill="${hex}"/><text x="${x + 90}" y="520" font-size="18" font-family="Helvetica,Arial" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="0.6">${label}</text><text x="${x + 90}" y="545" font-size="16" font-family="Helvetica,Arial" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="0.6">${hex}</text>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="560">${sw(r.measuredHex, 'measured', 560)}${sw(r.drawn, 'drawn today', 740)}${sw(r.prop, 'proposed', 920)}</svg>`;
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
