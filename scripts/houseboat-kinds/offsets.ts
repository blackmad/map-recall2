// Off-centre narrowing of the ship-like ends, per label: a chamfered pontoon corner
// narrows one side only; a bow curves in on both.
//   npx tsx scripts/houseboat-kinds/offsets.ts
import fs from 'node:fs';
import { houseboatFrame, houseboatHullProfile, SHIP_END, type Houseboat } from '../../src/canalRecall/houseboats.ts';
const { boats: labelled } = JSON.parse(fs.readFileSync('scripts/houseboat-kinds/labels.json', 'utf8'));
const { boats }: { boats: Houseboat[] } = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/houseboats.json', 'utf8'));
const byId = new Map(boats.map(b => [b.id, b]));
const out: Record<string, number[]> = {};
for (const [id, l] of Object.entries(labelled as Record<string, { label: string }>)) {
  if (l.label === 'none') continue;
  const f = houseboatFrame(byId.get(id)!)!;
  const { ends } = houseboatHullProfile(f.local, f.length, f.width);
  const e = ends.filter(e => e.widths[0] <= SHIP_END.at03 && e.widths[1] <= SHIP_END.at1);
  if (!e.length) continue;
  const k = l.label === 'ark' ? 'ark' : 'ship';
  (out[k] ??= []).push(+Math.min(...e.map(x => x.offset / Math.max(0.01, 1 - x.widths[0]))).toFixed(2));
}
for (const [k, v] of Object.entries(out)) console.log(k, v.sort((a, b) => a - b).join(' '));
