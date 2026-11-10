// The generic path reads HouseSpecs (house line H1 step 5): flag, decorator steps, enricher, bay fitting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { houseSpecEnricher, houseSpecPatch, houseSpecsEnabled, withHouseSpec, withHouseSpecCrown, type HouseSpecView } from './decorate.ts';
import { gameFeatureDecorator } from '../galleryPipeline.ts';
import { frontageLayoutScale, SPEC_BAY_SCALE } from '../streetFacadeRendering.ts';
import { STYLE_DIMS } from '../facadeCells.ts';

const feature = (p: Record<string, unknown>) => ({ type: 'Feature' as const, properties: { id: 'NL.IMBAG.Pand.0363100012182857', ...p } as Record<string, unknown>, geometry: null as any });

test('houseSpecsEnabled: default on, ?houseSpecs=0 and HOUSE_SPECS=0 off, the query wins', () => {
  assert.equal(houseSpecsEnabled(''), true);
  assert.equal(houseSpecsEnabled('?a=1&houseSpecs=0'), false);
  assert.equal(houseSpecsEnabled(null, '0'), false);
  assert.equal(houseSpecsEnabled('?houseSpecs=1', '0'), true);
});

test('no spec: the same object back from both steps (byte-identical chain)', () => {
  const f = feature({ constructionYear: 1700, monumentGable: 'bell' });
  assert.equal(withHouseSpec(f), f);
  assert.equal(withHouseSpecCrown(f), f);
  // A kit or a measured front is never touched, as with the register step.
  const kit = feature({ kitWall: 'plain', houseSpec: { gable: 'step', src: { gable: 'reviewed' } } });
  assert.equal(withHouseSpecCrown(kit), kit);
});

test('facts step: era-only year moves, finish, a spec recipe only when the mesher reads something', () => {
  const view: HouseSpecView = { year: 1605, wallMaterial: 'stucco', src: { year: 'monument-text', wallMaterial: 'monument-text' } };
  // BAG 1620 and spec 1605 are both canal era: the year stays (the register step's rule).
  assert.deepEqual(houseSpecPatch(view, { constructionYear: 1620 }), { registerFinish: 'light' });
  assert.deepEqual(houseSpecPatch(view, { constructionYear: 1905 }), { constructionYear: 1605, bagConstructionYear: 1905, registerFinish: 'light' });
  // The register already moved the year: bagConstructionYear keeps the BAG value it recorded.
  assert.deepEqual(houseSpecPatch(view, { constructionYear: 1880, bagConstructionYear: 1905, registerFinish: 'light' }), { constructionYear: 1605 });
  const measured: HouseSpecView = { gable: 'neck', year: 1680, bays: 3, wallHex: '#7A4A3A', src: { bays: 'streetlevel-measured', wallHex: 'streetlevel-measured' } };
  // The measured wall colour is held (SPEC_WALLS_HELD): the recipe carries the bays, crown and period only.
  assert.deepEqual(houseSpecPatch(measured, { constructionYear: 1680 }).specRecipe, { bays: 3, period: 'canal', crownShape: 'neck' });
  assert.equal(houseSpecPatch({ wallHex: '#7a4a3a', src: {} }, {}).specRecipe, undefined, 'a wall colour alone writes no recipe while held');
  assert.equal(houseSpecPatch({ gable: 'neck', src: {} }, {}).specRecipe, undefined);
});

test('crown step: a stronger source than the register text replaces its gable; a weaker one only fills a gap', () => {
  const strip = feature({ monumentGable: 'bell', houseSpec: { gable: 'step', src: { gable: 'streetlevel-measured' } } });
  assert.equal(withHouseSpecCrown(strip).properties.monumentGable, 'step');
  const judge = feature({ monumentGable: 'bell', houseSpec: { gable: 'neck', src: { gable: 'vision-judge' } } });
  assert.equal(withHouseSpecCrown(judge), judge);
  const gap = feature({ houseSpec: { gable: 'raised-neck', src: { gable: 'vision-judge' } } });
  assert.equal(withHouseSpecCrown(gap).properties.monumentGable, 'raisedNeck');
  const flat = feature({ houseSpec: { gable: 'flat', src: { gable: 'reviewed' } } });
  assert.equal(withHouseSpecCrown(flat), flat, 'flat has no roof-planner gable');
});

