/** J2 family 5 scorer. Hand truth (J2 lane, from sheets P-01..P-04): same-pand pairs P0..P13, decoys P14..P27 (different pands). null = crop framing differs too much to judge. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {CACHE} from './lib.mjs';
const pairs = JSON.parse(await fs.readFile(path.join(CACHE, 'pairs.json'), 'utf8'));
const sameB = {1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 10: 1, 11: 1, 12: 1, 13: 1, 9: 0, 0: null, 6: null, 7: null, 8: null}; // P9: the two crops show different buildings
const shop = {1: 1, 2: 1, 4: 1, 5: 1, 10: 1, 11: 1, 12: 0, 13: 1}; // same shopfront; P12 changed (Murugan sign vs plants)
const get = async (run, id) => JSON.parse(await fs.readFile(path.join(CACHE, 'runs/years', run, `${id}.json`), 'utf8')).response.answers;
const rep = {same_building: [0, 0], same_shopfront: [0, 0]};
for (const [i, p] of pairs.entries()) {
  const tb = p.kind === 'decoy' ? 0 : sameB[i], ts = p.kind === 'decoy' ? null : shop[i];
  for (const run of ['r1', 'r2']) {
    const a = await get(run, p.id);
    if (tb != null) { rep.same_building[1]++; rep.same_building[0] += (a.same_building.noul >= 0.5) === !!tb; }
    if (ts != null) { rep.same_shopfront[1]++; rep.same_shopfront[0] += (a.same_shopfront.noul >= 0.5) === !!ts; }
  }
}
console.log(Object.fromEntries(Object.entries(rep).map(([k, [c, n]]) => [k, `${c}/${n} (${(c / n * 100).toFixed(1)}%) over both runs`])));
