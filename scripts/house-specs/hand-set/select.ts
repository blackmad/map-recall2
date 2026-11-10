// Hand set v1 (lane H5h, #351): the stratified draw of AB07 pands to read by hand. Deterministic (seed 351).
// Strata, known BEFORE reading (writer outputs as proxies; the realised strata come from the readings):
//   tier          the crop tier house:describe chose (good / fallback); `none` and no-crop pands cannot be read
//   gable group   the register's gable (step, neck incl. raised-neck, bell, spout/point, cornice) or unlisted
//   tone          dark vs light front: HSL lightness of the pixel writer's wall colour < 0.38 (dark) or >= 0.38
//   finish proxy  Jev's finish (brick / stucco / painted-brick) or unknown
// Crops labelled `bad` (scripts/house-crops/labels/AB07*.json, same panoramas) are skipped: a hand reading needs a readable front.
// Each cell's candidates are listed in draw order so an unreadable pick is replaced by the next one of the same cell.
import fs from 'node:fs';
import path from 'node:path';
import { rgbToHsl } from '../../../src/canalRecall/blockFace/wallColour.ts';
import type { Envelope } from '../describe.ts';

export const HELP = `hand-set select: the stratified AB07 draw for the photo-read hand set (docs/house-line.md §4c).

  node --import tsx scripts/house-specs/hand-set/select.ts [--out data/house-line/hand-set-v1.selection.json]

Quotas per (tier, gable group) are in QUOTAS; within a cell picks alternate dark/light and rotate the finish proxy.`;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
export const DARK_L = 0.38;
type Group = 'step' | 'neck' | 'bell' | 'point' | 'cornice' | 'unlisted';
/** Picks per tier and register gable group (good 36, fallback 24). Every good-tier cornice and point pand is taken (6 and 2 exist). */
export const QUOTAS: Record<'good' | 'fallback', Record<Group, number>> = {
  good: { step: 0, neck: 6, bell: 6, point: 2, cornice: 6, unlisted: 16 },
  fallback: { step: 3, neck: 4, bell: 4, point: 2, cornice: 4, unlisted: 7 },
};
const groupOf = (g: string | undefined): Group => !g ? 'unlisted' : g === 'raised-neck' ? 'neck' : g === 'spout' ? 'point' : (['step', 'neck', 'bell', 'point', 'cornice'].includes(g) ? g as Group : 'unlisted');

export function mulberry32(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const lightness = (hex?: string) => { const m = hex ? /^#([0-9a-f]{6})$/i.exec(hex) : null; if (!m) return null; const n = parseInt(m[1], 16); return rgbToHsl([(n >> 16) & 255, (n >> 8) & 255, n & 255])[2]; };

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) { console.log(HELP); return; }
  const i = argv.indexOf('--out'); const out = i >= 0 ? argv[i + 1] : path.join(ROOT, 'data/house-line/hand-set-v1.selection.json');
  const dir = path.join(ROOT, 'scripts/house-specs/generated/AB07');
  const bad = new Set<string>();
  for (const f of ['AB07.json', 'AB07-picks.json']) for (const [id, l] of Object.entries<any>(JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/house-crops/labels', f), 'utf8')))) if (l.label === 'bad') bad.add(`${id}|${[...l.panoIds].sort().join()}`);
  type C = { pandId: string; tier: 'good' | 'fallback'; group: Group; tone: 'dark' | 'light' | 'unknown'; finish: string; registerGable: string | null; wallL: number | null; crop: string; quality: number | null };
  const cells = new Map<string, C[]>(); let skippedBad = 0, pop = 0;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    const e: Envelope = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const t = e.crop?.tier; if (t !== 'good' && t !== 'fallback') continue;
    pop++;
    if (bad.has(`${e.pandId}|${[...e.crop!.panoIds].sort().join()}`)) { skippedBad++; continue; }
    const reg = (e.writers.register?.design?.fronts?.[0] as any)?.gable as string | undefined;
    const L = lightness(e.writers.pixel?.design?.palette?.brick as string | undefined);
    const c: C = { pandId: e.pandId, tier: t, group: groupOf(reg), tone: L === null ? 'unknown' : L < DARK_L ? 'dark' : 'light', finish: (e.writers.jev?.design?.palette?.wallMaterial as string) ?? 'unknown', registerGable: reg ?? null, wallL: L === null ? null : +L.toFixed(3), crop: `source-data://pand-crops/${e.pandId}/${e.crop!.file}`, quality: e.crop!.quality };
    const k = `${t}/${c.group}`; (cells.get(k) ?? cells.set(k, []).get(k)!).push(c);
  }
  const rnd = mulberry32(351);
  const picks: (C & { cell: string; order: number })[] = [], reserves: Record<string, string[]> = {}, sizes: Record<string, number> = {};
  for (const tier of ['good', 'fallback'] as const) for (const [g, q] of Object.entries(QUOTAS[tier])) {
    const k = `${tier}/${g}`; const all = (cells.get(k) ?? []).map(c => ({ c, r: rnd() })).sort((a, b) => a.r - b.r).map(x => x.c);
    sizes[k] = all.length;
    // alternate dark / light, then rotate the finish proxy: one queue per (tone, finish), drained round-robin
    const queues = new Map<string, C[]>(); for (const c of all) { const qk = `${c.tone}/${c.finish}`; (queues.get(qk) ?? queues.set(qk, []).get(qk)!).push(c); }
    const order: C[] = []; const keys = [...queues.keys()].sort((a, b) => (a.startsWith('dark') ? 0 : 1) - (b.startsWith('dark') ? 0 : 1) || a.localeCompare(b));
    const tones = ['dark', 'light', 'unknown'];
    while (order.length < all.length) for (const tone of tones) { const ks = keys.filter(x => x.startsWith(tone + '/') && queues.get(x)!.length); if (!ks.length) continue; ks.sort((a, b) => queues.get(b)!.length - queues.get(a)!.length); order.push(queues.get(ks[0])!.shift()!); }
    order.slice(0, q).forEach((c, n) => picks.push({ ...c, cell: k, order: n }));
    reserves[k] = order.slice(q, q + 6).map(c => c.pandId);
  }
  const doc = { version: 1, seed: 351, buurt: 'AB07', darkL: DARK_L, quotas: QUOTAS, population: pop, skippedBadLabel: skippedBad, cellSizes: sizes, picks, reserves };
  fs.writeFileSync(out, JSON.stringify(doc, null, 1) + '\n');
  const tally = (f: (c: C) => string) => picks.reduce((m: Record<string, number>, c) => ((m[f(c)] = (m[f(c)] ?? 0) + 1), m), {});
  console.log(`population ${pop} readable-tier pands, ${skippedBad} skipped (bad label); picked ${picks.length}`);
  console.log('cells', sizes); console.log('tier', tally(c => c.tier)); console.log('group', tally(c => c.group)); console.log('tone', tally(c => c.tone)); console.log('finish proxy', tally(c => c.finish));
}
if (process.argv[1]?.endsWith('hand-set/select.ts')) main();
