// City-wide houseboat kinds: the old rule, the footprint classifier, and with the
// corridor overrides (what the game draws).
//   npx tsx scripts/houseboat-kinds/counts.ts
import fs from 'node:fs';
import { houseboatFrame, houseboatKind, type Houseboat } from '../../src/canalRecall/houseboats.ts';
import { classifyHouseboatHullBefore } from './before.ts';
const { boats }: { boats: Houseboat[] } = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/houseboats.json', 'utf8'));
const tally = { before: {} as Record<string, number>, footprint: {} as Record<string, number>, drawn: {} as Record<string, number> };
for (const boat of boats) {
  const f = houseboatFrame(boat);
  if (!f) continue;
  const add = (t: Record<string, number>, k: string) => { t[k] = (t[k] ?? 0) + 1; };
  add(tally.before, classifyHouseboatHullBefore(boat.id, f.local, f.length, f.width));
  add(tally.footprint, houseboatKind(boat.id, f.local, f.length, f.width, {}));
  add(tally.drawn, houseboatKind(boat.id, f.local, f.length, f.width));
}
console.log(JSON.stringify(tally));
