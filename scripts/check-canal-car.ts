import assert from 'node:assert/strict';
import { constrainCarToRoad, type CarKinematics, type RoadContact } from '../src/canalRecall/carRoadGuard';

const options = { edgeTolerance: 12 };
const road = (overrides: Partial<RoadContact> = {}): RoadContact => ({
  x: 0, y: 0, dist: 0, width: 30, angle: 0, ...overrides,
});
const car = (overrides: Partial<CarKinematics> = {}): CarKinematics => ({
  x: 0, y: 0, angle: 0, vx: 180, vy: 0, speed: 180, ...overrides,
});

{
  const subject = car({ x: 70, y: 55, vx: 160, vy: 90 });
  const result = constrainCarToRoad(subject, { x: 38, y: 28 }, road({ dist: 55 }), road({ x: 38, y: 0, dist: 28 }), options);
  assert.equal(result, 'rolled-back');
  assert.deepEqual({ x: subject.x, y: subject.y }, { x: 38, y: 28 });
  assert.equal(subject.vy, 0, 'rollback removes velocity pointing into a canal/block');
  assert.ok(subject.speed < 180, 'rollback sheds speed');
}

{
  const subject = car({ x: 35, y: 0, speed: 100 });
  const result = constrainCarToRoad(subject, { x: 34, y: 0 }, road({ x: 0, dist: 35 }), road({ dist: 34 }), options);
  assert.equal(result, 'soft-edge');
  assert.ok(subject.x < 35, 'the shoulder guard nudges inward before rollback is needed');
}

{
  const subject = car({ x: 3, y: 0, angle: Math.PI / 2, vx: 0, vy: 120 });
  const result = constrainCarToRoad(subject, { x: 2, y: 0 }, road({ dist: 3, angle: Math.PI / 2 }), road({ angle: Math.PI / 2 }), options);
  assert.equal(result, 'on-road', 'a bridge-centre contact remains drivable even above rendered water');
}

{
  const subject = car({ x: 80, y: 80, vx: 100, vy: 50 });
  constrainCarToRoad(subject, { x: 40, y: 40 }, null, null, options);
  assert.deepEqual({ x: subject.x, y: subject.y }, { x: 40, y: 40 });
  assert.deepEqual({ vx: subject.vx, vy: subject.vy }, { vx: 50, vy: 25 });
}

{
  const subject = car({ x: 50, y: 50, angle: 0, vx: 120, vy: 30 });
  constrainCarToRoad(subject, { x: 30, y: 30 }, road({ dist: 60, angle: Math.PI / 2 }), road({ angle: Math.PI / 2 }), options);
  assert.ok(subject.angle > 0, 'recovery begins aligning toward a sharp new street heading');
  assert.ok(Math.abs(subject.vx) < 0.001, 'recovery projects velocity onto the street tangent');
}

process.stdout.write('Canal Recall car road-guard simulations passed (5 scenarios).\n');
