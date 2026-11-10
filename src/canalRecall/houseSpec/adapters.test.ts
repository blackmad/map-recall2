// Adapters on real records from the repo (house line H1, docs/house-line.md §1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateBlockFace } from '../blockFace/intent.ts';
import { defaulted, measured } from '../facade/evidence.ts';
import { unobservedHouse } from '../facade/houseRecord.ts';
import { registerFactsFromExtract } from '../facade/registerRecipe.ts';
import { asLimit, fromBlockFace, fromHouseRecord, fromJev, fromRecipeIntent, fromRegisterFacts } from './adapters.ts';
import { validateSpec } from './spec.ts';
import { resolveSpecs } from './resolve.ts';

const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

test('fromBlockFace: the face design with the strip as receipt; limits that name the pand', () => {
  const face = validateBlockFace(json('scripts/block-face/faces/evertsen-152-160/intent.json'));
  const spec = fromBlockFace(face, 'NL.IMBAG.Pand.0363100012113386')!;
  validateSpec(spec);
  assert.equal(spec.pandId, '0363100012113386');
  assert.deepEqual(spec.provenance[''], { source: 'streetlevel-measured', confidence: 0.85, ref: 'scripts/block-face/faces/evertsen-152-160/strip.json', at: '2024-12-06' });
  assert.ok(spec.design.fronts?.length && spec.design.palette && spec.design.roof);
  // rhythm.schemaLimits of this house (legacy strings) become {component, what}; a line without a component is `facade`.
  assert.ok(spec.schemaLimits?.some(l => l.component === 'facade' && l.what.startsWith('the white oriel')), JSON.stringify(spec.schemaLimits));
  // A face limitation that names no pand is not attributed to any house.
  assert.ok(!spec.schemaLimits?.some(l => l.what.includes('coffeeshop sign')));
  assert.equal(fromBlockFace(face, '0363100000000000'), null);
  assert.deepEqual(asLimit('113386: oriel: the white corner oriel'), { component: 'oriel', what: 'the white corner oriel' });
  assert.deepEqual(asLimit('a tree hides the raised end above 12.3 m: no top window'), { component: 'facade', what: 'a tree hides the raised end above 12.3 m: no top window' });
});

test('fromRecipeIntent: canal-house intents only, their sources as provenance', () => {
  const spec = fromRecipeIntent(json('scripts/building-recipes/houses/bilder-079721/intent.json'))!;
  validateSpec(spec);
  assert.equal(spec.pandId, '0363100012079721');
  assert.equal(spec.provenance[''].ref, 'scripts/building-recipes/houses/bilder-079721/intent.json#pano-2025-07-31');
  assert.equal(spec.provenance[''].at, '2025-07-31');
  assert.equal(spec.design.fronts?.[0]?.gable, 'cornice');
  assert.equal(fromRecipeIntent({ kind: 'large', id: 'x', pandId: '0363100012079721' } as any), null);
});

test('fromHouseRecord: Dutch gable words, only observed fields, each with its own receipt', () => {
  const r = unobservedHouse('NL.IMBAG.Pand.0363100012182848');
  const obs = { id: 'pano-x', capturedAt: '2023-06-01' };
  r.gable = measured('klok', 'streetlevel-measured', 0.9, obs);
  r.bays = measured(3, 'streetlevel-measured', 0.8, obs);
  r.hoistBeam = measured(true, 'streetlevel-measured', 0.7, obs);
  r.corniceType = measured({ kind: 'kroonlijst', depthM: 0.4, brackets: 4 }, 'monument-text', 0.6, { id: 'rce:3853', capturedAt: '2020-01-01' });
  r.storeys = defaulted(4);
  const spec = validateSpec(fromHouseRecord(r));
  assert.deepEqual(spec.design.fronts?.[0], { gable: 'bell', bays: 3, hoist: true, cornice: 'heavy' });
  assert.equal(spec.provenance['fronts/0/gable'].ref, 'pano-x');
  assert.equal(spec.provenance['fronts/0/cornice'].source, 'monument-text');
  assert.equal(spec.provenance['fronts/0/storeys'], undefined, 'a defaulted field is not evidence');
  for (const [word, intent] of [['trap', 'step'], ['hals', 'neck'], ['verhoogde-hals', 'raised-neck'], ['tuit', 'spout'], ['punt', 'point'], ['lijst', 'cornice']] as const) {
    r.gable = measured(word, 'streetlevel-measured', 0.9, obs);
    assert.equal(fromHouseRecord(r).design.fronts?.[0]?.gable, intent);
  }
});

