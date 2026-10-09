// node --import tsx --test src/canalRecall/rendererSpike/rendererSpike.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStreetMeshes } from './streetMesh.js';
import { autopilotPath, cumulativeLengths, mapLibreEye, sampleAlong } from './ride.js';

test('street ribbons: width prior, upward faces, paint only where the class asks', () => {
  const m = buildStreetMeshes([
    { highway: 'tertiary', points: [[0, 0], [100, 0]] },
    { highway: 'residential', points: [[0, 50], [100, 50]] },
    { highway: 'motorway', points: [[0, 90], [100, 90]] },
  ]);
  assert.equal(m.stats.ways, 2);
  const ys = m.asphalt.positions.filter((_, i) => i % 3 === 1);
  assert.ok(Math.abs(Math.max(...ys) - 3.75) < 1e-6 && Math.abs(Math.min(...ys) + 3.75) < 1e-6);
  assert.ok(m.paint.indices.length > 0);
  // Every triangle is counter-clockwise seen from above (front faces up).
  for (const mesh of [m.asphalt, m.klinker, m.paint]) for (let i = 0; i < mesh.indices.length; i += 3) {
    const p = (k: number) => [mesh.positions[mesh.indices[i + k] * 3], mesh.positions[mesh.indices[i + k] * 3 + 1]];
    const [a, b, c] = [p(0), p(1), p(2)];
    assert.ok((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) >= -1e-9);
  }
  // Higher-rank classes sit above lower ones (no z-fighting at overlaps).
  assert.ok(m.asphalt.positions[2] > m.klinker.positions[2]);
});

test('autopilot is deterministic and follows the graph', () => {
  const grid = [];
  for (let i = 0; i <= 4; i++) {
    grid.push({ highway: 'residential', points: [[i * 50, 0], [i * 50, 200]] as [number, number][] });
    grid.push({ highway: 'residential', points: [[0, i * 50], [200, i * 50]] as [number, number][] });
  }
  // Split ways at junctions so nodes are shared.
  const split = grid.flatMap(w => { const out = []; const [a, b] = w.points; for (let k = 0; k < 4; k++) out.push({ highway: w.highway, points: [[a[0] + (b[0] - a[0]) * k / 4, a[1] + (b[1] - a[1]) * k / 4], [a[0] + (b[0] - a[0]) * (k + 1) / 4, a[1] + (b[1] - a[1]) * (k + 1) / 4]] as [number, number][] }); return out; });
  const one = autopilotPath(split, [100, 100], 600), two = autopilotPath(split, [100, 100], 600);
  assert.deepEqual(one, two);
  assert.ok(cumulativeLengths(one).at(-1)! >= 600);
  const s = sampleAlong(one, cumulativeLengths(one), 25);
  assert.ok(Math.abs(Math.hypot(...s.dir) - 1) < 1e-9);
});

test('MapLibre camera: pitch 0 looks straight down from the zoom distance', () => {
  const { eye } = mapLibreEye({ centre: [0, 0], zoom: 17, pitchDeg: 0, bearingDeg: 0, fovDeg: 36.87, lat: 0 }, 900);
  // 900 px tall viewport, fov 36.87 => 1350 px; z17 at the equator => 0.2986 m/px.
  assert.ok(Math.abs(eye[2] - 1350 * (2 * Math.PI * 6371008.8) / (512 * 2 ** 17)) < 0.05);
  const tilted = mapLibreEye({ centre: [0, 0], zoom: 17, pitchDeg: 60, bearingDeg: 90, fovDeg: 36.87, lat: 0 }, 900);
  assert.ok(tilted.eye[0] < 0 && Math.abs(tilted.eye[1]) < 1e-6); // facing east, the eye sits to the west
});
