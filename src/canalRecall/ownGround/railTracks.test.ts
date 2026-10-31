// railTracks.ts (rail-v1) pure pieces, issue #145 (user 2026-10-30: "train tracks buried by surface", "ooof, these
// rails look really bad"): yard beds between close tracks, the bed lifted over the land under its whole top, the rails
// painted into the bed's texture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RAIL_MERGE, RAIL_SECTION, RAIL_STRIPE, railMeshes, railSegIndex, railStripes, sideGap, yardReach, type RailWay } from './railTracks.ts';

const track = (y: number, extra: Partial<RailWay> = {}): RailWay => ({ kind: 'rail', bridge: false, service: false, points: [[0, y], [60, y]], ...extra });
const topAt = (m: { positions: number[] }, x: number, y: number, tol = 0.3) => {
  let z = -Infinity;
  for (let i = 0; i < m.positions.length; i += 3) if (Math.abs(m.positions[i] - x) < tol && Math.abs(m.positions[i + 1] - y) < tol) z = Math.max(z, m.positions[i + 2]);
  return z;
};
/** Is (x, y) under a triangle of the mesh (seen from above)? */
const covered = (m: { positions: number[]; indices: number[] }, x: number, y: number) => {
  const p = m.positions, I = m.indices;
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t + 1], I[t + 2]].map(k => [p[3 * k], p[3 * k + 1]]);
    const s = (u: number[], v: number[]) => (v[0] - u[0]) * (y - u[1]) - (v[1] - u[1]) * (x - u[0]);
    const d1 = s(a, b), d2 = s(b, c), d3 = s(c, a);
    if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) return true;
  }
  return false;
};

test('side gap: a parallel neighbour within maxM, not a crossing track, not another deck', () => {
  const ways = [track(0), track(4.5), { ...track(-5), points: [[30, -20], [30, 20]] as [number, number][] }, track(-6, { bridge: true })];
  const idx = railSegIndex(ways);
  assert.ok(Math.abs(sideGap(idx, ways, 0, [10, 0], [0, 1], [1, 0]) - 4.5) < 1e-9);
  assert.equal(sideGap(idx, ways, 0, [10, 0], [0, -1], [1, 0]), Infinity, 'the bridge track is another deck');
  assert.equal(sideGap(idx, ways, 0, [29, 0], [0, -1], [1, 0]), Infinity, 'a crossing track is not a neighbour');
  assert.equal(yardReach(RAIL_MERGE.maxM + 0.1), null);
  assert.equal(yardReach(4.5), 4.5 / 2 + RAIL_MERGE.overlap);
  assert.equal(yardReach(2), RAIL_SECTION.topHalf, 'never narrower than the bed');
});

test('yard bed: two tracks 4.5 m apart draw one ballast surface, no sand between; 12 m apart stay two beds', () => {
  const near = railMeshes({ ways: [track(0), track(4.5)], inCell: () => true, height: () => 0 });
  for (const y of [1.9, 2.25, 2.6]) assert.ok(covered(near.ballast, 30, y), `ballast between the tracks at y=${y}`);
  assert.ok(Math.abs(topAt(near.ballast, 24, 2.25 + RAIL_MERGE.overlap) - RAIL_SECTION.topLift) < 1e-6, 'the run is at bed height');
  // The outer sides keep their shoulders down to the ground.
  assert.ok(Math.abs(topAt(near.ballast, 24, -RAIL_SECTION.toeHalf, 0.05) - RAIL_SECTION.toeLift) < 1e-6);
  const far = railMeshes({ ways: [track(0), track(12)], inCell: () => true, height: () => 0 });
  assert.ok(!covered(far.ballast, 30, 6), 'separate corridors stay separate');
  // Bridge tracks side by side share one slab (no water between them).
  const bridges = railMeshes({ ways: [track(0, { bridge: true }), track(4.6, { bridge: true })], inCell: () => true, height: () => 0 });
  assert.ok(covered(bridges.slab, 30, 2.3), 'one deck under both bridge tracks');
});

test('bed lift: the top stands topLift over the highest land under it, not just the centreline', () => {
  // A cross slope: land rises 0.3 m per metre to the left; the left top edge's land is 0.465 m over the centre's.
  const slope = (_x: number, y: number) => Math.max(0, y) * 0.3;
  const m = railMeshes({ ways: [track(0)], inCell: () => true, height: slope });
  const t = topAt(m.ballast, 24, RAIL_SECTION.topHalf, 0.05);
  assert.ok(Math.abs(t - (RAIL_SECTION.topHalf * 0.3 + RAIL_SECTION.topLift)) < 1e-6, `top ${t}`);
  // Yard tracks no longer step 3 cm under the running lines (the dark ridges in Centraal's throat).
  const yard = railMeshes({ ways: [track(0, { service: true })], inCell: () => true, height: () => 0 });
  assert.ok(Math.abs(topAt(yard.ballast, 24, 0, 1.6) - RAIL_SECTION.topLift) < 1e-6);
});

test('rail stripes: at the gauge, inside the sleepered top, darker than the ballast', () => {
  const [l, r] = railStripes();
  assert.ok(Math.abs((r[0] + r[1]) / 2 - (l[0] + l[1]) / 2 - RAIL_SECTION.gauge) < 1e-9);
  assert.ok(l[0] > 0.25 && r[1] < 2 * RAIL_SECTION.topHalf - 0.25);
  assert.ok(RAIL_STRIPE.tone.every((v, i) => v < [126, 117, 106][i] - 40));
});

test('compact cells keep the bed uv (sleepers across the track, not along world x)', async () => {
  const { compactCell, gpuMeshBytes } = await import('./compactMesh.ts');
  const { packMesh } = await import('./groundCell.ts');
  // A track heading north-east: its bed's uv is not the position's x, y.
  const m = railMeshes({ ways: [{ kind: 'rail', bridge: false, service: false, points: [[0, 0], [40, 40]] }], inCell: () => true, height: () => 0 });
  const ballast = packMesh(m.ballast), land = packMesh(m.track);
  const c = compactCell({ key: '0_0', lod: 0, rect: [0, 0, 1, 1], layers: { ballast, land }, mask: null, stats: { bytes: 0 } } as never);
  const cb = (c.layers as unknown as Record<string, { uvs?: Float32Array }>).ballast;
  assert.ok(cb.uvs && cb.uvs.length === ballast.uvs.length, 'ballast keeps its uv');
  assert.equal((c.layers as unknown as Record<string, { uvs?: Float32Array }>).land.uvs, undefined, 'other layers read the uv from x, y');
  assert.ok(gpuMeshBytes(cb as never) > ballast.positions.byteLength);
});
