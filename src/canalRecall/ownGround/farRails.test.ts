// Lane R1-B (#224): rail corridors in the far ring, so tracks seen from the air do not end with the resident cells.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFarBlock, FAR_LIFT, FAR_RAIL } from './farRing.ts';
import { RAIL_TONES, type RailWay } from './railTracks.ts';

const way = (pts: [number, number][], bridge = false): RailWay => ({ kind: 'rail', bridge, service: false, points: pts });
const cell = (key: string, rect: [number, number, number, number], rails?: RailWay[]) => ({ key, rect, osm: null, water: null, ...(rails ? { rails } : {}) });

test('a far block draws each rail way once, two-toned, over the land', () => {
  const w = way([[100, 500], [1900, 520]]);
  // The way passes both lower sub-cells and is listed in each (rail-v1 lists a way in every cell it passes).
  const b = buildFarBlock({ key: '0_0', rect: [0, 0, 2000, 2000], ground: () => 2, project: p => p as [number, number], cells: [cell('0_0', [0, 0, 1000, 1000], [w]), cell('1_0', [1000, 0, 2000, 1000], [w])] });
  const rail = b.stats.byLayer.rail;
  assert.ok(rail > 0, 'rails drawn');
  // Two ribbons of one segment each: 2 quads, 4 triangles, drawn once though listed twice.
  assert.equal(rail, 4);
  const colours = b.parts.flatMap(p => Array.from(p.mesh.colors ?? []));
  const has = (c: readonly number[]) => colours.some((_, i) => i % 3 === 0 && Math.abs(colours[i] - c[0]) < 1e-3 && Math.abs(colours[i + 1] - c[1]) < 1e-3 && Math.abs(colours[i + 2] - c[2]) < 1e-3);
  assert.ok(has(FAR_RAIL.bed) && has(FAR_RAIL.track), 'bed and track tones');
  assert.deepEqual(FAR_RAIL.bed.map(v => Math.round(v * 255)), [...RAIL_TONES.ballast]);
  const zs = b.parts.flatMap(p => Array.from(p.mesh.positions).filter((_, i) => i % 3 === 2));
  assert.ok(zs.some(z => Math.abs(z - (2 + FAR_LIFT.railTrack)) < 1e-6), 'the dark band over the bed');
});

test('no rails in the input (?farRail=0, or none in the block): the block as before', () => {
  const input = { key: '0_0', rect: [0, 0, 2000, 2000] as [number, number, number, number], ground: () => 2, project: (p: [number, number]) => p, cells: [cell('0_0', [0, 0, 1000, 1000])] };
  const b = buildFarBlock(input);
  assert.equal(b.stats.byLayer.rail, undefined);
});

test('a bridge way rides at least the lower of its ends, not the water under it', () => {
  const ground = (x: number) => (x > 400 && x < 600 ? -1 : 3);
  const b = buildFarBlock({ key: '0_0', rect: [0, 0, 1000, 1000], ground, project: p => p as [number, number], cells: [cell('0_0', [0, 0, 1000, 1000], [way([[100, 500], [500, 500], [900, 500]], true)])] });
  const zs = b.parts.flatMap(p => Array.from(p.mesh.positions).filter((_, i) => i % 3 === 2));
  const railZ = zs.filter(z => z > 3.5);
  assert.ok(railZ.length && railZ.every(z => z >= 3 + FAR_LIFT.rail - 1e-6));
});
