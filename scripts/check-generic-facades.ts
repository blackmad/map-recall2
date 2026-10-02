// Checks for the generic facades + stylised trees experiment.
//   npx tsx scripts/check-generic-facades.ts
import assert from 'node:assert/strict';
import {
  FACADE_MAX_TILE_ZOOM, FACADE_MIN_TILE_ZOOM, FACADE_PATTERN_HEIGHT_M, FACADE_PIXELS_PER_M, allFacadeKeys, snapWallColour,
  decorateFacade, facadePixelRatio, facadeStyleFor, facadeTileZoom, footprintAreaM2, rasterizeFacade,
} from '../src/canalRecall/genericFacades.ts';
import { thinTreesNearRoute, treeFeatures, treesInBounds } from '../src/canalRecall/stylisedTrees.ts';

// Period from year; size only for towers and tiny structures.
assert.equal(facadeStyleFor({ year: 1660, heightM: 14, minHeightM: 0, footprintM2: 90 }), 'canal');
assert.equal(facadeStyleFor({ year: 1895, heightM: 14, minHeightM: 0, footprintM2: 90 }), 'c19');
assert.equal(facadeStyleFor({ year: 1925, heightM: 12, minHeightM: 0, footprintM2: 400 }), 'school');
assert.equal(facadeStyleFor({ year: 1958, heightM: 13, minHeightM: 0, footprintM2: 900 }), 'postwar');
assert.equal(facadeStyleFor({ year: 2004, heightM: 18, minHeightM: 0, footprintM2: 900 }), 'modern');
assert.equal(facadeStyleFor({ year: 1970, heightM: 45, minHeightM: 0, footprintM2: 900 }), 'tower');
assert.equal(facadeStyleFor({ year: 1660, heightM: 45, minHeightM: 0, footprintM2: 900 }), 'canal', 'an old church tower is not a tower block');
assert.equal(facadeStyleFor({ year: 1990, heightM: 2.2, minHeightM: 0, footprintM2: 40 }), null, 'sheds stay plain');
assert.equal(facadeStyleFor({ year: 1990, heightM: 8, minHeightM: 0, footprintM2: 6 }), null, 'kiosks stay plain');
assert.equal(facadeStyleFor({ year: 1005, heightM: 9, minHeightM: 0, footprintM2: 90 }), 'c19', 'BAG placeholder year is unknown');

// MapLibre stores the pattern pixel ratio as an integer: every drawn zoom must
// give a whole ratio ≥ 1, or the layer silently vanishes (seen at zoom 19).
for (let z = FACADE_MIN_TILE_ZOOM; z <= FACADE_MAX_TILE_ZOOM; z++) {
  const ratio = facadePixelRatio(z);
  assert.ok(Number.isInteger(ratio) && ratio >= 1, `ratio at z${z} is ${ratio}`);
  // Vertical phase: the pattern's display height must divide 512 tile px.
  const display = (FACADE_PATTERN_HEIGHT_M * FACADE_PIXELS_PER_M) / ratio;
  assert.equal(512 % display, 0, `display height ${display} at z${z}`);
}
assert.equal(facadeTileZoom(14.2), FACADE_MIN_TILE_ZOOM);
assert.equal(facadeTileZoom(18.9), 18);
assert.equal(facadeTileZoom(17.9, 18), 18, 'hold the set just under the boundary');
assert.equal(facadeTileZoom(19.2, 18), 18, 'and just over the next');
assert.equal(facadeTileZoom(17.6, 18), 17, 'switch once clearly past');
assert.equal(facadeTileZoom(FACADE_MAX_TILE_ZOOM + 1.1), null, 'past the range the plain walls return');

// Images: 32 m tall, seamless bay width, opaque, with door pixels at the bottom.
assert.equal(allFacadeKeys().length, 48);
for (const { style, colour, key } of allFacadeKeys()) {
  const image = rasterizeFacade(style, '#a4523b', 52.37);
  assert.equal(image.height, FACADE_PATTERN_HEIGHT_M * FACADE_PIXELS_PER_M, key);
  assert.equal(image.data.length, image.width * image.height * 4, key);
  for (let i = 3; i < image.data.length; i += 4) assert.equal(image.data[i], 255, `${key} opaque`);
  void colour;
}

// Footprint area: a 10 m × 10 m square.
const kx = 111_320 * Math.cos(52.37 * Math.PI / 180), ky = 110_540;
const square = { type: 'Polygon', coordinates: [[[4.9, 52.37], [4.9 + 10 / kx, 52.37], [4.9 + 10 / kx, 52.37 + 10 / ky], [4.9, 52.37 + 10 / ky], [4.9, 52.37]]] };
assert.ok(Math.abs(footprintAreaM2(square) - 100) < 1, `area ${footprintAreaM2(square)}`);

// Decoration: only the citywide prior is replaced; measured colour wins.
const base = { id: 'NL.IMBAG.Pand.0363100012061542', height: 12, minHeight: 0, constructionYear: 1660,
  sideColour: '#a4523b', appearanceStyleSource: 'citywide-identity-palette-v3-not-measured', groundAppearanceStyleSource: 'wall-inherited-not-independently-measured' };
const decorated = decorateFacade({ type: 'Feature', properties: { ...base }, geometry: square });
assert.match(String(decorated.properties.facade), /^canal-prior/);
const measured = decorateFacade({ type: 'Feature', properties: { ...base, appearanceStyleSource: 'procedural-prior-not-measured' }, geometry: square });
assert.equal(measured.properties.facade, undefined);

// OSM-tagged colours snap to the nearest wall colour and still get a facade.
assert.equal(snapWallColour('#ffffff'), 'priorPlaster');
assert.equal(snapWallColour('#b03020'), 'priorBrickRed');
assert.equal(snapWallColour('red'), null);
const tagged = decorateFacade({ type: 'Feature', properties: { id: 'x', height: 12, minHeight: 0, constructionYear: 1895, colour: '#b03020' }, geometry: square });
assert.equal(tagged.properties.facade, 'c19-priorBrickRed');

// Trees: two parts each; thinned off the route corridor.
const trees = [
  { id: 'a', lng: 4.9, lat: 52.37 },
  { id: 'b', lng: 4.9 + 2 / kx, lat: 52.37 },   // 2 m off the route
  { id: 'c', lng: 4.9 + 8 / kx, lat: 52.37 },   // 8 m off
];
assert.equal(treeFeatures(trees).length, 6);
assert.equal(treeFeatures(trees, { caps: true }).length, 9);
const route = [[4.9, 52.369], [4.9, 52.371]];
assert.deepEqual(thinTreesNearRoute(trees, route).map(t => t.id), ['c']);
assert.deepEqual(treesInBounds(trees, 4.8999, 52.36, 4.90001, 52.38).map(t => t.id), ['a']);

console.log('generic facades + stylised trees: ok');
