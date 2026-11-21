/**
 * Bar-fixes lane (2026-11-21, Herengracht 2-90 against David's bar): the pixel-grid storey profile and cornice depth, the
 * cornice drawn at its measured depth, the measured ground storey past the stock clamp, and Claude's unconfirmed pair links
 * no longer drawn over a house's own read. Each is byte-identical where its input is absent.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPixelProfile, pixelProfile } from './pixelProfile.ts';
import { beltPlotFacts } from './plotRead.ts';
import { drawnGrouping, pandDesign } from './design.ts';
import { soloCorniceBandM, soloDressAtDepth, SOLO_CORNICE_DRESS, SOLO_CORNICE_SCALE } from '../designUnits/draw.ts';
import { specStoreyFit, SPEC_GROUND_SCALE } from '../streetFacadeRendering.ts';
import { STYLE_DIMS } from '../facadeCells.ts';
import type { DescriptionFile, EditsFile, GroupingFile } from './types.ts';

test('pixelProfile: Herengracht 58 on the grid (ground 0.43, not the judge 0.36); cornice zone; disordered lines refused', () => {
  const h58 = { pavement: 970, floors: [640, 480, 340], corniceBottom: 205, corniceTop: 60, groundWindow: [695, 880] as [number, number], upperWindow: [515, 620] as [number, number] };
  const p = pixelProfile(h58)!;
  assert.deepEqual(p.storeyShares, [0.431, 0.209, 0.183, 0.176]);
  assert.equal(p.groundWindowRatio, 1.76);
  assert.equal(p.corniceRatio, 0.159);
  // A gable front: no cornice top, no cornice zone.
  assert.equal(pixelProfile({ pavement: 965, floors: [678, 495], corniceBottom: 345 })!.corniceRatio, undefined);
  assert.equal(pixelProfile({ pavement: 965, floors: [495, 678], corniceBottom: 345 }), null);
});

test('applyPixelProfile: shares only at the read count (after a stated correction); bays; ratios in range', () => {
  const a: Record<string, unknown> = { storeys: 5, bays: 5 };
  // Herengracht 40: four window rows over a basement band, read as five storeys.
  const m = { pavement: 975, floors: [700, 545, 420], corniceBottom: 290, corniceTop: 125, storeys: 4 };
  assert.deepEqual(applyPixelProfile(a, m), ['storeys', 'storeyShares', 'corniceRatio']);
  assert.equal(a.storeys, 4);
  assert.equal((a.storeyShares as number[]).length, 4);
  const b: Record<string, unknown> = { storeys: 3 };
  assert.deepEqual(applyPixelProfile(b, { pavement: 975, floors: [700, 545, 420], corniceBottom: 290 }), []);
  assert.equal(b.storeyShares, undefined);
  const c: Record<string, unknown> = { storeys: 3, bays: 6 };
  assert.deepEqual(applyPixelProfile(c, { pavement: 915, floors: [722, 555], corniceBottom: 405, corniceTop: 300, bays: 5 }), ['bays', 'storeyShares', 'corniceRatio']);
  assert.equal(c.bays, 5);
});

test('beltPlotFacts: a measured cornice zone is a depth in metres on a cornice front, none on a gable; absent: unchanged', () => {
  const fields = { storeys: 4, bays: 3, crown: 'cornice', cornice: 'heavy', eavesM: 15.77, ground: 'dwelling' };
  const without = beltPlotFacts(fields, { wallHex: '#4a4a4a' })!;
  assert.equal(without.facts.corniceDepthM, undefined);
  const withDepth = beltPlotFacts(fields, { wallHex: '#4a4a4a', corniceRatio: 0.159 })!;
  assert.equal(withDepth.facts.corniceDepthM, 2.51);
  assert.deepEqual({ ...withDepth.facts, corniceDepthM: undefined }, { ...without.facts, corniceDepthM: undefined });
  assert.equal(beltPlotFacts({ ...fields, crown: 'neck', cornice: 'none' }, { corniceRatio: 0.159 })!.facts.corniceDepthM, undefined);
  assert.equal(beltPlotFacts(fields, { corniceRatio: 0.5 })!.facts.corniceDepthM, undefined);
});

test('soloDressAtDepth: the timber cornice scaled so its band is the measured depth, within the clamp; unmeasured: the same object', () => {
  const heavy = SOLO_CORNICE_DRESS.heavy;
  assert.equal(soloDressAtDepth(heavy, undefined), heavy);
  const d = soloDressAtDepth(heavy, 2.51);
  assert.ok(Math.abs(soloCorniceBandM(d) - 2.51) < 0.03, String(soloCorniceBandM(d)));
  assert.equal(soloDressAtDepth(heavy, 0.2).scale, SOLO_CORNICE_SCALE.min);
  assert.equal(soloDressAtDepth(heavy, 9).scale, SOLO_CORNICE_SCALE.max);
});

test('specStoreyFit groundMax: lifts the ground clamp only when stated', () => {
  const dims = STYLE_DIMS.canal, exposedM = 14.6, groundM = 6.5;
  const base = specStoreyFit('canal', exposedM, 4, 1, { groundM, fit: 'nearest' })!;
  assert.equal(base.ground, SPEC_GROUND_SCALE.max);
  assert.deepEqual(specStoreyFit('canal', exposedM, 4, 1, { groundM, fit: 'nearest', groundMax: SPEC_GROUND_SCALE.max }), base);
  const lifted = specStoreyFit('canal', exposedM, 4, 1, { groundM, fit: 'nearest', groundMax: 2.4 })!;
  assert.ok(Math.abs(lifted.ground * dims.ground - groundM) < 1e-9);
  assert.deepEqual(specStoreyFit('canal', 10, 3, 1, { groundM: 3, fit: 'nearest', groundMin: 0.5 }), specStoreyFit('canal', 10, 3, 1, { groundM: 3, fit: 'nearest', groundMin: 0.5, groundMax: 1 }));
});

test("drawnGrouping / pandDesign: Claude's unconfirmed pair link is not drawn over the house's own read; David's link is", () => {
  const header = { schemaVersion: 1, faceId: 'f', revision: 1, updatedAt: '' } as const;
  const field = (value: unknown) => ({ value, source: 'photo-read', confidence: 0.75 });
  const description = { ...header, pands: [
    { pandId: 'A', address: 'Herengracht 44', order: 0, fields: { storeys: field(3), crown: field('neck') } },
    { pandId: 'B', address: 'Herengracht 46', order: 1, fields: { storeys: field(4), crown: field('neck') } },
  ] } as unknown as DescriptionFile;
  const edits = { ...header, edits: {} } as unknown as EditsFile;
  const face = { pands: [{ pandId: 'A' }, { pandId: 'B' }] } as never;
  const byClaude = { ...header, units: [], links: [{ pandId: 'A', kind: 'sameAs', target: 'B', by: 'claude', at: '' }] } as unknown as GroupingFile;
  const byDavid = { ...byClaude, links: [{ ...byClaude.links[0], by: 'david' }] } as unknown as GroupingFile;
  assert.equal(drawnGrouping(byDavid).grouping, byDavid);
  assert.equal(drawnGrouping(byClaude).grouping.links.length, 0);
  assert.equal(pandDesign(face, 'A', description, edits, byClaude).design.fronts[0].storeys, 3);
  assert.equal(pandDesign(face, 'A', description, edits, byDavid).design.fronts[0].storeys, 4);
  assert.match(pandDesign(face, 'A', description, edits, byClaude).notes.join(' '), /Claude's guess/);
});

test('relieving heads: a read relieving head draws the brick ring (with its white key / feet as read); absent: as before', async () => {
  const { headGrammarOf, headPieces, headRise } = await import('../houseLine/headGrammar.ts');
  const { plotHeads } = await import('../designUnits/plotPlan.ts');
  assert.deepEqual(plotHeads({ src: 'photo', headShape: 'relieving' }), { dressing: 'relieving-arch', shape: 'flat' });
  assert.deepEqual(plotHeads({ src: 'photo', headShape: 'relieving', whiteHeads: 'blocks' }), { dressing: 'relieving-blocks', shape: 'flat' });
  assert.deepEqual(plotHeads({ src: 'photo', headShape: 'relieving', whiteHeads: 'band' }), { dressing: 'stone-lintel', shape: 'flat' });
  // Unchanged: the other shapes and the tablet.
  assert.deepEqual(plotHeads({ src: 'photo', headShape: 'segmental', whiteHeads: 'blocks' }), { dressing: 'voussoirs', shape: 'segmental' });
  assert.deepEqual(headGrammarOf('tablet', 'relieving'), { shape: 'flat', tablet: true, relieving: true });
  const plain = headGrammarOf('relieving-arch', 'flat')!, keyed = headGrammarOf('relieving-blocks', 'flat')!;
  const p = headPieces(plain, 0, 1.1, 10), k = headPieces(keyed, 0, 1.1, 10);
  assert.ok(p.length >= 8 + 5 && p.every(x => x.tone !== 'white'), 'a brick ring only');
  assert.equal(k.filter(x => x.tone === 'white').length, 3, 'a key and two feet');
  assert.ok(headRise(keyed, 1.1) > headRise(plain, 1.1) && headRise(plain, 1.1) > 0.2);
  assert.equal(headGrammarOf('none', 'relieving'), null);
  assert.deepEqual(plotHeads({ src: 'photo', headShape: 'flat', whiteHeads: 'blocks' }), { dressing: 'block-surround', shape: 'flat' });
  assert.deepEqual(plotHeads({ src: 'photo', headShape: 'segmental', whiteHeads: 'band' }), { dressing: 'arched-frame', shape: 'segmental' });
  assert.deepEqual(plotHeads({ src: 'photo', headShape: 'flat', whiteHeads: 'band' }), { dressing: 'stone-lintel', shape: 'flat' });
});
