// Wall sample v2 (lane d1-wall-colour, 2026-11-14): flag, off byte-identical, the steps, and the named regressions
// (Weteringschans 168096-171218 and 171971-171983; D1 belt pages Herengracht even 98-232, Keizersgracht even 146-262 and 264-404).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WALL_SAMPLE, brickForDrawn, correctCapture, drawnForPixel, estimateWall, isWallSampleFact, labOf, resetWallSampleMode, wallSampleMode, wallSampleModeOf, wallSampleV2, type CaptureSample } from './wallSample.ts';
import { hexToOklab, specWallDisplay, paleWarmReading } from './wallColour.ts';
import { emptySpec, setSpecField, specProblems } from './spec.ts';

type Fixture = { rows: Array<{ row: string; photo: { L: number; C: number }; pands: Array<{ pandId: string; photo: { L: number; C: number }; captures: Array<{ hex: string; pinned: boolean; refs: { scene: [number, number, number] } }> }> }> };
const FIX = JSON.parse(fs.readFileSync(new URL('./wallSample.regressions.json', import.meta.url), 'utf8')) as Fixture;
const samples = (p: Fixture['rows'][0]['pands'][0]): CaptureSample[] => p.captures.map(c => ({ hex: c.hex, pinned: c.pinned, refs: { white: [0, 0, 0], scene: c.refs.scene, n: 0 } }));
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
/** Row means of the raw pinned sample, the v2 estimate and the predicted pixel (the transfer applied to the drawn wall). */
function rowStats(row: Fixture['rows'][0]) {
  const est = row.pands.map(p => estimateWall(samples(p))!), facts = row.pands.map(p => wallSampleV2(samples(p))!);
  const pix = facts.map(f => { const [L, a, b] = hexToOklab(f.drawn), R = WALL_SAMPLE.render; return { L: R.kL * L + R.cL, C: Math.hypot(R.kC * a + R.cast[0], R.kC * b + R.cast[1]) }; });
  return {
    rawL: mean(est.map(e => labOf(e.raw).L)), rawC: mean(est.map(e => labOf(e.raw).C)),
    L: mean(est.map(e => labOf(e.hex).L)), C: mean(est.map(e => labOf(e.hex).C)),
    pixL: mean(pix.map(p => p.L)), pixC: mean(pix.map(p => p.C)),
    photoL: mean(row.pands.map(p => p.photo.L)), photoC: mean(row.pands.map(p => p.photo.C)),
  };
}

test('flag: default 1, query over env, WALL_SAMPLE read once', () => {
  assert.equal(wallSampleModeOf(''), 1);
  assert.equal(wallSampleModeOf(null, '2'), 2);
  assert.equal(wallSampleModeOf('?wallSample=1', '2'), 1);
  assert.equal(wallSampleModeOf('?x=1&wallSample=2'), 2);
  assert.equal(wallSampleModeOf('?wallSample=7'), 1);
  const was = process.env.WALL_SAMPLE;
  delete process.env.WALL_SAMPLE; resetWallSampleMode();
  assert.equal(wallSampleMode(), 1);
  process.env.WALL_SAMPLE = '2'; resetWallSampleMode();
  assert.equal(wallSampleMode(), 2);
  if (was === undefined) delete process.env.WALL_SAMPLE; else process.env.WALL_SAMPLE = was;
  resetWallSampleMode();
});

test('a capture without references is passed through; the gain keeps chromaticity and is clamped', () => {
  assert.deepEqual(correctCapture({ hex: '#5E4033', refs: null }), { hex: '#5e4033', out: '#5e4033', gain: 1, wb: [1, 1, 1] });
  const dark = correctCapture({ hex: '#5e4033', refs: { white: [1, 1, 1], scene: [0.03, 0.03, 0.03], n: 1 } });
  assert.equal(dark.gain, WALL_SAMPLE.gainMax);
  assert.ok(labOf(dark.out).L > labOf('#5e4033').L + 0.1);
  assert.ok(Math.abs(labOf(dark.out).h - labOf('#5e4033').h) <= 3, 'hue kept');
  assert.ok(labOf(dark.out).C > labOf('#5e4033').C, 'chroma rises with the gain');
  const bright = correctCapture({ hex: '#8a6a55', refs: { white: [1, 1, 1], scene: [0.4, 0.4, 0.4], n: 1 } });
  assert.equal(bright.gain, WALL_SAMPLE.gainMin);
});

test('estimate: per-axis median of the corrected captures, L change capped at maxDL', () => {
  const s = (hex: string, y: number, pinned = false): CaptureSample => ({ hex, pinned, refs: { white: [1, 1, 1], scene: [y, y, y], n: 1 } });
  const e = estimateWall([s('#3c322d', 0.03, true), s('#715d53', 0.12), s('#6a5a50', 0.09)])!;
  assert.equal(e.raw, '#3c322d');
  assert.equal(e.captures.length, 3);
  assert.ok(labOf(e.hex).L - labOf(e.raw).L <= WALL_SAMPLE.maxDL + 1e-3);
  assert.equal(estimateWall([]), null);
});

test('drawn and brick: the transfer inverted, display inverted, warm walls kept under the pale-warm guard', () => {
  for (const target of ['#7a4a38', '#5a4a40', '#b07a5a', '#4a3f38']) {
    const drawn = drawnForPixel(target), brick = brickForDrawn(drawn), shown = specWallDisplay(brick);
    assert.ok(Math.abs(hexToOklab(shown)[0] - hexToOklab(drawn)[0]) < 0.01, `${target}: display(brick) lands on the drawn L`);
    assert.ok(!paleWarmReading(drawn), `${target}: not held by the pale-warm guard`);
  }
  // the inverted transfer predicts the target pixel back (inside the clamps)
  const [L, a, b] = hexToOklab(drawnForPixel('#6a4a3a')), R = WALL_SAMPLE.render;
  assert.ok(Math.abs(R.kL * L + R.cL - hexToOklab('#6a4a3a')[0]) < 0.01);
  assert.ok(Math.abs(Math.hypot(R.kC * a + R.cast[0], R.kC * b + R.cast[1]) - labOf('#6a4a3a').C) < 0.006);
});

