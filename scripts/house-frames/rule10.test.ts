/** house:frames rule 10 (lane TF, 2026-11-13): options, the likeness lens and window, far bank, as-played rider, captions. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { frameFor, projectRd, rdToLocal, FRAME_H, FRAME_W, type WallQuad } from './pose.ts';
import { acrossWater, asPlayedPose, cameraCaption, chooseLikeness, fixedLensPose, likenessPose, parseRule10, waterSegments, worldOf, FLAGS_ONLY, LIKENESS_VFOV_DEG } from './rule10.ts';
import { lngLatToRd, rdToLngLat } from '../../src/canalRecall/facade/rdNew.ts';
import { HELP } from './frames.ts';

// Weteringschans 171218 (pand 0363100012171218): a 16.65 m front facing 185 deg, its house:frames capture 13 m off.
const W171218: WallQuad = { a: { x: 121500.99791513935, y: 485843.8145131306 }, b: { x: 121507.46474709586, y: 485843.103032599 }, heightM: 16.65 };
const mid = { x: (W171218.a.x + W171218.b.x) / 2, y: (W171218.a.y + W171218.b.y) / 2 };
/** A point `d` m out from the wall's middle along its outward normal (south), shifted `along` m east. */
const out = (d: number, along = 0): [number, number] => { const n = { x: -0.1094, y: -0.994 }; return rdToLngLat({ x: mid.x + n.x * d + along, y: mid.y + n.y * d }) as [number, number]; };

test('parseRule10: absent unless asked; --rule10 is both frames at dpr 2, trees hidden, far bank on', () => {
  assert.equal(parseRule10([]), null);
  assert.equal(parseRule10(['--pands', '1', '--query', '?world=live']), null);
  assert.deepEqual(parseRule10(['--rule10']), { likeness: true, asPlayed: true, dpr: 2, asPlayedBackM: 15, likenessMaxDistM: 70, likenessTrees: 'hide', farBank: true });
  const l = parseRule10(['--likeness', '--dpr', '1', '--likeness-trees', 'show', '--no-far-bank'])!;
  assert.equal(l.asPlayed, false); assert.equal(l.dpr, 1); assert.equal(l.likenessTrees, 'show'); assert.equal(l.farBank, false);
  assert.equal(parseRule10(['--as-played'])!.likeness, false);
  assert.throws(() => parseRule10(['--rule10', '--dpr', '9']));
  assert.throws(() => parseRule10(['--rule10', '--likeness-trees', 'maybe']));
  for (const f of ['--rule10', '--likeness', '--as-played', '--dpr', '--likeness-trees', '--no-far-bank']) assert.match(HELP, new RegExp(f));
});

test('likeness lens: always 72 deg at the window; a front that fits needs no raise', () => {
  const lp = likenessPose({ lngLat: out(40), eyeHeightM: 2.44 }, W171218);
  assert.equal(lp.shiftPx, 0); assert.deepEqual(lp.clipped, []);
  assert.equal(lp.pose.vfovDeg, LIKENESS_VFOV_DEG); assert.equal(lp.pose.height, FRAME_H); assert.equal(lp.window.height, FRAME_H);
});

test('likeness window: a front too tall for 72 deg at 20 m is raised (shift lens), the focal held', () => {
  const lp = likenessPose({ lngLat: out(20), eyeHeightM: 2.44 }, W171218);
  assert.ok(lp.shiftPx > 0, 'raised');
  assert.equal(lp.pose.height, FRAME_H + 2 * lp.shiftPx);
  // The same focal as the 72 deg window: the tall frame's vfov grows with its height.
  const f = 0.5 * lp.pose.height / Math.tan(lp.pose.vfovDeg * Math.PI / 360);
  assert.ok(Math.abs(f - 0.5 * FRAME_H / Math.tan(36 * Math.PI / 180)) < 1e-6);
  // The crown allowance and the base both land in the window (the top FRAME_H rows), with the lowest look-down.
  assert.equal(lp.pose.lookDownDeg, 5);
  const fr = frameFor(lp.pose);
  for (const z of [0, W171218.heightM + 1.5]) for (const p of [W171218.a, W171218.b]) {
    const s = projectRd(fr, lp.pose, p, z);
    assert.ok(s.y >= 0 && s.y <= lp.window.height, `z ${z}: y ${s.y.toFixed(0)} in the window`);
  }
  assert.deepEqual(lp.clipped, []);
  // fixedLensPose alone (no raise) cuts the top off there.
  assert.ok(fixedLensPose({ lngLat: out(20), eyeHeightM: 2.44 }, W171218).clipped.includes('top'));
  // At 13 m the front spans more than the window even raised: the crown is held and the base listed as clipped.
  const near = likenessPose({ lngLat: out(13), eyeHeightM: 2.44 }, W171218);
  assert.deepEqual(near.clipped, ['bottom']);
  assert.ok(projectRd(frameFor(near.pose), near.pose, W171218.a, W171218.heightM + 1.5).y >= 0);
});

