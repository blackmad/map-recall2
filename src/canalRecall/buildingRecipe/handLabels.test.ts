import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {measureFacade, rgbToLab, type OpeningSplit, type Rgb} from './measureFacade.ts';
import {blurRgb} from '../houseSpec/previewVerdict.ts';
import {handGlazing, jitterBoxes, hslLightness, type OpeningsLabel} from './handLabels.ts';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/wall-trim');
interface Case {name: string; file: string; ppm: number; topM: number; box: {u0: number; u1: number; v0: number; v1: number}; lines: number[]}
const cases: Case[] = JSON.parse(fs.readFileSync(path.join(DIR, 'cases.json'), 'utf8'));
const labels: Record<string, OpeningsLabel> = JSON.parse(fs.readFileSync(path.join(DIR, 'openings-labels.json'), 'utf8'));

test('hand glazing: lattices and rects over the counted band, clipped to the box', () => {
  const box = {u0: 0, u1: 4, v0: 0, v1: 10};
  const l: OpeningsLabel = {wallTopV: 10, lattices: [{u: [[0.5, 1.5], [2.5, 3.5]], v: [[4, 6]]}], rects: [[0, 2.0, 1, 3.0]]};
  // band v 2.5..10 x u 0..4 = 30 m2; windows 2 x (1 x 2) = 4; the rect is clipped to v >= 2.5: 1 x 0.5
  assert.ok(Math.abs(handGlazing(l, box) - 4.5 / 30) < 1e-9);
  assert.equal(handGlazing({...l, vMin: 5}, box), 2 / 20);
});

test('jitter boxes: the base first, +-10 cm per edge and every corner of the three free edges', () => {
  const b = {u0: 0.2, u1: 5, v0: 0, v1: 10}, js = jitterBoxes(b);
  assert.equal(js[0], b);
  assert.equal(js.length, 1 + 6 + 8);
  for (const j of js) for (const k of ['u0', 'u1', 'v1'] as const) assert.ok(Math.abs(j[k] - b[k]) <= 0.1 + 1e-9);
});

// ---- the twelve labelled fronts (lane H2d); `read` has every part of the opening split on, the reading the gate judges ----
/**
 * Raw wall colour labels: the median of a hand-chosen patch of bare wall (`wallPatch` in openings-labels.json) for the four
 * AB07 fronts; the eight H2c fronts keep their H2c normalised colours (wallTrim.test.ts). Dark = the wall is dark (HSL L <= 0.3).
 */
const RAW_WALL: Record<string, string> = {'ab07-168006-dark': '#2a272d', 'ab07-173056-white': '#fefef5', 'ab07-168698-dark': '#46474f', 'ab07-169846-dark': '#443c3d'};
/**
 * Fronts whose glazing is still outside the hand label by more than 0.10. The test pins today's reading (+-0.02) and fails
 * when one is fixed, so the label is promoted to the gate. Causes (docs/house-line.md): the photo's panes are lighter than its
 * wall and split between clusters (164843 photo, 168006), windows read as one wall-coloured cluster (168698), muntin
 * windows with pale upper sashes (heren door, keizers) lose 0.10..0.12 of the label.
 */
