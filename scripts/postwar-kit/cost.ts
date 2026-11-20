/**
 * Cost of the post-1965 kit: whole-tile chunks ('walls' and 'extras', photo look) over the first TILES (default 6) of the
 * sampled members' z14 tiles, with the kit on and off (the flag toggled between builds; the components stay registered
 * with p 0, which draws nothing without a forced read), the pands it reads and where their walls come from, and the
 * build time.   node --import tsx scripts/postwar-kit/cost.ts
 */
import fs from 'node:fs';
import path from 'node:path';
const g = globalThis as { __canalRecallPostwarKit?: boolean };
g.__canalRecallPostwarKit = true;
const { gameChain, loadTile } = await import('../world/pipeline.ts');
const { buildFeatureChunk, meshBuildingFor } = await import('../../src/canalRecall/threeBuildingFeatures.ts');
const OUT = path.resolve(import.meta.dirname, '../../artifacts/postwar-kit');
const sample = JSON.parse(fs.readFileSync(path.join(OUT, 'sample.json'), 'utf8')) as Record<string, any>;
const tileOf = (lng: number, lat: number) => { const n = 2 ** 14; return `${Math.floor((lng + 180) / 360 * n)}/${Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n)}`; };
const tiles = [...new Set(Object.values(sample).filter((r: any) => r.photo).map((r: any) => tileOf(r.centroid[0], r.centroid[1])))].sort().slice(0, Number(process.env.TILES ?? 6));
const chain = gameChain();
const res = { tiles: tiles.length, features: 0, withGeometry: 0, ids: {} as Record<string, number>, on: { walls: 0, extras: 0, ms: 0 }, off: { walls: 0, extras: 0, ms: 0 } };
for (const t of tiles) {
  const features = (await loadTile(t, chain)).map(r => r.styled);
  res.features += features.length;
  for (const f of features) {
    const b = meshBuildingFor(f as never, 'photo') as any;
    if (!b) continue;
    // bayLook's read is not on the MeshBuilding; the forced ids are.
    const ids = (b.registerForce ?? []).filter((x: string) => x.startsWith('postwar-'));
    if (ids.length) res.withGeometry++;
    for (const id of ids) res.ids[id] = (res.ids[id] ?? 0) + 1;
  }
  for (const side of ['on', 'off'] as const) {
    g.__canalRecallPostwarKit = side === 'on';
    for (const mode of ['walls', 'extras'] as const) {
      const t0 = performance.now();
      const chunk = buildFeatureChunk(features as never, 'photo', mode) as any;
      res[side].ms += performance.now() - t0;
      res[side][mode] += chunk.indices.length / 3;
    }
  }
  g.__canalRecallPostwarKit = true;
}
res.on.ms = Math.round(res.on.ms); res.off.ms = Math.round(res.off.ms);
console.log(JSON.stringify(res, null, 1));
