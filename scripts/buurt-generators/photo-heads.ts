/**
 * Photo heads (buurt generators round 16): an opus reader's window-head reads (scripts/buurt-generators/heads-reader-prompt.md,
 * one line per row cut from row-cuts.ts) into the district's measured file as `photoHeads`, per pand, in the row kit's head
 * vocabulary (houseSpec/row/types.ts ROW_HEAD_SHAPES and ROW_HEAD_DRESSINGS). A read naming `other` or `unclear` keeps its
 * note and is never drawn (generate.ts photoHeadsOf); it is the list of what the kit cannot say.
 *
 *   node --import tsx scripts/buurt-generators/photo-heads.ts --district=de-pijp <readsDir...> [--reread=<dir>...]
 *
 * Round 17: a `--reread` dir (a re-read of chosen pands after the vocabulary grew, e.g. the `other` reads after lane R's
 * five dressings) replaces those pands' reads whatever their confidence; the plain dirs keep the most confident read.
 */
import fs from 'node:fs';
import { parseHeadsLine } from '../../src/canalRecall/buurtGenerator/generate.ts';

const district = process.argv.find(a => a.startsWith('--district='))?.slice(11) ?? 'de-pijp';
const dirs = process.argv.slice(2).filter(a => !a.startsWith('--'));
const rereads = process.argv.filter(a => a.startsWith('--reread=')).map(a => a.slice(9));
const staged = new Set((JSON.parse(fs.readFileSync(`artifacts/buurt-generators/${district}/row-front.json`, 'utf8')).records as Array<{ pandId: string }>).map(r => r.pandId));
const best = new Map<string, NonNullable<ReturnType<typeof parseHeadsLine>>>();
let lines = 0, bad = 0;
for (const d of dirs) for (const f of fs.readdirSync(d).filter(x => /^read-\d+\.txt$/.test(x)).sort())
  for (const line of fs.readFileSync(`${d}/${f}`, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    lines++;
    const r = parseHeadsLine(line);
    if (!r) { bad++; continue; }
    if (!best.has(r.pandId) || r.confidence > best.get(r.pandId)!.confidence) best.set(r.pandId, r);
  }
for (const d of rereads) for (const f of fs.readdirSync(d).filter(x => /^read-\d+\.txt$/.test(x)).sort())
  for (const line of fs.readFileSync(`${d}/${f}`, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    lines++;
    const r = parseHeadsLine(line);
    if (!r) { bad++; continue; }
    best.set(r.pandId, r);
  }
const file = `src/canalRecall/buurtGenerator/districts/measured/${district}.json`, m = JSON.parse(fs.readFileSync(file, 'utf8'));
m.photoHeads = Object.fromEntries([...best].filter(([pid]) => staged.has(pid)).sort(([a], [b]) => (a < b ? -1 : 1)).map(([pid, r]) => [pid, { heads: r.heads, confidence: r.confidence, ...(r.note ? { note: r.note } : {}) }]));
m.photoHeadsSource = 'opus window-head reads (scripts/buurt-generators/heads-reader-prompt.md) of one rectified panorama cut per row (scripts/buurt-generators/row-cuts.ts; data.amsterdam.nl panoramas, CC BY 4.0)';
fs.writeFileSync(file, JSON.stringify(m, null, 2) + '\n');
console.log(`${district}: ${lines} lines, ${bad} unparsed, ${Object.keys(m.photoHeads).length} pands on staged rows`);
