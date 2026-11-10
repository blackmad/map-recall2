// The generic path reads HouseSpecs (house line H1 step 5): flag, decorator steps, enricher, bay fitting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CROWN_RISE_M, crownInGeometry, houseSpecEnricher, houseSpecPatch, houseSpecsEnabled, registerGableMode, REGISTER_GABLE_MODE_DEFAULT, SPEC_BAYS_HELD, withHouseSpec, withHouseSpecCrown, type HouseSpecView, SPEC_WALL_HOLD } from './decorate.ts';
import { gameFeatureDecorator } from '../galleryPipeline.ts';
import { frontageLayoutScale, specCellCount, specStoreyScale } from '../streetFacadeRendering.ts';
import { layoutWall } from '../facadeLayout.ts';
import { FAMILY_TONE, resetSpecWallsFlag, specWallDisplay, specWallSource } from './wallColour.ts';
import { STYLE_DIMS } from '../facadeCells.ts';

const feature = (p: Record<string, unknown>) => ({ type: 'Feature' as const, properties: { id: 'NL.IMBAG.Pand.0363100012182857', ...p } as Record<string, unknown>, geometry: null as any });

test('houseSpecsEnabled: default on, ?houseSpecs=0 and HOUSE_SPECS=0 off, the query wins', () => {
  assert.equal(houseSpecsEnabled(''), true);
  assert.equal(houseSpecsEnabled('?a=1&houseSpecs=0'), false);
  assert.equal(houseSpecsEnabled(null, '0'), false);
  assert.equal(houseSpecsEnabled('?houseSpecs=1', '0'), true);
});

test('no spec: the same object back from both steps (byte-identical chain)', () => {
  const f = feature({ constructionYear: 1700, monumentGable: 'bell', eaves: 9, ridge: 13 });
  assert.equal(withHouseSpec(f), f);
  assert.equal(withHouseSpecCrown(f), f, 'a register gable with a 3DBAG crown above the eaves is drawn as before');
  const bare = feature({ constructionYear: 1700, monumentGable: 'bell' });
  assert.equal(withHouseSpecCrown(bare, 'drawn'), bare, 'drawn (the gate off): byte-identical');
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
  // The measured wall colour reaches the mesher through the wall-colour rule (lane H9; H1 held it).
  assert.deepEqual(houseSpecPatch(measured, { constructionYear: 1680 }).specRecipe, { ...(SPEC_BAYS_HELD ? {} : { bays: 3 }), wallHex: specWallDisplay('#7a4a3a'), period: 'canal', crownShape: 'neck' });
  assert.deepEqual(houseSpecPatch({ wallHex: '#7a4a3a', src: {} }, {}).specRecipe, { wallHex: specWallDisplay('#7a4a3a') }, 'a wall colour alone writes a recipe');
  // SPEC_WALLS=0: the period colour again (the H1 hold); bays (when released) unaffected.
  const env = process.env.SPEC_WALLS;
  process.env.SPEC_WALLS = '0'; resetSpecWallsFlag();
  assert.deepEqual(houseSpecPatch(measured, { constructionYear: 1680 }).specRecipe, SPEC_BAYS_HELD ? undefined : { bays: 3, period: 'canal', crownShape: 'neck' });
  assert.deepEqual(houseSpecPatch({ ...measured, storeys: 4 }, { constructionYear: 1680 }).specRecipe, { ...(SPEC_BAYS_HELD ? {} : { bays: 3 }), storeys: 4, period: 'canal', crownShape: 'neck' }, 'storeys do not depend on bays');
  assert.equal(houseSpecPatch({ wallHex: '#7a4a3a', src: {} }, {}).specRecipe, undefined);
  assert.deepEqual(houseSpecPatch({ wallMaterial: 'painted-brick', wallHex: '#343235', src: {} }, {}).registerFinish, 'light', 'flag off: painted is a light finish');
  if (env === undefined) delete process.env.SPEC_WALLS; else process.env.SPEC_WALLS = env;
  resetSpecWallsFlag();
  // Painted brick with a measured colour keeps brick cells; without one the register's rule (light) stands.
  assert.equal(houseSpecPatch({ wallMaterial: 'painted-brick', wallHex: '#343235', src: {} }, {}).registerFinish, 'brick');
  assert.equal(houseSpecPatch({ wallMaterial: 'painted-brick', src: {} }, {}).registerFinish, 'light');
  // Storeys (lane H9) write a recipe of their own; a one-storey count is ignored.
  assert.deepEqual(houseSpecPatch({ storeys: 4, src: {} }, {}).specRecipe, { storeys: 4 });
  assert.equal(houseSpecPatch({ storeys: 1, src: {} }, {}).specRecipe, undefined);
  assert.equal(houseSpecPatch({ gable: 'neck', src: {} }, {}).specRecipe, undefined);
});

