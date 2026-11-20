import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLUSTER_DISTRIBUTION, MEASURED_FRONTS, clusterFor, measuredFront, validateFronts } from './facts.js';
import { FAMILY_SWATCHES, coarseFamily, correctedWall, familyOfHex, postwarExtraIds, postwarKitFor, styleFor, validateWalls } from './kit.js';
import { calibrateThumb, isBuffRaw, isShadedRaw, measureWallPatch } from './wallPatch.js';
import CORRECTED from './corrected-walls.json';
import { ExtraSink } from '../facadeExtraCore.js';
import type { ExtraContext } from '../facadeExtraCore.js';
import { arcade, balconyBand, darkErkers, projectingBalconies, roundBalconies } from './components.js';
import { rgbToLab } from '../look/brickTone.js';

test('facts: 59 read fronts in the four clusters; validation rejects a bad family', () => {
  assert.equal(MEASURED_FRONTS.length, 59);
  assert.deepEqual(Object.keys(CLUSTER_DISTRIBUTION).sort(), ['C1', 'C2', 'C4', 'C5']);
  assert.throws(() => validateFronts([{ ...MEASURED_FRONTS[0], wall: 'brick-pink' as never }]));
  assert.equal(measuredFront('NL.IMBAG.Pand.0363100012171628')?.ground, 'arcade'); // Pentagon
});

test('clusters follow the backlog: era, and towers from 24 m in 1985-2004', () => {
  assert.equal(clusterFor(1964, 15), null);
  assert.equal(clusterFor(1970, 30), 'C4');
  assert.equal(clusterFor(1990, 20), 'C1');
  assert.equal(clusterFor(1990, 24), 'C5');
  assert.equal(clusterFor(2010, 40), 'C2');
});

test('brick is the measured majority of 1965-2004 blocks; an unread, unmeasured pand gets no draw', () => {
  for (const c of ['C1', 'C4'] as const) {
    const w = CLUSTER_DISTRIBUTION[c].wall, n = CLUSTER_DISTRIBUTION[c].n;
    const brick = Object.entries(w).filter(([k]) => k.startsWith('brick')).reduce((s, [, v]) => s + v!, 0);
    assert.ok(brick / n >= 0.7, `${c} brick share ${brick}/${n}`);
  }
  for (let i = 0; i < 50; i++) assert.equal(postwarKitFor({ id: `NL.IMBAG.Pand.03631000199${String(i).padStart(5, '0')}`, year: 1978, heightM: 15, use: 'housing' }), null);
});

test('a read pand draws its own read; not housing, no year or pre-1965: null', () => {
  const k = postwarKitFor({ id: '0363100012171628', year: 1983, heightM: 17.7, use: 'housing' })!;
  assert.equal(k.wallSource, 'read');
  assert.equal(k.family, 'render-white');
  assert.equal(k.balcony, 'round');
  assert.ok(k.arcade);
  assert.deepEqual(postwarExtraIds(k), ['postwar-round-balconies', 'postwar-arcade']);
  const marnix = postwarKitFor({ id: '0363100012173278', year: 1996, heightM: 15, use: 'housing' })!;
  assert.equal(marnix.erker, 'dark-glass');
  assert.equal(postwarKitFor({ id: 'x', year: 1983, heightM: 17, use: 'office' }), null);
  assert.equal(postwarKitFor({ id: 'x', year: null, heightM: 17, use: 'housing' }), null);
  assert.equal(postwarKitFor({ id: 'x', year: 1950, heightM: 17, use: 'housing' }), null);
});

test('a measured unread pand takes its brick-only wall and nothing else; the file validates', () => {
  assert.throws(() => validateWalls({ schemaVersion: 1, revision: 'x', walls: { '123': 'b9a5240' } }));
  assert.throws(() => validateWalls({ schemaVersion: 1, revision: 'x', walls: { '0363100012171628': 'x9a5240' } }));
  const id = Object.keys(CORRECTED.walls).find(k => !measuredFront(k));
  if (!id) return;
  const k = postwarKitFor({ id, year: 1990, heightM: 15, use: 'housing' })!;
  assert.equal(k.wallSource, 'measured');
  assert.equal(k.wall, correctedWall(id)!.hex);
  assert.equal(k.style, null);
  assert.deepEqual(postwarExtraIds(k), []);
  assert.equal(postwarKitFor({ id, year: 1990, heightM: 15, use: 'office' }), null);
});

