/**
 * Shop runs census (lane shop-band-ground-20261121, src/canalRecall/shopRun.ts): how many shop pands city-wide change
 * under SHOP_RUN=1, and how many wall runs (and metres of ground storey) move from the shop ground to the quiet ground.
 * Each z14 tile is built alone with its streets (walls mode, photo look), so a wall at a tile border whose neighbour sits
 * in the next tile counts as exposed: the counts are a slight overestimate there.
 *
 *   SHOP_RUN=1 node --import tsx scripts/retail-ground/shop-run-census.ts [--tiles=N] [--only=x/y,x/y] [--out=artifacts/shop-run/census.json]
 */
import '../world/useBrowserMath.ts';
import fs from 'node:fs';
import path from 'node:path';
if (process.env.SHOP_RUN !== '1') throw new Error('run with SHOP_RUN=1');
const { gameChain, loadTile, EXTRACT, ROOT } = await import('../world/pipeline.ts');
const { shellStreets, shellProfiles } = await import('../world/shellBake.ts');
const { buildFeatureChunk } = await import('../../src/canalRecall/threeBuildingFeatures.ts');
const { shopRunProbe } = await import('../../src/canalRecall/threeBuildingMesh.ts');

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const out = path.resolve(arg('out') ?? path.join(ROOT, 'artifacts/shop-run/census.json'));
const root = path.join(EXTRACT, 'building-tiles/14');
const tiles = fs.readdirSync(root).flatMap(x => fs.readdirSync(path.join(root, x)).map(f => `${x}/${f.replace(/\.geojson\.gz$/, '')}`)).sort().filter(t => !arg('only') || arg('only')!.split(',').includes(t)).slice(0, Number(arg('tiles') ?? Infinity));
const chain = gameChain();
type Row = { id: string; tile: string; anchors: number; runs: number; streetRuns: number; shopRuns: number; quietRuns: number; quietM: number; quietStreetRuns: number; shopM: number; /** The longest quieted street run and the longest kept street run: middle [lng, lat], bearing, length. */ quietWall?: { at: [number, number]; bearing: number; lenM: number }; shopWall?: { at: [number, number]; bearing: number; lenM: number }; /** The longest quieted back (non-street) run. */ quietBack?: { at: [number, number]; bearing: number; lenM: number } };
const rows = new Map<string, Row>();
let tile = '';
const wall = (rs: ReadonlyArray<{ lenM: number; street: boolean; mid: [number, number]; bearing: number }>, street = true) => { const r = rs.filter(r => r.street === street).sort((a, b) => b.lenM - a.lenM)[0]; return r ? { at: [Math.round(r.mid[0] * 1e6) / 1e6, Math.round(r.mid[1] * 1e6) / 1e6] as [number, number], bearing: Math.round(r.bearing), lenM: Math.round(r.lenM * 10) / 10 } : undefined; };
shopRunProbe.sink = (id, keep, runs, anchors) => {
  const quiet = runs.filter((_, i) => !keep[i]), shop = runs.filter((_, i) => keep[i]);
  rows.set(id, { id, tile, anchors, runs: runs.length, streetRuns: runs.filter(r => r.street).length, shopRuns: shop.length, quietRuns: quiet.length, quietM: Math.round(quiet.reduce((s, r) => s + r.lenM, 0) * 10) / 10, quietStreetRuns: quiet.filter(r => r.street).length, shopM: Math.round(shop.reduce((s, r) => s + r.lenM, 0) * 10) / 10, quietWall: wall(quiet), shopWall: wall(shop), quietBack: wall(quiet, false) });
};
const t0 = performance.now();
for (const [i, t] of tiles.entries()) {
  tile = t;
  const features = (await loadTile(t, chain)).map(r => r.styled);
  if (!features.some(f => f.properties.shopKind !== undefined)) continue;
  buildFeatureChunk(features as never, 'photo', 'walls', shellStreets(ROOT, features as never), shellProfiles(ROOT));
  if (i % 25 === 0) console.error(`${i + 1}/${tiles.length} ${t} ${rows.size} shop pands, ${Math.round((performance.now() - t0) / 1000)} s`);
}
const all = [...rows.values()], changed = all.filter(r => r.quietRuns > 0);
const sum = (rs: Row[], k: keyof Row) => Math.round(rs.reduce((s, r) => s + (r[k] as number), 0));
const summary = {
  tiles: tiles.length, shopPands: all.length, multiRun: all.filter(r => r.runs > 1).length,
  changed: changed.length, changedAnchored: changed.filter(r => r.anchors > 0).length, changedUnanchored: changed.filter(r => r.anchors === 0).length,
  changedStreet: changed.filter(r => r.quietStreetRuns > 0).length,
  runsMoved: sum(changed, 'quietRuns'), streetRunsMoved: sum(changed, 'quietStreetRuns'), metresMoved: sum(changed, 'quietM'), runsKept: sum(all, 'shopRuns'), metresKept: sum(all, 'shopM'),
  movedOver10m: changed.filter(r => r.quietM >= 10).length,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ summary, rows: all.sort((a, b) => b.quietM - a.quietM) }, null, 1));
console.log(JSON.stringify(summary));
console.log(`-> ${path.relative(ROOT, out)} (${Math.round((performance.now() - t0) / 1000)} s)`);
