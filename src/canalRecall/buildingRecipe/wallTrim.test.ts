import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {measureFacade, rgbToLab, type Rgb} from './measureFacade.ts';
import {blurRgb} from '../houseSpec/previewVerdict.ts';
import {wallVsTrim, type ClusterStat} from './wallTrim.ts';

const stat = (lab: Rgb, share: number, solid: number, glassy = false): ClusterStat => ({lab, share, solid, glassy});

// ---- the rule on cluster statistics (Nassaukade 164843 render, k = 4) ----
const BROWN = stat([21, 10.1, 8.3], 0.257, 0.49), EDGE_BROWN = stat([28.3, 8.1, 7.8], 0.22, 0.19), GLASS = stat([32, -3.8, -9.4], 0.305, 0.76, true), WHITE_BAND = stat([59.3, -0.6, 3.5], 0.218, 0.19);

test('a thin white band picked as the wall gives way to the dark body that outweighs it', () => {
  const r = wallVsTrim([BROWN, EDGE_BROWN, GLASS, WHITE_BAND], [false, true, false, true], 3);
  assert.ok(r);
  assert.equal(r!.wallC, 0);
  assert.deepEqual(r!.wallSet, [true, true, false, false]);
});
test('white stays the wall when it is the dominant area (plastered front)', () => {
  const plaster = stat([88, 0, 4], 0.6, 0.8), shutters = stat([30, 12, 9], 0.2, 0.5), glass = stat([35, -2, -8], 0.2, 0.7, true);
  assert.equal(wallVsTrim([plaster, shutters, glass], [true, false, false], 0), null);
  // even a pale cluster that is thin loses nothing when the dark cluster is smaller than it
  assert.equal(wallVsTrim([stat([80, 0, 3], 0.4, 0.2), stat([30, 12, 9], 0.2, 0.6)], [true, false], 0), null);
});
test('a dark neutral cluster beside pale panels is glass, not the wall', () => {
  assert.equal(wallVsTrim([stat([72, 0, 3], 0.25, 0.2), stat([22, 1, 1], 0.4, 0.6)], [true, false], 0), null);
});
test('a coloured pale cluster is not painted trim', () => {
  assert.equal(wallVsTrim([stat([75, 20, 40], 0.25, 0.2), stat([22, 10, 8], 0.4, 0.6)], [true, false], 0), null);
});
test('a body-solid pale wall is never a band', () => {
  assert.equal(wallVsTrim([stat([75, 0, 3], 0.25, 0.5), stat([22, 10, 8], 0.4, 0.6)], [true, false], 0), null);
});

// ---- rule B (lane H2d): the solid body in the wall set, not a thin cluster enriched in the floor zones ----
test('a thin cluster picked as the wall gives way to a solid wall-set body of the same size (a slate wall with lintels, 164843 photo)', () => {
  const slate = stat([25, 6, -7], 0.247, 0.41, true), glass = stat([41, 1, -5], 0.31, 0.39), lintels = stat([40, 1, 5], 0.253, 0.27), pale = stat([63, -3, 2], 0.19, 0.27);
  const r = wallVsTrim([slate, glass, lintels, pale], [true, false, true, false], 2);
  assert.equal(r!.wallC, 0);
  assert.deepEqual(r!.wallSet, [true, false, true, false]);
  assert.equal(wallVsTrim([slate, glass, lintels, pale], [true, false, true, false], 2, false), null, 'off: unchanged');
  // a thin cluster stays the wall when no solid body of the wall set is as large
  assert.equal(wallVsTrim([stat([25, 6, -7], 0.1, 0.41), glass, lintels, pale], [true, false, true, false], 2), null);
});

// ---- hand-labelled crops (fixtures/wall-trim/cases.json) ----
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/wall-trim');
interface Case {name: string; file: string; ppm: number; topM: number; box: {u0: number; u1: number; v0: number; v1: number}; lines: number[]; source: string}
/**
 * Hand labels, read off the crop by eye (the wall's own colour, not the trim; glazing as the share of the upper
 * storeys' wall area the openings take). `wall` is a Lab radius (dE76 <= 12) round the labelled colour, `trim` whether
 * the front has pale bands, sills or frames that must not be read as the wall, `glazing` +- 0.1. `knownMiss` pins a
 * glazing reading that is outside the label today for a reason that is not the wall pick (the opening pass fills every
 * storey of a dark front into one frame: facadeOpenings.ts, GitHub #338 H2c OPEN); when it is fixed the test says so.
 * Marnixstraat's wall is the normalised white (215 reference, lightTrimNormalisation), not the sunlit #f4f4f2.
 */