test('chooseLikeness: far bank first, else the pair capture, else step back; clipped only when nothing holds it', () => {
  const c = (d: number, id: string, farBank = false, along = 0) => ({ lngLat: out(d, along), distM: d, id, farBank });
  const own = c(20, 'own'), back = c(30, 'back'), farther = c(45, 'farther'), water = c(38, 'water', true, 6);
  assert.equal(chooseLikeness([own, back, farther], 0, W171218)!.index, 0, 'the raise holds a 16.65 m front from 20 m');
  const close = c(13, 'close');
  const stepped = chooseLikeness([close, back, farther], 0, W171218)!;
  assert.equal(stepped.index, 1, 'from 13 m the base is cut: step back to 30 m');
  // A 40 m tower cannot be held from 20 m even raised one window: step back to the nearest that holds it.
  const tower = { ...W171218, heightM: 40 };
  const pick = chooseLikeness([own, farther, back], 0, tower)!;
  assert.equal(pick.index, 1, '45 m holds a 40 m tower, 30 m cuts its base'); assert.ok(pick.steppedBackM > 0 && /stepped back/.test(pick.note));
  assert.equal(chooseLikeness([own, back, water], 0, W171218, { farBank: true })!.index, 2, 'far bank wins');
  assert.equal(chooseLikeness([own, back, water], 0, W171218, { farBank: false })!.index, 0);
  const huge = { ...W171218, heightM: 200 };
  const none = chooseLikeness([own], 0, huge)!;
  assert.ok(none.lp.clipped.includes('top') && /clipped/.test(none.note));
});

test('acrossWater: the sight line crosses a canal centreline ([lat, lng] paths, water.json)', () => {
  // A centreline running east-west 8 m south of the wall.
  const a = rdToLngLat({ x: mid.x - 50, y: mid.y - 8 }), b = rdToLngLat({ x: mid.x + 50, y: mid.y - 8 });
  const segs = waterSegments([{ paths: [[[a[1], a[0]], [b[1], b[0]]]] }]);
  assert.equal(acrossWater(lngLatToRd(out(20)), W171218, segs), true);
  assert.equal(acrossWater(lngLatToRd(out(5)), W171218, segs), false);
});

test('as-played rider: before the row, riding along it, fronts on the right', () => {
  const walls = [{ ...W171218, nx: -0.1094, ny: -0.994 }];
  const cap = lngLatToRd(out(13));
  const r = asPlayedPose(walls, [cap], 15)!;
  // The wall runs west to east and faces south: riding west (~276 deg) keeps it on the right.
  assert.ok(Math.abs(r.headingDeg - 276) < 3, `heading ${r.headingDeg}`);
  const [x, y] = rdToLocal(W171218.b, r.lngLat), h = r.headingDeg * Math.PI / 180;
  const ahead = x * Math.sin(h) + y * Math.cos(h), right = x * Math.cos(h) - y * Math.sin(h);
  assert.ok(Math.abs(ahead - 15) < 0.5, `the row's east end 15 m ahead: ${ahead}`);
  assert.ok(right > 5, `and on the right: ${right}`);
});

test('captions name camera, FOV, pixel ratio, engine and world; wide frames say flags only', () => {
  const c = cameraCaption({ camera: 'first person', vfovDeg: 72, dpr: 2, engine: 'own', world: worldOf('?world=live') });
  for (const w of ['first person', '72°', 'pixel ratio 2', 'engine own', 'world live tiles']) assert.ok(c.includes(w), w);
  assert.ok(!c.includes(FLAGS_ONLY));
  assert.ok(cameraCaption({ camera: 'first person', vfovDeg: 113.78, dpr: 1, engine: 'own', world: worldOf(''), wide: true }).endsWith(FLAGS_ONLY));
  assert.equal(worldOf('', undefined), 'baked world-v1');
  assert.equal(FRAME_W, 1440);
});

test('an old run is unchanged: the job carries no rule-10 field without a rule-10 flag', async () => {
  const { jobFor } = await import('./frames.ts');
  const pose = fixedLensPose({ lngLat: out(20) }, W171218);
  const prep = { key: 'k', pandId: 'p', pose, wall: W171218, samples: [{ x: 1, y: 2 }] } as any;
  const base = { out: '/o', query: '', reopenEvery: 40 } as any;
  const old = jobFor(base, [prep]);
  assert.deepEqual(Object.keys(old), ['out', 'query', 'width', 'height', 'reopenEvery', 'settleMs', 'poses']);
  assert.deepEqual(Object.keys(old.poses[0]), ['key', 'pandId', 'out', 'lngLat', 'headingDeg', 'fps', 'picks']);
  const r10 = jobFor({ ...base, rule10: parseRule10(['--rule10']) }, [prep]);
  assert.equal(r10.rule10!.dpr, 2); assert.equal(r10.rule10!.likenessQuery, 'trees3d=0&dpr=2'); assert.equal(r10.rule10!.asPlayed.length, 1);
});
