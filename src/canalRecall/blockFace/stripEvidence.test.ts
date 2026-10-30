import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EVIDENCE, evidenceVerdict, measureSpanEvidence, runVerdict} from './stripEvidence.ts';

// Synthetic strips at 10 px/m, 18 m tall, one 6 m pand: a 12 m eaves, 14 m roof.
const PPM = 10, W = 60, H = 180, EAVES = 12, ROOF = 14;
type Px = (x: number, y: number) => [number, number, number];
const fill = (px: Px) => {
  const a = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) a.set(px(x, y), (y * W + x) * 3);
  return a;
};
const heightOf = (y: number) => (H - y) / PPM;
// A brick front with a window grid (1 m windows every 2 m, from 1 m to the eaves).
const brick: Px = (x, y) => {
  const m = heightOf(y), u = x / PPM;
  return m > 1 && (u % 2) > 0.5 && (u % 2) < 1.5 && (m % 3) > 1 && (m % 3) < 2.4 ? [40, 45, 50] : [120, 70, 55];
};
const measure = (rgb: Uint8Array) => measureSpanEvidence({rgb, width: W, height: H, px: [0, W], pixelsPerMetre: PPM, eavesM: EAVES, roofM: ROOF,
  panoramas: [{distanceM: 9, obliquityDeg: 12}, {distanceM: 11, obliquityDeg: 30}]});

test('a front under grey overcast sky passes', () => {
  const e = measure(fill((x, y) => (heightOf(y) > EAVES ? [176, 178, 180] : brick(x, y))));
  assert.equal(e.skyCols, 1);
  assert.equal(e.distanceM, 9);
  assert.equal(evidenceVerdict(e).pass, true);
});

test('a front under clear blue sky with clouds passes (blue is sky even where it is textured)', () => {
  const e = measure(fill((x, y) => (heightOf(y) > EAVES ? ((x + y) % 7 < 2 ? [235, 238, 242] : [110, 160, 220]) : brick(x, y))));
  assert.ok(e.skyCols >= EVIDENCE.minSkyColumns, `${e.skyCols}`);
  assert.equal(evidenceVerdict(e).pass, true);
});

test('bare branches over the roof still leave sky in every column', () => {
  // Dark one-pixel branches every third row over a grey sky: about two thirds of each column is sky.
  const e = measure(fill((x, y) => (heightOf(y) > EAVES ? ((y + (x >> 2)) % 3 === 0 ? [50, 45, 40] : [180, 182, 185]) : brick(x, y))));
  assert.equal(evidenceVerdict(e).pass, true, JSON.stringify(e));
});

test('a magnified wall that runs past the strip top fails (Bloemstraat 128-206 r2, Akoleienstraat 2-10 r1)', () => {
  const e = measure(fill(brick));
  assert.ok(e.skyCols < EVIDENCE.minSkyColumns);
  const v = evidenceVerdict(e);
  assert.equal(v.pass, false);
  assert.match(v.reasons[0], /nearer wall, fence or tree/);
});

test('white frames on a magnified wall do not read as sky', () => {
  const e = measure(fill((x, y) => ((x % 10) < 2 ? [240, 240, 238] : brick(x, y))));
  assert.equal(evidenceVerdict(e).pass, false, JSON.stringify(e));
});

test('a strip that ends at the roof has no band to read', () => {
  const v = evidenceVerdict({skyCols: 1, aboveM: 0.2});
  assert.equal(v.pass, false);
  assert.match(v.reasons[0], /no sky to read/);
});

test('a run passes only when every span shows its front', () => {
  assert.deepEqual(runVerdict([{pandId: '0363100012170212', pass: true, reasons: []}, {pandId: '0363100012170209', pass: false, reasons: ['x']}]), {pass: false, reasons: ['170209: x']});
  assert.equal(runVerdict([{pandId: 'a', pass: true, reasons: []}]).pass, true);
});

test('named calibration: the 4 reviewed no-front runs are rejected, the 24 reviewed installs pass', () => {
  const fx = JSON.parse(readFileSync(new URL('./fixtures/strip-evidence-calibration.json', import.meta.url), 'utf8')) as {spans: {expect: string; run: string; pand: string; skyCols: number; aboveM: number}[]};
  const runs = new Map<string, {expect: string; pass: boolean}>();
  for (const s of fx.spans) {
    const r = runs.get(s.run) ?? {expect: s.expect, pass: true};
    r.pass &&= evidenceVerdict(s).pass;
    runs.set(s.run, r);
  }
  const rejected = [...runs].filter(([, r]) => r.expect === 'reject-run').map(([id, r]) => [id, r.pass]);
  assert.deepEqual(rejected, [['bloemgracht-53-95-r1', false], ['bloem-128-206-r2', false], ['akoleien-2-10-r1', false], ['lelie-150-194-r1', false]]);
  const goodRejected = [...runs].filter(([, r]) => r.expect === 'pass' && !r.pass).map(([id]) => id);
  assert.deepEqual(goodRejected, []);
  assert.ok([...runs.values()].filter(r => r.expect === 'pass').length >= 16);
});
