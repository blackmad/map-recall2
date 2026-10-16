// Which outlines need eyes on the orthophoto: every ship hull (the outline cannot tell
// barge from hullbox), and every pontoon whose pixels look like an empty berth or whose
// outline is close to a ship's. The rest are arks with something on them.
//   npx tsx scripts/houseboat-kinds/select.ts -> artifacts/houseboat-kinds/queue.json (+ report on labels)
import fs from 'node:fs';
import { classifyHouseboatHull, houseboatFrame, houseboatHullProfile, type Houseboat } from '../../src/canalRecall/houseboats.ts';
import type { PixelStats } from './pixels.ts';

const OUT = 'artifacts/houseboat-kinds';
const { boats }: { boats: Houseboat[] } = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/houseboats.json', 'utf8'));
const px: Record<string, PixelStats> = JSON.parse(fs.readFileSync(`${OUT}/pixels.json`, 'utf8'));
const labels: Record<string, { label: string }> = JSON.parse(fs.readFileSync('scripts/houseboat-kinds/labels.json', 'utf8')).boats;

/** Pixels that could be bare water or deep shadow: the interior matches the water around
 *  it and is smooth. Bounds from the 50 labelled `none` outlines (scripts/houseboat-kinds/labels.json). */
export const emptyish = (s: PixelStats) => Math.hypot(s.inner[0] - s.outer[0], s.inner[1] - s.outer[1], s.inner[2] - s.outer[2]) <= 16 || s.grad <= 6;

const why = new Map<string, string>();
for (const b of boats) {
  const f = houseboatFrame(b), s = px[b.id];
  if (!f || !s) { why.set(b.id, 'unmeasured'); continue; }
  const hull = classifyHouseboatHull(f.local, f.length, f.width);
  const prof = houseboatHullProfile(f.local, f.length, f.width);
  const nearShip = f.local.length > 4 && prof.aspect >= 2.6 && Math.min(prof.ends[0].widths[1], prof.ends[1].widths[1]) < 0.99;
  if (hull === 'ship') why.set(b.id, 'ship');
  else if (emptyish(s)) why.set(b.id, 'empty?');
  else if (nearShip) why.set(b.id, 'near-ship');
}
const tally = (xs: string[]) => xs.reduce((m, x) => (m[x] = (m[x] ?? 0) + 1, m), {} as Record<string, number>);
console.log('queue reasons (all boats)', tally([...why.values()]), 'auto ark', boats.length - why.size);
// On the labelled boats: what does each queue reason hold, and is "auto ark" safe?
const onLabels: Record<string, Record<string, number>> = {};
for (const [id, l] of Object.entries(labels)) {
  const r = why.get(id) ?? 'auto-ark';
  (onLabels[r] ??= {})[l.label] = (onLabels[r][l.label] ?? 0) + 1;
}
console.log('labels by reason', onLabels);
const queue = [...why.entries()].filter(([id, r]) => r !== 'unmeasured' && !labels[id]).map(([id]) => id);
fs.writeFileSync(`${OUT}/queue.json`, JSON.stringify(queue));
console.log(`queue ${queue.length} unlabelled -> ${OUT}/queue.json`);
