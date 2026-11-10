// Hand set v1 (lane H5h, #351): build data/house-line/hand-set-v1.json (reader A, all 80 pands) from the reading log
// data/house-line/hand-set-v1.reader-a.tsv, and data/house-line/hand-set-v1.reader-b.json (the blind second reader, 30 pands) from
// its raw records; both validated by validateHandSet. Image refs and sha256 come from sources.ts (what the sheets showed).
//
// TSV columns: pandId, panel (A|B|C: the panel most fields were read from), axes:conf, storeys:conf, flags (comma list:
// souterrain, entresol, atticInCrown, aps=a-b-c for axesPerStorey from storey 2 up; - for none), gable:conf, finish:conf,
// wall:conf, pui:conf, note. A value "-" is null. axes "UNREADABLE" marks readable false.
import fs from 'node:fs';
import path from 'node:path';
import { setPands } from './sources.ts';
import { HAND_SET_VERSION, READING_CONVENTION, validateHandSet, type HandPand, type HandSet, type Reading } from '../../../src/canalRecall/houseSpec/handSet.ts';

export const HELP = `hand-set build: reading logs -> data/house-line/hand-set-v1.json and hand-set-v1.reader-b.json (validated).

  node --import tsx scripts/house-specs/hand-set/build.ts [--date YYYY-MM-DD]`;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const D = path.join(ROOT, 'data/house-line');

export function parseRow(line: string, images: { ref: string; sha256: string }[]): Omit<HandPand, 'group'> {
  const [pandId, panel, axes, storeys, flags, gable, finish, wall, pui, note] = line.split('\t');
  const ref = images['ABC'.indexOf(panel)]?.ref; if (!ref) throw new Error(`${pandId}: no panel ${panel}`);
  if (axes === 'UNREADABLE') {
    const nul = <T,>(): Reading<T> => ({ value: null, confidence: 'low', ref });
    return { pandId, images, readable: false, fields: { axes: nul(), storeys: nul(), gable: nul(), finish: nul(), wall: nul(), pui: nul() }, notes: note };
  }
  const r = <T,>(cell: string, num = false): Reading<T> => { const [v, c] = cell.split(':'); return { value: v === '-' ? null : (num ? Number(v) : v) as T, confidence: c as Reading<T>['confidence'], ref }; };
  const fl = flags === '-' ? [] : flags.split(',');
  const aps = fl.find(f => f.startsWith('aps='));
  return {
    pandId, images, readable: true,
    fields: {
      axes: r<number>(axes, true), ...(aps ? { axesPerStorey: aps.slice(4).split('-').map(Number) } : {}), storeys: r<number>(storeys, true),
      ...(fl.includes('souterrain') ? { souterrain: true } : {}), ...(fl.includes('entresol') ? { entresol: true } : {}), ...(fl.includes('atticInCrown') ? { atticInCrown: true } : {}),
      gable: r(gable), finish: r(finish), wall: r(wall), pui: r(pui),
    },
    notes: note,
  };
}

function main() {
  if (process.argv.includes('--help')) { console.log(HELP); return; }
  const i = process.argv.indexOf('--date'); const date = i >= 0 ? process.argv[i + 1] : '2026-11-10';
  const pands = setPands(); const byId = new Map(pands.map(p => [p.pandId, p]));
  const imgs = (id: string) => byId.get(id)!.images.slice(0, 3).map(({ ref, sha256 }) => ({ ref, sha256 }));
  const rows = fs.readFileSync(path.join(D, 'hand-set-v1.reader-a.tsv'), 'utf8').split('\n').filter(l => l && !l.startsWith('#'));
  const a: HandSet = { version: HAND_SET_VERSION, reader: 'A: lane H5h (Claude Opus 5.5), reading log hand-set-v1.reader-a.tsv', date, convention: READING_CONVENTION, pands: [] };
  for (const l of rows) { const id = l.split('\t')[0]; const p = byId.get(id); if (!p) throw new Error(`${id} not in the set`); a.pands.push({ ...parseRow(l, imgs(id)), group: p.group } as HandPand); }
  a.pands.sort((x, y) => pands.findIndex(p => p.pandId === x.pandId) - pands.findIndex(p => p.pandId === y.pandId));
  const missing = pands.filter(p => !a.pands.some(h => h.pandId === p.pandId)).map(p => p.pandId);
  if (missing.length) throw new Error(`reader A misses ${missing.join(', ')}`);
  const raw = JSON.parse(fs.readFileSync(path.join(D, 'hand-set-v1.reader-b.raw.json'), 'utf8'));
  const b: HandSet = { version: HAND_SET_VERSION, reader: 'B: blind second reader (Claude Opus subagent; saw only CONVENTION and the 30 sheets)', date, convention: READING_CONVENTION, pands: raw.map((r: any) => {
    const f = { ...r.fields };
    for (const k of ['axes', 'storeys', 'gable', 'finish', 'wall', 'pui']) if (!f[k]) f[k] = { value: null, confidence: 'low', ref: imgs(r.pandId)[0].ref };
    // reader B wrote axes 0 for a one-storey front (093912); the schema says null when there is no upper storey
    if (f.axes.value === 0) f.axes = { ...f.axes, value: null, note: 'reader wrote 0 (no upper storey); normalised to null' };
    return { pandId: r.pandId, group: byId.get(r.pandId)!.group, images: imgs(r.pandId), readable: r.readable, fields: f, ...(r.notes ? { notes: r.notes } : {}) };
  }) };
  for (const [name, set] of [['hand-set-v1.json', a], ['hand-set-v1.reader-b.json', b]] as const) {
    const problems = validateHandSet(set); if (problems.length) { console.error(name, problems); process.exit(1); }
    fs.writeFileSync(path.join(D, name), JSON.stringify(set, null, 1) + '\n'); console.log(`${name}: ${set.pands.length} pands, ${set.pands.filter(p => p.readable).length} readable`);
  }
}
if (process.argv[1]?.endsWith('hand-set/build.ts')) main();
