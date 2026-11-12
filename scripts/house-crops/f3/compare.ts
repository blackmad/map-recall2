/**
 * F3 (#381) step 1: before / after good-crop share on a pand sample. Reads the candidates `house:crops --all-years --bearings` archived
 * (<archive>/pand-crops/<id>/front.json + years/*.jpg) and picks, per pand:
 *   before  = today's rule (rank.ts defaultPick: first usable year in the default order);
 *   pixel   = the F3 pixel rank over every year and both bearings (rank.ts rankedPick);
 *   gated   = the best candidate that passes the crop gate (gate.ts; needs `gate.ts` to have run), else the pixel pick.
 * Writes <out>/items.json ([{key: "<id>|<variant file>", file}] for label-sheets.ts: only distinct crops, so a crop two rules agree on is
 * labelled once) and <out>/selections.json. With --labels <labels.json> ({key: good|marginal|bad}) prints the good / marginal / bad table.
 *
 *   node --import tsx scripts/house-crops/f3/compare.ts --archive <dir> --out <dir> [--labels <file>] [--gate <gate-*.json>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { defaultPick, rankedPick, type Tried } from './rank.ts';

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const archive = arg('archive')!, out = arg('out')!;
if (!archive || !out) { console.error('usage: compare.ts --archive <dir> --out <dir> [--labels f] [--gate f]'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const gate: Record<string, { chosen: string | null }> = arg('gate') ? JSON.parse(fs.readFileSync(arg('gate')!, 'utf8')) : {};
type Sel = { before?: string; pixel?: string; gated?: string };
const sel: Record<string, Sel> = {};
for (const id of fs.readdirSync(path.join(archive, 'pand-crops')).sort()) {
  const fjPath = path.join(archive, 'pand-crops', id, 'front.json');
  if (!fs.existsSync(fjPath)) continue; // a pand with no wall or no panorama, or one still being written
  const fj = JSON.parse(fs.readFileSync(fjPath, 'utf8')), tried: Tried[] = (fj.candidates as Tried[]).filter(t => t.file && t.flags);
  if (!tried.length) continue;
  const b = defaultPick(tried), p = rankedPick(tried);
  sel[id] = { before: b?.file, pixel: p?.file, gated: gate[id]?.chosen ?? p?.file };
}
const keys = new Map<string, string>();
for (const [id, s] of Object.entries(sel)) for (const f of new Set([s.before, s.pixel, s.gated])) if (f) keys.set(`${id}|${f}`, path.join(archive, 'pand-crops', id, f));
fs.writeFileSync(path.join(out, 'items.json'), JSON.stringify([...keys].map(([key, file]) => ({ key, file })), null, 1));
fs.writeFileSync(path.join(out, 'selections.json'), JSON.stringify(sel, null, 1));
const same = (a: 'before' | 'pixel' | 'gated', b: 'before' | 'pixel' | 'gated') => Object.values(sel).filter(s => s[a] === s[b]).length;
console.log(`${Object.keys(sel).length} pands; ${keys.size} distinct crops to label; before=pixel on ${same('before', 'pixel')}, pixel=gated on ${same('pixel', 'gated')}`);
if (arg('labels')) {
  const labels: Record<string, string> = JSON.parse(fs.readFileSync(arg('labels')!, 'utf8'));
  for (const v of ['before', 'pixel', 'gated'] as const) {
    const c: Record<string, number> = { good: 0, marginal: 0, bad: 0, unlabelled: 0 }; let n = 0;
    for (const [id, s] of Object.entries(sel)) { if (!s[v]) continue; n++; c[labels[`${id}|${s[v]}`] ?? 'unlabelled']++; }
    const ci = (k: number) => { const p = k / n, h = 1.96 * Math.sqrt(p * (1 - p) / n); return `${(100 * Math.max(0, p - h)).toFixed(0)}-${(100 * Math.min(1, p + h)).toFixed(0)}`; };
    console.log(`${v.padEnd(6)} n=${n} good ${c.good} (${(100 * c.good / n).toFixed(1)} %, 95 % CI ${ci(c.good)}) marginal ${c.marginal} bad ${c.bad} unlabelled ${c.unlabelled}`);
  }
}
