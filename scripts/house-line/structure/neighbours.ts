/**
 * Lane PR1 (integrator refinement 1): how often a house matches its party-wall neighbour, per field, split by
 * similarity (build year within 3 years, street-run width within 0.3 m, exposed height within 0.8 m) and by buurt
 * family (canal belt, 19th-century ring, 20th century). This table decides which fields use neighbours and where.
 *
 *   node --import tsx scripts/house-line/structure/neighbours.ts [--probe-cache f.json] [--json out.json] [--md out.md]
 *
 * Neighbours: two read pands whose footprints share at least PARTY_MIN_M of boundary (within PARTY_TOL_M). A pair is
 * compared on a field only when both readings carry it in the same vocabulary (dataset.ts agree). Type-placed block-face
 * houses (`face-type`) are reported apart: a type repeats one design along a row, so their agreement is the placer's.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../../house-preview/nodeDom.ts';
import { probeAll } from './baseline.ts';
import { FIELDS, agree, benchmarkReadings, faceReadings, specReadings, type Field, type Reading } from './dataset.ts';
import type { ProbeRecord } from './probe.ts';
import { wilson, pct } from './labels.ts';

export const PARTY_MIN_M = 2, PARTY_TOL_M = 0.35;
export const SIMILAR = { yearY: 3, widthM: 0.3, heightM: 0.8 };
const KX = 111_320 * Math.cos(52.37 * Math.PI / 180), KY = 110_540;

/** Buurt family by gebied (coverage-v1 buurten), else by the pand's build year. */
export function buurtFamily(gebied: string | null, year: number | null): 'canal belt' | '19th-c ring' | '20th c' {
  if (gebied === 'Centrum-West' || gebied === 'Centrum-Oost') return 'canal belt';
  if (year !== null && year < 1850) return 'canal belt';
  if (year !== null && year < 1915) return '19th-c ring';
  if (year === null && gebied && /Oud-West|De Pijp|Oud-Zuid|Oost|Westerpark|Weesperzijde|Oosterpark/.test(gebied)) return '19th-c ring';
  return '20th c';
}

/** Boundary length of `a` within PARTY_TOL_M of `b` (metres, sampled every 0.25 m). */
export function sharedM(a: number[][], b: number[][], origin: readonly [number, number]): number {
  const xy = (q: number[]) => [(q[0] - origin[0]) * KX, (q[1] - origin[1]) * KY];
  const A = a.map(xy), B = b.map(xy);
  const dist = (p: number[]) => {
    let best = Infinity;
    for (let i = 0; i + 1 < B.length; i++) {
      const [x0, y0] = B[i], [x1, y1] = B[i + 1], dx = x1 - x0, dy = y1 - y0, l = dx * dx + dy * dy;
      const t = l ? Math.max(0, Math.min(1, ((p[0] - x0) * dx + (p[1] - y0) * dy) / l)) : 0;
      best = Math.min(best, Math.hypot(p[0] - x0 - t * dx, p[1] - y0 - t * dy));
    }
    return best;
  };
  let shared = 0;
  for (let i = 0; i + 1 < A.length; i++) {
    const len = Math.hypot(A[i + 1][0] - A[i][0], A[i + 1][1] - A[i][1]), n = Math.max(1, Math.ceil(len / 0.25));
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; if (dist([A[i][0] + t * (A[i + 1][0] - A[i][0]), A[i][1] + t * (A[i + 1][1] - A[i][1])]) <= PARTY_TOL_M) shared += len / n; }
  }
  return shared;
}

