// node --import tsx --test scripts/buurt-generators/sheetPose.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { poseCheck, poseFaults } from './sheetPose.ts';

// RD coordinates from the Centrum stage (fronts.json) and the cached panorama records the sheets were cut from.
test('Sleperssteeg 182789-182780: a camera in the street behind the block is refused', () => {
  const cam = { x: 122011.08, y: 487219.64 }; // recording_2025-07-03_04-36-25_01193
  const row = [
    { id: '0363100012182789', a: { x: 122029.87, y: 487226.43 }, b: { x: 122026.28, y: 487229.57 } },
    { id: '0363100012182788', a: { x: 122026.28, y: 487229.57 }, b: { x: 122022.02, y: 487233.49 } },
    { id: '0363100012182780', a: { x: 122022.02, y: 487233.49 }, b: { x: 122016.81, y: 487238.09 } },
  ];
  const v = poseCheck(cam, row, row);
  assert.deepEqual(v.map(x => x.behind), [true, true, true]);
  assert.ok(v.every(x => x.distM < -17), 'about 17.5 m behind the fronts');
  assert.equal(poseFaults(v).length, 3);
});

test('Binnen Bantammerstraat 181775-182980: a camera 23 m out across another block is refused', () => {
  const cam = { x: 121973.16, y: 487412.89 }; // TMX7316010203-002863_pano_0001_000013
  const row = [
    { id: '0363100012181775', a: { x: 121982.30, y: 487434.49 }, b: { x: 121986.91, y: 487431.23 } },
    { id: '0363100012181774', a: { x: 121986.91, y: 487431.23 }, b: { x: 121991.52, y: 487428.08 } },
    { id: '0363100012182980', a: { x: 121991.52, y: 487428.08 }, b: { x: 121996.26, y: 487424.71 } },
  ];
  const across = { id: '0363100012181777', a: { x: 121974.74, y: 487414.73 }, b: { x: 121977.99, y: 487411.70 } };
  const v = poseCheck(cam, row, [...row, across]);
  assert.deepEqual(v.map(x => x.blockedBy), [null, across.id, across.id]);
  assert.ok(v.every(x => !x.behind && x.distM > 22));
  assert.equal(poseFaults(v).length, 2);
});

test('Raamstraat 169930-169925: 6.4 m out on the street side, unblocked; the pose check does not see its one-house shift', () => {
  const cam = { x: 120532.27, y: 486603.57 }; // TMX7316010203-001675_pano_0000_005533 (2020)
  const row = [
    { id: '0363100012169930', a: { x: 120541.12, y: 486601.04 }, b: { x: 120535.58, y: 486598.07 } },
    { id: '0363100012169925', a: { x: 120535.58, y: 486598.07 }, b: { x: 120529.57, y: 486594.89 } },
  ];
  const v = poseCheck(cam, row, row);
  assert.deepEqual(poseFaults(v), []);
  assert.deepEqual(v.map(x => x.distM), [6.41, 6.41]);
});

test('a camera on the street side with a clear view passes; touching end points do not block', () => {
  const row = [{ id: 'a', a: { x: 0, y: 0 }, b: { x: 5, y: 0 } }, { id: 'b', a: { x: 5, y: 0 }, b: { x: 10, y: 0 } }];
  // The street side is the left of a->b: for a front running +x it is -y.
  const v = poseCheck({ x: 5, y: -6 }, row, row);
  assert.deepEqual(v.map(x => x.distM), [6, 6]);
  assert.deepEqual(poseFaults(v), []);
});
