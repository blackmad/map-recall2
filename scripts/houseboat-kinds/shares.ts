// Share of open barges among labelled ship hulls, by the shape class houseboatKind uses.
//   npx tsx scripts/houseboat-kinds/shares.ts
import fs from 'node:fs';
import { classifyHouseboatHull, houseboatFrame, houseboatHullProfile, type Houseboat } from '../../src/canalRecall/houseboats.ts';
const { boats: labelled } = JSON.parse(fs.readFileSync('scripts/houseboat-kinds/labels.json', 'utf8'));
const { boats }: { boats: Houseboat[] } = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/houseboats.json', 'utf8'));
const byId = new Map(boats.map(b => [b.id, b]));
const t: Record<string, Record<string, number>> = {};
for (const [id, l] of Object.entries(labelled as Record<string, { label: string; set: string }>)) {
  if (l.label !== 'barge' && l.label !== 'hullbox') continue;
  const f = houseboatFrame(byId.get(id)!)!;
  if (classifyHouseboatHull(f.local, f.length, f.width) !== 'ship') continue;
  const { ends } = houseboatHullProfile(f.local, f.length, f.width);
  const pointed = Math.min(ends[0].widths[1], ends[1].widths[1]) <= 0.75;
  const cls = f.length > 28 ? 'long' : pointed ? 'pointed' : 'rounded';
  for (const key of [`${l.set}:${cls}`, `all:${cls}`, `${l.set}:any`, 'all:any']) {
    t[key] ??= { barge: 0, hullbox: 0 };
    t[key][l.label]++;
  }
}
for (const [k, v] of Object.entries(t).sort()) console.log(k.padEnd(18), JSON.stringify(v), (v.barge / (v.barge + v.hullbox)).toFixed(2));
