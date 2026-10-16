import test from 'node:test';
import assert from 'node:assert/strict';
import { MotionEstimate, aheadRank, aheadRankXY, boxAround, lookAheadPoints, offsetLngLat, tileCentre } from './streamingLookAhead.ts';
import { planTiles, planTilesAhead } from './buildingTileSource.ts';
import { tileFor, tileKey } from './slippyTiles.ts';
import { detailBlock, metresToTile } from './detailRing.ts';
import { ChunkBuildQueue } from './chunkBuildQueue.ts';
import { GroundBuildQueue } from './ownGround/buildQueue.ts';

test('ground build queue: arrival order unranked; a newer request replaces; order re-ranks and drops cells left behind', () => {
  const q = new GroundBuildQueue();
  q.build('a', 1, 1); q.build('b', 1, 1); q.build('c', 1, 1); q.requestFar('F', 1);
  q.build('a', 0, 1); // now near: one job, LOD 0, behind b and c in arrival order
  assert.equal(q.size, 4);
  assert.deepEqual(q.next(), { kind: 'cell', key: 'b', lod: 1, gen: 1 });
  q.order(['a', 'd']); // the rider moved: c is no longer wanted, a is first
  q.build('d', 1, 2);
  assert.deepEqual(q.next(), { kind: 'cell', key: 'a', lod: 0, gen: 1 });
  assert.deepEqual(q.next(), { kind: 'cell', key: 'd', lod: 1, gen: 2 });
  assert.deepEqual(q.next(), { kind: 'far', key: 'F', gen: 1 }, 'far blocks after cells');
  assert.equal(q.next(), null);
});

const M_LAT = 111_320;
const mLng = (lat: number) => M_LAT * Math.cos(lat * Math.PI / 180);

test('motion: a rider going east at 40 m/s reads as 40 m/s east; a jump resets instead of reading as speed', () => {
  const m = new MotionEstimate(300);
  const lat = 52.37;
  for (let i = 0; i <= 120; i++) m.update(4.88 + (40 * i / 60) / mLng(lat), lat, i * 1000 / 60);
  assert.ok(Math.abs(m.speed - 40) < 0.5, `speed ${m.speed}`);
  const [e, n] = m.direction!;
  assert.ok(e > 0.999 && Math.abs(n) < 0.01);
  m.update(4.95, 52.40, 121 * 1000 / 60); // 5 km in a frame: a new ride
  assert.equal(m.speed, 0);
  assert.equal(m.direction, null);
});

test('look-ahead points: none while standing; ahead along the heading, clamped between min and max', () => {
  assert.deepEqual(lookAheadPoints([4.88, 52.37], { speed: 0, direction: null }), []);
  const pts = lookAheadPoints([4.88, 52.37], { speed: 40, direction: [0, 1] }, { seconds: [5, 12], maxM: 1200, minM: 200 });
  assert.equal(pts.length, 2);
  assert.ok(Math.abs((pts[0][1] - 52.37) * M_LAT - 200) < 0.5, 'max(200, 40·5) m north');
  assert.ok(Math.abs((pts[1][1] - 52.37) * M_LAT - 480) < 0.5, '40·12 m north');
  const far = lookAheadPoints([4.88, 52.37], { speed: 200, direction: [1, 0] }, { seconds: [12], maxM: 1200 });
  assert.ok(Math.abs((far[0][0] - 4.88) * mLng(52.37) - 1200) < 0.5, 'clamped at 1200 m');
  const [x, y] = offsetLngLat([4.88, 52.37], [0.6, 0.8], 100);
  assert.ok(Math.abs((x - 4.88) * mLng(52.37) - 60) < 0.01 && Math.abs((y - 52.37) * M_LAT - 80) < 0.01);
  const box = boxAround([4.88, 52.37], 150);
  assert.ok(Math.abs((box.north - box.south) * M_LAT - 300) < 0.01);
});

test('ahead rank: ahead before beside before behind at equal distance; plain distance without a heading', () => {
  const at: [number, number] = [4.88, 52.37], dir: [number, number] = [1, 0];
  const ahead = aheadRank(at, offsetLngLat(at, [1, 0], 500), dir);
  const beside = aheadRank(at, offsetLngLat(at, [0, 1], 500), dir);
  const behind = aheadRank(at, offsetLngLat(at, [-1, 0], 500), dir);
  assert.ok(ahead < beside && beside < behind);
  assert.ok(Math.abs(beside - 500) < 0.5 && Math.abs(ahead - 200) < 0.5 && Math.abs(behind - 800) < 0.5);
  assert.ok(Math.abs(aheadRank(at, offsetLngLat(at, [1, 0], 500), null) - 500) < 0.5);
  assert.ok(aheadRankXY([0, 0], [300, 0], [1, 0]) < aheadRankXY([0, 0], [150, 0], [-1, 0]), 'a cell 300 m ahead before one 150 m behind');
  const [lng, lat] = tileCentre(14, 8414, 5384);
  assert.equal(tileKey(tileFor(lng, lat, 14)), '14/8414/5384');
});

