// Two-finger twist orbits the chase/cockpit camera (user ask 2026-10-03).
// A pinch's natural wobble must not turn the view; a real twist tracks the
// fingers without a jump; Option/Alt + scroll is the Chrome/Firefox route.

import assert from 'node:assert/strict';
import {
  TWIST_DEADZONE_DEG, bearingAfterTwist, startTwist, twistStep, wheelTwistDegrees,
} from '../src/canalRecall/game/trackpadTwist.ts';

let checks = 0;
const ok = (condition: boolean, message: string): void => { assert.ok(condition, message); checks++; };

// Pinch wobble inside the dead zone never turns the camera.
{
  const state = startTwist();
  const turned = [1, -2, 3.5, -4, 5].reduce((sum, deg) => sum + twistStep(state, deg), 0);
  ok(turned === 0 && !state.engaged, 'wobble under the dead zone is ignored');
}

// Crossing the dead zone engages without a jump, then follows the fingers.
{
  const state = startTwist();
  ok(twistStep(state, 3) === 0, 'still in the dead zone');
  ok(twistStep(state, TWIST_DEADZONE_DEG + 1) === 0, 'engaging does not jump');
  ok(twistStep(state, TWIST_DEADZONE_DEG + 21) === 20, 'then tracks 1:1');
  ok(twistStep(state, TWIST_DEADZONE_DEG + 11) === -10, 'and back');
  ok(twistStep(state, NaN) === 0, 'non-finite rotation is ignored');
}

// Counter-clockwise twists engage too.
{
  const state = startTwist();
  twistStep(state, -(TWIST_DEADZONE_DEG + 2));
  ok(twistStep(state, -(TWIST_DEADZONE_DEG + 32)) === -30, 'counter-clockwise tracks');
}

// Clockwise on screen lowers the bearing, and the bearing stays wrapped.
ok(bearingAfterTwist(0, 30) === -30, 'clockwise twist lowers bearing');
ok(bearingAfterTwist(170, -30) === -160, 'wraps past +180');
ok(bearingAfterTwist(-170, 30) === 160, 'wraps past -180');

// Option/Alt + scroll twists; plain, ctrl (pinch) and shift scroll do not.
const wheel = (o: Partial<{ altKey: boolean; ctrlKey: boolean; deltaX: number; deltaY: number; deltaMode: number }>) =>
  wheelTwistDegrees({ altKey: false, ctrlKey: false, deltaX: 0, deltaY: 0, deltaMode: 0, ...o });
ok(wheel({ deltaY: 40 }) === null, 'plain scroll pans');
ok(wheel({ ctrlKey: true, altKey: true, deltaY: 40 }) === null, 'pinch zoom stays zoom');
ok((wheel({ altKey: true, deltaY: 40 }) ?? 0) > 0, 'alt + vertical scroll twists');
ok((wheel({ altKey: true, deltaX: -40, deltaY: 5 }) ?? 0) < 0, 'alt + sideways scroll twists the other way');
ok(wheel({ altKey: true, deltaY: 1, deltaMode: 1 })! === wheel({ altKey: true, deltaY: 16 })!, 'line-mode wheels scale to pixels');

console.log(`trackpad twist: ${checks} checks passed`);
