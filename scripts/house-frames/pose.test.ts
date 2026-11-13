/** house:frames pose maths (lane H10, #358): two pinned poses, RD/WGS84 -> game coordinates, heading, eye height. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { aimPose, frameFor, fpsFor, gamePlayer, gridConvergenceDeg, hfovDeg, projectRd, rayFor, toPanoDirection, wallOutline, PANO_EYE_HEIGHT_M, type WallQuad } from './pose.ts';
import { HELP, PINNED_POSES, splitLists, withPinnedPoses } from './frames.ts';

const close = (a: number, b: number, eps: number, what: string) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b} (+-${eps})`);
const LOADER = { _lastCenterLng: 4.8952, _lastCenterLat: 52.3702, _lastOffsetX: 1000, _lastOffsetY: 2000 };

// Pinned pose 1: 0363100012116526's Nassaukade wall from panorama recording_2024-09-11_08-03-34_00046 (17 m, straight on).
const NASSAU = { ll: [4.874106703982891, 52.37196553948638] as [number, number], wall: { a: { x: 120041.91863097114, y: 487235.10395808204 }, b: { x: 120039.69306607483, y: 487247.8043300092 }, heightM: 17.63 } as WallQuad };
// Pinned pose 2: Nieuwmarkt 20-22 (0363100012182857) from a 2020-01-10 panorama, 10 m off a 12 m front.
const NIEUWMARKT = { ll: [4.89985205618066, 52.372571340792] as [number, number], wall: { a: { x: 121799.41706429308, y: 487298.18554609065 }, b: { x: 121804.46241661196, y: 487309.1671542453 }, heightM: 12.1 } as WallQuad };

test('pinned pose 1: Nassaukade corner, heading at the wall centre, eye 2.44 m, game px', () => {
  const pose = aimPose({ lngLat: NASSAU.ll }, NASSAU.wall);
  close(pose.headingDeg, 258.82, 0.01, 'heading');
  assert.equal(pose.lookDownDeg, 5, 'the game camera looks at least 5 deg down (MAX_PITCH_DEG 85)');
  close(pose.vfovDeg, 102.52, 0.05, 'vfov');
  close(hfovDeg(pose), 126.74, 0.05, 'hfov');
  assert.deepEqual(pose.clipped, []);
  const f = frameFor(pose);
  close(f.eye[0], 0, 1e-6, 'eye x'); close(f.eye[1], 0, 1e-6, 'eye y'); close(f.eye[2], PANO_EYE_HEIGHT_M, 1e-9, 'eye height');
  const fps = fpsFor(pose);
  assert.equal(fps.pitch, 85); close(fps.zoom, 19.2316, 1e-3, 'zoom'); close(fps.eye.heightM, 2.44, 1e-9, 'fps eye');
  const o = wallOutline(f, pose, NASSAU.wall);
  const want = [[584.62, 469.83], [856.92, 470.42], [870.52, 62.52], [571.34, 66.92]];
  o.forEach((p, i) => { close(p!.x, want[i][0], 0.5, `corner ${i} x`); close(p!.y, want[i][1], 0.5, `corner ${i} y`); });
  const g = gamePlayer(NASSAU.ll, pose.headingDeg, LOADER);
  close(g.x, -3300.96, 0.05, 'game x'); close(g.y, 1410.38, 0.05, 'game y'); close(g.angle, 2.9464, 1e-3, 'player angle');
});

test('pinned pose 2: Nieuwmarkt 20-22, a 12 m front at 10 m opens the lens', () => {
  const pose = aimPose({ lngLat: NIEUWMARKT.ll }, NIEUWMARKT.wall);
  close(pose.headingDeg, 291.69, 0.01, 'heading');
  close(pose.vfovDeg, 110.85, 0.05, 'vfov');
  const f = frameFor(pose), o = wallOutline(f, pose, NIEUWMARKT.wall);
  const want = [[540.49, 495.70], [909.21, 499.63], [931.78, 82.69], [520.30, 102.10]];
  o.forEach((p, i) => { close(p!.x, want[i][0], 0.5, `corner ${i} x`); close(p!.y, want[i][1], 0.5, `corner ${i} y`); });
  const g = gamePlayer(NIEUWMARKT.ll, pose.headingDeg, LOADER);
  close(g.x, 1948.56, 0.05, 'game x'); close(g.y, 1208.07, 0.05, 'game y'); close(g.angle, -2.7630, 1e-3, 'player angle');
});

test('the image centre ray points along the heading, 5 deg down; a point ahead at eye height sits on the horizon', () => {
  const pose = aimPose({ lngLat: NASSAU.ll }, NASSAU.wall), f = frameFor(pose);
  const r = rayFor(f, pose.width / 2, pose.height / 2), h = Math.hypot(r[0], r[1]);
  close((Math.atan2(r[0], r[1]) * 180 / Math.PI + 360) % 360, pose.headingDeg, 1e-6, 'centre bearing');
  close(Math.atan2(-r[2], h) * 180 / Math.PI, 5, 1e-6, 'centre look-down');
  // 20 m ahead along the (true) heading at eye height: on the image's vertical centre line, above the centre by focal * tan(5).
  const b = (pose.headingDeg - gridConvergenceDeg(pose.lngLat)) * Math.PI / 180, rd = { x: pose.rd.x + Math.sin(b) * 20, y: pose.rd.y + Math.cos(b) * 20 };
  const s = projectRd(f, pose, rd, PANO_EYE_HEIGHT_M);
  close(s.x, pose.width / 2, 0.3, 'ahead x (true bearing = grid bearing + convergence)');
  close(s.y, pose.height / 2 - f.focal * Math.tan(5 * Math.PI / 180), 0.5, 'ahead y');
});

test('grid convergence: the panorama is indexed on the RD grid, about -0.4 deg in the centre', () => {
  const g = gridConvergenceDeg(NASSAU.ll);
  close(g, -0.4057, 1e-3, 'convergence');
  const d = toPanoDirection([0, 1, 0], g);
  close(Math.atan2(d[0], d[1]) * 180 / Math.PI, -g, 1e-9, 'true north on the grid');
});

test('--help text names every input and the review section', () => {
  for (const flag of ['--pands', '--face', '--buurt', '--list', '--year', '--season', '--query', '--label', '--out']) assert.match(HELP, new RegExp(flag));
  assert.match(HELP, /§7/);
});

test('relative wall colour cancels exposure and catches a pand painted unlike its neighbours', async () => {
  const { relativeColour, flagsFor } = await import('./analyse.ts');
  const pose = aimPose({ lngLat: NASSAU.ll }, NASSAU.wall), f = frameFor(pose);
  const paint = (wallGrey: number, neighbourGrey: number) => {
    const img = { width: pose.width, height: pose.height, data: new Uint8Array(pose.width * pose.height * 3).fill(neighbourGrey) };
    const o = wallOutline(f, pose, NASSAU.wall).map(p => p!), x0 = Math.min(...o.map(p => p.x)), x1 = Math.max(...o.map(p => p.x)), y0 = Math.min(...o.map(p => p.y)), y1 = Math.max(...o.map(p => p.y));
    for (let y = Math.floor(y0); y < y1; y++) for (let x = Math.floor(x0); x < x1; x++) img.data.fill(wallGrey, (y * pose.width + x) * 3, (y * pose.width + x) * 3 + 3);
    return img;
  };
  const same = relativeColour(paint(60, 120), paint(36, 72), f, pose, NASSAU.wall); // the game half 40 % darker overall
  assert.equal(same.used, 2);
  close(same.score!, 0, 0.05, 'exposure cancels');
  const lighter = relativeColour(paint(60, 120), paint(200, 120), f, pose, NASSAU.wall); // dark in the photo, pale in the game
  assert.ok(lighter.score! > 0.35, `score ${lighter.score}`);
  const picks = { wall: { n: 35, target: 35, other: 0, none: 0, others: {} }, above: { n: 14, target: 0, other: 0, none: 14, others: {} }, drawnBy: '' } as any;
  const m = { openings: 10, wallHex: null, wallL: null, usable: 1, columns: 3 };
  assert.match(flagsFor(picks, m, m, { crownM: 17, game: null, photo: null, above: 0 }, lighter).wallColour!, /inverted \(darker than its neighbours in the photo, lighter in the game\)/);
  assert.equal(flagsFor(picks, m, m, { crownM: 17, game: null, photo: null, above: 0 }, same).wallColour, null);
});

test('pinned 116526 (H7 r4 frames, h7r4-116526): lighter than its neighbour in the photo, darker in the game, one strip: the inversion fires', async () => {
  const { flagsFor } = await import('./analyse.ts');
  const picks = { wall: { n: 35, target: 35, other: 0, none: 0, others: {} }, above: { n: 14, target: 0, other: 0, none: 14, others: {} }, drawnBy: '' } as any;
  const m = { openings: 10, wallHex: null, wallL: null, usable: 1, columns: 3 }, roof = { crownM: 17.63, game: null, photo: null, above: 0 };
  // Measured by relativeColour on those frames: photo pand 0.309 / right neighbour 0.244, game 0.411 / 0.482 (the left strip is sky in one half).
  const c116526 = { photo: { pand: 0.309, neighbours: [0.439, 0.244], rel: 1.266 }, game: { pand: 0.411, neighbours: [0.383, 0.482], rel: 0.853 }, used: 1, ref: 'right only' as const, score: -0.395 };
  assert.match(flagsFor(picks, m, m, roof, c116526).wallColour!, /inverted .*ref right only/);
  // An inversion fires under the log threshold too (each side > 10 % from 1.0); no reference never fires.
  const small = { ...c116526, photo: { ...c116526.photo, rel: 1.15 }, game: { ...c116526.game, rel: 0.88 }, score: -0.268 };
  assert.match(flagsFor(picks, m, m, roof, small).wallColour!, /inverted/);
  // Noise across 1.0 is not an inversion (H7's 236262: 1.024 vs 0.998, read as right).
  const noise = { ...c116526, photo: { ...c116526.photo, rel: 1.024 }, game: { ...c116526.game, rel: 0.998 }, score: -0.026 };
  assert.equal(flagsFor(picks, m, m, roof, noise).wallColour, null);
  const none = { ...c116526, photo: { ...c116526.photo, rel: null }, game: { ...c116526.game, rel: null }, used: 0, ref: 'no ref' as const, score: null };
  assert.equal(flagsFor(picks, m, m, roof, none).wallColour, null);
});

test('--lists splits into one argv per list, the shared flags kept and --out/--list dropped (lane Q1, #378)', () => {
  const runs = splitLists(['--lists', 'a.json:out/A,dir:x/b.json:out/B', '--query', '?world=live', '--out', 'ignored', '--reuse-photos', '--season=winter']);
  assert.deepEqual(runs, [
    ['--list', 'a.json', '--out', 'out/A', '--query', '?world=live', '--reuse-photos', '--season=winter'],
    ['--list', 'dir:x/b.json', '--out', 'out/B', '--query', '?world=live', '--reuse-photos', '--season=winter'],
  ]);
  assert.throws(() => splitLists(['--lists', 'a.json']), /want <list.json>:<out dir>/);
  assert.match(HELP, /--lists/);
  assert.match(HELP, /--reuse-photos/);
});

test('pinned eyeball poses: a listed pand takes its pinned capture and bad captures; others and an entry pano are kept', () => {
  const [k, other, own] = withPinnedPoses([{ id: '0363100012165023', notPanos: ['x'] }, { id: '0363100099999999' }, { id: '0363100012171218', pano: 'mine' }], PINNED_POSES);
  assert.equal(k.pano, 'TMX7316010203-001047_pano_0000_000803', 'Keizersgracht 165023: the clear 2019-01-10 capture at 5.1 m');
  assert.deepEqual(k.notPanos, ['x', 'TMX7316010203-002980_pano_0000_000022']);
  assert.deepEqual(other, { id: '0363100099999999' });
  assert.equal(own.pano, 'mine');
});