test('wall patch: glass, frames and loggia shadow do not pull a red brick wall grey', () => {
  const px: number[] = [];
  for (let i = 0; i < 3000; i++) px.push(150, 82, 64); // brick
  for (let i = 0; i < 1800; i++) px.push(60, 64, 68); // glass and shade
  for (let i = 0; i < 600; i++) px.push(235, 235, 232); // white frames
  for (let i = 0; i < 900; i++) px.push(20, 18, 18); // loggia shadow
  const m = measureWallPatch(px)!;
  assert.equal(m.hex, '#965240');
  assert.equal(familyOfHex(m.hex, m.painted), 'brick-red');
  assert.ok(m.accepted);
  const white: number[] = [];
  for (let i = 0; i < 3000; i++) white.push(232, 230, 224);
  for (let i = 0; i < 1000; i++) white.push(60, 64, 68);
  const w = measureWallPatch(white)!;
  assert.ok(w.painted);
  assert.equal(familyOfHex(w.hex, w.painted), 'render-white');
  assert.equal(familyOfHex('#e6e2d8', true), 'render-white');
  assert.equal(coarseFamily('brick-dark'), 'warm');
});

test('swatches: brick within the city brightness band, render light', () => {
  for (const [fam, sw] of Object.entries(FAMILY_SWATCHES)) for (const hex of sw) {
    const L = rgbToLab([1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)))[0];
    if (fam.startsWith('brick')) assert.ok(L >= 25 && L <= 72, `${fam} ${hex} L ${L}`);
    if (fam === 'render-white') assert.ok(L >= 85, `${hex} L ${L}`);
  }
  assert.equal(styleFor(false, 'strip', 'white'), 'ribbon');
  assert.equal(styleFor(true, 'punched', 'dark'), 'smoothDark');
  assert.equal(styleFor(false, 'tall', 'white'), 'tall');
});

const ctx = (len: number, storeys = 4): ExtraContext => ({
  id: 'p', style: 'modern', wallKey: 'w', f: { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len }, base: 0, top: 3.2 + storeys * 2.9 + 0.6,
  layout: { bays: Math.max(1, Math.round(len / 3.6)), bayWidthM: len / Math.max(1, Math.round(len / 3.6)), groundM: 3.2, storeys, storeyM: 2.9, doorBays: [0] },
  wallHex: '#9a5240', accentHex: '#ffffff', groundLevel: true, streetSide: true, postwarKit: { balconyHex: '#e9e7e1', pierHex: '#9a5240' },
});

test('components: bounded triangles, nothing without the kit context', () => {
  const cost = (fn: (c: ExtraContext, s: ExtraSink) => void, c: ExtraContext) => { const s = new ExtraSink(10_000); fn(c, s); return s.tris.length; };
  assert.equal(cost(balconyBand, ctx(30)), 4 * 14);
  assert.equal(cost(roundBalconies, ctx(30)), 4 * 2 * 2 * 10);
  assert.equal(cost(projectingBalconies, ctx(30)), 4 * 2 * 14);
  assert.ok(cost(arcade, ctx(30)) <= 2 + 14 * 8 + 10);
  assert.ok(cost(darkErkers, ctx(30)) > 0);
  const bare = { ...ctx(30), postwarKit: undefined };
  assert.equal(cost(balconyBand, bare), 0);
  assert.equal(cost(arcade, bare), 0);
});