export type Pair = { a: Reading; b: Reading; pa: ProbeRecord; pb: ProbeRecord; similar: boolean; sameHeight: boolean; sameYearHeight: boolean; family: ReturnType<typeof buurtFamily> };
/** Party-wall pairs among pands with a reading and a footprint (grid-bucketed). */
export function partyPairs(readings: Reading[], probes: Map<string, ProbeRecord>): Pair[] {
  const items = readings.map(r => ({ r, p: probes.get(r.pandId) })).filter(x => x.p?.ring?.length && x.p.at) as { r: Reading; p: ProbeRecord }[];
  const cell = (q: readonly number[]) => `${Math.floor(q[0] * KX / 60)}:${Math.floor(q[1] * KY / 60)}`;
  const grid = new Map<string, typeof items>();
  for (const it of items) { const k = cell(it.p.at!); grid.set(k, [...(grid.get(k) ?? []), it]); }
  const pairs: Pair[] = [], seen = new Set<string>();
  for (const it of items) {
    const [cx, cy] = cell(it.p.at!).split(':').map(Number);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const jt of grid.get(`${cx + dx}:${cy + dy}`) ?? []) {
      if (jt === it) continue;
      const key = [it.r.pandId, jt.r.pandId].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      if (sharedM(it.p.ring!, jt.p.ring!, it.p.at!) < PARTY_MIN_M) continue;
      const pa = it.p, pb = jt.p;
      const similar = pa.year !== null && pb.year !== null && Math.abs(pa.year - pb.year) <= SIMILAR.yearY
        && !!pa.drawn && !!pb.drawn && Math.abs(pa.drawn.runM - pb.drawn.runM) <= SIMILAR.widthM && Math.abs(pa.drawn.exposedM - pb.drawn.exposedM) <= SIMILAR.heightM;
      const sameHeight = !!pa.drawn && !!pb.drawn && Math.abs(pa.drawn.exposedM - pb.drawn.exposedM) <= SIMILAR.heightM;
      const sameYearHeight = sameHeight && pa.year !== null && pb.year !== null && Math.abs(pa.year - pb.year) <= SIMILAR.yearY;
      pairs.push({ a: it.r, b: jt.r, pa, pb, similar, sameHeight, sameYearHeight, family: buurtFamily(pa.gebied, pa.year) });
    }
  }
  return pairs;
}

type Cell = { n: number; k: number };
export function agreementTable(pairs: Pair[]) {
  const split = (name: string, keep: (p: Pair) => boolean) => {
    const row: Record<Field, Cell> = Object.fromEntries(FIELDS.map(f => [f, { n: 0, k: 0 }])) as Record<Field, Cell>;
    for (const p of pairs) if (keep(p)) for (const f of FIELDS) { const a = agree(f, p.a, p.b); if (a === null) continue; row[f].n++; if (a) row[f].k++; }
    return { name, pairs: pairs.filter(keep).length, row };
  };
  const read = (p: Pair) => p.a.source !== 'face-type' && p.b.source !== 'face-type';
  const one = (p: Pair) => p.a.oneFront !== false && p.b.oneFront !== false;
  return [
    split('all read pairs', p => read(p) && one(p)),
    split('  similar (yr ±3, width ±0.3 m, height ±0.8 m)', p => read(p) && one(p) && p.similar),
    split('  not similar', p => read(p) && one(p) && !p.similar),
    split('  year ±3 and height ±0.8 m (any width)', p => read(p) && one(p) && p.sameYearHeight),
    split('  height ±0.8 m only', p => read(p) && one(p) && p.sameHeight),
    split('  height differs > 0.8 m', p => read(p) && one(p) && !p.sameHeight),
    split('  canal belt', p => read(p) && one(p) && p.family === 'canal belt'),
    split('  19th-c ring', p => read(p) && one(p) && p.family === '19th-c ring'),
    split('  20th c', p => read(p) && one(p) && p.family === '20th c'),
    split('  canal belt, similar', p => read(p) && one(p) && p.family === 'canal belt' && p.similar),
    split('  19th-c ring, similar', p => read(p) && one(p) && p.family === '19th-c ring' && p.similar),
    split('  20th c, similar', p => read(p) && one(p) && p.family === '20th c' && p.similar),
    split('benchmark labels only', p => p.a.source === 'benchmark' && p.b.source === 'benchmark' && one(p)),
    split('  benchmark, similar', p => p.a.source === 'benchmark' && p.b.source === 'benchmark' && one(p) && p.similar),
    split('type-placed block-face pairs (placer agreement)', p => !read(p)),
  ];
}

