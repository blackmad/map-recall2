// The four house:describe writers, the merge and the crop tiers on fixtures: no network, no key (house line H5).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { decodeDescriptor } from '../../bagTiles.ts';
import { registerFactsFromExtract } from '../../facade/registerRecipe.ts';
import { validateSpec, specField } from '../spec.ts';
import { BAG_WRITES_STOREYS, bagStoreys, bagWriter } from './bag.ts';
import { registerWriter } from './register.ts';
import { PIXEL_BAYS, PIXEL_WRITES_STOREYS, pixelSpec, storeysFromPitch } from './pixel.ts';
import { Budget, JEV, askJev, costOf, cropHash, judgementOf, jevSpec, parseResponse, requestBody } from './jev.ts';
import { mergeWriters } from './merge.ts';
import { bestCrop, tierOf } from '../../../../scripts/house-specs/tier.ts';
import { emptySpec, setSpecField } from '../spec.ts';

const fx = (f: string) => JSON.parse(readFileSync(path.join(import.meta.dirname, 'fixtures', f), 'utf8'));
const WALL_TRIM = path.join(import.meta.dirname, '../../buildingRecipe/fixtures/wall-trim');

// --- register ---------------------------------------------------------------------------------------------------------
test('register writer: a listed pand\'s gable, facade year and elements, monument-text with the rce ref; unlisted -> null', () => {
  const facts = registerFactsFromExtract({ buildings: { 'NL.IMBAG.Pand.0363100012100001': { nr: ['598', '518376'], elements: [{ key: 'hoistBeam', term: 'hijsbalk' }], facadeDate: { from: 1765, to: 1765, confidence: 'exact', term: '1765' }, gable: 'neck' } as any } });
  const s = registerWriter('NL.IMBAG.Pand.0363100012100001', facts)!;
  validateSpec(s);
  assert.equal(specField(s, 'fronts/0/gable'), 'neck');
  assert.equal(specField(s, 'facts/facadeYear'), 1765);
  assert.equal(specField(s, 'fronts/0/hoist'), true);
  assert.deepEqual(s.provenance['fronts/0/gable'], { source: 'monument-text', confidence: 0.8, ref: 'rce:598', at: null });
  assert.equal(registerWriter('0363100012100002', facts), null);
});

// --- bag --------------------------------------------------------------------------------------------------------------
test('bag writer: year (bag 0.5) from the descriptor; storeys off by measurement (H5h); bagStoreys offsets; an implausible year is dropped', () => {
  const d = decodeDescriptor([2, 4, 3, 93, 129, 1890, 1]);
  const s = bagWriter('0363100012164995', d, '2026-11-10')!;
  validateSpec(s);
  assert.equal(specField(s, 'facts/facadeYear'), 1890);
  assert.equal(s.provenance['facts/facadeYear'].source, 'bag');
  assert.equal(BAG_WRITES_STOREYS, false);
  assert.equal(specField(s, 'fronts/0/storeys'), undefined, 'BAG storeys 0.43 (0.55 with offsets) on the hand set: under 0.80, dropped');
  assert.equal(bagStoreys(d), 4);
  assert.equal(bagStoreys(d, { pitched: true }), 3, 'roof code 3 = slanted: -1');
  assert.equal(bagStoreys(d, { pitched: true, souterrain: true }), 2);
  assert.equal(bagStoreys(decodeDescriptor([2, 4, 1, 93, 129, 1890, 1]), { pitched: true }), 4, 'a flat roof takes no pitched offset');
  assert.equal(bagStoreys(decodeDescriptor([2, 1, 3, 30, 60, 1890, 1]), { pitched: true, souterrain: true }), 1, 'never below 1');
  assert.equal(bagStoreys(decodeDescriptor([0, 1, 0, 0, 0, 1005, 0])), undefined, 'no height, no count');
  const noHeights = bagWriter('0363100012164995', decodeDescriptor([0, 1, 0, 0, 0, 1005, 0]));
  assert.equal(noHeights, null, 'year 1005 is a placeholder');
  assert.equal(bagWriter('0363100012164995', undefined), null);
});

