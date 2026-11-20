import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLUSTER_DISTRIBUTION, MEASURED_FRONTS, clusterFor, measuredFront, validateFronts } from './facts.js';
import { FAMILY_SWATCHES, blended, familyOfHex, plausibleOwnWall, postwarExtraIds, postwarKitFor, styleFor } from './kit.js';
import { ExtraSink } from '../facadeExtraCore.js';
import type { ExtraContext } from '../facadeExtraCore.js';
import { arcade, balconyBand, darkErkers, projectingBalconies, roundBalconies } from './components.js';
import { rgbToLab } from '../look/brickTone.js';

const NOWHERE: [number, number] = [4.70, 52.30];

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

test('brick is the measured majority of 1965-2004 blocks, and the kit draws it so', () => {
  for (const c of ['C1', 'C4'] as const) {
    const w = CLUSTER_DISTRIBUTION[c].wall, n = CLUSTER_DISTRIBUTION[c].n;
    const brick = Object.entries(w).filter(([k]) => k.startsWith('brick')).reduce((s, [, v]) => s + v!, 0);
    assert.ok(brick / n >= 0.7, `${c} brick share ${brick}/${n}`);
  }
  let brick = 0;
  for (let i = 0; i < 400; i++) {
    const k = postwarKitFor({ id: `NL.IMBAG.Pand.03631000129${String(i).padStart(5, '0')}`, year: 1978, heightM: 15, use: 'housing', at: NOWHERE })!;
    if (k.family.startsWith('brick')) brick++;
    assert.equal(k.wallSource, 'drawn');
  }
  assert.ok(brick / 400 > 0.75 && brick / 400 < 0.95, `drawn C4 brick share ${brick / 400}`);
});

test('a read pand draws its own read; not housing, no year or pre-1965: null', () => {
  const k = postwarKitFor({ id: '0363100012171628', year: 1983, heightM: 17.7, use: 'housing' })!;
  assert.equal(k.wallSource, 'measured');
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

test('own T0 walls: a plausible brick or a white paint is kept, a window-averaged grey or near-black is not', () => {
  assert.ok(plausibleOwnWall({ hex: '#7b5c57', painted: false }));
  assert.ok(!plausibleOwnWall({ hex: '#372622', painted: false })); // Wibautstraat 31-55 on red-brown brick
  assert.ok(!plausibleOwnWall({ hex: '#7a7c7e', painted: true })); // Bloemgracht 210-286 on red brick
  assert.ok(plausibleOwnWall({ hex: '#ece8de', painted: true }));
  const kept = postwarKitFor({ id: 'own-test', year: 1990, heightM: 15, use: 'housing', at: NOWHERE, own: { hex: '#9a5240', painted: false } })!;
  assert.equal(kept.wallSource, 'own'); assert.equal(kept.wall, '#9a5240'); assert.equal(kept.family, 'brick-red');
  const dropped = postwarKitFor({ id: 'own-test', year: 1990, heightM: 15, use: 'housing', at: NOWHERE, own: { hex: '#372622', painted: false } })!;
  assert.equal(dropped.wallSource, 'drawn');
  assert.equal(familyOfHex('#e6e2d8', true), 'render-white');
});

test('neighbours shift the draw: a read same-cluster front nearby weighs 1.5', () => {
  const near = MEASURED_FRONTS.filter(r => r.cluster === 'C4').slice(0, 1).map(r => ({ r, w: 1.5 }));
  const opts = blended(CLUSTER_DISTRIBUTION.C4.wall, near, r => r.wall);
  const fam = near[0].r.wall;
  assert.equal(opts.find(([k]) => k === fam)![1], (CLUSTER_DISTRIBUTION.C4.wall[fam] ?? 0) + 1.5);
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
