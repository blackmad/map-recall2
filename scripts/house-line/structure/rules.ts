/**
 * Lane PR1 (integrator refinements 1-3): neighbour rules scored leave-one-out on the party-wall pairs, agreement per street
 * group, and the per-group spread of drawn storeys and columns against the benchmark labels.
 *
 *   node --import tsx scripts/house-line/structure/rules.ts [--on prior-on.json --off prior-off.json] [--json out.json]
 *
 * For each house A of a read pair (A, B), with A's own reading hidden:
 *  - copy:     A takes B's count (the similar-pair rule);
 *  - transfer: A's storeys = round(H_A / (H_B / S_B)) (B's floor-to-floor height on A's wall; S counts the ground storey
 *              once, the label convention), the rule proposed for neighbours whose heights differ by more than 0.8 m;
 *  - prior:    the structure prior's guess from a table without any training house within HOLDOUT_M of A (A's row and B).
 * `--on/--off` take baseline.ts --json outputs (STRUCTURE_PRIOR=1 and off) for the spread table.
 */
import fs from 'node:fs';
import { REPO_ROOT } from '../../house-preview/nodeDom.ts';
import { probeAll } from './baseline.ts';
import { faceReadings, specReadings, type Reading } from './dataset.ts';
import { loadAllReadings, partyPairs, type Pair } from './neighbours.ts';
import { fmt, score, pct } from './labels.ts';
import { structureGuess, STRUCTURE_PRIOR_TABLE, type StructurePriorTable } from '../../../src/canalRecall/houseSpec/structurePrior.ts';

