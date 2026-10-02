// Shopfronts: POI tags map to the right shopfront, the published extract covers the city's
// shopping streets (named regressions from the user's report: Clercqstraat, Rozengracht),
// and a shop building's ground floor uses its shopfront with no house door on a narrow front.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { shopKindForTags, setShopfronts, decorateShopfront } from '../src/canalRecall/shopfronts.ts';
import { buildFeatureChunk } from '../src/canalRecall/threeBuildingFeatures.ts';
import { bayLayer } from '../src/canalRecall/bayLook.ts';

assert.equal(shopKindForTags({ amenity: 'cafe' }), 'shopCafe');
assert.equal(shopKindForTags({ amenity: 'pub' }), 'shopBar');
assert.equal(shopKindForTags({ shop: 'bakery' }), 'shopDeli');
assert.equal(shopKindForTags({ shop: 'florist' }), 'shopFlorist');
assert.equal(shopKindForTags({ shop: 'bicycle' }), 'shopBike');
assert.equal(shopKindForTags({ shop: 'clothes' }), 'shopWindow');
assert.equal(shopKindForTags({ shop: 'vacant' }), null);
assert.equal(shopKindForTags({ amenity: 'parking' }), null);

const extract = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/shopfronts.json', 'utf8'));
const count = Object.keys(extract.buildings).length;
assert.ok(count > 8000 && count < 40000, `a plausible number of shop buildings (${count})`);
setShopfronts(extract);
// Named buildings: Mook pancakes (café) and Flowers & Powers (florist) on De Clercqstraat.
const tileOf = (lng: number, lat: number) => { const n = 2 ** 14, r = lat * Math.PI / 180; return `${Math.floor(((lng + 180) / 360) * n)}/${Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)}`; };
const tile = JSON.parse(zlib.gunzipSync(fs.readFileSync(`public/data/extracts/amsterdam/building-tiles/14/${tileOf(4.871289, 52.371291)}.geojson.gz`)).toString()).features;
const byId = (id: string) => tile.find((f: any) => f.properties.id === id);
assert.equal(decorateShopfront(byId('NL.IMBAG.Pand.0363100012153203')).properties.shopKind, 'shopCafe', 'Mook pancakes');
assert.equal(decorateShopfront(byId('NL.IMBAG.Pand.0363100012156758')).properties.shopKind, 'shopFlorist', 'Flowers & Powers');
const quiet = tile.find((f: any) => extract.buildings[f.properties.id] === undefined);
assert.equal(decorateShopfront(quiet).properties.shopQuiet, true);

// A narrow canal house (5 x 5 m) that is a café: its ground quads use the café cell and no door cell.
const sq = [[4.9, 52.37], [4.900073, 52.37], [4.900073, 52.370045], [4.9, 52.370045], [4.9, 52.37]];
const feature = { type: 'Feature', properties: { id: 'cafe-house', height: 14, minHeight: 0, facade: 'canal-x', facadeStyle: 'canal', constructionYear: 1700, shopKind: 'shopCafe' }, geometry: { type: 'Polygon', coordinates: [sq] } };
const chunk = buildFeatureChunk([feature], 'photo');
const layers = new Set<number>(); for (let v = 0; v < chunk.vertexCount; v += 4) layers.add(chunk.layers[v]);
assert.ok(layers.has(bayLayer('canal', 0, 'shopCafe')), 'café shopfront on the ground floor');
assert.ok(![0, 1, 2, 3].some(style => layers.has(bayLayer('canal', style, 'groundDoor'))), 'no house door beside a narrow shopfront');
console.log(`shopfronts: ok (${count} shop buildings)`);
