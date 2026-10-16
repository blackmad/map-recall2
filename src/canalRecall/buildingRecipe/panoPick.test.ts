import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterPanos, isEmptyFilter, mergeWallRows, parsePanoFilter, segmentTag, segmentWall} from './panoPick.ts';

const ranked = [
  {panoId: 'a', timestamp: '2024-12-11T10:00:00Z'},
  {panoId: 'b', timestamp: '2020-02-07T09:00:00Z'},
  {panoId: 'c', timestamp: '2019-04-29T12:00:00Z'},
  {panoId: 'd', timestamp: '2022-05-02T08:00:00Z'},
];

test('parsePanoFilter: comma lists, empty when absent, bad prefixes refused', () => {
  assert.deepEqual(parsePanoFilter(['--pand=1']), {});
  assert.ok(isEmptyFilter(parsePanoFilter([])));
  assert.deepEqual(parsePanoFilter(['--date=2019,2022-05', '--exclude-date=2024-12-11', '--exclude-pano=x,y']),
    {dates: ['2019', '2022-05'], excludeDates: ['2024-12-11'], excludePanos: ['x', 'y']});
  assert.throws(() => parsePanoFilter(['--date=19']));
});

test('filterPanos keeps order; empty filter is the identity (all-walls unchanged)', () => {
  assert.deepEqual(filterPanos(ranked, {}), ranked);
  assert.deepEqual(filterPanos(ranked, {excludeDates: ['2024-12-11']}).map(p => p.panoId), ['b', 'c', 'd']);
  assert.deepEqual(filterPanos(ranked, {dates: ['2019', '2022-05']}).map(p => p.panoId), ['c', 'd']);
  assert.deepEqual(filterPanos(ranked, {excludePanos: ['b', 'c']}).map(p => p.panoId), ['a', 'd']);
});

test('segmentWall: equal pieces along a -> b, short walls untouched', () => {
  const w = {a: {x: 0, y: 0}, b: {x: 100, y: 0}, len: 100, mid: {x: 50, y: 0}, nx: 0, ny: -1, extra: 7};
  assert.deepEqual(segmentWall(w, 0), [w]);
  assert.deepEqual(segmentWall(w, 120), [w]);
  const s = segmentWall(w, 30);
  assert.equal(s.length, 4);
  assert.deepEqual(s.map(p => [p.a.x, p.b.x, p.len, p.mid.x]), [[0, 25, 25, 12.5], [25, 50, 25, 37.5], [50, 75, 25, 62.5], [75, 100, 25, 87.5]]);
  assert.ok(s.every(p => p.ny === -1 && p.extra === 7));
  assert.deepEqual(s[2].segment, {index: 2, of: 4});
  assert.equal(segmentTag('w01-67', s[2].segment, 'd20'), 'w01-67s3d20');
  assert.equal(segmentTag('w01-67', undefined), 'w01-67');
});

test('mergeWallRows replaces rows of the same tag and keeps the rest', () => {
  const merged = mergeWallRows([{tag: 'w01-67', v: 1}, {tag: 'w02-248', v: 1}], [{tag: 'w01-67', v: 2}, {tag: 'w01-67s1', v: 2}]);
  assert.deepEqual(merged, [{tag: 'w01-67', v: 2}, {tag: 'w01-67s1', v: 2}, {tag: 'w02-248', v: 1}]);
  // re-cutting w01-67 drops its earlier pieces (and their leaf-off twins) of the same suffix, not other suffixes or walls
  const old = ['w01-67', 'w01-67L', 'w01-67s1', 'w01-67s1L', 'w01-67s6', 'w01-67s1d19', 'w010-67', 'w02-248'].map(tag => ({tag}));
  assert.deepEqual(mergeWallRows(old, [{tag: 'w01-67s1'}, {tag: 'w01-67s2'}], ['w01-67']).map(r => r.tag), ['w01-67s1', 'w01-67s1d19', 'w01-67s2', 'w010-67', 'w02-248']);
});

test('closeCameraSpan: a segmented mosaic of near cameras is judged per crop, not by the whole wall', async () => {
  const {closeCameraSpan} = await import('./likeness.ts');
  const piece = (tag: string, u0: number, u1: number, cameraDistM: number) => ({u0, u1, crop: {tag, cameraDistM}});
  // 88 m pale hall side in eight 11 m crops from 4-5 m: no single close crop spans over 15 m
  assert.equal(closeCameraSpan(Array.from({length: 8}, (_, i) => piece(`s${i}`, i * 11, i * 11 + 11, 4.5))), 11);
  // one close crop used in two runs adds up; far crops do not count
  assert.equal(closeCameraSpan([piece('a', 0, 10, 5), piece('b', 10, 30, 20), piece('a', 30, 38, 5)]), 18);
  assert.equal(closeCameraSpan([piece('b', 0, 30, 20)]), 0);
});
