// Lane R1-B (#224): rail corridors in the far ring, so tracks seen from the air do not end with the resident cells.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFarBlock, FAR_LIFT, FAR_RAIL, FAR_RAIL_STEP_M, farLandAt } from './farRing.ts';
import { RAIL_TONES, type RailWay } from './railTracks.ts';

const way = (pts: [number, number][], bridge = false): RailWay => ({ kind: 'rail', bridge, service: false, points: pts });
const cell = (key: string, rect: [number, number, number, number], rails?: RailWay[]) => ({ key, rect, osm: null, water: null, ...(rails ? { rails } : {}) });

test('a far block draws each rail way once, two-toned, over the land', () => {
  const w = way([[100, 500], [1900, 520]]);
  // The way passes both lower sub-cells and is listed in each (rail-v1 lists a way in every cell it passes).
  const b = buildFarBlock({ key: '0_0', rect: [0, 0, 2000, 2000], ground: () => 2, project: p => p as [number, number], cells: [cell('0_0', [0, 0, 1000, 1000], [w]), cell('1_0', [1000, 0, 2000, 1000], [w])] });
  const rail = b.stats.byLayer.rail;
  assert.ok(rail > 0, 'rails drawn');
  // Two ribbons, a vertex every FAR_RAIL_STEP_M (#232): 2 × 2 triangles per step, drawn once though listed twice.
  const steps = Math.ceil(Math.hypot(1800, 20) / FAR_RAIL_STEP_M);
  assert.equal(rail, 4 * steps);
  // `railDrape: false` (?farRailDrape=0, the R1-B build): two ribbons of one segment each, 4 triangles.
  const before = buildFarBlock({ key: '0_0', rect: [0, 0, 2000, 2000], railDrape: false, ground: () => 2, project: p => p as [number, number], cells: [cell('0_0', [0, 0, 1000, 1000], [w]), cell('1_0', [1000, 0, 2000, 1000], [w])] });
  assert.equal(before.stats.byLayer.rail, 4);
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

test('over an embankment the far rail band stays over the far land between its bends (#232: broken dark stubs)', () => {
  // A 6 m rail embankment along y = 500 (the Zuidas corridor), the way straight from end to end: one chord.
  const ground = (_x: number, y: number) => Math.max(0, 6 - Math.abs(y - 500) * 0.2) + (_x > 300 && _x < 700 ? 1.5 : 0);
  const rect: [number, number, number, number] = [0, 0, 1000, 1000];
  const input = (railDrape?: boolean) => ({ key: '0_0', rect, ...(railDrape === false ? { railDrape } : {}), ground, project: (p: [number, number]) => p, cells: [cell('0_0', rect, [way([[20, 512], [980, 512]])])] });
  // The band's centre line, interpolated along x between its vertices, against the far land mesh's surface.
  const under = (railDrape?: boolean) => {
    const pos = buildFarBlock(input(railDrape)).parts[0].mesh.positions, verts: [number, number][] = [];
    for (let k = 0; k < pos.length; k += 3) if (Math.abs(pos[k + 1] - 512) < FAR_RAIL.trackM && pos[k + 2] > 1) verts.push([pos[k], pos[k + 2]]);
    verts.sort((a, b) => a[0] - b[0]);
    let low = 0;
    for (let x = 30; x < 970; x += 5) {
      const i = verts.findIndex(v => v[0] >= x);
      if (i <= 0) continue;
      const [ax, az] = verts[i - 1], [bx, bz] = verts[i], z = az + (bz - az) * (x - ax) / (bx - ax || 1);
      if (z < farLandAt(ground, rect, x, 512)) low++;
    }
    return { low };
  };
  assert.ok(under(false).low > 0, 'the R1-B band dips under the land between its ends');
  assert.equal(under().low, 0, 'draped: never under the land');
});
