// Twin copy guard scores (integrator rulings on step 1c and D1-fix): a front copies its twin only under stage.ts `twinGuard`.
//   plain   the describer's `sameAs` names that side (no guard)
//   pr1     plain AND PR1's `similar` (built within 3 years, street-run width within 0.3 m, exposed height within 0.8 m; step 1c)
//   mutual  each house's `sameAs` names the other AND width within 0.3 m AND build year within 3 (D1-fix default; no height test)
// plus the mutual components alone (mutual-sameAs, width+year on one-sided sameAs) for reading which part costs recall.
// Scores each guard on the twin-v2 truth sides: precision and recall with Wilson 95 % intervals, on every side and on the sides
// whose neighbour has a twin read too (the `both-read` subset; twins-v2.ts `neighbours` makes the missing neighbour images).
//
//   node --import tsx scripts/house-specs/describer-d1/twin-guard.ts [--probes <probe-cache.json>] [--answers <dir>] [--out <json>]
import fs from 'node:fs';
import path from 'node:path';
import { similar, similarWidthYear, type Probe } from './partyPairs.ts';
import { namesSide, opposite, twinGuard } from './stage.ts';
import { wilson } from '../../../src/canalRecall/houseSpec/describerScore.ts';

type Tally = { tp: number; fp: number; fn: number; tn: number };
export type GuardSide = { truth: boolean; a: { sameAs?: unknown }; b: { sameAs?: unknown } | null; side: 'left' | 'right'; pa?: Probe; pb?: Probe };
export const GUARD_NAMES = ['plain', 'pr1', 'mutual', 'mutual-sameAs', 'width+year'] as const;
export type GuardName = (typeof GUARD_NAMES)[number];

/** Whether guard `g` lets the side copy. */
export function guardSays(g: GuardName, s: GuardSide): boolean {
  const back = opposite(s.side);
  if (g === 'plain') return namesSide(s.a.sameAs, s.side);
  if (g === 'pr1') return twinGuard('pr1', { side: s.side, back, a: s.a, b: s.b, pa: s.pa, pb: s.pb });
  if (g === 'mutual') return twinGuard('mutual', { side: s.side, back, a: s.a, b: s.b, pa: s.pa, pb: s.pb });
  if (g === 'mutual-sameAs') return namesSide(s.a.sameAs, s.side) && !!s.b && namesSide(s.b.sameAs, back);
  return namesSide(s.a.sameAs, s.side) && !!s.pa && !!s.pb && similarWidthYear(s.pa, s.pb);
}

export function tally(sides: GuardSide[], g: GuardName): Tally {
  const t: Tally = { tp: 0, fp: 0, fn: 0, tn: 0 };
  for (const s of sides) { const p = guardSays(g, s); if (p && s.truth) t.tp++; else if (p) t.fp++; else if (s.truth) t.fn++; else t.tn++; }
  return t;
}
export const stat = (x: Tally) => ({ ...x, precision: +(x.tp / Math.max(1, x.tp + x.fp)).toFixed(3), precisionCI: wilson(x.tp, x.tp + x.fp),
  recall: +(x.tp / Math.max(1, x.tp + x.fn)).toFixed(3), recallCI: wilson(x.tp, x.tp + x.fn) });

function main() {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
  const D = path.join(ROOT, 'artifacts/describer-d1');
  const args = process.argv.slice(2), opt = (k: string) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : undefined);
  const probes: Record<string, Probe> = JSON.parse(fs.readFileSync(opt('probes') ?? '/Users/blackmad/Code/map-recall2-worktrees/structure-priors-20261113/artifacts/structure-priors/probe-cache.json', 'utf8'));
  const truth = JSON.parse(fs.readFileSync(path.join(D, 'twins-v2.json'), 'utf8')).rows as any[];
  const A = opt('answers') ?? path.join(D, 'answers-twins-v2');
  const read = (id: string) => { const f = path.join(A, `${id}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
  const sides: (GuardSide & { pandId: string; neighbour: string })[] = [];
  for (const r of truth) {
    const a = read(r.pandId); if (!a) continue;
    for (const side of ['left', 'right'] as const) {
      const t = r[side];
      if (!t || typeof t.twin !== 'boolean') continue;
      sides.push({ pandId: r.pandId, neighbour: t.id, truth: t.twin, a, b: read(t.id), side, pa: probes[r.pandId], pb: probes[t.id] });
    }
  }
  const both = sides.filter(s => s.b);
  const block = (ss: GuardSide[]) => Object.fromEntries(GUARD_NAMES.map(g => [g, stat(tally(ss, g))]));
  const rows = sides.map(s => ({ pandId: s.pandId, side: s.side, neighbour: s.neighbour, truth: s.truth, sameAs: namesSide(s.a.sameAs, s.side),
    backSameAs: s.b ? namesSide(s.b.sameAs, opposite(s.side)) : null, probed: !!(s.pa && s.pb),
    similar: !!(s.pa && s.pb && similar(s.pa, s.pb)), widthYear: !!(s.pa && s.pb && similarWidthYear(s.pa, s.pb)) }));
  const out = { v: 2, sides: sides.length, bothRead: both.length, all: block(sides), bothReadOnly: block(both), rows };
  fs.writeFileSync(opt('out') ?? path.join(D, 'twin-guard.json'), `${JSON.stringify(out, null, 1)}\n`);
  const line = (k: string, x: ReturnType<typeof stat>) => `| ${k} | ${x.tp}/${x.fp}/${x.fn} | ${x.precision} [${x.precisionCI.join('-')}] | ${x.recall} [${x.recallCI.join('-')}] |`;
  for (const [title, b] of [[`all ${sides.length} sides`, out.all], [`both read (${both.length} sides)`, out.bothReadOnly]] as const) {
    console.log(`\n${title}\n| guard | tp/fp/fn | precision | recall |\n|---|---|---|---|`);
    for (const g of GUARD_NAMES) console.log(line(g, (b as any)[g]));
  }
}
if (import.meta.url === `file://${process.argv[1]}`) main();
