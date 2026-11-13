/**
 * Lane PR1 step 3: the house:frames lists for the structure prior's photo / off / on triples.
 *
 *   node --import tsx scripts/house-line/structure/frames-lists.ts [--seed 1113] [--n 30] --out <dir>
 *
 * <out>/eyeball.frames.json: the easy-houses set (docs/house-line.md §6b), Nassaukade 150 (the Nassaukade 506 block),
 * Weteringschans 0363100012171218 and Keizersgracht 0363100012165023.
 * <out>/random.frames.json: `n` generic pands drawn with a seeded generator from every pand of the building tiles, kept
 * when the Node probe draws them on the generic path with a ground-level street run, built before 1945, with no
 * HouseSpec count (the pands the prior is for); each with the off and on grid it draws, so a triple can be checked.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../../house-preview/nodeDom.ts';
import { StructureProbe } from './probe.ts';
import { resetStructurePriorFlag } from '../../../src/canalRecall/houseSpec/structurePrior.ts';

const args = process.argv.slice(2), opt = (k: string, d?: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const out = opt('--out')!, seed = Number(opt('--seed', '1113')), n = Number(opt('--n', '30'));
fs.mkdirSync(out, { recursive: true });
const easy = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'scripts/house-specs/sets/easy-houses-20261110.json'), 'utf8')).pands.map((p: { pandId: string }) => p.pandId);
const eyeball = [...easy, '0363100012164843', '0363100012171218', '0363100012165023'];
const entry = (id: string) => ({ pandId: id, key: id, maxDistM: 60 });
fs.writeFileSync(path.join(out, 'eyeball.frames.json'), JSON.stringify(eyeball.map(entry), null, 1));

// mulberry32
let s = seed >>> 0;
const rand = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const all = Object.keys(JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'artifacts/house-preview/pand-tiles.json'), 'utf8'))).sort();
const probe = new StructureProbe();
const picked: { id: string; off: unknown; on: unknown }[] = [];
const seen = new Set<string>();
const grid = (r: Awaited<ReturnType<StructureProbe['probe']>>) => r.drawn ? { storeys: r.drawn.storeys, columns: r.drawn.columns, fit: r.drawn.fit } : null;
while (picked.length < n && seen.size < all.length) {
  const id = all[Math.floor(rand() * all.length)];
  if (seen.has(id)) continue;
  seen.add(id);
  process.env.STRUCTURE_PRIOR = '0'; resetStructurePriorFlag();
  const off = await probe.probe(id).catch(() => null);
  if (!off || off.route !== 'generic' || !off.drawn || off.drawn.recipe || off.year === null || off.year >= 1945 || off.spec?.storeys || off.spec?.bays) continue;
  process.env.STRUCTURE_PRIOR = 'all'; resetStructurePriorFlag();
  const on = await probe.probe(id);
  delete process.env.STRUCTURE_PRIOR; resetStructurePriorFlag();
  picked.push({ id, off: { year: off.year, ...grid(off) }, on: grid(on) });
  console.log(`${picked.length}/${n} ${id} ${off.year} off ${JSON.stringify(grid(off))} on ${JSON.stringify(grid(on))}`);
}
fs.writeFileSync(path.join(out, 'random.frames.json'), JSON.stringify(picked.map(p => entry(p.id)), null, 1));
fs.writeFileSync(path.join(out, 'random.grids.json'), JSON.stringify({ seed, tried: seen.size, picked }, null, 1));