// --- pixel ------------------------------------------------------------------------------------------------------------
async function fixtureCrop(name: string) {
  const c = JSON.parse(readFileSync(path.join(WALL_TRIM, 'cases.json'), 'utf8')).find((x: { name: string }) => x.name === name);
  const { data, info } = await sharp(path.join(WALL_TRIM, c.file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { image: { rgb: new Uint8Array(data), width: info.width, height: info.height, ppm: c.ppm as number }, wallTopM: c.box.v1 as number };
}
test('pixel writer on the AB07 168006 crop (black front, white frames): a dark wall colour, bays only on a good crop, storeys off', async () => {
  const { image, wallTopM } = await fixtureCrop('ab07-168006-dark');
  const base = { pandId: '0363100012168006', image, wallTopM, ref: 'fixture:ab07-168006', at: '2021-03-17' };
  const good = pixelSpec({ ...base, tier: 'good' })!, fallback = pixelSpec({ ...base, tier: 'fallback' })!;
  validateSpec(good); validateSpec(fallback);
  const hex = specField(good, 'palette/brick') as string;
  const l = (parseInt(hex.slice(1, 3), 16) * 0.299 + parseInt(hex.slice(3, 5), 16) * 0.587 + parseInt(hex.slice(5, 7), 16) * 0.114) / 255;
  assert.ok(l < 0.35, `a black painted front reads dark, got ${hex}`);
  assert.equal(good.provenance['palette/brick'].source, 'streetlevel-measured');
  assert.equal(good.provenance['palette/brick'].confidence, 0.55);
  assert.equal(fallback.provenance['palette/brick'].confidence, 0.45, 'fallback tier: lower confidence');
  assert.match(good.provenance['palette/brick'].ref, /#good$/);
  assert.match(fallback.provenance['palette/brick'].ref, /#fallback$/);
  assert.equal(specField(fallback, 'fronts/0/bays'), undefined, 'a fallback crop never writes bays');
  assert.equal(specField(fallback, 'palette/wallMaterial'), undefined);
  assert.equal(PIXEL_WRITES_STOREYS, false);
  assert.equal(specField(good, 'fronts/0/storeys'), undefined);
});
test('pixel writer abstains on a crop too small to measure; storeysFromPitch needs a resolved plausible pitch', () => {
  assert.equal(pixelSpec({ pandId: '0363100012168006', image: { rgb: new Uint8Array(30), width: 5, height: 2, ppm: 50 }, tier: 'good', wallTopM: 10, ref: 'x', at: null }), null);
  assert.equal(storeysFromPitch({ storeyM: 3, pitchM: 2, pitchScore: 0.1 }, 12), null, 'unresolved pitch');
  assert.equal(storeysFromPitch({ storeyM: 5, pitchM: 2, pitchScore: 0.9 }, 12), null, 'implausible pitch');
  assert.equal(storeysFromPitch({ storeyM: 2.9, pitchM: 2, pitchScore: 0.9 }, 9.3), 3);
  assert.equal(PIXEL_BAYS.minPitchScore, 0.6);
});

// --- jev --------------------------------------------------------------------------------------------------------------
const choice = (c: string, probs: Record<string, number>) => ({ choice: c, probabilities: probs });
test('jev: the request carries the fixture questions and the image asset, never a key', () => {
  const body = requestBody('abc-facade');
  assert.equal(body.model, 'jev-1.14.0');
  assert.deepEqual(Object.keys(body.questions).sort(), ['bays', 'finish', 'gable', 'shopfront']);
  assert.deepEqual(body.assets, { 'abc-facade': { type: 'image', part: 'facade' } });
  assert.ok(!/bearer|api[_-]?key|authorization/i.test(JSON.stringify(body)));
  assert.equal(JEV.thresholds.bays, 0.55); assert.equal(JEV.thresholds.gable, 0.75); assert.equal(JEV.thresholds.finish, 0.9); assert.equal(JEV.thresholds.pui, 0.875);
});
test('jev: a recorded response parses; thresholds decide what is written; gable only for the classes the fixture allows', () => {
  const parsed = parseResponse(fx('jev-response.json'));
  assert.equal(parsed.tokens, 7343 + 379);
  assert.ok(parsed.answers.gable && parsed.answers.bays);
  // bays: three at p 0.41 is below 0.55 -> not written; at 0.7 it is
  assert.equal(judgementOf('0363100012065375', 'c', null, parsed.answers).bays, undefined);
  const sure = { bays: choice('three', { one: 0, two: 0.1, three: 0.7, four: 0.2, five: 0 }), gable: choice('step', { neck: 0, bell: 0, step: 0.9, cornice: 0.05, spout: 0, plain: 0.05 }), finish: choice('painted brick', { brick: 0.05, 'painted brick': 0.93, plaster: 0.02, stone: 0, mixed: 0 }), shopfront: { noul: 0.05 } };
  const s = jevSpec('0363100012065375', 'source-data://x', '2024-12-16', sure);
  validateSpec(s);
  assert.equal(specField(s, 'fronts/0/bays'), 3);
  assert.equal(specField(s, 'fronts/0/gable'), 'step');
  assert.equal(specField(s, 'palette/wallMaterial'), 'painted-brick');
  assert.equal(specField(s, 'facts/pui'), 'residential');
  assert.equal(s.provenance['fronts/0/bays'].source, 'vision-judge');
  assert.equal(s.provenance['fronts/0/bays'].confidence, 0.7);
  assert.equal(s.provenance['fronts/0/bays'].at, '2024-12-16');
  // a cornice at p 0.98 is NOT written (it contradicted the register on AB07 canal fronts); neck and bell neither
  for (const g of ['cornice', 'neck', 'bell'] as const) assert.equal(judgementOf('0363100012065375', 'c', null, { gable: choice(g, { [g]: 0.98 }) }).gable, undefined, g);
  assert.equal(judgementOf('0363100012065375', 'c', null, { gable: choice('plain', { plain: 0.8 }) }).gable?.value, 'point');
  assert.equal(judgementOf('0363100012065375', 'c', null, { gable: choice('step', { step: 0.7 }) }).gable, undefined, 'under 0.75');
  // finish under 0.9, stone and mixed are not wall materials; shopfront between 0.125 and 0.875 stays unanswered
  assert.equal(judgementOf('0363100012065375', 'c', null, { finish: choice('brick', { brick: 0.85 }) }).finish, undefined);
  assert.equal(judgementOf('0363100012065375', 'c', null, { finish: choice('stone', { stone: 0.99 }) }).finish, undefined);
  assert.equal(judgementOf('0363100012065375', 'c', null, { shopfront: { noul: 0.7 } }).pui, undefined);
  assert.equal(judgementOf('0363100012065375', 'c', null, { shopfront: { noul: 0.95 } }).pui?.value, 'shop');
});
test('jev: a malformed response is refused, the cache key follows the image bytes, the budget stops at the cap', () => {
  assert.throws(() => parseResponse({ answers: {} }), /malformed/);
  assert.throws(() => parseResponse({}), /malformed/);
  assert.notEqual(cropHash(Buffer.from('a')), cropHash(Buffer.from('b')));
  assert.equal(cropHash(Buffer.from('a')), cropHash(Buffer.from('a')));
  const b = new Budget(0.001); assert.equal(b.exhausted, false);
  b.add(30_000); assert.ok(b.exhausted, `${costOf(30_000)} >= 0.001`);
  assert.equal(new Budget(3, 3).exhausted, true, 'a ledger already at the buurt cap starts exhausted');
});
test('jev: askJev sends the key and the images header in headers only, and returns an auth failure untouched', async () => {
  let seen: { url: string; headers: Record<string, string>; bodyKeys: string[] } | null = null;
  const fake = (async (url: string, init: any) => { seen = { url, headers: init.headers, bodyKeys: [...(init.body as FormData).keys()] }; return new Response(JSON.stringify({ error: 'no' }), { status: 401 }); }) as unknown as typeof fetch;
  const r = await askJev('KEY-FOR-TEST', Buffer.from([1, 2, 3]), 'id-facade', fake);
  assert.equal(r.status, 401);
  assert.equal(seen!.url, 'https://api.typesafe.ai/v1/systemone');
  assert.equal(seen!.headers['TypeSafe-Danger-Zone-Images'], 'true');
  assert.deepEqual(seen!.bodyKeys, ['request', 'facade']);
  const failing = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  assert.equal((await askJev('k', Buffer.from([1]), 'i', failing)).status, 0);
});

// --- merge and tiers --------------------------------------------------------------------------------------------------
test('merge: the stronger source wins, both values are logged, and a field one writer states is not a disagreement', () => {
  const reg = emptySpec('0363100012164995'); setSpecField(reg, 'fronts/0/gable', 'neck'); reg.provenance['fronts/0/gable'] = { source: 'monument-text', confidence: 0.8, ref: 'rce:1', at: null };
  const jev = emptySpec('0363100012164995'); setSpecField(jev, 'fronts/0/gable', 'step'); jev.provenance['fronts/0/gable'] = { source: 'vision-judge', confidence: 0.9, ref: 'crop', at: '2024-01-01' };
  setSpecField(jev, 'fronts/0/bays', 3); jev.provenance['fronts/0/bays'] = { source: 'vision-judge', confidence: 0.7, ref: 'crop', at: '2024-01-01' };
  const px = emptySpec('0363100012164995'); setSpecField(px, 'fronts/0/bays', 4); px.provenance['fronts/0/bays'] = { source: 'streetlevel-measured', confidence: 0.5, ref: 'crop#good', at: null };
  const m = mergeWriters([{ writer: 'register', spec: reg }, { writer: 'jev', spec: jev }, { writer: 'pixel', spec: px }])!;
  assert.equal(specField(m.spec, 'fronts/0/gable'), 'neck', 'monument-text outranks vision-judge');
  assert.equal(specField(m.spec, 'fronts/0/bays'), 4, 'the ladder puts a measured street photo above a judge');
  assert.deepEqual(m.disagreements.map(d => [d.path, d.picked]), [['fronts/0/bays', 'pixel'], ['fronts/0/gable', 'register']]);
  assert.equal(m.disagreements[0].values.length, 2);
  assert.ok((m.spec.design.notes ?? []).some(n => /fronts\/0\/gable disagrees/.test(n)));
  validateSpec(m.spec);
  assert.equal(mergeWriters([{ writer: 'bag', spec: emptySpec('0363100012164995') }]), null, 'no fields, no spec');
  const same = mergeWriters([{ writer: 'a', spec: jev }, { writer: 'b', spec: jev }])!;
  assert.equal(same.disagreements.length, 0);
});
test('crop tiers: a hard flag is none, the judge decides good against fallback, the best crop ranks tier then quality then year', () => {
  assert.equal(tierOf({ reasons: ['blocked'], quality: 0.9 }), 'none');
  assert.equal(tierOf({ reasons: ['occluder'], quality: 0.6 }), 'good', 'occluder is not a hard flag once judged');
  assert.equal(tierOf({ reasons: [], quality: 0.49 }), 'fallback');
  assert.equal(tierOf({ reasons: [], quality: null }), 'fallback');
  assert.equal(tierOf({ reasons: [], quality: 0.45 }, 0.4), 'good');
  const c = (file: string, year: number, reasons: string[], quality: number | null) => ({ file, year, panoIds: [file], reasons, quality });
  const best = bestCrop([c('a', 2021, [], 0.3), c('b', 2017, [], 0.55), c('c', 2024, ['oblique'], 0.9), c('d', 2022, [], 0.55)])!;
  assert.deepEqual([best.crop.file, best.tier], ['d', 'good'], 'ties on quality go to the newer year; a hard-flag failure never wins');
  assert.equal(bestCrop([c('x', 2021, ['void'], 0.9)]), null);
});