const args = process.argv.slice(2), opt = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const KX = 111_320 * Math.cos(52.37 * Math.PI / 180), KY = 110_540, HOLDOUT_M = 60;
const { all } = loadAllReadings(REPO_ROOT);
void faceReadings; void specReadings;
const probes = await probeAll(all.map(r => r.pandId), 'artifacts/structure-priors/probe-cache.json');
const pairs = partyPairs(all, probes).filter(p => p.a.source !== 'face-type' && p.b.source !== 'face-type' && p.a.oneFront !== false && p.b.oneFront !== false);
const table = STRUCTURE_PRIOR_TABLE;
const priorFor = (r: Reading) => {
  const p = probes.get(r.pandId)!;
  if (!p.drawn || !p.at) return null;
  const t: StructurePriorTable = { ...table, rows: table.rows.filter(x => Math.hypot((x[0] - p.at![0]) * KX, (x[1] - p.at![1]) * KY) > HOLDOUT_M) };
  return structureGuess({ lng: p.at[0], lat: p.at[1], year: p.year, exposedM: p.drawn.exposedM, widthM: p.drawn.runM }, t);
};
type Dir = { me: Reading; other: Reading; pair: Pair; meH: number; otherH: number };
const dirs: Dir[] = pairs.flatMap(p => [{ me: p.a, other: p.b, pair: p, meH: p.pa.drawn?.exposedM ?? NaN, otherH: p.pb.drawn?.exposedM ?? NaN }, { me: p.b, other: p.a, pair: p, meH: p.pb.drawn?.exposedM ?? NaN, otherH: p.pa.drawn?.exposedM ?? NaN }]);
const out: Record<string, unknown> = {};
const line = (name: string, s: ReturnType<typeof score>) => { console.log(`  ${name.padEnd(34)} ${fmt(s)}`); return s; };
for (const [name, keep] of [
  ['similar pairs (yr±3, w±0.3, h±0.8)', (d: Dir) => d.pair.similar],
  ['heights differ > 0.8 m', (d: Dir) => !d.pair.sameHeight],
  ['heights differ > 0.8 m, 19th-c ring', (d: Dir) => !d.pair.sameHeight && d.pair.family === '19th-c ring'],
  ['heights differ > 0.8 m, canal belt', (d: Dir) => !d.pair.sameHeight && d.pair.family === 'canal belt'],
  ['all read pairs', () => true],
] as const) {
  const ds = dirs.filter(keep as (d: Dir) => boolean);
  console.log(`\n${name}: ${ds.length} directed pairs`);
  const rows: Record<string, unknown> = {};
  for (const f of ['storeys', 'columns'] as const) {
    const ok = ds.filter(d => d.me[f] && d.other[f]);
    rows[`${f} copy`] = line(`${f} copy neighbour`, score(ok.map(d => [d.me[f]!, d.other[f]!])));
    rows[`${f} prior`] = line(`${f} prior (row held out)`, score(ok.map(d => [d.me[f]!, priorFor(d.me)?.[f] ?? null])));
    if (f === 'storeys') rows['storeys transfer'] = line('storeys floor-to-floor transfer', score(ok.filter(d => d.meH > 0 && d.otherH > 0).map(d => [d.me.storeys!, Math.max(1, Math.round(d.meH / (d.otherH / d.other.storeys!)))])));
  }
  out[name] = rows;
}
// Agreement per street group (face run, spec directory, benchmark group): the pooled rate hides clustering.
const groupOf = (p: Pair) => p.a.run === p.b.run ? String(p.a.run) : `${p.a.run}|${p.b.run}`;
const groups = new Map<string, Pair[]>();
for (const p of pairs) groups.set(groupOf(p), [...(groups.get(groupOf(p)) ?? []), p]);
console.log('\nstoreys / columns agreement per street group (groups with 6+ pairs)');
const perGroup: Record<string, unknown> = {};
for (const [g, ps] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
  if (ps.length < 6) continue;
  const s = score(ps.filter(p => p.a.storeys && p.b.storeys).map(p => [p.a.storeys!, p.b.storeys!])), c = score(ps.filter(p => p.a.columns && p.b.columns).map(p => [p.a.columns!, p.b.columns!]));
  perGroup[g] = { pairs: ps.length, storeys: s.rate, columns: c.rate };
  console.log(`  ${g.padEnd(48)} pairs ${String(ps.length).padStart(3)}  storeys ${pct(s.rate).padStart(7)}  columns ${pct(c.rate).padStart(7)}`);
}
out.perGroup = perGroup;
// Spread: per benchmark group, the std of labels against drawn off and on (refinement 3: do not pool streets flat).
if (opt('--on') && opt('--off')) {
  const on = JSON.parse(fs.readFileSync(opt('--on')!, 'utf8')).rows, off = JSON.parse(fs.readFileSync(opt('--off')!, 'utf8')).rows;
  const sd = (xs: number[]) => { if (xs.length < 2) return 0; const m = xs.reduce((s, x) => s + x, 0) / xs.length; return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length); };
  const byGroup = new Map<string, { label: [number, number]; off: [number, number]; on: [number, number] }[]>();
  for (let i = 0; i < on.length; i++) {
    const a = on[i], b = off[i];
    if (a.probe?.route !== 'generic' || !a.probe.drawn || !b.probe?.drawn || a.truth.storeys == null || a.truth.columns == null) continue;
    if (a.probe.spec?.storeys || a.probe.spec?.bays || a.probe.drawn.recipe) continue;
    const g = a.truth.group;
    byGroup.set(g, [...(byGroup.get(g) ?? []), { label: [a.truth.storeys, a.truth.columns], off: [b.probe.drawn.storeys, b.probe.drawn.columns], on: [a.probe.drawn.storeys, a.probe.drawn.columns] }]);
  }
  console.log('\nper-group spread (std) on the unspecified benchmark pands: label / today / prior');
  const spread: Record<string, unknown> = {};
  for (const [g, xs] of byGroup) {
    if (xs.length < 3) continue;
    const s = (k: 'label' | 'off' | 'on', i: 0 | 1) => +sd(xs.map(x => x[k][i])).toFixed(2);
    spread[g] = { n: xs.length, storeys: [s('label', 0), s('off', 0), s('on', 0)], columns: [s('label', 1), s('off', 1), s('on', 1)] };
    console.log(`  ${g.padEnd(18)} n ${String(xs.length).padStart(2)}  storeys ${s('label', 0)} / ${s('off', 0)} / ${s('on', 0)}   columns ${s('label', 1)} / ${s('off', 1)} / ${s('on', 1)}`);
  }
  out.spread = spread;
}
if (opt('--json')) fs.writeFileSync(opt('--json')!, JSON.stringify(out, null, 1));