const LABELS: Record<string, {wall: string; trim: boolean; glazing: number; knownMiss?: number}> = {
  'nassau-164843-render': {wall: '#3d2722', trim: true, glazing: 0.375, knownMiss: 0.864},
  'nassau-164843-photo': {wall: '#353240', trim: true, glazing: 0.368, knownMiss: 0.699},
  'nassau-161422-render': {wall: '#784628', trim: true, glazing: 0.408, knownMiss: 0.797},
  'heren-175702-render': {wall: '#5e554d', trim: true, glazing: 0.28},
  'keizers-171052-render': {wall: '#70665e', trim: true, glazing: 0.38},
  'nassau-116526-strip': {wall: '#62493a', trim: true, glazing: 0.27},
  'haarlemmerweg-940-white': {wall: '#d8d8d4', trim: false, glazing: 0.4, knownMiss: 0.259},
  'marnixstraat-248-white': {wall: '#d6d6d3', trim: false, glazing: 0.4},
};
const hexRgb = (h: string): Rgb => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as Rgb;
const dE = (a: Rgb, b: Rgb) => { const x = rgbToLab(a), y = rgbToLab(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };

async function read(c: Case, wallVsTrimOn: boolean, openingSplit = false) {
  const {data, info} = await sharp(path.join(DIR, c.file)).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const rgb = blurRgb(new Uint8Array(data), info.width, info.height, 1.5);
  return measureFacade({image: {width: info.width, height: info.height, rgb, ppm: c.ppm, topM: c.topM}, box: c.box, lines: c.lines, wallVsTrim: wallVsTrimOn, openingSplit});
}
// the eight fronts of lane H2c (lane H2d added four more to cases.json; openings and jitter are pinned in handLabels.test.ts)
const cases: Case[] = (JSON.parse(fs.readFileSync(path.join(DIR, 'cases.json'), 'utf8')) as Case[]).filter(c => c.name in LABELS);

test('eight labelled fronts: wall colour, trim, glazing', async () => {
  assert.equal(cases.length, 8);
  for (const c of cases) {
    const L = LABELS[c.name], m = await read(c, true);
    const dw = dE(hexRgb(m.wall.hex), hexRgb(L.wall));
    assert.ok(dw <= 12, `${c.name}: wall ${m.wall.hex} is ${dw.toFixed(1)} dE from the label ${L.wall}`);
    const lighter = m.trim ? rgbToLab(m.trim.normalised)[0] - rgbToLab(m.wall.normalised)[0] : -99;
    assert.equal(lighter >= 8, L.trim, `${c.name}: trim ${m.trim?.hex ?? '-'} is ${lighter.toFixed(0)} L above the wall, label says trim ${L.trim}`);
    if (L.knownMiss === undefined) assert.ok(Math.abs(m.glazing - L.glazing) <= 0.1, `${c.name}: glazing ${m.glazing} vs label ${L.glazing}`);
    else {
      assert.ok(Math.abs(m.glazing - L.glazing) > 0.1, `${c.name}: glazing ${m.glazing} is now within the label ${L.glazing}: drop knownMiss`);
      assert.ok(Math.abs(m.glazing - L.knownMiss) <= 0.02, `${c.name}: known-miss glazing moved to ${m.glazing} from ${L.knownMiss}`);
    }
  }
});

test('before H2c the Nassaukade render read the white trim as the wall; every other labelled front reads the same either way', async () => {
  for (const c of cases) {
    const off = await read(c, false), on = await read(c, true);
    if (c.name === 'nassau-164843-render') {
      assert.equal(off.wall.hex, '#b0a99a');
      assert.ok(dE(hexRgb(off.wall.hex), hexRgb(LABELS[c.name].wall)) > 30);
    } else assert.equal(on.wall.hex, off.wall.hex, c.name);
  }
});
