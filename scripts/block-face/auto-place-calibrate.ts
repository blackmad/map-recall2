/**
 * Calibration of the auto-place likeness gate: every pand of the given faces placed as EACH library type (no vetoes,
 * no gate), and the body NCC per pand per type tabulated. The placed (right) type should score clearly over the wrong
 * ones; the gate threshold (blockFace/stripLikeness.ts `minNcc`) sits between.
 *
 *   node --import tsx scripts/block-face/auto-place-calibrate.ts --buurt=bellamybuurt-zuid --district=bellamy --only=<face>,... [--truth=<face>:<type>,...]
 *
 * Writes staging/buurt/calibrate/<face>--<type>.json (auto-place.ts --force-type) and staging/buurt/calibrate/table.json.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {TYPE_LIBRARY_DIR} from '../../src/canalRecall/blockFace/typeLibrary.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const buurt = arg('buurt') ?? 'bellamybuurt-zuid', district = arg('district') ?? 'bellamy', only = arg('only');
if (!only) throw Error('--only=<face>,... required');
const types = (await fs.readdir(path.join(TYPE_LIBRARY_DIR, district))).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
for (const t of types) {
  if (process.argv.includes('--skip-run')) break;
  console.log(`placing every pand as ${t}`);
  execFileSync('node', ['--import', 'tsx', 'scripts/block-face/auto-place.ts', `--buurt=${buurt}`, `--district=${district}`, `--only=${only}`, '--no-gate', `--force-type=${t}`], {stdio: ['ignore', 'ignore', 'inherit']});
}
const truth = new Map((arg('truth') ?? '').split(',').filter(Boolean).map(x => x.split(':') as [string, string]));
const rows: {face: string; pand: string; truth?: string; ncc: Record<string, number | null>}[] = [];
for (const face of only.split(',')) {
  const byPand = new Map<string, Record<string, number | null>>();
  for (const t of types) {
    const f = path.join('staging/buurt/calibrate', `${face}--${t}.json`);
    const d = JSON.parse(await fs.readFile(f, 'utf8').catch(() => '{"pands": []}'));
    for (const p of d.pands) { const r = byPand.get(p.pandId) ?? {}; r[t] = p.likeness?.nccRaw ?? null; byPand.set(p.pandId, r); }
  }
  for (const [pand, ncc] of byPand) rows.push({face, pand, ...(truth.has(pand.slice(-6)) ? {truth: truth.get(pand.slice(-6))} : {}), ncc});
}
await fs.writeFile('staging/buurt/calibrate/table.json', JSON.stringify({types, rows}, null, 1) + '\n');
console.log(['face'.padEnd(18), 'pand  ', ...types.map(t => t.slice(8).padStart(18))].join(' '));
for (const r of rows) console.log([r.face.padEnd(18), r.pand.slice(-6), ...types.map(t => String(r.ncc[t] ?? '-').padStart(18))].join(' '));
