// Hand set v1 (lane H5h, #351): build data/house-line/hand-set-v1.json (reader A, all 80 pands) from the reading log
// data/house-line/hand-set-v1.reader-a.tsv, and data/house-line/hand-set-v1.reader-b.json (the blind second reader, 30 pands) from
// its raw records; both validated by validateHandSet. Image refs and sha256 come from sources.ts (what the sheets showed).
//
// TSV columns: pandId, panel (A|B|C: the panel most fields were read from), axes:conf, storeys:conf, flags (comma list:
// souterrain, entresol, atticInCrown, multi (extent multi), crowns=n (n >= 2 crowns of the gable type), aps=a-b-c for axesPerStorey from storey 2 up; - for none), gable:conf,
// finish:conf, wall:conf, pui:conf, note. A value "-" is "unknown" (the crop cannot show it). axes "UNREADABLE" marks readable false.
import fs from 'node:fs';
import path from 'node:path';
import { gablePands, setPands } from './sources.ts';
import { HAND_SET_VERSION, READING_CONVENTION, UNKNOWN, validateGableRows, validateHandSet, type GableRowSet, type HandFront, type HandPand, type HandSet, type Reading } from '../../../src/canalRecall/houseSpec/handSet.ts';
import { specProblems, type HouseSpec } from '../../../src/canalRecall/houseSpec/spec.ts';

export const HELP = `hand-set build: reading logs -> data/house-line/hand-set-v1.json and hand-set-v1.reader-b.json (validated).

  node --import tsx scripts/house-specs/hand-set/build.ts [--date YYYY-MM-DD]`;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const D = path.join(ROOT, 'data/house-line');

export function parseRow(line: string, images: { ref: string; sha256: string }[]): Omit<HandPand, 'group'> {
  const [pandId, panel, axes, storeys, flags, gable, finish, wall, pui, note] = line.split('\t');
  const ref = images['ABC'.indexOf(panel)]?.ref; if (!ref) throw new Error(`${pandId}: no panel ${panel}`);
  if (axes === 'UNREADABLE') {
    const nul = <T,>(): Reading<T> => ({ value: UNKNOWN, confidence: 'low', ref });
    return { pandId, images, readable: false, extent: 'single', fields: { axes: nul(), storeys: nul(), gable: nul(), finish: nul(), wall: nul(), pui: nul() }, notes: note };
  }
  const r = <T,>(cell: string, num = false): Reading<T> => { const [v, c] = cell.split(':'); return { value: v === '-' ? UNKNOWN : (num ? Number(v) : v) as T, confidence: c as Reading<T>['confidence'], ref }; };
  const fl = flags === '-' ? [] : flags.split(',');
  const aps = fl.find(f => f.startsWith('aps=')), crowns = fl.find(f => f.startsWith('crowns='));
  return {
    pandId, images, readable: true, extent: fl.includes('multi') ? 'multi' : 'single',
    fields: {
      axes: r<number>(axes, true), ...(aps ? { axesPerStorey: aps.slice(4).split('-').map(Number) } : {}), storeys: r<number>(storeys, true),
      ...(fl.includes('souterrain') ? { souterrain: true } : {}), ...(fl.includes('entresol') ? { entresol: true } : {}), ...(fl.includes('atticInCrown') ? { atticInCrown: true } : {}),
      gable: r(gable), ...(crowns ? { crowns: Number(crowns.slice(7)) } : {}), finish: r(finish), wall: r(wall), pui: r(pui),
    },
    notes: note,
  };
}

/** Reader A's per-front cells (hand-set-v1.reader-a.fronts.json) -> HandFronts, read from panel A. */
export function parseFronts(cells: any[], ref: string): HandFront[] {
  return cells.map(c => {
    const row = parseRow(['0000000000000000', 'A', c.axes, c.storeys, c.flags ?? '-', c.gable, c.finish, c.wall, c.pui, c.note ?? ''].join('\t'), [{ ref, sha256: '' }]);
    const { axesPerStorey: _a, ...f } = row.fields;
    return { share: c.share, ...f } as HandFront;
  });
}

const CONF = { high: 0.9, med: 0.7, low: 0.5 } as const;
/** A multi pand's hand fronts as a HouseSpec: one `design.fronts[]` entry per front with its `share`, source author. Unknown
 *  values are left out (nothing is invented); wall colour and pui have no per-front spec field and stay in the hand set. */