test('fromRegisterFacts: the Nieuwmarkt 20-22 register entry (RCE 3856)', () => {
  const facts = registerFactsFromExtract(json('public/data/extracts/amsterdam/monument-facts.json'));
  const id = 'NL.IMBAG.Pand.0363100012182857', f = facts.get(id)!;
  const spec = validateSpec(fromRegisterFacts(f, f.nr, id));
  assert.equal(spec.design.fronts?.[0]?.gable, 'step');
  assert.equal(spec.facts?.facadeYear, 1605);
  assert.equal(spec.provenance['fronts/0/gable'].source, 'monument-text');
  assert.equal(spec.provenance['fronts/0/gable'].ref, 'rce:3856');
  // A stone front cannot be said by palette.wallMaterial: a schema limit, not the nearest option.
  const stone = fromRegisterFacts({ finish: 'stone', gable: 'cornice' }, '1', id);
  assert.equal(stone.design.palette, undefined);
  assert.equal(stone.schemaLimits![0].component, 'palette');
  assert.match(stone.schemaLimits![0].what, /^register finish stone/);
  const el = fromRegisterFacts({ elements: [{ key: 'hoistBeam', term: 'hijsbalk' }, { key: 'stoop', term: 'stoep' }] }, '2', id);
  assert.equal(el.design.fronts?.[0]?.hoist, true);
  assert.equal(el.design.fronts?.[0]?.basement, 'stoop');
  assert.deepEqual(el.facts?.elements, ['hoist-beam', 'stoop']);
});

test('fromJev: vision-judge receipts, confident gables only, weak answers dropped', () => {
  const spec = validateSpec(fromJev({ pandId: '0363100012182848', crop: 'source-data://pand-crops/0363100012182848/front.jpg', capturedAt: '2024-03-02',
    bays: { value: 3, p: 0.92 }, pui: { value: 'shop', p: 0.4 }, gable: { value: 'bell', p: 0.9, confident: false }, finish: { value: 'brick', p: 0.85 } }));
  assert.equal(spec.design.fronts?.[0]?.bays, 3);
  assert.equal(spec.design.fronts?.[0]?.gable, undefined, 'an unconfident gable is not read');
  assert.equal(spec.facts?.pui, undefined, 'p 0.4 is under JEV_MIN_P');
  assert.equal(spec.provenance['fronts/0/bays'].source, 'vision-judge');
  assert.equal(spec.provenance['fronts/0/bays'].confidence, 0.92);
  // Merged with the register: the register gable stays, the judge's bays fill the gap.
  const register = fromRegisterFacts({ gable: 'bell' }, '3853', '0363100012182848');
  const out = resolveSpecs([register, spec]);
  assert.equal(out.design.fronts?.[0]?.gable, 'bell');
  assert.equal(out.design.fronts?.[0]?.bays, 3);
});

test('fromBlockFace: a1 object limits {component, what} (the shape on lane/belt-haarlemmer-20261110)', () => {
  // a1's belt faces carry face-level `schemaLimits: [{component, what}]` naming pands by their last six digits
  // (haarlemmer-46-96-r1: "54 (171144) and 52 (171145): sandstone scrolls…"). Main's faces do not yet, so the same
  // shape is put on a main face here: one limit per pand, one naming two pands, one naming none (face-wide).
  const face = validateBlockFace({ ...json('scripts/block-face/faces/evertsen-152-160/intent.json'), schemaLimits: [
    { component: 'gable ornament', what: '160 (065375) and 158 (144634): sandstone scrolls on the crowns; drawn plain' },
    { component: 'ground storey', what: '158 (144634): two tall arched windows and a portal; drawn with a door and plain windows' },
    { component: 'roof', what: 'a continuous zinc gutter along the row; not drawn' },
  ] });
  const first = fromBlockFace(face, '0363100012065375')!, second = fromBlockFace(face, '0363100012144634')!, last = fromBlockFace(face, '0363100012113386')!;
  validateSpec(first); validateSpec(second); validateSpec(last);
  // (Houses may also carry their type's legacy rhythm strings, filed under `facade`.)
  const own = (s: typeof first) => s.schemaLimits?.map(l => l.component).filter(c => c !== 'facade');
  assert.deepEqual(own(first), ['gable ornament', 'roof']);
  assert.deepEqual(own(second), ['gable ornament', 'ground storey', 'roof']);
  assert.match(second.schemaLimits!.find(l => l.component === 'ground storey')!.what, /two tall arched windows/);
  // The last house: its own legacy rhythm strings (filed under facade) plus the face-wide roof limit.
  assert.deepEqual([...new Set(last.schemaLimits?.map(l => l.component))], ['facade', 'roof']);
});

test('limits: legacy strings and objects read the same way', () => {
  const a = { ...fromRegisterFacts({}, '1', '0363100012182857'), schemaLimits: [asLimit('oriel: the white corner oriel')] };
  const b = { ...fromRegisterFacts({}, '1', '0363100012182857'), schemaLimits: [{ component: 'oriel', what: 'the white corner oriel' }] };
  assert.deepEqual(a.schemaLimits, b.schemaLimits);
  assert.deepEqual(resolveSpecs([a, b]).schemaLimits, [{ component: 'oriel', what: 'the white corner oriel' }]);
});
