/** Belt review R3: candidate selection, ordering, dedupe and the automatic pick, offline on fixtures. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { planWallPicks, sameView, reviewHardPass, stripYears, wantsStrips, orderCandidates, dedupeCandidates, finalCandidates, autoPick, type PoolPick } from './candidates.ts';
import { faceOrder } from './faceModel.ts';
import type { Candidate } from './faceModel.ts';
import type { CropFlags } from '../house-crops/flags.ts';

const pick = (panoId: string, timestamp: string, obliquityDeg: number, cam: [number, number], o: Partial<PoolPick> = {}): PoolPick => ({
  panoId, timestamp, missionYear: Number(timestamp.slice(0, 4)), missionType: 'bi', surface: 'land', distM: 15, obliquityDeg, relaxed: false, record: {}, blocked: false, cam: { x: cam[0], y: cam[1] }, ...o,
});

const flags = (o: Partial<CropFlags> = {}): CropFlags => ({ foliage: 0, foliagePlain: 0, wbApplied: false, washedOut: 0, missing: 0, voidShare: 0, occluderShare: 0, obliquity: 10, cameraDistance: 15, rayBlocked: false, wallWidthM: 6, heightCover: 1, edgeDensity: 0.1, seamStep: 0, strip: false, ...o });
const cand = (id: string, o: Partial<Candidate> = {}): Candidate => ({
  id, file: `p/${id}.jpg`, year: 2022, month: 3, distM: 15, obliquityDeg: 10, source: 'wall', flags: flags(), reasons: [], hardPass: true, usable: true,
  pano: { id: `pano-${id}`, date: '2022-03-01' }, leafOff: true, rayBlocked: false, ppm: 80, nativePpm: 85, width: 500, height: 1400, ...o,
});

test('same view: same panorama, or the same day with cameras under 3 m apart', () => {
  const a = pick('A', '2022-03-01T10:00:00Z', 10, [0, 0]);
  assert.ok(sameView(a, pick('A', '2023-03-01T10:00:00Z', 10, [50, 0])));
  assert.ok(sameView(a, pick('B', '2022-03-01T10:00:05Z', 12, [2, 0])));
  assert.ok(!sameView(a, pick('C', '2022-03-01T10:00:09Z', 14, [5, 0])));
  assert.ok(!sameView(a, pick('D', '2023-03-01T10:00:00Z', 10, [1, 0])), 'another year is another view even at the same spot');
});

test('wall picks: one per year first (leaf-off and straight first), then other positions; oblique views stay for the strip', () => {
  const pool = [
    pick('y24-summer', '2024-07-01T10:00:00Z', 5, [0, 0]),
    pick('y23-winter', '2023-02-01T10:00:00Z', 12, [0, 0]),
    pick('y23-winter-dup', '2023-02-01T10:00:02Z', 14, [1.5, 0]),
    pick('y23-winter-alt', '2023-02-01T10:00:20Z', 20, [9, 0]),
    pick('y22-oblique', '2022-03-01T10:00:00Z', 45, [0, 0]),
    pick('y21-winter', '2021-12-01T10:00:00Z', 8, [0, 0]),
  ];
  const ids = planWallPicks(pool, 6).map(p => p.panoId);
  assert.deepEqual(ids, ['y23-winter', 'y21-winter', 'y24-summer', 'y23-winter-alt']);
  assert.ok(!ids.includes('y23-winter-dup'), 'same day, 1.5 m away: deduped');
  assert.ok(!ids.includes('y22-oblique'), '45 deg goes to the strip route, not a wall crop');
  assert.deepEqual(planWallPicks(pool, 2).map(p => p.panoId), ['y23-winter', 'y21-winter']);
});

test('wall picks: a blocked ray only when fewer than two clear views exist', () => {
  const clear2 = [pick('clear1', '2023-02-01T10:00:00Z', 10, [0, 0]), pick('clear2', '2021-02-01T10:00:00Z', 10, [0, 0]), pick('blocked', '2024-02-01T10:00:00Z', 2, [0, 0], { blocked: true })];
  assert.deepEqual(planWallPicks(clear2).map(p => p.panoId), ['clear1', 'clear2']);
  const clear1 = [clear2[0], clear2[2]];
  assert.deepEqual(planWallPicks(clear1).map(p => p.panoId), ['clear1', 'blocked']);
});

test('strip years and when strips are wanted', () => {
  const pool = [pick('a', '2024-07-01T10:00:00Z', 40, [0, 0]), pick('b', '2022-01-10T10:00:00Z', 50, [0, 0]), pick('c', '2020-01-10T10:00:00Z', 30, [0, 0], { blocked: true }), pick('d', '2019-12-10T10:00:00Z', 44, [0, 0])];
  assert.deepEqual(stripYears(pool), [2019, 2022], 'leaf-off and least oblique first, blocked years out');
  assert.ok(wantsStrips(3.6, 4, 4), 'narrow wall');
  assert.ok(wantsStrips(6, 0, 0), 'no straight view');
  assert.ok(wantsStrips(6, 3, 1), 'only one wall passes');
  assert.ok(!wantsStrips(6, 3, 2));
});

test('review hard pass: narrow is soft for a real 2.5-3.5 m front, everything else stays hard', () => {
  assert.ok(reviewHardPass(['narrow'], 3.45));
  assert.ok(reviewHardPass(['narrow', 'foliage'], 3.0));
  assert.ok(!reviewHardPass(['narrow'], 2.2));
  assert.ok(!reviewHardPass(['narrow', 'blocked'], 3.45));
  assert.ok(!reviewHardPass(['void'], 8));
});

test('display order: hard-pass walls, hard-pass strips, then failing walls and strips; leaf-off, straighter, newer inside', () => {
  const list = [
    cand('fail-wall', { hardPass: false, reasons: ['blocked'] }),
    cand('strip-ok', { source: 'strip' }),
    cand('summer', { leafOff: false, month: 7 }),
    cand('winter-oblique', { obliquityDeg: 30 }),
    cand('winter-straight', { obliquityDeg: 4 }),
    cand('winter-straight-older', { obliquityDeg: 3, year: 2019 }),
    cand('fail-strip', { source: 'strip', hardPass: false, reasons: ['void'] }),
  ];
  assert.deepEqual(orderCandidates(list).map(c => c.id), ['winter-straight', 'winter-straight-older', 'winter-oblique', 'summer', 'strip-ok', 'fail-wall', 'fail-strip']);
});

test('dedupe by source and panorama set; the cap keeps at most two strips and fills the rest with walls', () => {
  const list = [cand('a'), cand('a2', { pano: { id: 'pano-a', date: '2022-03-01' } }), cand('s', { source: 'strip', pano: { id: 'pano-a', date: '2022-03-01', ids: ['pano-a', 'x'] } }), cand('s2', { source: 'strip', pano: { id: 'q', date: '2022-03-01', ids: ['x', 'pano-a'] } })];
  assert.deepEqual(dedupeCandidates(list).map(c => c.id), ['a', 's']);
  const many = [...Array.from({ length: 7 }, (_, i) => cand(`w${i}`, { year: 2016 + i })), cand('s1', { source: 'strip', hardPass: false }), cand('s2', { source: 'strip', year: 2020, hardPass: false }), cand('s3', { source: 'strip', year: 2021, hardPass: false })];
  const fin = finalCandidates(many, 6);
  assert.equal(fin.length, 6);
  assert.equal(fin.filter(c => c.source === 'strip').length, 2);
  assert.deepEqual(fin.slice(0, 4).map(c => c.id), ['w6', 'w5', 'w4', 'w3']);
});

test('auto-pick: the judge picker when scores exist, else the first usable hard-pass, else none', () => {
  const judged = [cand('a', { judge: { quality: 0.3, score: 0.5, occluded: 0.4, closeUp: 0, model: 'm' } }), cand('b', { obliquityDeg: 25, judge: { quality: 0.7, score: 0.8, occluded: 0.1, closeUp: 0, model: 'm' } }), cand('c', { hardPass: false, reasons: ['blocked'], judge: { quality: 0.9, score: 0.9, occluded: 0, closeUp: 0, model: 'm' } })];
  assert.equal(autoPick(judged).id, 'b');
  assert.equal(autoPick([cand('x', { usable: false, reasons: ['foliage'] }), cand('y', { obliquityDeg: 30 })]).id, 'y');
  assert.equal(autoPick([cand('x', { usable: false, reasons: ['foliage'] })]).id, 'x');
  assert.equal(autoPick([cand('x', { hardPass: false, usable: false, reasons: ['void'] })]).id, null);
});

test('face order runs left to right as seen from the street, along the mean normal', () => {
  // A face looking north (normal +y): seen from the street the viewer faces south, so left is east (+x) ... u = (-ny, nx) = (-1, 0).
  const items = [{ id: 'west', mid: { x: 0, y: 0 }, normal: [0, 1] as [number, number], firstNumber: 2 }, { id: 'east', mid: { x: 10, y: 0 }, normal: [0, 1] as [number, number], firstNumber: 4 }, { id: 'mid', mid: { x: 5, y: 0 }, firstNumber: 3 }];
  assert.deepEqual(faceOrder(items), ['east', 'mid', 'west']);
  assert.deepEqual(faceOrder(items.map(i => ({ ...i, normal: undefined }))), ['west', 'mid', 'east'], 'no walls: house-number order');
});

test('forced front edge: the longest footprint edge facing the face bearing', async () => {
  const { frontEdge, displayPpm } = await import('./prepare.ts');
  // A 5 x 15 m plot, front on the south (bearing 180), a 1 m jog in the back.
  const ring = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 15 }, { x: 0, y: 15 }, { x: 0, y: 0 }];
  const w = frontEdge(ring, 180)!;
  assert.equal(Math.round(w.len), 5);
  assert.ok(Math.abs(w.ny + 1) < 1e-9, 'outward normal points south');
  assert.equal(frontEdge(ring, 135), null, 'no edge within 30 degrees');
  assert.equal(frontEdge([...ring].reverse(), 180)!.len, 5, 'winding does not matter');
  // Display scale: a close camera is capped at 100 px/m, a far one floored at 50 px/m with its native resolution reported.
  assert.equal(displayPpm(8000, 6, 16).ppm, 100);
  const far = displayPpm(8000, 30, 16);
  assert.equal(far.ppm, 50); assert.ok(far.native < 50);
});
