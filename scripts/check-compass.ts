/**
 * North-screen angle for the HUD compass.
 *
 * World −Y is north. A needle drawn along local +X must rotate to −π/2 when
 * the camera is north-up, then follow camera.rotation as the map turns.
 */
import assert from 'node:assert/strict';
import { northScreenAngle } from '../src/canalRecall/compass.ts';

const near = (actual: number, expected: number, label: string) => {
  const delta = Math.atan2(Math.sin(actual - expected), Math.cos(actual - expected));
  assert.ok(Math.abs(delta) < 1e-9, `${label}: got ${actual}, want ${expected}`);
};

near(northScreenAngle(0), -Math.PI / 2, 'north-up points up the screen');
near(northScreenAngle(Math.PI / 2), -Math.PI, 'quarter turn points left');
near(northScreenAngle(Math.PI), Math.PI / 2, 'south-up points down');
near(northScreenAngle(-Math.PI / 2), 0, 'west-up points right');

console.log('Compass OK: 4 checks.');
