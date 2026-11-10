// Byte-identity proof for the H1c axis units (#350, docs/house-line.md §1 "Odd bays"): the photo-look mesh of every
// building in the house-spec tiles (walls, extras and shell chunks, built per z14 tile as the runtime does), hashed per
// building (positions, uvs, layers, tints, accents of its vertex range).
//   npx tsx scripts/house-specs/odd-cells-hash.ts [--dir=house-specs] [--force-bays] [--out <file.json>]
// --force-bays stamps each spec'd building's view bays as specRecipe.bays (what decorate.ts writes once SPEC_BAYS_HELD is
// lifted), so the mesher's spec path runs. Compare two runs with --diff a.json b.json.
import '../world/useBrowserMath.js';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { EXTRACT, ROOT, gameChain, loadTile, type Feature } from '../world/pipeline.ts';
import { shellProfiles, shellStreets } from '../world/shellBake.ts';
import { buildFeatureChunk } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { BuildingContextIndex } from '../../src/canalRecall/buildingContextIndex.ts';

export const HELP = `odd-cells-hash [--dir=house-specs] [--force-bays] [--out <file>] | --diff <a.json> <b.json>
  per-building mesh hashes (photo look; walls, extras, shell) over the house-spec tiles; --diff lists the buildings that differ`;
const args = process.argv.slice(2);
if (args.includes('--help')) { console.log(HELP); process.exit(0); }
if (args[0] === '--diff') {
  const a = JSON.parse(fs.readFileSync(args[1], 'utf8')), b = JSON.parse(fs.readFileSync(args[2], 'utf8'));
  const ids = new Set([...Object.keys(a.hashes), ...Object.keys(b.hashes)]);
  const diff = [...ids].filter(id => a.hashes[id] !== b.hashes[id]).sort();
  console.log(JSON.stringify({ buildings: ids.size, differ: diff.length, ids: diff.slice(0, 200), a: a.meta, b: b.meta }, null, 1));
  process.exit(0);
}
const dir = args.find(a => a.startsWith('--dir='))?.slice(6) ?? 'house-specs';
const force = args.includes('--force-bays');
const outAt = args.indexOf('--out');
process.env.HOUSE_SPECS = '1'; process.env.HOUSE_SPECS_DIR = dir;
const chain = gameChain();
const base = path.join(EXTRACT, dir, '14');
const tiles: string[] = [];
for (const x of fs.readdirSync(base)) for (const y of fs.readdirSync(path.join(base, x))) tiles.push(`${x}/${y.replace('.json.gz', '')}`);
const boxOf = (f: Feature): [number, number, number, number] => {
  const ring = (f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates[0])[0] as number[][];
  return [Math.min(...ring.map(p => p[0])), Math.min(...ring.map(p => p[1])), Math.max(...ring.map(p => p[0])), Math.max(...ring.map(p => p[1]))];
};
const hashes: Record<string, string> = {};
let forced = 0;
for (const tile of tiles.sort()) {
  const rows = await loadTile(tile, chain);
  const features = rows.map(r => {
    const v = r.raw.properties.houseSpec as { bays?: number; src?: { bays?: string } } | undefined;
    if (!force || !v?.bays || v.src?.bays === 'default' || r.styled.properties.specRecipe && (r.styled.properties.specRecipe as { bays?: number }).bays) return r.styled;
    forced++;
    return { ...r.styled, properties: { ...r.styled.properties, specRecipe: { ...(r.styled.properties.specRecipe as object ?? {}), bays: v.bays } } };
  });
  const ctx = new BuildingContextIndex(features as never, boxOf as never);
  const inChunk = new Set(features);
  const context = ctx.neighbors(features as never, (f: Feature) => inChunk.has(f));
  const streets = shellStreets(ROOT, features as never), profiles = shellProfiles(ROOT);
  for (const mode of ['walls', 'extras', 'shell'] as const) {
    const c = buildFeatureChunk(features as never, 'photo', mode, streets, profiles, context as never);
    for (const r of c.ranges) {
      const h = createHash('sha256');
      for (const [arr, k] of [[c.positions, 3], [c.uvs, 2], [c.layers, 1], [c.tints, 4], [c.accents, 4]] as const) {
        const view = (arr as Float32Array | Uint8Array).subarray(r.start * k, (r.start + r.count) * k);
        h.update(Buffer.from(view.buffer, view.byteOffset, view.byteLength));
      }
      const key = `${mode}:${r.id}`;
      hashes[key] = createHash('sha256').update((hashes[key] ?? '') + h.digest('hex')).digest('hex').slice(0, 16);
    }
  }
}
const all = createHash('sha256').update(Object.keys(hashes).sort().map(k => `${k}=${hashes[k]}`).join('\n')).digest('hex').slice(0, 16);
const meta = { dir, force, forced, tiles: tiles.length, entries: Object.keys(hashes).length, all, oddAxisCells: process.env.ODD_AXIS_CELLS ?? 'default' };
console.log(JSON.stringify(meta));
if (outAt >= 0) fs.writeFileSync(args[outAt + 1], JSON.stringify({ meta, hashes }));
