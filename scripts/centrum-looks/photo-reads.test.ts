// The Centrum colour + crown reader v2 (round 5: grey-brown fronts drawn red-brown; Lindengracht 168662, Palmstraat 168635).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeColour, mergeSecond, parseReads2, UNSTATED } from './photo-reads.ts';

const r = (family: string, confidence: number) => ({ family, confidence, finish: 'brick', reader: 't' });

test('parseReads2 reads colour and crown fields', () => {
  const m = parseReads2('0363100012170176 brick brown-brick 0.8 cornice simple 4 n 0.85 0.8\n0363100012168300 unclear unclear 0.3 not-visible not-visible nv nv 0.5 0.5 \n');
  assert.deepEqual({ ...m.get('0363100012170176'), reader: '' }, { finish: 'brick', family: 'brown-brick', confidence: 0.8, reader: '', crown: 'cornice', cornice: 'simple', full: 4, souterrain: false, cc: 0.85, sc: 0.8 });
  assert.equal(m.get('0363100012168300')!.full, null);
});

test('v1 red-brown against v2 brown is left unstated', () => {
  const m = mergeColour(r('red-brown-brick', 0.75), r('brown-brick', 0.75));
  assert.equal(m.confidence, UNSTATED);
});

test('v2 stands when confident; a confident v1 fills a weak v2', () => {
  assert.equal(mergeColour(r('brown-brick', 0.75), r('red-brown-brick', 0.8)).pick!.family, 'red-brown-brick');
  assert.equal(mergeColour(r('red-brown-brick', 0.8), r('red-brown-brick', 0.6)).pick!.family, 'red-brown-brick');
  assert.equal(mergeColour(r('red-brown-brick', 0.8), undefined).pick!.family, 'red-brown-brick');
  // round 6: two weak readers agreeing on the coarse group state v2's family; v1's red over a weak non-red v2 does not stand
  assert.deepEqual(mergeColour(r('dark-paint', 0.6), r('dark-grey-brick', 0.65)), { pick: r('dark-grey-brick', 0.65), rule: 'v1 and v2 agree weakly', confidence: 0.7 });
  assert.equal(mergeColour(r('red-brown-brick', 0.8), r('purple-brown-brick', 0.6)).confidence, UNSTATED);
  assert.equal(mergeColour(r('white-paint', 0.5), r('cream-paint', 0.5)).rule, 'below the bar');
});

test('a second capture settles a doubt only when confident', () => {
  assert.deepEqual(mergeSecond({ family: 'brown-brick', confidence: UNSTATED, v1Family: 'red-brown-brick' }, r('red-brown-brick', 0.8)), { family: 'red-brown-brick', confidence: 0.8, rule: 'second capture reads red' });
  // the same brown-leaning reader on another date is no news for the red/brown doubt
  assert.equal(mergeSecond({ family: 'brown-brick', confidence: UNSTATED, v1Family: 'red-brown-brick' }, r('brown-brick', 0.8)).confidence, UNSTATED);
  assert.equal(mergeSecond({ family: 'white-paint', confidence: 0.6 }, r('white-paint', 0.85)).confidence, 0.85);
  assert.equal(mergeSecond({ family: 'brown-brick', confidence: 0.8 }, r('dark-paint', 0.8)).confidence, UNSTATED);
  assert.equal(mergeSecond({ family: 'brown-brick', confidence: 0.8 }, r('dark-paint', 0.6)).confidence, 0.8);
});

test('a confident photo cornice overrules a register gable (round 4: gables invented on flat-cornice rows)', async () => {
  const { photoOverRegisterGable } = await import('./generate.ts');
  assert.equal(photoOverRegisterGable('neck', { crown: 'cornice', cc: 0.85 }), true);   // Jordaan 170212
  assert.equal(photoOverRegisterGable('bell', { crown: 'flat', cc: 0.75 }), true);
  assert.equal(photoOverRegisterGable('neck', { crown: 'cornice', cc: 0.7 }), false);
  assert.equal(photoOverRegisterGable('neck', { crown: 'mansard', cc: 0.9 }), false);
  assert.equal(photoOverRegisterGable('cornice', { crown: 'flat', cc: 0.9 }), false);
  assert.equal(photoOverRegisterGable(undefined, { crown: 'cornice', cc: 0.9 }), false);
});

test('a brick family read stands under a register that states only brick (Lindengracht 172512)', async () => {
  const { photoFamily } = await import('./generate.ts');
  const red = { finish: 'brick', family: 'red-brown-brick', confidence: 0.85, reader: 't' };
  assert.equal(photoFamily(red, 'brick'), 'red-brown-brick');
  assert.equal(photoFamily(red, 'painted'), undefined);
  assert.equal(photoFamily({ ...red, family: 'white-paint' }, 'brick'), undefined);
  assert.equal(photoFamily({ ...red, confidence: 0.6 }, undefined), undefined);
});

test('round 6: the draw takes the confident reads mix; the gable foot pitch is the p25 of AHN tops over photo storeys', async () => {
  const { photoMix, gableFootPitch } = await import('./generate.ts');
  const fb = { before1860: { 'red-brown-brick': 0.45, 'orange-red-brick': 0.15, 'brown-brick': 0.4 }, from1860: { 'brown-brick': 1 } };
  const reads = [...Array(9)].map(() => ({ year: 1700, family: 'brown-brick' as const })).concat([{ year: 1700, family: 'purple-brown-brick' as const }, { year: 1700, family: 'painted-black' as never }]);
  const m = photoMix(reads, fb, 10);
  assert.deepEqual(m.before1860, { 'brown-brick': 0.9, 'purple-brown-brick': 0.1 });   // paint counted out, no orange
  assert.equal(m.from1860, fb.from1860);                                               // no reads: the fallback
  const ahn = new Map([...Array(40)].map((_, i) => [`p${i}`, { n: 30, p50: 13, p90: 14 + (i % 4) * 0.4, max: 15 }] as [string, any]));
  const pr = [...ahn.keys()].map(k => [k, { crown: 'cornice', cc: 0.8, sc: 0.8, full: 4, souterrain: false }] as [string, any]);
  assert.equal(gableFootPitch(pr, ahn)!.pitch, 3.5);
  assert.equal(gableFootPitch(pr.slice(0, 10), ahn), null);
});
