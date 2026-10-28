import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFeatureChunk, ORIGIN, type Feature } from './threeBuildingFeatures.js';
import { ThreeBuildings } from './threeBuildingsBrowser.js';
// Far facade chunks on touch devices (CANAL-RECALL-7, lane 2026-10-28): the z14 city shells away
// from the rider build one quad per wall in the building's own window cell plus its flat lid; the
// rider's detailed block and every desktop build are unchanged.

const kx = 111320 * Math.cos(ORIGIN.lat * Math.PI / 180);
const ll = (x: number, y: number): [number, number] => [ORIGIN.lng + x / kx, ORIGIN.lat + y / 110540];
/** A canal house with a door and a pitched planned roof: the content the touch shell drops. */
const house = (id: string, x: number, w: number): Feature => ({
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [[ll(x, 5), ll(x + w, 5), ll(x + w, 18), ll(x, 18), ll(x, 5)]] },
  properties: { id, height: 14, minHeight: 0, facade: 'canal-priorBrickRed', facadeStyle: 'canal', constructionYear: 1680, roofPlanned: true, roofShapeTag: 'gabled', roofEavesHeightM: 10, roofColour: '#594e48' },
});
const streets = new Float32Array([-10, 0, 60, 0]);
const houses = [house('bag:fixture-a', 0, 6), house('bag:fixture-b', 6, 7), house('bag:fixture-c', 13, 5)];
const tris = (chunk: { indices: Uint32Array }) => chunk.indices.length / 3;

test('touch shell keeps every building’s mass, height, lid and wall colour, and costs a fraction', () => {
  const full = buildFeatureChunk(houses, 'photo', 'coarse', streets);
  const shell = buildFeatureChunk(houses, 'photo', 'shell', streets);
  assert.ok(tris(shell) < tris(full) * 0.55, `shell ${tris(shell)} tris vs coarse ${tris(full)}`);
  // Mass and height: same footprint rings, same top (the lid sits at the mapped height in both).
  assert.deepEqual(shell.ranges.map(r => r.id), full.ranges.map(r => r.id), 'one range per building, same order');
  const top = (chunk: { positions: Float32Array }) => Math.max(...Array.from(chunk.positions).filter((_, i) => i % 3 === 2));
  assert.equal(top(shell), top(full), 'same skyline: the lid stays at the building height');
  // Wall colour: the first wall vertex of the first building carries the same tint (colour x shade).
  const tint0 = (chunk: { tints: Uint8Array }) => Array.from(chunk.tints.slice(0, 3));
  assert.deepEqual(tint0(shell), tint0(full), 'same wall colour and shade on the first wall');
  // Windows stay textured: every shell wall vertex uses one of the coarse build's own wall cells
  // (bay/procedural cells), never a flat colour layer.
  const lidLayer = Math.max(...Array.from(full.layers));
  const wallCells = new Set(Array.from(full.layers).filter(layer => layer < lidLayer));
  const shellWalls = [...new Set(shell.layers)].filter(layer => layer !== lidLayer);
  assert.ok(shellWalls.length && shellWalls.every(layer => wallCells.has(layer)), `shell walls keep a textured window cell (${shellWalls})`);
  // Content dropped: no ground-floor/door cells, no cornice plate, no extras.
  assert.equal(shell.kinds?.['ground'] ?? 0, 0, 'no ground-floor slice');
  assert.equal(shell.kinds?.['door'] ?? 0, 0, 'no door bay');
  assert.equal(shell.kinds?.['roof-plate'] ?? 0, 0, 'no projecting cornice');
  assert.ok((full.kinds?.['ground'] ?? 0) > 0 && (full.kinds?.['roof-plate'] ?? 0) > 0, 'the coarse build still has them');
  assert.deepEqual(shell, buildFeatureChunk(houses, 'photo', 'shell', streets), 'deterministic');
});

test('the desktop build is untouched: `coarse` output is the same buffers as before the shell mode', () => {
  // The shell branch is gated on mode === 'shell'; the coarse path must produce the documented content.
  const coarse = buildFeatureChunk(houses, 'photo', 'coarse', streets);
  assert.ok((coarse.kinds?.['upper'] ?? 0) > 0 && (coarse.kinds?.['ground'] ?? 0) > 0 && (coarse.kinds?.['lid'] ?? 0) > 0);
  assert.deepEqual(coarse, buildFeatureChunk(houses, 'photo', 'coarse', streets), 'deterministic coarse output');
});

test('the level is chosen like the ground’s: pointer-coarse or ?facadeDetail, and per chunk', () => {
  const map = { getZoom: () => 17, triggerRepaint() {}, getCanvas: () => ({}) } as never;
  const touch = new ThreeBuildings(map, {} as never, 'photo', { detail: 'touch' }) as any;
  const full = new ThreeBuildings(map, {} as never, 'photo', { detail: 'full' }) as any;
  assert.equal(touch.detail, 'touch');
  assert.equal(full.detail, 'full');
  // Touch: the city shells are cheap, the rider's own detailed block and its extras stay full.
  assert.equal(touch.modeFor('coarse:8414/5384'), 'shell');
  assert.equal(touch.modeFor('near:67313/43072'), 'walls');
  assert.equal(touch.modeFor('extras:67313/43072'), 'extras');
  assert.equal(touch.modeFor('__kit'), 'walls');
  assert.equal(touch.modeFor('boats:8414/5384'), 'walls');
  // Desktop: byte-identical to the pre-lane path.
  assert.equal(full.modeFor('coarse:8414/5384'), 'coarse');
  assert.equal(full.modeFor('near:67313/43072'), 'walls');
});
