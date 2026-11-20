/**
 * Round-2 blind set, fixed before any flag-on frame is rendered: 20 cluster members chosen by sha1('postwar-blind2:' + id)
 * from those that
 *   - were not read (measured-fronts.json) and were not in round 1's sample (sample.json: its 60 measured + 15 blind);
 *   - have an accepted brick-only measurement (corrected-walls.json) and a straight capture (obliquity <= 25 deg);
 *   - the kit actually changes in the game: the probed wall moves by Delta E >= 6 (probe-all.json vs probe-all-on.json,
 *     numbers only, no frames).
 *   node --import tsx scripts/postwar-kit/split2.ts  -> artifacts/postwar-kit/blind2-ids.json, blind2-list.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { rgbToLab } from '../../src/canalRecall/look/brickTone.ts';
import { measuredFront } from '../../src/canalRecall/postwarKit/facts.ts';
import CORRECTED from '../../src/canalRecall/postwarKit/corrected-walls.json' with { type: 'json' };

const N = 20, MIN_DE = 6, MAX_OBLIQUITY = 25;
const OUT = path.resolve(import.meta.dirname, '../../artifacts/postwar-kit');
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
const all = read('sample-all.json') as Record<string, any>, round1 = read('sample.json') as Record<string, any>;
const off = read('probe-all.json') as Record<string, any>, on = read('probe-all-on.json') as Record<string, any>;
const lab = (hex: string) => rgbToLab([1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
const dE = (p: string, q: string) => { const a = lab(p), b = lab(q); return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); };
const walls = (CORRECTED as { walls: Record<string, string> }).walls;
const h = (id: string) => createHash('sha1').update(`postwar-blind2:${id}`).digest('hex');
const pool = Object.entries(all).filter(([id, r]) => r.photo && walls[id] && !round1[id] && !measuredFront(id) && (r.obliquityDeg ?? 90) <= MAX_OBLIQUITY
  && off[id]?.wallHex && on[id]?.wallHex && dE(off[id].wallHex, on[id].wallHex) >= MIN_DE).map(([id]) => id);
const ids = pool.sort((a, b) => h(a).localeCompare(h(b))).slice(0, N);
fs.writeFileSync(path.join(OUT, 'blind2-ids.json'), JSON.stringify(ids, null, 1));
fs.writeFileSync(path.join(OUT, 'blind2-list.json'), JSON.stringify(ids.map(id => ({ pandId: id, bearing: all[id].bearingDeg, pano: all[id].panoId, key: id })), null, 1));
console.log(`pool ${pool.length}; blind ${ids.length}`, ids.map(id => `${all[id].cluster} ${all[id].address}`));
