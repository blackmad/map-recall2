/**
 * Lane H2e (#352): the two fixtures the judgement session named for the houseLine measure profile. Each is a dumped
 * likeness group (`likeness-replay.ts --dump`: the photo mosaic, its box and storey lines, the model's mask and colours)
 * replayed through the same code as the 448-group replay.
 *  - Hotel Arena walls[0] (pand 236788): five mullioned window columns per storey at a 3.8 m pitch. `core` thins the
 *    openings, the half-bay autocorrelation peak then sits 8 % off the half lag on a plateau, the fold read two bays
 *    as one (3 columns, a "square" window) and the replay failed a house whose photo reads tall windows at 3.7 m.
 *  - pand-070306 walls[5]: a glass canopy and bare trees on a wall that does not face the street; houseLine gives NO
 *    EVIDENCE, not a FAIL on columns the model does not draw.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {replayGroup} from '../../../scripts/building-recipes/likeness-replay.ts';
import sharp from 'sharp';
import {MEASURE_PROFILES, measureFacade} from './measureFacade.ts';
import {blurRgb, PRE_BLUR_PX} from '../houseSpec/previewVerdict.ts';

const load = (n: string) => ({meta: JSON.parse(fs.readFileSync(new URL(`./fixtures/houseline/${n}.json`, import.meta.url), 'utf8')), bin: zlib.gunzipSync(fs.readFileSync(new URL(`./fixtures/houseline/${n}.bin`, import.meta.url)))});
const run = (n: string, profile: keyof typeof MEASURE_PROFILES) => {
  const {meta, bin} = load(n);
  return replayGroup(meta, bin, {openingSplit: MEASURE_PROFILES[profile], houseLine: profile === 'houseLine'});
};

test('Hotel Arena walls[0]: houseLine reads the 3.7 m bay, not two bays as one square window', () => {
  const {photo, likeness: L} = run('hotel-arena-236788.g0', 'houseLine');
  assert.ok(L.photoGrid.pitchM! > 3.4 && L.photoGrid.pitchM! < 4.4, `pitch ${L.photoGrid.pitchM}`);
  assert.equal(L.photoGrid.window?.shape, 'tall');
  assert.ok(L.columns.windows!.photo! >= 5, `photo columns ${L.columns.windows!.photo}`);
  assert.equal(L.shape.pass, true);
  assert.notEqual(L.verdict, 'FAIL', L.reasons.join('; '));
  assert.ok(photo.wall.hex);
});
test('Hotel Arena walls[0]: installGate still reads it as it did (verdict WARN on mask IoU only)', () => {
  const {likeness: L} = run('hotel-arena-236788.g0', 'installGate');
  assert.equal(L.verdict, 'WARN');
});
test('pand-070306 walls[5]: a wall that does not face the street is NO EVIDENCE under houseLine, judged as before under installGate', () => {
  const hl = run('pand-070306.g5', 'houseLine').likeness;
  assert.equal(hl.verdict, 'NO EVIDENCE');
  assert.match(hl.reasons.join(';'), /does not face the street/);
  assert.equal(run('pand-070306.g5', 'installGate').likeness.verdict, 'WARN');
});

// H2e round 2 (#352 ruling): clusterWall takes the larger-area wall material; the paler only with >= 60 % of the wall-set cells.
test('Montessori van Ostade walls[0]: houseLine reads the dark brick wall (#615549 under installGate), not the paler lit cluster (#b4856a)', () => {
  const hl = run('montessori-van-ostade.g0', 'houseLine'), ig = run('montessori-van-ostade.g0', 'installGate');
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hl.photo.wall.hex.slice(i, i + 2), 16));
  assert.ok(r < 0x80 && g < 0x70 && b < 0x62, `wall ${hl.photo.wall.hex} (installGate ${ig.photo.wall.hex})`);
  assert.equal(hl.likeness.verdict, 'WARN', hl.likeness.reasons.join('; '));
});
test('Nieuwmarkt 182857 (red brick with white stone bands, washed-out photo): houseLine reads the brick body, not the white bands', async () => {
  const {data, info} = await sharp(fs.readFileSync(new URL('./fixtures/houseline/nieuwmarkt-182857-front.jpg', import.meta.url))).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const rgb = blurRgb(new Uint8Array(data), info.width, info.height, PRE_BLUR_PX);
  const wall = (profile: keyof typeof MEASURE_PROFILES) => measureFacade({image: {width: info.width, height: info.height, rgb, ppm: 50, topM: info.height / 50}, box: {u0: 0.2, u1: 11.82, v0: 0, v1: 7.774}, lines: [0, 3.2, 5.487, 7.774], openingSplit: MEASURE_PROFILES[profile]}).wall;
  const hl = wall('houseLine'), ig = wall('installGate');
  assert.equal(hl.hex, ig.hex, 'houseLine reads the same brick body as installGate');
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hl.hex.slice(i, i + 2), 16));
  assert.ok(r > g && g > b && r < 0xe0, `warm and not white: ${hl.hex}`);
});

// KNOWN REGRESSION (H2e, integrator ruling): a two-material front, beige concrete (left) and brown brick (right). Under the v2
// houseLine (clusterWall = the picked cluster) the photo wall read #9a8b70 against the model's #9a8a6f (dL -0.002, PASS). The
// larger-area rule takes the brown brick group (Lab [44,6,14], interior 2921 cells vs the picked beige [60,1,16], 2167): photo
// wall #796250, dL +0.125 (FAIL, "wall dL +0.13"). Both are plausible walls; area cannot separate them. Remove `todo` when fixed.
test('Kloveniersburgwal 72 walls[3] (two-material front): houseLine keeps reading the beige body, PASS', {todo: 'larger-area rule takes the brown brick: wall #796250, dL +0.125, FAIL'}, () => {
  const {photo, likeness: L} = run('kloveniersburgwal-72-171179.g3', 'houseLine');
  assert.equal(photo.wall.hex, '#9a8b70');
  assert.equal(L.verdict, 'PASS', L.reasons.join('; '));
});

// KNOWN CASE, NOT the clusterWall guard's (H2e, judgement session): the preview render of pand 182848 (house:preview, bell gable, dark
// brick drawn at L ~0.34) measures a pale wall, #e8e2d7 under installGate and #b3aca6 under houseLine (frontClass curtain, glazing
// 0.94). The cause is upstream of clusterWall: the dark brick body is read as glazing/opening cells (the dark cluster is not in the
// wall set) and the cream trim and ground storey are the only wall cluster, so there is no rival for the guard to rank. The
// dark-neutral guard does not apply (it would only exclude the brick). Same family as pand 061473 (not reproducible here: its
// stored front.png reads #5f3216, correct, under both profiles). Remove `todo` when the wall set keeps a dark brick body.
test('182848 render: dark brick drawn, houseLine measures the dark wall', {todo: 'the dark body is read as openings; the wall reads the cream trim'}, async () => {
  const {data, info} = await sharp(fs.readFileSync(new URL('./fixtures/houseline/render-182848-front.png', import.meta.url))).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const rgb = blurRgb(new Uint8Array(data), info.width, info.height, PRE_BLUR_PX);
  const m = measureFacade({image: {width: info.width, height: info.height, rgb, ppm: 50, topM: 16}, box: {u0: 0.2, u1: 4, v0: 0, v1: 10.88}, lines: [0, 3.2, 5.76, 8.319, 10.879], openingSplit: MEASURE_PROFILES.houseLine});
  assert.ok(parseInt(m.wall.hex.slice(1, 3), 16) < 0x70, `wall ${m.wall.hex}`);
});