test('the decorator chain: a spec gable survives withMonumentGable, which would restore the register gable', () => {
  const gables = new Map([['NL.IMBAG.Pand.0363100012182857', 'bell']]) as any;
  const chain = gameFeatureDecorator({ gables });
  const ring = [[4.9, 52.37], [4.90008, 52.37], [4.90008, 52.37012], [4.9, 52.37012], [4.9, 52.37]];
  const base = { type: 'Feature' as const, geometry: { type: 'Polygon', coordinates: [ring] }, properties: { id: 'NL.IMBAG.Pand.0363100012182857', height: 13, constructionYear: 1650 } };
  assert.equal(chain(base as any).properties.monumentGable, 'bell');
  const spec = { ...base, properties: { ...base.properties, houseSpec: { gable: 'step', bays: 3, src: { gable: 'streetlevel-measured', bays: 'streetlevel-measured' } } } };
  const out = chain(spec as any).properties;
  assert.equal(out.monumentGable, 'step');
  assert.deepEqual(out.specRecipe, { bays: 3, period: 'canal', crownShape: 'plain' });
});

test('enricher stamps the runtime view by feature id; a missing tile stamps nothing', async () => {
  const tile = { version: 1, buildings: { 'NL.IMBAG.Pand.0363100012182857': { d: {}, s: {}, r: 'generic', v: { gable: 'step', src: { gable: 'monument-text' } } } } };
  const fetchImpl = (async (url: string) => url.endsWith('/house-specs/14/8414/5384.json.gz') ? new Response(JSON.stringify(tile)) : new Response(null, { status: 404 })) as typeof fetch;
  const e = houseSpecEnricher('file:/x', fetchImpl);
  const features = [{ properties: { id: 'NL.IMBAG.Pand.0363100012182857' } as Record<string, unknown> }, { properties: { id: 'NL.IMBAG.Pand.0363100012182858' } as Record<string, unknown> }];
  (await e({ z: 14, x: 8414, y: 5384 }))!(features);
  assert.deepEqual(features[0].properties.houseSpec, { gable: 'step', src: { gable: 'monument-text' } });
  assert.equal('houseSpec' in features[1].properties, false);
  assert.equal(await e({ z: 14, x: 1, y: 1 }), undefined);
});

test('frontageLayoutScale: a stated bay count fits whole cells to the street run', () => {
  const fallback = { bay: 0.95, storey: 1, ground: 1 };
  assert.deepEqual(frontageLayoutScale(undefined, fallback, 'canal', 8), fallback, 'no bays: unchanged');
  // 4 bays on 2-axis cells over 8 m: 2 cells of 4 m, bay scale 4 / 5.0.
  const s = frontageLayoutScale(undefined, fallback, 'canal', 8, { bays: 4, axesPerCell: 2 });
  assert.equal(s.bay, 8 / 2 / STYLE_DIMS.canal.bay);
  assert.equal(Math.round(8 / (STYLE_DIMS.canal.bay * s.bay)), 2);
  // 3 bays on 2-axis cells round to 2 cells (a generic-cell limit); 6 bays on 3-axis cells over a narrow 5 m front clamp.
  assert.equal(frontageLayoutScale(undefined, fallback, 'canal', 8, { bays: 3, axesPerCell: 2 }).bay, 8 / 2 / STYLE_DIMS.canal.bay);
  assert.equal(frontageLayoutScale(undefined, fallback, 'canal', 5, { bays: 6, axesPerCell: 3 }).bay, Math.max(SPEC_BAY_SCALE.min, 5 / 2 / STYLE_DIMS.canal.bay));
  assert.equal(frontageLayoutScale(undefined, fallback, 'canal', 3, { bays: 6, axesPerCell: 1 }).bay, SPEC_BAY_SCALE.min);
});
