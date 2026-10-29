/**
 * Facade geometry with and without the buurt profiles (GitHub #102 acceptance: < 10 % triangle growth per facade).
 *   node --import tsx scripts/buurt-profiles/triangles.ts
 * Builds the walls and extras chunks of every pre-1945 BAG pand around each of the 12 sheet spots (150 m), decorated
 * the way the streamer does for the city-wide prior (genericFacades.ts decorateFacade), in the photo look, once with
 * the published profiles and once without, and prints triangles per building per spot.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import { buildFeatureChunk } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { decorateFacade } from '../../src/canalRecall/genericFacades.ts';
import { decorateBuildingFeature } from '../../src/canalRecall/buildingTilesBrowser.ts';
import { setBuurtProfiles } from '../../src/canalRecall/buurtProfiles/data.ts';
import SET from '../../src/canalRecall/buurtProfiles/buurt-profiles.json' with { type: 'json' };

const SPOTS: [string, number, number][] = [
  ['egelantiersdwars', 4.882064, 52.376806], ['tichel', 4.880705, 52.379193], ['looiersdwars', 4.881144, 52.368856], ['bellamy', 4.865742, 52.367016],
  ['tenkate', 4.866931, 52.366855], ['beets', 4.866072, 52.364679], ['jansteen', 4.901409, 52.356425], ['saenredam', 4.889496, 52.355698],
  ['stalpert', 4.891577, 52.356126], ['vanbree', 4.869844, 52.355087], ['kerk', 4.886966, 52.364464], ['run', 4.883577, 52.368888],
];
const tile = (lng: number, lat: number) => { const n = 2 ** 14, s = Math.sin(lat * Math.PI / 180); return [Math.floor((lng + 180) / 360 * n), Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n)]; };
const tris = (c: { indices: Uint32Array } | null) => (c?.indices.length ?? 0) / 3;
let sumOn = 0, sumOff = 0;
for (const [name, lng, lat] of SPOTS) {
  const [x, y] = tile(lng, lat);
  const fc = JSON.parse(zlib.gunzipSync(fs.readFileSync(`public/data/extracts/amsterdam/bag-tiles/14/${x}/${y}.geojson.gz`)).toString());
  const feats = (fc.features as any[]).filter(f => { const c = f.geometry?.coordinates?.[0]?.[0]; return c && Math.hypot((c[0] - lng) * 67900, (c[1] - lat) * 110500) < 150; })
    .map(f => decorateFacade(decorateBuildingFeature({ ...f, properties: { ...f.properties, constructionYear: f.properties.year, shopQuiet: true } } as any, new Map()) as any));
  const count = (on: boolean) => { setBuurtProfiles(on ? SET as any : null); return tris(buildFeatureChunk(feats, 'photo', 'walls') as any) + tris(buildFeatureChunk(feats, 'photo', 'extras') as any); };
  const on = count(true), off = count(false); sumOn += on; sumOff += off;
  console.log(name.padEnd(18), String(feats.length).padStart(4), 'buildings', `${(off / feats.length).toFixed(0)} -> ${(on / feats.length).toFixed(0)} triangles/building`, `${((on / off - 1) * 100).toFixed(1)} %`);
}
console.log('all spots', `${((sumOn / sumOff - 1) * 100).toFixed(1)} %`);
