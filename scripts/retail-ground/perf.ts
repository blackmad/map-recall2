/**
 * Lane retail-ground: triangles and build time of the generic building chunk with `retailGround` off and on, over the
 * building tiles around a few shop streets (the game's decoration chain, galleryPipeline.gameDecorator, with the
 * shopfronts extract and the staged template extract installed for the on run).
 *   node --import tsx scripts/retail-ground/perf.ts
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import { gameDecorator } from '../../src/canalRecall/galleryPipeline.ts';
import { buildFeatureChunk, type Feature } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { setShopfronts, setShopTemplates } from '../../src/canalRecall/shopfronts.ts';

const g = globalThis as { __canalRecallRetailGround?: boolean };
const tile = (lng: number, lat: number) => { const n = 2 ** 14, x = Math.floor((lng + 180) / 360 * n), r = lat * Math.PI / 180; return [x, Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)]; };
const PLACES: Array<[string, number, number]> = [['Haarlemmerdijk', 4.886, 52.3815], ['Nieuwendijk', 4.8955, 52.3762], ['Kinkerstraat', 4.869, 52.3665], ['Ferdinand Bolstraat', 4.8915, 52.355]];
setShopfronts(JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/shopfronts.json', 'utf8')));
const templates = JSON.parse(fs.readFileSync('data/retail-ground/shop-templates.json', 'utf8'));
for (const [name, lng, lat] of PLACES) {
  const [x, y] = tile(lng, lat), file = `public/data/extracts/amsterdam/building-tiles/14/${x}/${y}.geojson`;
  const path = fs.existsSync(file) ? file : `${file}.gz`;
  const bytes = fs.readFileSync(path), raw = JSON.parse((bytes[0] === 0x1f ? zlib.gunzipSync(bytes) : bytes).toString()).features as Feature[];
  const row: string[] = [name, String(raw.length)];
  for (const on of [false, true]) {
    g.__canalRecallRetailGround = on;
    setShopTemplates(on ? templates : null);
    const decorate = gameDecorator();
    const features = raw.map(f => decorate(f));
    const stamped = features.filter(f => Array.isArray(f.properties.shopTemplate)).length;
    let best = Infinity, chunk = buildFeatureChunk(features, 'photo');
    for (let k = 0; k < 3; k++) { const t0 = performance.now(); chunk = buildFeatureChunk(features, 'photo'); best = Math.min(best, performance.now() - t0); }
    row.push(`${on ? 'on' : 'off'}: ${chunk.indices.length / 3} tris, ${(chunk.positions.byteLength + chunk.uvs.byteLength + chunk.layers.byteLength + chunk.tints.byteLength + chunk.accents.byteLength + chunk.indices.byteLength) / 1e6} MB, ${best.toFixed(0)} ms, ${stamped} templates`);
  }
  console.log(row.join(' | '));
}
