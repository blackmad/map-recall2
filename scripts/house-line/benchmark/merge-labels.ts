/**
 * Facade benchmark (lane F4, #379): merge reader label files into benchmark-v1.json, with the photo each was read from.
 *
 *   node --import tsx scripts/house-line/benchmark/merge-labels.ts --frames artifacts/critic/frames-round-0 <labels.json ...>
 *
 * A label file is an array of {key, readable, notes, labels} (labels.md). Every record is validated (labels.ts); a record
 * whose photo is no longer the pose's photo (the pose was re-picked) must be re-read and is refused. `photo` records the
 * panorama id, capture date, distance, obliquity and the archive ref (source-data experiments/facade-benchmark).
 */
import fs from 'node:fs';
import path from 'node:path';
import { labelProblems } from '../../../src/canalRecall/houseSpec/critic/labels.ts';
import { BENCHMARK_FILE } from './build.ts';

const argv = process.argv.slice(2), fi = argv.indexOf('--frames');
const frames = fi >= 0 ? argv[fi + 1] : 'artifacts/critic/frames-round-0';
const files = argv.filter((a, i) => !a.startsWith('--') && (fi < 0 || i !== fi + 1));
const prepared = new Map<string, any>(JSON.parse(fs.readFileSync(path.join(frames, 'prepared.json'), 'utf8')).prepared.map((p: any) => [p.key, p]));
const bench = JSON.parse(fs.readFileSync(BENCHMARK_FILE, 'utf8'));
const byKey = new Map<string, any>(bench.pands.map((p: any) => [p.key, p]));
let merged = 0; const refused: string[] = [];
for (const f of files) {
  const reader = path.basename(f, '.json');
  for (const r of JSON.parse(fs.readFileSync(f, 'utf8'))) {
    const p = byKey.get(r.key), prep = prepared.get(r.key);
    if (!p || !prep) { refused.push(`${r.key}: not in the benchmark or not posed`); continue; }
    if (r.photo?.panoId && r.photo.panoId !== prep.pick.panoId) { refused.push(`${r.key}: read from ${r.photo.panoId}, pose now ${prep.pick.panoId}`); continue; }
    if (r.readable) { const bad = labelProblems(r.labels); if (bad.length) { refused.push(`${r.key}: ${bad.join('; ')}`); continue; } }
    p.readable = !!r.readable; p.labels = r.readable ? r.labels : null; p.notes = r.notes ?? ''; p.reader = `${reader} (Claude Opus 5.5, 2026-11-12)`;
    p.photo = { panoId: prep.pick.panoId, date: String(prep.pick.timestamp).slice(0, 10), distM: +prep.pick.distM.toFixed(1), obliquityDeg: +prep.pick.obliquityDeg.toFixed(1), ref: `source-data://experiments/facade-benchmark/round-0/${r.key}/photo.jpg` };
    merged++;
  }
}
fs.writeFileSync(BENCHMARK_FILE, JSON.stringify(bench, null, 1) + '\n');
const lab = bench.pands.filter((p: any) => p.readable !== undefined), readable = lab.filter((p: any) => p.readable);
console.log(`merged ${merged}; benchmark ${bench.pands.length} pands, read ${lab.length}, readable ${readable.length}${refused.length ? `\nrefused ${refused.length}:\n  ${refused.join('\n  ')}` : ''}`);
