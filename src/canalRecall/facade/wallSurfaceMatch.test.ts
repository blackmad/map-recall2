import assert from 'node:assert/strict';
import type { FacadeWallPlane } from '../building/facadePointCloud.ts';
import { matchWallSurface, WALL_ANGLE_TOLERANCE_DEG, WALL_OFFSET_TOLERANCE_M, type A0WallFrame } from './wallSurfaceMatch.ts';

let checks = 0;
const check = (condition: boolean, label: string) => {
  checks += 1;
  assert.ok(condition, label);
};
const close = (actual: number | null, expected: number, tolerance: number, label: string) => {
  checks += 1;
  assert.ok(actual !== null && Math.abs(actual - expected) <= tolerance, `${label} (got ${actual}, expected ${expected} ±${tolerance})`);
};

let surfaceCounter = 0;
/** A vertical wall polygon: direction (cosθ, sinθ) through the origin, z in [minZ, maxZ]. */
const wall = (angleDeg: number, lengthM: number, offsetY: number, minZ = 0, maxZ = 5): FacadeWallPlane => {
  const theta = angleDeg * Math.PI / 180;
  const direction = { x: Math.cos(theta), y: Math.sin(theta) };
  const normal: readonly [number, number, number] = [Math.sin(theta), -Math.cos(theta), 0];
  const along = (t: number): readonly [number, number, number] => [
    t * direction.x,
    offsetY + t * direction.y,
    minZ,
  ];
  const alongTop = (t: number): readonly [number, number, number] => [
    t * direction.x,
    offsetY + t * direction.y,
    maxZ,
  ];
  surfaceCounter += 1;
  return {
    buildingId: 'bag:0363100012164991',
    surfaceId: `surface-${surfaceCounter}`,
    exterior: true,
    vertices: [along(0), alongTop(0), alongTop(lengthM), along(lengthM)],
    normal,
    areaSquareMetres: lengthM * (maxZ - minZ),
  };
};

const frame = (leftEdge: 'start' | 'end' = 'start'): A0WallFrame => ({
  pandId: '0363100012164991',
  start: { x: 0, y: 0 },
  end: { x: 10, y: 0 },
  bottomNap: 1,
  topNap: 14,
  leftEdge,
});

// 1. A wall on its own surface matches, exactly and within the tolerances.
const base = wall(0, 10, 0);
const exact = matchWallSurface(frame(), [base]);
check(exact.relation === 'match' && !exact.excluded, 'coplanar, parallel wall matches');
close(exact.offsetM, 0, 1e-9, 'match offset is zero');
close(exact.angleDeg, 0, 1e-9, 'match angle is zero');
close(exact.overlapFraction, 1, 1e-9, 'match covers the whole wall');

// 2. The strip's left-edge flag is provenance, not geometry: it cannot change the match.
const flipped = matchWallSurface(frame('end'), [base]);
check(flipped.relation === exact.relation && flipped.surfaceId === base.surfaceId, 'leftEdge does not affect the geometry');

// 3. The offset tolerance is a hard edge at 0.5 m.
const shiftedNear = matchWallSurface(frame(), [wall(0, 10, WALL_OFFSET_TOLERANCE_M - 0.1)]);
check(shiftedNear.relation === 'match', 'a 0.4 m shift is still on the surface');
const shiftedFar = matchWallSurface(frame(), [wall(0, 10, WALL_OFFSET_TOLERANCE_M + 0.1)]);
check(shiftedFar.relation === 'offset' && shiftedFar.excluded, 'a 0.6 m shift is excluded');

// 4. The angle tolerance is a hard edge at 5°.
const tiltedNear = matchWallSurface(frame(), [wall(WALL_ANGLE_TOLERANCE_DEG - 1, 10, 0)]);
check(tiltedNear.relation === 'match', 'a 4° tilt is still the same wall');
const tiltedFar = matchWallSurface(frame(), [wall(WALL_ANGLE_TOLERANCE_DEG + 5, 10, 0)]);
check(tiltedFar.relation === 'angle' && tiltedFar.excluded, 'a 10° tilt is excluded');
close(tiltedFar.angleDeg, 10, 1e-6, 'the reported angle is the measured one');

// 5. A surface on the same line but elsewhere along the façade is not this wall.
const elsewhere: A0WallFrame = { ...frame(), start: { x: 20, y: 0 }, end: { x: 30, y: 0 } };
const disjoint = matchWallSurface(elsewhere, [wall(0, 10, 0)]);
check(disjoint.relation === 'no-overlap' && disjoint.excluded, 'a coplanar surface with no along-overlap is excluded');
close(disjoint.overlapM, 0, 1e-9, 'disjoint overlap is zero');

// 6. A vertical band that misses the surface is not a lie-on-surface either.
const highBand: A0WallFrame = { ...frame(), bottomNap: 100, topNap: 110 };
const above = matchWallSurface(highBand, [wall(0, 10, 0)]);
check(above.relation === 'no-overlap' && above.excluded, 'a wall band above the surface is excluded');
close(above.verticalOverlapM, 0, 1e-9, 'vertical overlap is zero');

// 7. With several surfaces, the one that matches wins even when another is closer in offset.
const candidates = [wall(90, 5, 0), wall(0, 10, 0.02)];
const best = matchWallSurface(frame(), candidates);
check(best.relation === 'match' && best.surfaceId === candidates[1].surfaceId, 'the matching surface wins over a closer-offset corner');

// 8. A pand with no wall surfaces at all abstains instead of guessing.
const none = matchWallSurface(frame(), []);
check(none.relation === 'no-surface' && none.excluded && none.surfaceId === null, 'no surfaces means no-surface');

process.stdout.write(`Wall-surface match checks passed (${checks} assertions).\n`);