test('buff calibration (round 3): named fronts stay buff, red brick is unchanged', () => {
  // Spitsbergenstraat 2-36 (yellow brick): raw #e9ccad, round 2 drew a pink tan #ac8976.
  const spits = calibrateThumb('#e9ccad', false);
  assert.equal(familyOfHex(spits, false), 'brick-buff');
  assert.notEqual(spits, '#ac8976');
  // Funenpark 440-463 (grey-buff brick): raw #6f685d, round 2 drew a warm brown #826250 (the blind's kit regression).
  const funen = calibrateThumb('#6f685d', false);
  assert.equal(familyOfHex(funen, false), 'brick-buff');
  const [, fa, fb] = rgbToLab([1, 3, 5].map(i => parseInt(funen.slice(i, i + 2), 16)));
  assert.ok(fa < 6 && fb > 6, `grey-buff, not red: ${funen}`);
  // Red brick (Bloemgracht 210-286, raw #544a42) keeps the #118 path byte for byte.
  assert.ok(!isBuffRaw(rgbToLab([0x54, 0x4a, 0x42])));
  assert.equal(calibrateThumb('#544a42', false), '#654436');
  // Weteringschans 159-161, red brick read at mid lightness with a yellowish cast (raw L 57, h 77): not buff.
  assert.ok(!isBuffRaw([57, 9 * Math.cos(77 * Math.PI / 180), 9 * Math.sin(77 * Math.PI / 180)]));
});

test('sunlit white render broken by glazing reads as paint (round 4: Nieuwe Kerkstraat 105-111)', () => {
  // Cluster shares as measured: white 22 %, sun-warmed render and curtains 22 % (L* 52), glazing and shade the rest.
  const px: number[] = [];
  const add = (n: number, r: number, g: number, b: number) => { for (let i = 0; i < n; i++) px.push(r, g, b); };
  add(2200, 247, 245, 240); add(2200, 150, 120, 95); add(2500, 85, 80, 74); add(2000, 125, 123, 120); add(1100, 185, 180, 168);
  const m = measureWallPatch(px)!;
  assert.equal(m.kind, 'paint');
  assert.ok(m.painted);
  // Dark red brick with white frames keeps its brick.
  const brick: number[] = [];
  const addB = (n: number, r: number, g: number, b: number) => { for (let i = 0; i < n; i++) brick.push(r, g, b); };
  addB(3000, 120, 80, 66); addB(2200, 247, 245, 240); addB(2000, 60, 62, 64);
  const k = measureWallPatch(brick)!;
  assert.equal(k.kind, 'brick');
  // Sunlit red brick under many white frames and sky (Sarphatistraat 62: warm L* 62, a* 18) keeps its brick.
  const sun: number[] = [];
  const addS = (n: number, r: number, g: number, b: number) => { for (let i = 0; i < n; i++) sun.push(r, g, b); };
  addS(3200, 190, 128, 100); addS(2700, 247, 245, 240); addS(1500, 215, 210, 195); addS(1100, 120, 100, 80);
  assert.equal(measureWallPatch(sun)!.kind, 'brick');
});

test('shaded low-chroma brick is not accepted (round 5: Mauritskade 17); sunlit red brick is not buff', () => {
  // Mauritskade 17: tan-brown brick in full shade measured raw #5d504c (L* 35, C* 6): round 4 drew it red #704944.
  const px: number[] = [];
  for (let i = 0; i < 4000; i++) px.push(0x5d, 0x50, 0x4c);
  for (let i = 0; i < 1200; i++) px.push(60, 62, 64);
  const m = measureWallPatch(px)!;
  assert.equal(m.kind, 'brick');
  assert.ok(m.shaded);
  assert.ok(!m.accepted);
  assert.ok(isShadedRaw(rgbToLab([0x5d, 0x50, 0x4c])));
  // Shaded red brick with colour left in it (Bloemgracht 210-286, raw #544a42: C* 7) is shaded too; a sunlit front is not.
  assert.ok(!isShadedRaw(rgbToLab([150, 82, 64])));
  // Red brick in full sun (raw L* 83, C* 36, hue 80) stays off the buff branch; read buff fronts (C* 20-26) keep it.
  const lab = (L: number, C: number, h: number) => [L, C * Math.cos(h * Math.PI / 180), C * Math.sin(h * Math.PI / 180)];
  assert.ok(!isBuffRaw(lab(83, 36, 80)));
  assert.ok(isBuffRaw(lab(86, 26, 74)));
  assert.ok(isBuffRaw(rgbToLab([0xe9, 0xcc, 0xad])));
});
