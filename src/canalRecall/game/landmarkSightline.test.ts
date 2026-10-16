import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_SIGHTLINE, SIGHTLINE, easeSightline, landmarkSightline, relativeTo, sightlineWeight } from './landmarkSightline.ts';

test('landmark sightline (ride review J3): the Westertoren 210 m ahead lifts the chase view, bounded', () => {
  // The Leliegracht frame: rider at 4.88437, 52.37641 heading 182°, the Westertoren at 4.88378, 52.37456 (85 m).
  const rel = relativeTo([4.88437, 52.37641], 182, [4.88378, 52.37456]);
  assert.ok(rel.distanceM > 200 && rel.distanceM < 220, `distance ${rel.distanceM}`);
  const { view, engaged } = landmarkSightline({ ...rel, heightM: 85 }, false);
  assert.ok(engaged && view.pitchDeg === SIGHTLINE.maxPitchDeg && view.leadM === SIGHTLINE.maxLeadM, JSON.stringify(view));
  // Bounded: never more than the maximum; nothing for a short building, behind the rider, past the reach, or on a phone.
  for (const d of [50, 90, 150, 260, 299, 400]) { const v = landmarkSightline({ distanceM: d, offAxisDeg: 0, heightM: 85 }, false).view; assert.ok(v.pitchDeg <= SIGHTLINE.maxPitchDeg && v.leadM <= SIGHTLINE.maxLeadM); }
  assert.deepEqual(landmarkSightline({ ...rel, heightM: 20 }, false).view, NO_SIGHTLINE);
  assert.deepEqual(landmarkSightline({ distanceM: 200, offAxisDeg: 170, heightM: 85 }, false).view, NO_SIGHTLINE);
  assert.deepEqual(landmarkSightline({ distanceM: 320, offAxisDeg: 0, heightM: 85 }, false).view, NO_SIGHTLINE);
  assert.deepEqual(landmarkSightline({ ...rel, heightM: 85 }, false, false).view, NO_SIGHTLINE);
  assert.equal(landmarkSightline(null, true).engaged, false);
  // Hysteresis on the heading cone: 50° off does not engage, but keeps an engaged view.
  assert.equal(landmarkSightline({ distanceM: 200, offAxisDeg: 50, heightM: 85 }, false).engaged, false);
  assert.equal(landmarkSightline({ distanceM: 200, offAxisDeg: 50, heightM: 85 }, true).engaged, true);
  assert.equal(landmarkSightline({ distanceM: 200, offAxisDeg: -365 + 50, heightM: 85 }, true).engaged, true, 'angles wrap');
  // Faded at both ends, continuous.
  assert.equal(sightlineWeight(SIGHTLINE.nearZeroM), 0); assert.equal(sightlineWeight(SIGHTLINE.reachM), 0);
  let last = 0, worst = 0;
  for (let d = 0; d <= 320; d += 1) { const w = sightlineWeight(d); worst = Math.max(worst, Math.abs(w - last)); last = w; }
  assert.ok(worst < 0.1, `largest step per metre ${worst}`);
});

test('landmark sightline eases toward its target; reduced motion snaps', () => {
  let v = NO_SIGHTLINE;
  const target = { pitchDeg: 8, leadM: 50 };
  v = easeSightline(v, target, 1 / 60);
  assert.ok(v.pitchDeg > 0 && v.pitchDeg < 1, `first frame ${v.pitchDeg}`);
  for (let i = 0; i < 600; i++) v = easeSightline(v, target, 1 / 60);
  assert.deepEqual(v, target);
  assert.deepEqual(easeSightline(NO_SIGHTLINE, target, 1 / 60, true), target);
});
