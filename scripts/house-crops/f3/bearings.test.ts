import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signedBearingDeg, secondBearings } from './bearings.ts';
import type { PanoPick } from '../../pand-reference/select.ts';

const wall = { a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, len: 10, nx: 0, ny: -1, mid: { x: 5, y: 0 } };
test('signed bearing: straight on is 0, either side has opposite sign', () => {
  assert.ok(Math.abs(signedBearingDeg({ x: 5, y: -10 }, wall)) < 1e-9);
  const l = signedBearingDeg({ x: -3, y: -10 }, wall), r = signedBearingDeg({ x: 13, y: -10 }, wall);
  assert.ok(l * r < 0 && Math.abs(Math.abs(l) - Math.abs(r)) < 1e-9);
});
const p = (id: string, y: number, ts: string, obl: number): PanoPick => ({ panoId: id, timestamp: ts, missionYear: y, missionType: '', surface: '', distM: 10, obliquityDeg: obl, relaxed: false, record: null });
test('second bearing: same year, separated, leaf-off first', () => {
  const rep = p('a', 2020, '2020-07-01', 5), summer = p('b', 2020, '2020-06-01', 20), winter = p('c', 2020, '2020-02-01', 30), near = p('d', 2020, '2020-01-01', 6), other = p('e', 2019, '2019-02-01', 20);
  const bear: Record<string, number> = { a: 5, b: 25, c: -30, d: 8, e: 25 };
  const got = secondBearings([rep, summer, winter, near, other], [rep], x => bear[x.panoId], () => 0);
  assert.deepEqual(got.map(g => g.panoId), ['c']);
});
