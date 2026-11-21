/**
 * Round 2 blind set (lane postwar-kit-r2-20261121), fixed before any round-2 frame is rendered: per item, members chosen
 * by sha1('postwar-r2-blind:' + id) from the pands whose kit the round changes:
 *   stair: a feature-read glazed stair; erker: a white/brick erker or a counted erker; balcony: balconies from an own
 *   feature read on an unread pand; sibling: balconies inferred from a read sibling; curved: a kit pand with a band or
 *   arcade over a curved run (curves.json). Writes artifacts/postwar-kit/blind-r2-ids.json and -list.json.
 *   node --import tsx scripts/postwar-kit/split-r2.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { postwarKitFor } from '../../src/canalRecall/postwarKit/kit.ts';
import { measuredFront } from '../../src/canalRecall/postwarKit/facts.ts';
const OUT = path.resolve(import.meta.dirname, '../../artifacts/postwar-kit');
const ROOT = path.resolve(import.meta.dirname, '../..');
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const FEAT = read(path.join(ROOT, 'src/canalRecall/postwarKit/feature-reads.json')).features as Record<string, any>;
const SIB = read(path.join(ROOT, 'src/canalRecall/postwarKit/sibling-features.json')).siblings as Record<string, any>;
const sample = read(path.join(OUT, 'sample-all.json')) as Record<string, any>;
const curves = read(path.join(OUT, 'curves.json')) as Record<string, any>;
const h = (id: string) => createHash('sha1').update(`postwar-r2-blind:${id}`).digest('hex');
const kitOf = (id: string) => postwarKitFor({ id, year: sample[id]?.year ?? 1990, heightM: sample[id]?.heightM ?? 15, use: 'housing' });
const longCurve = (id: string) => (curves[id]?.chains ?? []).some((c: any) => c.lenM >= 10 && c.radiusM >= 8);
const pools: Record<string, string[]> = {
  stair: Object.keys(FEAT).filter(id => FEAT[id].stair && kitOf(id)?.stair),
  erker: [...Object.keys(FEAT).filter(id => FEAT[id].erker && kitOf(id)?.erkerCount),
    ...Object.keys(sample).filter(id => measuredFront(id) && ['white-glass', 'brick'].includes(kitOf(id)?.erker ?? ''))],
  balcony: Object.keys(FEAT).filter(id => FEAT[id].balcony && !measuredFront(id) && !FEAT[id].stair && !FEAT[id].erker && kitOf(id)?.balcony !== 'none'),
  sibling: Object.keys(SIB),
  curved: Object.keys(sample).filter(id => longCurve(id) && (k => k && (k.balcony === 'band' || k.arcade))(kitOf(id))),
};
const N: Record<string, number> = { stair: 4, erker: 4, balcony: 4, sibling: 4, curved: 3 };
const ids: Array<{ item: string; id: string }> = [], seen = new Set<string>();
for (const [item, pool] of Object.entries(pools)) {
  const pick = pool.filter(id => !seen.has(id)).sort((a, b) => h(a).localeCompare(h(b))).slice(0, N[item]);
  for (const id of pick) { seen.add(id); ids.push({ item, id }); }
  console.log(item, pool.length, pick.map(id => sample[id]?.address ?? id));
}
fs.writeFileSync(path.join(OUT, 'blind-r2-ids.json'), JSON.stringify(ids, null, 1));
fs.writeFileSync(path.join(OUT, 'blind-r2-list.json'), JSON.stringify(ids.map(({ id }) => ({ pandId: id, key: id, ...(sample[id] ? { bearing: sample[id].bearingDeg, pano: sample[id].panoId } : {}) })), null, 1));