export function multiSpec(h: HandPand, date: string): HouseSpec {
  const spec: HouseSpec = { schemaVersion: 1, pandId: h.pandId, design: { fronts: [] }, provenance: {} };
  h.fronts!.forEach((fr, i) => {
    const f: Record<string, unknown> = { share: fr.share };
    spec.provenance[`fronts/${i}/share`] = { source: 'author', confidence: 0.7, ref: `${fr.axes.ref} (hand set v1, reader A)`, at: date };
    const put = (k: string, r: Reading<unknown>) => { if (r.value === UNKNOWN) return; f[k] = r.value; spec.provenance[`fronts/${i}/${k}`] = { source: 'author', confidence: CONF[r.confidence], ref: `${r.ref} (hand set v1, reader A)`, at: date }; };
    put('bays', fr.axes); put('storeys', fr.storeys); put('gable', fr.gable);
    spec.design.fronts!.push(f as any);
  });
  return spec;
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
  const frontsFile = path.join(D, 'hand-set-v1.reader-a.fronts.json');
  if (fs.existsSync(frontsFile)) for (const [id, cells] of Object.entries<any[]>(JSON.parse(fs.readFileSync(frontsFile, 'utf8')).fronts)) {
    const h = a.pands.find(p => p.pandId === id); if (!h) throw new Error(`fronts: ${id} not in the set`);
    h.fronts = parseFronts(cells, h.images[0].ref);
  }
  const extentA = new Map(a.pands.map(p => [p.pandId, p.extent]));
  /** A blind reader's raw records -> HandPands: null and missing fields become "unknown" (the v1 convention said null), axes 0 (a
   *  one-storey front) becomes unknown, and a reader that did not state extent (B read the v1 convention) takes reader A's. */
  const blind = (file: string, reader: string): HandSet => ({ version: HAND_SET_VERSION, reader, date, convention: READING_CONVENTION, pands: JSON.parse(fs.readFileSync(path.join(D, file), 'utf8')).map((r: any) => {
    const f = { ...r.fields };
    for (const k of ['axes', 'storeys', 'gable', 'finish', 'wall', 'pui']) { if (!f[k]) f[k] = { value: UNKNOWN, confidence: 'low', ref: imgs(r.pandId)[0].ref }; else if (f[k].value === null || f[k].value === undefined) f[k] = { ...f[k], value: UNKNOWN }; }
    if (f.axes.value === 0) f.axes = { ...f.axes, value: UNKNOWN, note: 'reader wrote 0 (no upper storey); normalised to unknown' };
    if (!r.readable) for (const k of ['axes', 'storeys', 'gable', 'finish', 'wall', 'pui']) f[k] = { ...f[k], value: UNKNOWN };
    return { pandId: r.pandId, group: byId.get(r.pandId)!.group, images: imgs(r.pandId), readable: r.readable, extent: r.extent === 'multi' || r.extent === 'single' ? r.extent : extentA.get(r.pandId)!, fields: f, ...(r.notes ? { notes: r.notes } : {}) };
  }) });
  const b = blind('hand-set-v1.reader-b.raw.json', 'B: blind second reader (Claude Opus subagent; saw only the v1 CONVENTION and the 30 sheets)');
  const sets: [string, HandSet][] = [['hand-set-v1.json', a], ['hand-set-v1.reader-b.json', b]];
  if (fs.existsSync(path.join(D, 'hand-set-v1.reader-c.raw.json'))) sets.push(['hand-set-v1.reader-c.json', blind('hand-set-v1.reader-c.raw.json', 'C: fresh blind reader after the rev-2 fixes (Claude Opus subagent; saw only the rev-2 CONVENTION and the same 30 sheets)')]);
  for (const [name, set] of sets) {
    const problems = validateHandSet(set); if (problems.length) { console.error(name, problems); process.exit(1); }
    fs.writeFileSync(path.join(D, name), JSON.stringify(set, null, 1) + '\n'); console.log(`${name}: ${set.pands.length} pands, ${set.pands.filter(p => p.readable).length} readable`);
  }
  // the multi pands' fronts as HouseSpecs (schema and validator only; not a source of the extract)
  const specs = a.pands.filter(h => h.fronts).map(h => multiSpec(h, date));
  for (const s of specs) { const pr = specProblems(s); if (pr.length) { console.error(s.pandId, pr); process.exit(1); } }
  fs.writeFileSync(path.join(D, 'hand-set-v1.multi-specs.json'), JSON.stringify(specs, null, 1) + '\n'); console.log(`hand-set-v1.multi-specs.json: ${specs.length} specs`);
  // gable-only rows: blind readers B2 (the record) and C2 (the second reader), from crown crops
  const gp = new Map(gablePands().map(p => [p.pandId, p]));
  const gimgs = (id: string) => gp.get(id)!.images.slice(0, 3).map(({ ref, sha256 }) => ({ ref, sha256 }));
  for (const [raw, out, who] of [['hand-set-v1.gable-b2.raw.json', 'hand-set-v1.gable-b2.json', 'B2: blind gable reader (Claude Opus subagent; saw only the rev-2 CONVENTION and the 40 crown sheets)'], ['hand-set-v1.gable-c2.raw.json', 'hand-set-v1.gable-c2.json', 'C2: second blind gable reader (Claude Opus subagent; same convention and sheets, read in reverse order)']] as const) {
    if (!fs.existsSync(path.join(D, raw))) continue;
    const set: GableRowSet = { version: HAND_SET_VERSION, reader: who, date, convention: READING_CONVENTION, rows: JSON.parse(fs.readFileSync(path.join(D, raw), 'utf8')).pands.map((r: any) => {
      const images = gimgs(r.pandId), ref = images['ABC'.indexOf(r.panel)]?.ref ?? images[0].ref;
      const unknown = !r.gable || r.gable === 'unknown';
      return { pandId: r.pandId, images, gable: { value: unknown ? UNKNOWN : r.gable, confidence: r.confidence ?? 'low', ref }, ...(r.crowns >= 2 ? { crowns: r.crowns } : {}), ...(r.note ? { note: r.note } : {}) };
    }) };
    const pr = validateGableRows(set); if (pr.length) { console.error(out, pr); process.exit(1); }
    fs.writeFileSync(path.join(D, out), JSON.stringify(set, null, 1) + '\n'); console.log(`${out}: ${set.rows.length} rows, ${set.rows.filter(r => r.gable.value !== UNKNOWN).length} read`);
  }
}
if (process.argv[1]?.endsWith('hand-set/build.ts')) main();