export function tableMarkdown(t: ReturnType<typeof agreementTable>): string {
  const head = `| split | pairs | ${FIELDS.join(' | ')} |\n|---|---|${FIELDS.map(() => '---').join('|')}|`;
  const cell = (c: Cell) => c.n < 5 ? (c.n ? `(${c.k}/${c.n})` : '–') : `${pct(c.k / c.n).replace(' ', '')} (${c.n})`;
  return [head, ...t.map(r => `| ${r.name.trim()} | ${r.pairs} | ${FIELDS.map(f => cell(r.row[f])).join(' | ')} |`)].join('\n');
}

export function loadAllReadings(root: string) {
  const face = faceReadings(root), spec = specReadings(root), bench = benchmarkReadings(root);
  // One reading per pand for the neighbour table: benchmark labels, then specs (hand reads), then the faces.
  const byPand = new Map<string, Reading>();
  for (const r of [...face, ...spec, ...bench]) byPand.set(r.pandId, r);
  return { face, spec, bench, all: [...byPand.values()] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
  const { face, spec, bench, all } = loadAllReadings(REPO_ROOT);
  console.log(`readings: block-face ${face.length} (designed ${face.filter(r => r.source === 'face-design').length}, type-placed ${face.filter(r => r.source === 'face-type').length}), specs ${spec.length}, benchmark ${bench.length}; pands ${all.length}`);
  const probes = await probeAll(all.map(r => r.pandId), opt('--probe-cache') ?? 'artifacts/structure-priors/probe-cache.json');
  const pairs = partyPairs(all, probes);
  const t = agreementTable(pairs);
  // Chance agreement: two independent draws from the read pairs' own marginals (sum of squared shares per field).
  const readPairs = pairs.filter(p => p.a.source !== 'face-type' && p.b.source !== 'face-type' && p.a.oneFront !== false && p.b.oneFront !== false);
  const chance = Object.fromEntries(FIELDS.map(f => {
    if (f === 'storeyH' || f === 'tone') return [f, null];
    // Per vocabulary (pairs compare within one), weighted by that vocabulary's compared pairs.
    let total = 0, acc = 0;
    for (const vocab of ['intent', 'label'] as const) {
      const ps = readPairs.filter(p => p.a.vocab === vocab && agree(f, p.a, p.b) !== null);
      const vals = ps.flatMap(p => [p.a, p.b]).map(r => String(r[f]));
      if (!vals.length) continue;
      const c = new Map<string, number>(); for (const v of vals) c.set(v, (c.get(v) ?? 0) + 1);
      acc += ps.length * [...c.values()].reduce((s2, n) => s2 + (n / vals.length) ** 2, 0); total += ps.length;
    }
    return [f, total ? acc / total : null];
  }));
  const md = tableMarkdown(t);
  console.log(md);
  console.log('chance agreement (read pairs, own marginals): ' + FIELDS.map(f => `${f} ${chance[f] === null ? '–' : pct(chance[f] as number)}`).join('; '));
  const ci = (c: Cell) => wilson(c.k, c.n).map(x => pct(x)).join('-');
  console.log('\n95 % CI, all read pairs: ' + FIELDS.map(f => `${f} ${ci(t[0].row[f])}`).join('; '));
  if (opt('--md')) fs.writeFileSync(opt('--md')!, md + '\n');
  if (opt('--json')) { fs.mkdirSync(path.dirname(opt('--json')!), { recursive: true }); fs.writeFileSync(opt('--json')!, JSON.stringify({ similar: SIMILAR, party: { minM: PARTY_MIN_M, tolM: PARTY_TOL_M }, table: t, pairs: pairs.map(p => ({ a: p.a.pandId, b: p.b.pandId, sa: p.a.source, sb: p.b.source, similar: p.similar, family: p.family })) }, null, 1)); }
}
