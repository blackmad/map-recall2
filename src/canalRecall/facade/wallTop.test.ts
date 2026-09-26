import assert from 'node:assert/strict';
import { wallTopNAP } from './wallTop.ts';

const ORIGIN = { x: 100000, y: 400000 };
const HEIGHT_DATUM = 'legacy-block-NAP-minus-0.65m';
const DATUM_OFFSET = 0.65;
const GROUND_NAP = 0.2;
const RIDGE_HEIGHT = 12;

const owner = (surfaces: any[], building: any = {}) => ({
  id: 'synthetic-owner',
  geometry: {
    frame: { originRD: { ...ORIGIN }, heightDatum: HEIGHT_DATUM },
    building: { groundNAP: GROUND_NAP, height: RIDGE_HEIGHT, surfaces, ...building },
  },
});

const toRd = (east: number, south: number) => ({ x: ORIGIN.x + east, y: ORIGIN.y - south });
const wall = { start: toRd(0, 0), end: toRd(10, 0) };
const wallSurface = (points: number[][]) => ({ type: 'wall', rings: [points] });
const roofSurface = (points: number[][]) => ({ type: 'roof', rings: [points] });

let checks = 0;
const close = (actual: number, expected: number, label: string) => {
  checks++;
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: expected ${expected}, got ${actual}`);
};

// 1. A coplanar wall surface matches and its top (NOT the building ridge) wins.
const matching = owner([
  roofSurface([[0, 0, 0], [10, 0, 0], [10, 10, 4], [0, 10, 4]]),
  wallSurface([[0, 0, 0], [10, 0, 0], [10, 8, 0], [0, 8, 0]]),
]);
const matched = wallTopNAP(matching, wall);
assert.equal(matched.matched, true, 'coplanar wall surface should match');
assert.equal(matched.source, '3dbag-wall-surface', 'matched source');
assert.deepEqual(matched.surfaceIndices, [1], 'only the wall surface contributes');
close(matched.topNAP, 8 + DATUM_OFFSET, 'matched eave NAP');
close(matched.coverageFraction, 1, 'full coverage');

// 2. Rotated and offset planes must not match; the ridge fallback is used.
const rotated = wallTopNAP(owner([wallSurface([[0, 0, 0], [0, 0, 10], [0, 8, 10], [0, 8, 0]])]), wall);
assert.equal(rotated.matched, false, 'rotated plane must not match');
assert.equal(rotated.source, 'ground-plus-height-fallback', 'rotated source');
assert.deepEqual(rotated.surfaceIndices, [], 'rotated has no contributors');
close(rotated.topNAP, GROUND_NAP + RIDGE_HEIGHT, 'rotated fallback NAP');
close(rotated.coverageFraction, 0, 'rotated fallback coverage');

const offset = wallTopNAP(owner([wallSurface([[0, 0, 3], [10, 0, 3], [10, 8, 3], [0, 8, 3]])]), wall);
assert.equal(offset.matched, false, 'offset 3 m plane must not match');
close(offset.topNAP, GROUND_NAP + RIDGE_HEIGHT, 'offset fallback NAP');

// 3. A closed N-gon (5 vertices, first == last) still matches.
const closedNgons = owner([wallSurface([[0, 0, 0], [10, 0, 0], [10, 8, 0], [0, 8, 0], [0, 0, 0]])]);
const ngon = wallTopNAP(closedNgons, wall);
assert.equal(ngon.matched, true, 'closed N-gon should match');
close(ngon.topNAP, 8 + DATUM_OFFSET, 'N-gon eave NAP');

// 4. An open ring (first != last vertex) is handled identically.
const openRing = owner([wallSurface([[0, 0, 0], [10, 0, 0], [10, 8, 0], [0, 8, 0]])]);
const open = wallTopNAP(openRing, wall);
assert.equal(open.matched, true, 'open ring should match');
close(open.topNAP, 8 + DATUM_OFFSET, 'open-ring eave NAP');

// 5. Per-surface coverage gates the match, and the option can loosen it.
const partial = owner([wallSurface([[0, 0, 0], [4, 0, 0], [4, 10, 0], [0, 10, 0]])]);
assert.equal(wallTopNAP(partial, wall).matched, false, 'a 40% coverage surface must fall back');
const loosened = wallTopNAP(partial, wall, { minimumCoverage: 0.3 });
assert.equal(loosened.matched, true, 'loosened coverage should accept the surface');
close(loosened.topNAP, 10 + DATUM_OFFSET, 'loosened eave NAP');
close(loosened.coverageFraction, 0.4, 'loosened coverage fraction');

// 6. Multiple matched surfaces: highest top wins, coverage unions.
const layered = owner([
  wallSurface([[0, 0, 0], [8, 0, 0], [8, 8, 0], [0, 8, 0]]),
  wallSurface([[2, 0, 0], [10, 0, 0], [10, 9, 0], [2, 9, 0]]),
]);
const merged = wallTopNAP(layered, wall);
assert.equal(merged.matched, true, 'layered surfaces should match');
assert.deepEqual(merged.surfaceIndices, [0, 1], 'both surfaces contribute');
close(merged.topNAP, 9 + DATUM_OFFSET, 'highest matched top wins');
close(merged.coverageFraction, 1, 'union coverage');

console.log(`wall top: ${checks} assertions passed (matched, rotated/offset fallback, N-gon, open ring, coverage, union).`);
