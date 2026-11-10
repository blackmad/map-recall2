import {test} from 'node:test';
import assert from 'node:assert/strict';
import {acceptedByEye, applyReviewedStrip, type ReviewedStrips} from './reviewedStrips.ts';
import {installVerdict} from './batchInstall.ts';

const doc: ReviewedStrips = {accepted: [{face: 'zamenhof-54-60', date: '2025-09-22', by: 'opus'}]};

test('the exact face and date waives colour-cast reasons', () => {
  const v = applyReviewedStrip({bad: true, reasons: ['blown', 'cold cast rb']}, doc, 'zamenhof-54-60', '2025-09-22');
  assert.deepEqual(v, {bad: false, reasons: [], waived: ['blown', 'cold cast rb']});
});

test('another date or another face is not covered', () => {
  const s = {bad: true, reasons: ['cold cast rb']};
  assert.equal(applyReviewedStrip(s, doc, 'zamenhof-54-60', '2022-05-10').bad, true);
  assert.equal(applyReviewedStrip(s, doc, 'zamenhof-84-90', '2025-09-22').bad, true);
  assert.equal(acceptedByEye(null, 'a', 'b'), null);
});

test('dark and no-usable-span are never waived', () => {
  assert.equal(applyReviewedStrip({bad: true, reasons: ['cold cast rb', 'dark']}, doc, 'zamenhof-54-60', '2025-09-22').bad, true);
  assert.equal(applyReviewedStrip({bad: true, reasons: ['no usable span']}, doc, 'zamenhof-54-60', '2025-09-22').bad, true);
});

test('the override does not touch the over-drawn floor in the install verdict', () => {
  const strip = applyReviewedStrip({bad: true, reasons: ['cold cast rb']}, doc, 'zamenhof-54-60', '2025-09-22');
  const base = {strip, compile: {gatesFailed: [], auditPassed: true}, likeness: [{pandId: 'x', ncc: 0.5}], brickPands: 3};
  assert.equal(installVerdict({...base, stripOverDrawn: 1.0}).install, true);
  const low = installVerdict({...base, stripOverDrawn: 0.787});
  assert.equal(low.install, false);
  assert.match(low.reasons[0], /strip-over-drawn-low/);
});
