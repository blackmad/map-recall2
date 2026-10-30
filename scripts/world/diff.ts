/**
 * Diff the staged world-v1 cells against the published tiles, for the integrator's review:
 *   node --import tsx scripts/world/diff.ts [artifacts/world/staging]  -> <staging>/diff.json + a table
 * Rows: pands in building-tiles but not staged (should be exactly dropNestedDuplicates' drops), pands
 * staged but not in building-tiles (should be none), vs bag-tiles (the other published set): ids only in
 * one, heights differing > 0.25 m, and roof kinds the decorator chain changed from the tile's own tag.
 */
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { decodeCell, styledFeature } from '../../src/canalRecall/world/cellFormat.js';
import { EXTRACT } from './pipeline.js';

const dir = path.resolve(process.argv[2] ?? 'artifacts/world/staging');
const staged = new Map<string, { height: unknown; tag: unknown; kind: unknown }>();
for (const f of fs.readdirSync(path.join(dir, 'cells'))) {
  const cell = decodeCell(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'cells', f))), f);
  for (const b of cell.buildings) { if (staged.has(b.id)) throw Error(`${b.id} staged twice`); staged.set(b.id, { height: b.attr.height, tag: b.attr.roofShape, kind: styledFeature(b).properties.roofShape }); }
}
const readSet = (d: string) => {
  const out = new Map<string, Record<string, unknown>>(), idx = JSON.parse(fs.readFileSync(path.join(EXTRACT, d, 'index-z14.json'), 'utf8'));
  for (const t of idx.tileList) { const p = path.join(EXTRACT, d, `${t}.geojson.gz`); if (!fs.existsSync(p)) continue; for (const f of JSON.parse(zlib.gunzipSync(fs.readFileSync(p)).toString()).features) out.set(String(f.properties.id), f.properties); }
  return out;
};
const tiles = readSet('building-tiles'), bag = readSet('bag-tiles');
const notStaged = [...tiles.keys()].filter(id => !staged.has(id)), notInTiles = [...staged.keys()].filter(id => !tiles.has(id));
const onlyBag = [...bag.keys()].filter(id => !staged.has(id) && !tiles.has(id)), onlyStaged = [...staged.keys()].filter(id => !bag.has(id));
const heightDiff = [...staged].filter(([id, s]) => bag.has(id) && Math.abs(Number(s.height) - Number(bag.get(id)!.height)) > 0.25).map(([id, s]) => ({ id, staged: s.height, bag: bag.get(id)!.height }));
const kinds = new Map<string, number>();
for (const s of staged.values()) if (typeof s.tag === 'string' && s.tag !== s.kind) { const k = `${s.tag} -> ${String(s.kind)}`; kinds.set(k, (kinds.get(k) ?? 0) + 1); }
const planned = [...staged.values()].filter(s => s.tag === undefined && s.kind !== undefined).length;
const diff = { staged: staged.size, buildingTiles: tiles.size, bagTiles: bag.size, notStagedFromTiles: notStaged.length, notStagedSample: notStaged.slice(0, 20), stagedNotInTiles: notInTiles,
  onlyInBagTiles: onlyBag.length, onlyBagSample: onlyBag.slice(0, 20), stagedNotInBagTiles: onlyStaged.length, heightsDifferVsBag: heightDiff.length, heightSample: heightDiff.slice(0, 20),
  roofTagChangedByChain: Object.fromEntries([...kinds].sort((a, b) => b[1] - a[1])), roofPlannedWithoutTag: planned };
fs.writeFileSync(path.join(dir, 'diff.json'), JSON.stringify(diff, null, 2));
console.log(`| row | count | explanation |\n|---|---:|---|`);
console.log(`| building-tiles pands not staged | ${notStaged.length} | dropNestedDuplicates drops (the default path drops the same per tile) |`);
console.log(`| staged pands not in building-tiles | ${notInTiles.length} | must be 0 |`);
console.log(`| bag-tiles ids not staged (and not in building-tiles) | ${onlyBag.length} | in bag-tiles only (?bagTiles=1 set) |`);
console.log(`| staged ids not in bag-tiles | ${onlyStaged.length} | building-tiles only |`);
console.log(`| heights differing > 0.25 m vs bag-tiles | ${heightDiff.length} | |`);
console.log(`| tile roofShape tag changed by the chain | ${[...kinds.values()].reduce((a, b) => a + b, 0)} | ${[...kinds].slice(0, 6).map(([k, n]) => `${k}: ${n}`).join('; ')} |`);
console.log(`| roofs planned on untagged pands | ${planned} | decorateRoof, as at runtime |`);