const KNOWN_MISS: Record<string, number> = {'nassau-164843-photo': 0.728, 'heren-175702-render': 0.338, 'keizers-171052-render': 0.401, 'ab07-168006-dark': 0.557, 'ab07-168698-dark': 0.18, 'ab07-169846-dark': 0.716};
const dE = (a: Rgb, b: Rgb) => { const x = rgbToLab(a), y = rgbToLab(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
const hexRgb = (h: string): Rgb => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as Rgb;

async function read(c: Case, box = c.box, openingSplit: boolean | Partial<OpeningSplit> = true) {
  const {data, info} = await sharp(path.join(DIR, c.file)).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const rgb = blurRgb(new Uint8Array(data), info.width, info.height, 1.5);
  return measureFacade({image: {width: info.width, height: info.height, rgb, ppm: c.ppm, topM: c.topM}, box, lines: c.lines, openingSplit});
}

test('twelve labelled fronts, four of them white or pale, at least four dark', async () => {
  assert.equal(cases.length, 12);
  assert.deepEqual(Object.keys(labels).sort(), cases.map(c => c.name).sort());
  let dark = 0;
  for (const c of cases) if (hslLightness((await read(c)).wall.hex) <= 0.3) dark++;
  assert.ok(dark >= 4, `${dark} dark fronts`);
});

test('glazing is within 0.10 of the hand label, or pinned as a known miss', async () => {
  let ok = 0;
  for (const c of cases) {
    const m = await read(c), hand = handGlazing(labels[c.name], c.box), pin = KNOWN_MISS[c.name];
    if (pin === undefined) { assert.ok(Math.abs(m.glazing - hand) <= 0.1, `${c.name}: glazing ${m.glazing} vs hand ${hand.toFixed(3)}`); ok++; }
    else {
      assert.ok(Math.abs(m.glazing - hand) > 0.1, `${c.name}: glazing ${m.glazing} is within 0.10 of the hand label ${hand.toFixed(3)} now: drop it from KNOWN_MISS`);
      assert.ok(Math.abs(m.glazing - pin) <= 0.02, `${c.name}: known-miss glazing moved to ${m.glazing} from ${pin}`);
    }
  }
  assert.equal(ok, 12 - Object.keys(KNOWN_MISS).length);
});

test('the four AB07 walls match their hand-chosen patch (raw colour), the white house is white', async () => {
  for (const [name, hex] of Object.entries(RAW_WALL)) {
    const c = cases.find(x => x.name === name)!, m = await read(c);
    assert.ok(dE(hexRgb(m.wall.rawHex), hexRgb(hex)) <= 12, `${name}: raw wall ${m.wall.rawHex} vs patch ${hex}`);
  }
  const white = await read(cases.find(x => x.name === 'ab07-173056-white')!);
  assert.ok(rgbToLab(white.wall.normalised)[0] >= 80, `white canal house wall ${white.wall.hex}`);
});

test('the wall estimate holds under a +-10 cm jitter of the box: HSL lightness spread <= 0.02 on every front', async () => {
  for (const c of cases) {
    const ls: number[] = [];
    for (const b of jitterBoxes(c.box)) ls.push(hslLightness((await read(c, b)).wall.hex));
    assert.ok(Math.max(...ls) - Math.min(...ls) <= 0.02 + 1e-9, `${c.name}: wall lightness spread ${(Math.max(...ls) - Math.min(...ls)).toFixed(3)}`);
  }
});

test('before H2d: three Nassaukade fronts read the whole storey as one frame and the 164843 wall flipped with the box', async () => {
  const c = (n: string) => cases.find(x => x.name === n)!;
  assert.equal((await read(c('nassau-164843-render'), c('nassau-164843-render').box, false)).glazing, 0.864);
  assert.equal((await read(c('nassau-161422-render'), c('nassau-161422-render').box, false)).glazing, 0.797);
  const photo = c('nassau-164843-photo'), l = new Set<number>();
  for (const b of jitterBoxes(photo.box)) l.add(Math.round(hslLightness((await read(photo, b, false)).wall.hex) * 100));
  assert.ok(Math.max(...l) - Math.min(...l) > 20, 'the pre-H2d wall lightness moved by more than 0.20 across the jitter');
});

test('opening split: the default has the two replay-neutral parts on, true/false/object resolve, the CLI flag parses', async () => {
  const {OPENING_SPLIT_DEFAULT, OPENING_SPLIT_ALL, resolveOpeningSplit, openingSplitFromArgs} = await import('./measureFacade.ts');
  assert.deepEqual(OPENING_SPLIT_DEFAULT, {groups: true, core: false, solidBody: true, clusterWall: false});
  assert.deepEqual(resolveOpeningSplit(undefined), OPENING_SPLIT_DEFAULT);
  assert.deepEqual(resolveOpeningSplit(true), OPENING_SPLIT_ALL);
  assert.deepEqual(resolveOpeningSplit(false), {groups: false, core: false, solidBody: false, clusterWall: false});
  assert.deepEqual(resolveOpeningSplit({core: true}), {groups: false, core: true, solidBody: false, clusterWall: false});
  assert.deepEqual(openingSplitFromArgs(['--no-opening-split']), {openingSplit: false});
  assert.deepEqual(openingSplitFromArgs(['--opening-split=core,clusterWall']), {openingSplit: {core: true, clusterWall: true}});
  assert.deepEqual(openingSplitFromArgs([]), {});
  assert.throws(() => openingSplitFromArgs(['--opening-split=nope']));
});
