/**
 * 3DBAG-shaped per-pand items from the cached PDOK 3D Basisvoorziening blades (CC BY 4.0; same TU Delft reconstruction as
 * 3DBAG) for the building-type tools, when api.3dbag.nl is slow or down. Items are written to .cache/building-types/3dbag/<id>.json,
 * the file build.ts / stage-panden.ts read, so the rest of the flow runs unchanged.
 *
 *   node --import tsx scripts/building-types/pdok-items.ts --survey=staging/building-types/gein-3-survey 2104392 2141162   # print heights
 */
import fs from 'node:fs';
import path from 'node:path';
import {ensureBlade} from '../building-recipes/pdok-tiles.ts';
import {bladeFor, cityObjectToFeature, type CityJsonTile} from '../../src/canalRecall/buildingRecipe/pdokLod2.ts';
import {lngLatToRd} from '../../src/canalRecall/rdCoordinates.ts';

const tiles = new Map<string, CityJsonTile>();
export async function blade(name: string): Promise<CityJsonTile> {
  if (!tiles.has(name)) { const {file} = await ensureBlade(name); tiles.set(name, JSON.parse(fs.readFileSync(file, 'utf8'))); }
  return tiles.get(name)!;
}

/** Cache the item of each pand (16-digit id, centroid lng/lat) from the blade under its centroid or a neighbouring blade; returns the ids not found. */
export async function cacheItems(pands: {id: string; lngLat: [number, number]}[], dir = '.cache/building-types/3dbag'): Promise<string[]> {
  fs.mkdirSync(dir, {recursive: true});
  const missing: string[] = [];
  for (const p of pands) {
    const file = path.join(dir, `${p.id}.json`);
    if (fs.existsSync(file)) continue;
    const [x, y] = lngLatToRd(p.lngLat[0], p.lngLat[1]);
    const names = [...new Set([bladeFor(x, y), bladeFor(x + 30, y), bladeFor(x - 30, y), bladeFor(x, y + 30), bladeFor(x, y - 30)])];
    let done = false;
    for (const n of names) {
      const item = cityObjectToFeature(await blade(n), p.id);
      if (item) { fs.writeFileSync(file, JSON.stringify(item)); done = true; break; }
    }
    if (!done) missing.push(p.id);
  }
  return missing;
}

if (process.argv[1]?.endsWith('building-types/pdok-items.ts')) {
  const survey = process.argv.find(a => a.startsWith('--survey='))?.slice(9);
  if (!survey) throw new Error('--survey=<survey dir> required');
  const all = JSON.parse(fs.readFileSync(path.join(survey, 'pands.json'), 'utf8')).pands as {id: string; lngLat: [number, number]}[];
  const want = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const list = all.filter(p => want.some(w => p.id.endsWith(w)));
  console.log('missing', await cacheItems(list));
  for (const p of list) {
    const j = JSON.parse(fs.readFileSync(`.cache/building-types/3dbag/${p.id}.json`, 'utf8'));
    const a = (Object.values(j.feature.CityObjects) as any[]).find(o => o.type === 'Building').attributes, g = a.b3_h_maaiveld;
    const r = (v: number | null | undefined) => v == null ? '-' : (v - g).toFixed(2);
    console.log(p.id.slice(-7), 'yr', a.oorspronkelijkbouwjaar, a.b3_dak_type, 'min', r(a.b3_h_dak_min), '50p', r(a.b3_h_dak_50p), '70p', r(a.b3_h_dak_70p), 'max', r(a.b3_h_dak_max), 'nok', r(a.b3_h_nok));
  }
}