test('planTilesAhead: no areas is exactly planTiles; the tile ahead is wanted, loads after the view and is kept', () => {
  const view = { west: 4.880, south: 52.370, east: 4.884, north: 52.373 };
  const held = ['14/8410/5380'];
  assert.deepEqual(planTilesAhead(view, [], held, { zoom: 14, margin: 0, budget: 12 }), planTiles(view, held, { zoom: 14, margin: 0, budget: 12 }));
  // 1.2 km east: the next z14 tile.
  const ahead = boxAround(offsetLngLat([4.882, 52.3715], [1, 0], 1200), 150);
  const viewKeys = planTiles(view, [], { zoom: 14, margin: 0 }).wanted;
  const plan = planTilesAhead(view, [ahead], [], { zoom: 14, margin: 0, budget: 12 });
  const extra = plan.wanted.filter(k => !viewKeys.includes(k));
  assert.ok(extra.length >= 1, 'a look-ahead tile beyond the view');
  assert.deepEqual(plan.load.slice(0, viewKeys.length).map(tileKey), viewKeys, 'view tiles first');
  // Held and still ahead: never evicted, even over budget.
  const kept = planTilesAhead(view, [ahead], [...extra, '14/8000/5000'], { zoom: 14, margin: 0, budget: 1 });
  assert.ok(!kept.evict.some(k => extra.includes(k)));
  assert.ok(kept.evict.includes('14/8000/5000'));
});

const fracY = (lat: number, n: number) => ((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2) * n;
const tileTopLat = (y: number, n: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;

test('detail block: legacy is the old rider-centred 2x2; look-ahead leads, holds its side near the midline, lingers', () => {
  const z = 16, lat = 52.372, n = 2 ** z;
  // A rider a hair east of a z16 tile's vertical midline.
  const x = Math.floor(((4.885 + 180) / 360) * n);
  const midLng = ((x + 0.5) / n) * 360 - 180;
  const rider: [number, number] = [midLng + 1 / mLng(lat), lat];
  const legacy = detailBlock(rider, [0, 1], z, null, { legacy: true });
  assert.equal(legacy.dx, 1);
  assert.equal(legacy.keys.length, 4);
  // Wobbling 2 m west across the midline flips the legacy block but not the hysteretic one.
  const west: [number, number] = [midLng - 1 / mLng(lat), lat];
  assert.equal(detailBlock(west, [0, 1], z, legacy, { legacy: true }).dx, -1);
  const held = detailBlock(rider, null, z, null);
  assert.equal(detailBlock(west, null, z, held).dx, 1, 'held within the margin');
  // Heading north, 60 m short of the tile's north edge: the led centre is already in the next tile north.
  const y = Math.floor(fracY(lat, n));
  const nearTop: [number, number] = [midLng + 1 / mLng(lat), tileTopLat(y, n) - 60 / M_LAT];
  const led = detailBlock(nearTop, [0, 1], z, null);
  assert.equal(led.y, y - 1);
  assert.ok(led.keys.includes(`${x}/${y - 1}`), 'the tile ahead is in the block');
  // A tile the block leaves lingers while the rider is within 160 m of it.
  const before = detailBlock(nearTop, [0, -1], z, null);
  const after = detailBlock(nearTop, [0, 1], z, before);
  for (const k of before.keys) {
    if (after.keys.slice(0, 4).includes(k)) continue;
    assert.equal(after.keys.includes(k), metresToTile(nearTop, k, z) <= 160, `${k} lingers only within 160 m`);
  }
  assert.ok(after.keys.length <= 6);
});

test('chunk queue: with a rank the lowest builds next (ties in request order); NaN ranks keep request order', () => {
  const q = new ChunkBuildQueue(), order: string[] = [];
  const ranks: Record<string, number> = { a: 5, b: 1, c: 3, d: 1 };
  q.setRank(k => ranks[k]);
  for (const k of ['a', 'b', 'c', 'd']) q.push(k, () => order.push(k));
  while (q.length) q.shift()!();
  assert.deepEqual(order, ['b', 'd', 'c', 'a']);
  q.setRank(() => NaN);
  for (const k of ['a', 'b']) q.push(k, () => order.push(`${k}2`));
  while (q.length) q.shift()!();
  assert.deepEqual(order.slice(4), ['a2', 'b2']);
});
