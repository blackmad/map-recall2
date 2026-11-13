/**
 * Lane PR1 step 1: the programme scoreboard's structure row. What the generic path draws today (storeys, window columns
 * per upper storey, crown) against the facade benchmark's hand labels, exact match with n and a 95 % Wilson interval.
 *
 *   node --import tsx scripts/house-line/structure/baseline.ts [--labels benchmark.json] [--json out.json] [--probe-cache file.json]
 *
 * --labels: a benchmark file with the v1 label shape (default benchmark-v1.json; e.g. D1's benchmark-v1-adjudicated.json).
 *
 * Env flags apply as in the world compile (STRUCTURE_PRIOR=0 off, unset columns only, =all columns and storeys). Rows: every readable labelled pand the
 * generic path draws with a ground-level street run ("generic"), and the subset with no HouseSpec storeys or bays and no
 * street-appearance recipe ("unspecified": the pands a structure prior is for). Installed models are excluded (their GLB
 * draws the front).
 */
import fs from 'node:fs';
import path from 'node:path';
import { StructureProbe, crownFamily, type ProbeRecord } from './probe.ts';
import { BENCHMARK, benchmarkTruths, fmt, score, type Score } from './labels.ts';
import { REPO_ROOT } from '../../house-preview/nodeDom.ts';

const args = process.argv.slice(2);
const opt = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);

export async function probeAll(ids: readonly string[], cacheFile?: string): Promise<Map<string, ProbeRecord>> {
  const cache: Record<string, ProbeRecord> = cacheFile && fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
  const probe = new StructureProbe();
  const out = new Map<string, ProbeRecord>();
  let i = 0;
  for (const id of ids) {
    i++;
    if (cache[id]) { out.set(id, cache[id]); continue; }
    try { out.set(id, cache[id] = await probe.probe(id)); } catch (e) { process.stderr.write(`  ${id}: ${(e as Error).message}\n`); }
    if (i % 25 === 0) process.stderr.write(`  probed ${i}/${ids.length}\n`);
  }
  if (cacheFile) { fs.mkdirSync(path.dirname(cacheFile), { recursive: true }); fs.writeFileSync(cacheFile, JSON.stringify(cache)); }
  return out;
}

export type Table = Record<string, { storeys: Score; columns: Score; crown: Score; crownFamily: Score }>;
export function scoreRows(truths: ReturnType<typeof benchmarkTruths>, probes: Map<string, ProbeRecord>, keep: (r: ProbeRecord) => boolean): { storeys: Score; columns: Score; crown: Score; crownFamily: Score } {
  const rows = truths.map(t => ({ t, r: probes.get(t.pandId) })).filter(x => x.r && x.r.route === 'generic' && x.r.drawn && keep(x.r)) as { t: typeof truths[number]; r: ProbeRecord }[];
  return {
    storeys: score(rows.map(({ t, r }) => [t.storeys, r.drawn!.storeys]), true),
    columns: score(rows.map(({ t, r }) => [t.columns, r.drawn!.columns]), true),
    crown: score(rows.map(({ t, r }) => [t.crown, r.crown])),
    crownFamily: score(rows.map(({ t, r }) => [crownFamily(t.crown), crownFamily(r.crown)])),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const labels = opt('--labels');
  const truths = benchmarkTruths(REPO_ROOT, labels);
  const probes = await probeAll(truths.map(t => t.pandId), opt('--probe-cache'));
  const unspec = (r: ProbeRecord) => !r.spec?.storeys && !r.spec?.bays && !r.drawn?.recipe;
  const table: Table = {
    'generic (all)': scoreRows(truths, probes, () => true),
    'generic, one front': scoreRows(truths, probes, r => truths.find(t => t.pandId === r.pandId)!.oneFront),
    'unspecified (no spec, no recipe)': scoreRows(truths, probes, unspec),
    'unspecified, one front': scoreRows(truths, probes, r => unspec(r) && truths.find(t => t.pandId === r.pandId)!.oneFront),
  };
  const routes = { labelled: truths.length, generic: [...probes.values()].filter(r => r.route === 'generic' && r.drawn).length, installed: [...probes.values()].filter(r => r.route === 'installed').length, noStreetRun: [...probes.values()].filter(r => r.route === 'generic' && !r.drawn).length, notDrawn: [...probes.values()].filter(r => r.route === 'not-drawn').length };
  console.log(`labels ${labels ?? BENCHMARK}: readable ${routes.labelled}; generic with a street run ${routes.generic}, installed ${routes.installed}, generic without a street run ${routes.noStreetRun}, not drawn ${routes.notDrawn}`);
  console.log(`env STRUCTURE_PRIOR=${process.env.STRUCTURE_PRIOR ?? ''} HOUSE_SPECS=${process.env.HOUSE_SPECS ?? ''}`);
  for (const [name, s] of Object.entries(table)) {
    console.log(`\n${name}`);
    for (const [k, v] of Object.entries(s)) console.log(`  ${k.padEnd(12)} ${fmt(v)}`);
  }
  const json = opt('--json');
  if (json) {
    const rows = truths.map(t => ({ truth: t, probe: probes.get(t.pandId) ?? null }));
    fs.mkdirSync(path.dirname(json), { recursive: true });
    fs.writeFileSync(json, JSON.stringify({ env: { STRUCTURE_PRIOR: process.env.STRUCTURE_PRIOR ?? null }, routes, table, rows }, null, 1));
  }
}
