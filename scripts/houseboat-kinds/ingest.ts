// Turns the blind city labelling pass (contact sheets of artifacts/houseboat-kinds/all,
// one line of codes per sheet in all-labels.txt) into scripts/houseboat-kinds/city-labels.json.
// Codes: a ark | b<d> barge, roofed share d/10 | h<d> hullbox, cabin share d/10 |
// e empty berth | s small open boat / not a houseboat | u unseen (trees, shadow).
//   npx tsx scripts/houseboat-kinds/ingest.ts
import fs from 'node:fs';

const OUT = 'artifacts/houseboat-kinds';
const order: string[] = JSON.parse(fs.readFileSync(`${OUT}/all-order.json`, 'utf8'));
const queue = new Set<string>(JSON.parse(fs.readFileSync(`${OUT}/queue.json`, 'utf8')));
const codes = fs.readFileSync(`${OUT}/all-labels.txt`, 'utf8').split('\n').filter(l => /^\d/.test(l)).flatMap(l => l.trim().split(/\s+/).slice(1));
if (codes.length !== order.length) throw Error(`${codes.length} codes for ${order.length} boats`);
const bad = codes.filter(c => !/^(a|e|s|u|[bh][1-9])$/.test(c));
if (bad.length) throw Error(`bad codes ${bad.join(' ')}`);
const boats: Record<string, string> = {}, repeat: Record<string, string> = {};
order.forEach((id, i) => { (queue.has(id) ? boats : repeat)[id] = codes[i]; });
const sorted = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync('scripts/houseboat-kinds/city-labels.json', JSON.stringify({
  source: 'PDOK Actueel_orthoHR 8 cm, labelled 2026-10-16 blind to classifier output (sheets shuffled by id hash, artifacts/houseboat-kinds/all); every ship-hull outline, every outline whose pixels may be empty water, and pontoons near the ship test, not already in labels.json',
  codes: { a: 'ark', 'b<d>': 'barge, roofed (cabins + wheelhouse) share d/10 of the length', 'h<d>': 'hullbox, cabin share d/10', e: 'empty berth: open water at the outline', s: 'small open boat, or not a houseboat', u: 'unseen: under trees or in shadow' },
  boats: sorted(boats),
  /** The 124 blind ring-canal boats of labels.json, labelled again in this pass: labeller repeatability. */
  repeat: sorted(repeat),
}, null, 0).replace(/,"/g, ',\n"'));
const tally = (o: Record<string, string>) => Object.values(o).reduce((m, c) => (m[c[0]] = (m[c[0]] ?? 0) + 1, m), {} as Record<string, number>);
console.log('city', Object.keys(boats).length, tally(boats), 'repeat', Object.keys(repeat).length, tally(repeat));
