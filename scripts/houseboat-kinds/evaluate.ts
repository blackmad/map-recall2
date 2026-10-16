// Confusion matrix of the houseboat kind classifier against the orthophoto labels
// (overrides off: this measures the footprint classifier, not the labels table).
//   npx tsx scripts/houseboat-kinds/evaluate.ts [--table]
import fs from 'node:fs';
import { classifyHouseboatHull, houseboatFrame, houseboatKind, type Houseboat } from '../../src/canalRecall/houseboats.ts';
import { classifyHouseboatHullBefore } from './before.ts';

type Label = { label: string; sheet: number; set: string; note?: string };
const { boats: labelled }: { boats: Record<string, Label> } = JSON.parse(fs.readFileSync('scripts/houseboat-kinds/labels.json', 'utf8'));
const { boats }: { boats: Houseboat[] } = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/houseboats.json', 'utf8'));
const byId = new Map(boats.map(b => [b.id, b]));
/** Held out: the ring-canal set, labelled blind after the classifier was fixed. */
const heldOut = (l: Label) => l.set === 'ring';

const rows = Object.entries(labelled).filter(([, l]) => l.label !== 'none').map(([id, l]) => {
  const f = houseboatFrame(byId.get(id)!)!;
  return { id, truth: l.label, held: heldOut(l), n: f.local.length, L: f.length, W: f.width, kind: process.env.BEFORE ? classifyHouseboatHullBefore(id, f.local, f.length, f.width) : houseboatKind(id, f.local, f.length, f.width, {}), hull: classifyHouseboatHull(f.local, f.length, f.width) };
});
const truths = ['ark', 'barge', 'hullbox'];
const kinds = [...new Set(rows.map(r => r.kind))].sort();
const matrix = (set: typeof rows) => {
  const m: Record<string, Record<string, number>> = {};
  for (const t of truths) m[t] = Object.fromEntries(kinds.map(k => [k, 0]));
  for (const r of set) m[r.truth][r.kind]++;
  // Hull correctness: an ark must be drawn as an ark; barge/hullbox truths need a ship hull.
  const hullOk = set.filter(r => (r.truth === 'ark') === (r.kind === 'ark')).length;
  const exact = set.filter(r => r.truth === r.kind).length;
  return { m, n: set.length, hullAccuracy: +(hullOk / set.length).toFixed(3), exactAccuracy: +(exact / set.length).toFixed(3) };
};
const report = { all: matrix(rows), tuning: matrix(rows.filter(r => !r.held)), heldOut: matrix(rows.filter(r => r.held)) };
console.log(JSON.stringify(report, null, 1));
if (process.argv.includes('--table')) for (const r of rows) console.log([r.id, r.truth, r.kind, r.n, r.L.toFixed(1), r.W.toFixed(1), r.held ? 'held' : ''].join('\t'));
if (process.argv.includes('--write')) fs.writeFileSync(process.argv[process.argv.indexOf('--write') + 1], JSON.stringify(report, null, 1));
// Review captions for crops.ts (CAPTIONS=...): label, old rule, footprint classifier, drawn.
if (process.argv.includes('--captions')) {
  const captions: Record<string, string> = {};
  for (const [id, l] of Object.entries(labelled)) {
    const f = houseboatFrame(byId.get(id)!)!;
    captions[id] = `photo ${l.label} | old ${classifyHouseboatHullBefore(id, f.local, f.length, f.width)} | new ${houseboatKind(id, f.local, f.length, f.width, {})} | drawn ${houseboatKind(id, f.local, f.length, f.width)}`;
  }
  fs.writeFileSync(process.argv[process.argv.indexOf('--captions') + 1], JSON.stringify(captions));
}
