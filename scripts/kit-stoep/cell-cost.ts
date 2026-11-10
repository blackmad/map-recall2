// Triangle cost of spec stoops on the generic path (K-stoep #360), per z14 tile, in Node on the game chain.
//   HOUSE_SPECS_DIR=staging/house-specs node --import tsx scripts/kit-stoep/cell-cost.ts [--tiles=8414/5384,...]
// For every tile of the spec extract that holds a generic-path pand with a stoop (no installed model hides it): the
// near-tier chunk (walls + extras, as the runtime builds one per tile) with `specStoop` stripped from the decorated
// features (today's world) and kept (after publish). Prints triangles per tile, the delta and its share.
import '../world/useBrowserMath.js';
import fs from 'node:fs';
import path from 'node:path';
import { EXTRACT, ROOT, gameChain, loadTile, readJson } from '../world/pipeline.ts';
import { shellProfiles, shellStreets } from '../world/shellBake.ts';
import { buildFeatureChunk } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { stoopExtraStats } from '../../src/canalRecall/stoopExtra.ts';

const dir = process.env.HOUSE_SPECS_DIR ?? 'staging/house-specs';
process.env.HOUSE_SPECS_DIR = dir;
const covers = readJson(path.join(ROOT, 'public/canal-drive/models/covers.json'));
const hidden = new Set<string>([...Object.values<any>(covers.models).flatMap(m => m.p ?? []), ...covers.buildingTypes].map(String));
let tiles = process.argv.find(a => a.startsWith('--tiles='))?.slice(8).split(',');
if (!tiles) {
  tiles = [];
  const base = path.join(EXTRACT, dir, '14');
  for (const x of fs.readdirSync(base)) for (const y of fs.readdirSync(path.join(base, x))) tiles.push(`${x}/${y.replace('.json.gz', '')}`);
}
const chain = gameChain(), profiles = shellProfiles(ROOT);
const tris = (fs_: any[], streets: Float32Array | undefined) => ['walls', 'extras'].reduce((n, mode) => n + buildFeatureChunk(fs_ as never, 'photo' as never, mode as never, streets, profiles).indices.length / 3, 0);
const rows: any[] = [];
for (const tile of tiles.sort()) {
  const all = await loadTile(tile, chain);
  const stooped = all.filter(r => r.styled.properties.specStoop && !hidden.has(String(r.styled.properties.id).slice(-16)));
  if (!stooped.length) continue;
  const on = all.map(r => r.styled), off = on.map(f => { if (!f.properties.specStoop) return f; const { specStoop, ...p } = f.properties; return { ...f, properties: p }; });
  const streets = shellStreets(ROOT, on as never);
  const a = tris(off, streets), b = tris(on, streets);
  rows.push({ tile, stoops: stooped.length, before: a, after: b, delta: b - a, share: +((b - a) / a * 100).toFixed(2) });
  console.log(`${tile}: ${stooped.length} stoops, ${a} -> ${b} triangles (+${b - a}, ${((b - a) / a * 100).toFixed(2)} %)`);
}
const sum = rows.reduce((s, r) => ({ before: s.before + r.before, after: s.after + r.after, stoops: s.stoops + r.stoops }), { before: 0, after: 0, stoops: 0 });
console.log(JSON.stringify({ tiles: rows.length, ...sum, typed: stoopExtraStats, perStoop: +((sum.after - sum.before) / Math.max(1, sum.stoops)).toFixed(1), maxShare: Math.max(0, ...rows.map(r => r.share)) }));
fs.mkdirSync('artifacts/kit-stoep', { recursive: true });
fs.writeFileSync('artifacts/kit-stoep/cell-cost.json', JSON.stringify(rows, null, 1));