test('crown step: a stronger source than the register text replaces its gable; a weaker one only fills a gap', () => {
  const strip = feature({ monumentGable: 'bell', houseSpec: { gable: 'step', src: { gable: 'streetlevel-measured' } } });
  assert.equal(withHouseSpecCrown(strip).properties.monumentGable, 'step');
  // H5h round 4: a photo reading (a Jev crop judgement) outranks the register for the crown
  const judge = feature({ monumentGable: 'bell', houseSpec: { gable: 'neck', src: { gable: 'vision-judge' } } });
  assert.equal(withHouseSpecCrown(judge).properties.monumentGable, 'neck');
  const gap = feature({ houseSpec: { gable: 'raised-neck', src: { gable: 'vision-judge' } } });
  assert.equal(withHouseSpecCrown(gap).properties.monumentGable, 'raisedNeck');
  const flat = feature({ houseSpec: { gable: 'flat', src: { gable: 'reviewed' } } });
  assert.equal(withHouseSpecCrown(flat), flat, 'flat over no register gable: nothing changes (never a new pitched roof)');
  // A flat front over a register gable takes the cornice crown (lane H9, Raadhuisstraat 0363100012176346).
  const arcade = feature({ monumentGable: 'plain', houseSpec: { gable: 'flat', src: { gable: 'author' } } });
  assert.equal(withHouseSpecCrown(arcade).properties.monumentGable, 'cornice');
  const weak = feature({ monumentGable: 'plain', houseSpec: { gable: 'flat', src: { gable: 'vision-judge' } } });
  // A photo reading of a flat front drops the register gable to historicGable (H5h round 4 gate, merged over H9).
  assert.equal(withHouseSpecCrown(weak).properties.monumentGable, undefined);
  assert.equal(withHouseSpecCrown(weak).properties.historicGable, 'plain');
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

test('register gable gate: drawn only over a 3DBAG crown, else held as historicGable (H5h round 4)', () => {
  // the live tiles have no eaves/ridge: the spec view's crownRiseM stands in
  assert.equal(crownInGeometry({ houseSpec: { crownRiseM: 3.1, src: {} } }), true); assert.equal(crownInGeometry({ houseSpec: { crownRiseM: 0.4, src: {} } }), false);
  assert.equal(REGISTER_GABLE_MODE_DEFAULT, 'gated');
  assert.equal(registerGableMode(''), 'gated'); assert.equal(registerGableMode('?registerGable=drawn'), 'drawn'); assert.equal(registerGableMode(null, 'hint'), 'hint'); assert.equal(registerGableMode('?registerGable=bogus'), 'gated');
  // hint: every register gable, a cornice too, is kept as historicGable and not drawn
  assert.equal(withHouseSpecCrown(feature({ monumentGable: 'cornice', eaves: 9, ridge: 14 }), 'hint').properties.historicGable, 'cornice');
  assert.equal(CROWN_RISE_M, 2);
  assert.equal(crownInGeometry({ eaves: 9, ridge: 11 }), true); assert.equal(crownInGeometry({ eaves: 9, ridge: 10.9 }), false); assert.equal(crownInGeometry({ eaves: 9 }), null);
  // flat top: the raised register gable is held, the chain draws the front as without the register
  const flat = withHouseSpecCrown(feature({ monumentGable: 'bell', eaves: 12, ridge: 12.6 })).properties;
  assert.equal(flat.monumentGable, undefined); assert.equal(flat.historicGable, 'bell');
  // a cornice needs no crown: always drawn
  const cornice = feature({ monumentGable: 'cornice', eaves: 12, ridge: 12.2 });
  assert.equal(withHouseSpecCrown(cornice), cornice);
  // no ridge in the tile and no footprint to plan: held
  assert.equal(withHouseSpecCrown(feature({ monumentGable: 'neck' })).properties.historicGable, 'neck');
  // a register-sourced spec gable is gated the same way; a photo gable is not
  const reg = withHouseSpecCrown(feature({ eaves: 12, ridge: 12.5, houseSpec: { gable: 'neck', src: { gable: 'monument-text' } } })).properties;
  assert.equal(reg.monumentGable, undefined); assert.equal(reg.historicGable, 'neck');
  const photo = withHouseSpecCrown(feature({ monumentGable: 'bell', eaves: 12, ridge: 12.5, houseSpec: { gable: 'step', src: { gable: 'vision-judge' } } })).properties;
  assert.equal(photo.monumentGable, 'step');
  // a photo front with no planner gable (flat) drops the register's, which is kept as historicGable
  const photoFlat = withHouseSpecCrown(feature({ monumentGable: 'bell', eaves: 9, ridge: 14, houseSpec: { gable: 'flat', src: { gable: 'reviewed' } } })).properties;
  assert.equal(photoFlat.monumentGable, undefined); assert.equal(photoFlat.historicGable, 'bell');
});

test('specStoreyScale: a stated storey count sets the pitch layoutWall draws; out of range keeps the style', () => {
  // 13.9 m of canal wall: the style draws ground + 4 (3.1 m storeys at scale 1); 4 storeys stated -> ground + 3.
  const exposed = 13.9, scale = specStoreyScale('canal', exposed, 4, 1)!;
  assert.ok(scale > 1);
  assert.equal(layoutWall('canal', 6, exposed, 0.5, true, { bay: 1, storey: scale, ground: 1 })!.storeys + 1, 4);
  const s = frontageLayoutScale(undefined, { bay: 1, storey: 1, ground: 1 }, 'canal', 6, { axesPerCell: 2, storeys: 4, exposedM: exposed });
  assert.equal(s.storey, scale);
  assert.equal(specStoreyScale('canal', exposed, 12, 1), null, '12 storeys on 13.9 m: under the pitch floor');
  assert.equal(specStoreyScale('canal', exposed, 1, 1), null);
});

test('trim misread: a reader family and a brick finish turn a pale reading into the family tone (Nieuwmarkt 182857)', () => {
  const view: HouseSpecView = { wallHex: '#ceb8ae', wallMaterial: 'brick', wallFamily: 'red', src: { wallHex: 'streetlevel-measured', wallFamily: 'reviewed' } };
  assert.equal((houseSpecPatch(view, { id: 'NL.IMBAG.Pand.0363100012182857' }).specRecipe as { wallHex?: string } | undefined)?.wallHex, specWallDisplay(FAMILY_TONE.red, { fromPixel: false }));
  // The register's brick finish stands in for a spec material.
  assert.equal((houseSpecPatch({ wallHex: '#e8dccb', src: {} }, { registerFinish: 'brick' }).specRecipe as { wallHex?: string } | undefined)?.wallHex, specWallDisplay(specWallSource('#e8dccb', { brick: true }).hex, { fromPixel: false }));
  assert.equal((houseSpecPatch({ wallHex: '#e8dccb', src: {} }, {}).specRecipe as { wallHex?: string } | undefined)?.wallHex, specWallDisplay('#e8dccb'), 'no finish, no family: the pixel');
  assert.equal(SPEC_WALL_HOLD.size, 0, 'no pand wall held (182857 draws red-brown after the rule)');
});

test('fixture: the register-brick branch of the trim rule (no spec material, no reader family)', () => {
  // Synthetic: a pand the register calls brick (registerFinish 'brick', the register step), whose strip reading caught its
  // white trim (#e3d9cc, pale grey-beige) and no reader has named a family. The nearest brick family's tone is drawn.
  const feature = { type: 'Feature' as const, geometry: null, properties: { id: 'NL.IMBAG.Pand.0363100099999999', registerFinish: 'brick', constructionYear: 1890, houseSpec: { wallHex: '#e3d9cc', src: { wallHex: 'streetlevel-measured' } } } };
  const out = withHouseSpec(feature as any).properties as any;
  const src = specWallSource('#e3d9cc', { brick: true });
  assert.equal(src.fromPixel, false);
  assert.equal(out.specRecipe.wallHex, specWallDisplay(FAMILY_TONE[src.family!], { fromPixel: false }));
  // The same reading on a front the register calls light (stucco) keeps its pixel.
  const light = withHouseSpec({ ...feature, properties: { ...feature.properties, registerFinish: 'light' } } as any).properties as any;
  assert.equal(light.specRecipe.wallHex, specWallDisplay('#e3d9cc'));
});
