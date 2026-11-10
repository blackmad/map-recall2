// The generic path reads HouseSpecs (house line H1 step 5): flag, decorator steps, enricher, bay fitting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { houseSpecEnricher, houseSpecPatch, houseSpecsEnabled, SPEC_BAYS_HELD, withHouseSpec, withHouseSpecCrown, type HouseSpecView } from './decorate.ts';
import { gameFeatureDecorator } from '../galleryPipeline.ts';
import { frontageLayoutScale, specCellCount } from '../streetFacadeRendering.ts';
import { layoutWall } from '../facadeLayout.ts';
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
  // Spec bays are held too (SPEC_BAYS_HELD, #348): while both are held a spec writes no recipe.
  assert.deepEqual(houseSpecPatch(measured, { constructionYear: 1680 }).specRecipe, SPEC_BAYS_HELD ? undefined : { bays: 3, period: 'canal', crownShape: 'neck' });
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
  assert.deepEqual(out.specRecipe, SPEC_BAYS_HELD ? undefined : { bays: 3, period: 'canal', crownShape: 'plain' });
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
  // An odd count on 2-axis cells draws the even number below (3 -> 2 columns, 5 -> 4), never the one above (H1b, #349).
  assert.equal(specCellCount(3, 2, 8, STYLE_DIMS.canal.bay), 1);
  assert.equal(specCellCount(5, 2, 12, STYLE_DIMS.canal.bay), 2);
  // Cells no narrower than MIN_COLUMN_M per column: 6 bays on 3-axis cells over a narrow 5 m front is one cell.
  assert.equal(specCellCount(6, 3, 5, STYLE_DIMS.canal.bay), 1);
  // 1-axis cells carry any count exactly, down to the reach of the clamp (3 m cannot hold 6 cells).
  assert.equal(specCellCount(3, 1, 12, STYLE_DIMS.canal.bay), 3);
  assert.equal(specCellCount(6, 1, 3, STYLE_DIMS.canal.bay), 1);
});

// Three pands from the 2026-11-10 spot-check (#348), front length from measure.json `wall.lengthM`. The upper-storey
// columns the mesher draws are layoutWall's cells x the cell's axes. Photo counts: measureFacade on the crop (9901: 3)
// and hand-grid counts (4833: 2, 9665: 3). Before the fix the drawn counts were 6, 4 and 4.
const doubling = [
  { pand: '0363100012169901', style: 'canal', front: 8.85, bays: 5, axes: 2, photo: 3, was: 6 },
  { pand: '0363100012174833', style: 'c19', front: 5.08, bays: 3, axes: 2, photo: 2, was: 4 },
  { pand: '0363100012179665', style: 'canal', front: 5.7, bays: 3, axes: 2, photo: 3, was: 4 },
] as const;
for (const c of doubling) test(`bays: ${c.pand} draws the photo's ${c.photo} columns or the nearest the 2-axis cell reaches, never a doubling`, () => {
  const s = frontageLayoutScale(undefined, { bay: 1.03, storey: 1, ground: 1 }, c.style, c.front, { bays: c.bays, axesPerCell: c.axes });
  const drawn = layoutWall(c.style, c.front, 12, 0.3, true, s)!.bays * c.axes;
  assert.ok(drawn < c.photo * 1.5, `${drawn} columns against a photo of ${c.photo}`);
  assert.ok(drawn < c.was, `${drawn} must be fewer than the ${c.was} the cell rounding drew`);
  // 2-axis cells draw even counts: the nearest to the photo is photo or photo + 1 (odd photo counts are a cell limit).
  assert.ok(Math.abs(drawn - c.photo) <= 1, `${drawn} vs ${c.photo}`);
  assert.ok(drawn <= c.bays, 'the drawn columns never exceed the stated bays');
});