test('the receipt validates as facts/wallSample', () => {
  const f = wallSampleV2([{ hex: '#463a34', pinned: true, refs: { white: [1, 1, 1], scene: [0.06, 0.06, 0.06], n: 1 } }])!;
  assert.ok(isWallSampleFact(f));
  const spec = emptySpec('0363100012171971');
  setSpecField(spec, 'palette/brick', f.brick);
  setSpecField(spec, 'facts/wallSample', f);
  spec.provenance['palette/brick'] = spec.provenance['facts/wallSample'] = { source: 'streetlevel-measured', confidence: 0.6, ref: 'artifacts/describer-d1/cuts-ah07/0363100012171971.jpg', at: '2026-11-14' };
  assert.deepEqual(specProblems(spec), []);
  setSpecField(spec, 'facts/wallSample', { v: 2, raw: 'x' });
  assert.ok(specProblems(spec).some(p => p.startsWith('facts/wallSample')));
});

// ---- named regressions --------------------------------------------------------------------------------------------------
// Tolerances. One rule-10 photo is one capture of the row. Over 1,704 captures of 436 belt and AH07 pands (captures.ts), the
// same wall's W1 sample moves between captures with sd 0.085 in OKLab L (0.10 with the small-sample correction at ~3.5
// captures a pand) and sd 0.51 in ln C. A photo row mean is close to one capture (its pands share it), so the estimate is held
// to the photo within two capture sd: 0.18 in L and x2.5 in C. Where the raw pinned sample is already outside that (a photo
// from an outlier exposure: Weteringschans 2024-12-11 reads the white frames at 255; Keizersgracht 146-262's sunlit 2016-08 and
// 2020-04 captures), the estimate must move toward the photo instead. Across the 189 page pands the per-pand |dL| to the photo
// is 0.115 for the raw sample and for v2 alike: no exposure rule predicts which capture the photo is.
const L_TOL = 0.18, C_TOL = 2.5;
const lnr = (a: number, b: number) => Math.abs(Math.log(Math.max(a, 1e-3) / Math.max(b, 1e-3)));
const row = (name: string) => FIX.rows.find(r => r.row === name)!;

test('regression: Weteringschans 168096-171218 (even, orange-red brick) leaves the floor and gains chroma', () => {
  const s = rowStats(row('weteringschans-168096-171218'));
  assert.ok(s.L > s.rawL + 0.08 && s.L < s.photoL, `L ${s.L.toFixed(3)} between raw ${s.rawL.toFixed(3)} + 0.08 and photo ${s.photoL}`);
  assert.ok(s.C >= 0.6 * s.photoC && s.C <= 1.6 * s.photoC, `C ${s.C.toFixed(3)} vs photo ${s.photoC}`);
  assert.ok(s.C > 2 * s.rawC, `C ${s.C.toFixed(3)} more than twice raw ${s.rawC.toFixed(3)}`);
});
test('regression: Weteringschans 171971-171983 (odd) leaves the floor and gains chroma', () => {
  const s = rowStats(row('weteringschans-171971-171983'));
  assert.ok(s.L > s.rawL + 0.05 && s.L < s.photoL, `L ${s.L.toFixed(3)} vs raw ${s.rawL.toFixed(3)}, photo ${s.photoL}`);
  assert.ok(s.C >= 0.6 * s.photoC && s.C <= 1.6 * s.photoC, `C ${s.C.toFixed(3)} vs photo ${s.photoC}`);
});
for (const name of ['herengracht-even-2', 'keizersgracht-even-2', 'keizersgracht-even-3']) {
  test(`regression: D1 belt page ${name}: estimate within capture noise of the rule-10 photos, or closer than raw`, () => {
    const s = rowStats(row(name));
    if (Math.abs(s.rawL - s.photoL) > L_TOL) assert.ok(Math.abs(s.L - s.photoL) < Math.abs(s.rawL - s.photoL), `L ${s.L.toFixed(3)} closer to photo ${s.photoL.toFixed(3)} than raw ${s.rawL.toFixed(3)}`);
    else assert.ok(Math.abs(s.L - s.photoL) <= L_TOL, `L ${s.L.toFixed(3)} vs photo ${s.photoL.toFixed(3)}`);
    assert.ok(lnr(s.C, s.photoC) <= Math.log(C_TOL) || lnr(s.C, s.photoC) < lnr(s.rawC, s.photoC), `C ${s.C.toFixed(3)} vs photo ${s.photoC.toFixed(3)} (raw ${s.rawC.toFixed(3)})`);
    // the point of v2: the staged wall leaves the near-black floor the D1 staging parked these rows on
    assert.ok(s.pixL > 0.42, `predicted pixel L ${s.pixL.toFixed(3)} above the floor rows (staged drew 0.33-0.40)`);
  });
}
test('regression table (printed)', () => {
  for (const r of FIX.rows) { const s = rowStats(r); console.log(`${r.row.padEnd(30)} n ${r.pands.length}  photo L ${s.photoL.toFixed(3)} C ${s.photoC.toFixed(3)} | raw L ${s.rawL.toFixed(3)} C ${s.rawC.toFixed(3)} | v2 est L ${s.L.toFixed(3)} C ${s.C.toFixed(3)} | v2 pixel L ${s.pixL.toFixed(3)} C ${s.pixC.toFixed(3)}`); }
});
