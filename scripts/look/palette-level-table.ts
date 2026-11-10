/**
 * Palette level (lane palette-level, 2026-11-09): the rendered-minus-measured wall table, in Node.
 *
 *   node --import tsx scripts/look/palette-level-table.ts [--transfer=artifacts/palette-level/transfer.json] [--out=artifacts/palette-level/table.json] [--level=0|1]
 *
 * "Measured" = the buurt profiles' wall swatches (buurtProfiles/buurt-profiles.json, weighted by the fronts each swatch
 * stands for: the 3,6xx photo fronts after derive.ts brought every source onto one frame). The generic walls draw that
 * swatch as the tint, so "rendered" = the browser-measured transfer of a tint (artifacts/palette-level/transfer.json,
 * tests/e2e/palette-level.spec.ts) fitted per channel (look/paletteLevel.ts fitTransfer) and applied to every swatch,
 * on the sun side and on the shade side. Per era x family (brick, painted, stone): median and p10/p90 of dL*, dC*.
 */
import fs from 'node:fs';
import { rgbToLab, labToRgb } from '../../src/canalRecall/look/brickTone.ts';
import { hexToRgb } from '../../src/canalRecall/look/palette.ts';
import { fitTransfer, applyTransfer, levelWallHex, type TransferRow } from '../../src/canalRecall/look/paletteLevel.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const transfer = JSON.parse(fs.readFileSync(arg('transfer', 'artifacts/palette-level/transfer.json'), 'utf8')) as { rows: Record<string, TransferRow> };
const level = arg('level', '0') === '1';
const profiles = JSON.parse(fs.readFileSync('src/canalRecall/buurtProfiles/buurt-profiles.json', 'utf8')).profiles as any[];
const fit = fitTransfer(transfer.rows);

type Fam = 'brick' | 'painted' | 'stone';
const lchOf = (rgb: readonly number[]) => { const [L, a, b] = rgbToLab(rgb); return { L, C: Math.hypot(a, b), h: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360 }; };
/** derive.ts photoPainted: light near-neutral render, or a mid cool grey-green; other near-neutral mid greys are stone. */
export function familyOf(rgb: readonly number[]): Fam {
  const c = lchOf(rgb);
  if ((c.L >= 62 && c.C < 14) || (c.L >= 40 && c.h > 100 && c.h < 250 && c.C < 12)) return 'painted';
  if (c.C < 6) return 'stone';
  return 'brick';
}
const pct = (v: number[], p: number) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
type Acc = { dL: number[]; dC: number[]; w: number[] };
const acc = new Map<string, Acc>();
const add = (k: string, dL: number, dC: number, w: number) => { const a = acc.get(k) ?? { dL: [], dC: [], w: [] }; a.dL.push(dL); a.dC.push(dC); a.w.push(w); acc.set(k, a); };
for (const p of profiles) for (const [era, e] of Object.entries<any>(p.eras)) {
  for (const [hex, w] of (e.walls ?? []) as [string, number][]) {
    const m = hexToRgb(hex), fam = familyOf(m), lm = lchOf(m);
    const tint = level ? levelWallHex(hex) : hex;
    for (const side of ['sun', 'shade', 'mix'] as const) {
      const r = applyTransfer(fit, tint, side), lr = lchOf(r);
      for (const k of [`${era}|${fam}|${side}`, `${era}|all|${side}`, `all|${fam}|${side}`, `all|all|${side}`]) for (let i = 0; i < w; i++) add(k, lr.L - lm.L, lr.C - lm.C, 1);
    }
  }
}
const out: Record<string, any> = {};
for (const [k, a] of acc) out[k] = { n: a.dL.length, dL: { p10: pct(a.dL, 0.1), p50: pct(a.dL, 0.5), p90: pct(a.dL, 0.9) }, dC: { p10: pct(a.dC, 0.1), p50: pct(a.dC, 0.5), p90: pct(a.dC, 0.9) } };
fs.writeFileSync(arg('out', 'artifacts/palette-level/table.json'), JSON.stringify({ level, fit, table: out }, null, 1));
const f = (x: number) => (x >= 0 ? '+' : '') + x.toFixed(1);
console.log(`level ${level ? 'ON' : 'off'}; fronts ${acc.get('all|all|sun')?.dL.length}`);
for (const k of [...acc.keys()].filter(k => k.endsWith('|sun') || k.endsWith('|mix')).sort()) {
  const o = out[k]; console.log(k.padEnd(24), String(o.n).padStart(5), 'dL', f(o.dL.p10), f(o.dL.p50), f(o.dL.p90), ' dC', f(o.dC.p10), f(o.dC.p50), f(o.dC.p90));
}
