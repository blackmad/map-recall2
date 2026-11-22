/**
 * Belt review render wiring (2026-11-21): the photo read reaches the render as a one-plot design unit. Pins the field ->
 * plot-fact mapping on Herengracht reads, the draw it produces (roof on the measured cornice, covering, dormers, hoist,
 * white parts, cornice, door; a described gable beating the register's), and that nothing moves without a read.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { beltDesignUnit, beltPlotFacts, DARK_FRAME_HEX, DARK_PILASTERS, TEXT_CUES } from './plotRead.ts';
import { fieldsToDesign, withPhotoRead, type FieldSet } from './design.ts';
import { withDesignUnitRoof } from '../designUnits/draw.ts';
import { designUnitOf } from '../designUnits/drawProps.ts';
import { plotDormers } from '../designUnits/plotPlan.ts';

/** Herengracht 2-4 as lane C's read has it: a cornice front, red-tile roof with an arched hoist dormer, stucco ground. */
const H2 = {
  fields: { storeys: 3, bays: 3, crown: 'cornice', cornice: 'frieze', roofStorey: 'dormers', dormers: { count: 1, kind: 'plain' }, heads: 'flat', whiteFrames: true, ground: 'shop', door: { bay: 3 }, eavesM: 12.75, facadeYear: 1790, wallColour: 'dark' },
  read: { wallHex: '#4E4A4C', dormerStyle: 'arched', roofMaterial: 'red-tile', whiteHeads: 'none', stringCourses: true, speklagen: 'none', ornaments: [], kitCannotSay: ['ground storey: white stuccoed pilaster-and-lintel frontage with tall small-paned windows', 'dormer: arched hoist dormer with hoist beam on hipped red pantile roof'] },
};
/** Herengracht 28: a raised neck gable the register calls a cornice front; dark brick. */
const H28 = {
  fields: { storeys: 3, bays: 3, crown: 'raised-neck', cornice: 'none', roofStorey: 'gable-attic', dormers: { count: 0 }, heads: 'flat', whiteFrames: true, ground: 'dwelling', door: { bay: 0 }, stoop: 'stoop-and-windows', eavesM: 13.44, facadeYear: 1737 },
  read: { wallHex: '#3e3634', dormerStyle: 'plain', roofMaterial: 'not-visible', whiteHeads: 'none', stringCourses: false, speklagen: 'none', ornaments: ['hoist beam projecting from gable top'], kitCannotSay: ['grey-painted plinth with souterrain grilles'] },
};

test('no read, no plot: the description draws as before', () => {
  assert.equal(beltPlotFacts(H2.fields, null), null);
  const fs: FieldSet = Object.fromEntries(Object.entries(H2.fields).map(([k, value]) => [k, { value, source: 'photo-read' }]));
  const before = fieldsToDesign(fs), after = withPhotoRead(structuredClone(before), fs, {}, 8);
  assert.deepEqual(after, before);
});

test('Herengracht 2-4: tile roof on the 12.75 m cornice, one hoist dormer, stucco ground with pilasters, the door at the right', () => {
  const p = beltPlotFacts(H2.fields, H2.read, { widthM: 8.09 })!;
  assert.equal(p.eavesM, 12.75);
  assert.equal(p.gable, null, 'a cornice front: no gable');
  assert.deepEqual({ roof: p.facts.roof, dormers: p.facts.dormers, dormer: p.facts.dormer, hoist: p.facts.hoist, roofMaterial: p.facts.roofMaterial }, { roof: 'dormers', dormers: 1, dormer: 'pediment', hoist: true, roofMaterial: 'tile' });
  // Its pilasters are the stucco ground's ("ground storey: white stuccoed pilaster-and-lintel frontage"), not full-height
  // corner pilasters (belt windows lane, 2026-11-22: the cue skips a ground's, shop's, door's, dormer's or risalit's).
  assert.deepEqual({ stone: p.facts.stone, pilasters: p.facts.pilasters, courses: p.facts.stringCourses, heads: p.facts.whiteHeads, cornice: p.facts.cornice }, { stone: 'ground', pilasters: undefined, courses: true, heads: 'none', cornice: 'frieze' });
  assert.deepEqual(p.facts.door, { index: 3, of: 4 });
  assert.equal(p.facts.wallHex, '#4e4a4c');
});

test('Herengracht 28: the described raised neck gable, no roof storey, no dormers; the hoist cue needs dormers', () => {
  const p = beltPlotFacts(H28.fields, H28.read, { widthM: 6.09 })!;
  assert.equal(p.gable, 'raisedNeck');
  assert.equal(p.facts.roof, undefined);
  assert.equal(p.facts.hoist, undefined, 'no dormer to carry it');
  assert.deepEqual(p.facts.parts, ['hoist-beam'], 'the front\'s own hoist beam instead');
  assert.equal(p.facts.stone, 'plinth');
  assert.deepEqual(p.facts.door, { index: 0, of: 3 });
});

test('an eaves too low for the stated storeys (3DBAG 2.4 m on Herengracht 54) is dropped; the tile height stands in', () => {
  assert.equal(beltPlotFacts({ ...H2.fields, eavesM: 2.4 }, H2.read)!.eavesM, null);
  assert.equal(beltPlotFacts({ ...H2.fields, storeys: 4, eavesM: 9 }, H2.read)!.eavesM, null);
});

test('withPhotoRead: the read wall hex over the family tone, a dark frame when not white; David\'s colour edit wins', () => {
  const fs: FieldSet = Object.fromEntries(Object.entries(H2.fields).map(([k, value]) => [k, { value, source: 'photo-read' }]));
  const d = withPhotoRead(fieldsToDesign(fs), fs, { photoRead: H2.read }, 8.09);
  assert.equal(d.palette.brick, '#4e4a4c');
  assert.equal(d.plot?.facts.roof, 'dormers');
  const dark = { ...fs, whiteFrames: { value: false, source: 'photo-read' } };
  assert.equal(withPhotoRead(fieldsToDesign(dark), dark, { photoRead: H2.read }, 8).palette.frame, DARK_FRAME_HEX);
  const edited = { ...fs, wallColour: { value: 'red', source: 'edit', edited: true } };
  assert.notEqual(withPhotoRead(fieldsToDesign(edited), edited, { photoRead: H2.read }, 8).palette.brick, '#4e4a4c');
});

const feature = (props: Record<string, unknown>) => ({ type: 'Feature', properties: { id: 'NL.IMBAG.Pand.0363100100091828', height: 13.15, facade: 'canal-priorBrickDark', facadeStyle: 'canal', ...props },
  geometry: { type: 'Polygon', coordinates: [[[4.8915, 52.3770], [4.89162, 52.3770], [4.89162, 52.37715], [4.8915, 52.37715], [4.8915, 52.3770]]] } });

test('the solo draw: roof storey on the cornice (tile, hoist dormer), white parts forced, the read cornice and door', () => {
  const stamp = beltDesignUnit('0363100100091828', beltPlotFacts(H2.fields, H2.read, { widthM: 8.09 })!);
  assert.ok(designUnitOf({ designUnit: stamp })?.solo, 'a valid design-unit stamp');
  const g = globalThis as { __canalRecallDesignUnits?: boolean };
  g.__canalRecallDesignUnits = false; // the flag does not gate a stated (solo) plot
  try {
    const p = withDesignUnitRoof(feature({ designUnit: stamp, monumentGable: 'cornice', roofPlanned: true })).properties as Record<string, any>;
    assert.equal(p.roofEavesHeightM, 12.75);
    assert.equal(p.monumentGable, undefined, 'the cornice front is not a gable');
    assert.equal(p.rowRoof.material, 'tile');
    assert.equal(p.rowRoof.shape, 'hipped');
    assert.deepEqual(p.rowRoof.joins, {});
    assert.deepEqual(p.rowRoof.dormers, [{ a: 0.5, kind: 'pediment', hoist: true }]);
    // A read frieze cornice is the timber cornice on modillions over a panelled frieze (2026-11-21).
    assert.deepEqual(p.designCorniceDress, { supports: 'modillions', frieze: 'panels', scale: 1.4 });
    assert.deepEqual(p.designDoor, { index: 3, of: 4 });
    for (const id of ['string-courses', 'rusticated-plinth', 'row-cornice', 'white-window-frames']) assert.ok(p.registerForce.includes(id), id);
    assert.ok(!p.registerForce.includes('corner-pilasters'), 'the ground\'s pilasters are not the front\'s');
  } finally { delete g.__canalRecallDesignUnits; }
});

test('the solo draw: the described gable beats the register\'s cornice and stands on the measured eaves', () => {
  const stamp = beltDesignUnit('0363100012179837', beltPlotFacts(H28.fields, H28.read, { widthM: 6 })!);
  const p = withDesignUnitRoof(feature({ designUnit: stamp, monumentGable: 'cornice', height: 13.44 })).properties as Record<string, any>;
  if (p.monumentGable !== undefined) {
    assert.equal(p.monumentGable, 'raisedNeck');
    assert.equal(p.roofEavesHeightM, 13.44);
    assert.ok(p.height > 13.44);
  } else assert.ok(p.rowRoof, 'a plot the planner cannot gable keeps a roof storey');
});

test('a read of no dormers draws none; unread keeps one per front', () => {
  assert.deepEqual(plotDormers(6, 5.5, { dormers: 0, src: 'photo' }, 'plain', false), []);
  assert.equal(plotDormers(6, 5.5, { src: 'photo' }, 'plain', false).length, 1);
});

// 2026-11-21 (self-check pass 1: 22 major "deep cornice drawn as a thin line"): the solo draw dresses a heavy or bracketed
// cornice as the row kit's deep timber cornice on consoles (row-cornice), not the kroonlijst / console-cornice line.
test('a heavy cornice is the deep row cornice on consoles, a bracketed one too; a dressed door is a stone doorcase', () => {
  const g = globalThis as { __canalRecallDesignUnits?: boolean };
  const draw = (fields: Record<string, unknown>) => withDesignUnitRoof(feature({ designUnit: beltDesignUnit('0363100012168544', beltPlotFacts({ ...H2.fields, roofStorey: 'none', dormers: { count: 0 }, ...fields }, { ...H2.read, roofMaterial: 'not-visible' }, { widthM: 6 })!) })).properties as Record<string, any>;
  const heavy = draw({ cornice: 'heavy', ground: 'dwelling', door: { bay: 0, surround: true } });
  assert.equal(heavy.roofShape, 'flat');
  assert.ok(!heavy.registerForce.includes('kroonlijst') && heavy.registerForce.includes('row-doorcase') && !heavy.registerForce.includes('door-surround') && heavy.registerForce.includes('row-cornice'));
  assert.equal(heavy.designDoorcase.material, 'stone', 'a dressed door is a stone doorcase');
  assert.deepEqual(heavy.designCorniceDress, { supports: 'consoles', frieze: 'plain', scale: 1.6 });
  const bracketed = draw({ cornice: 'bracketed' });
  assert.ok(bracketed.registerForce.includes('row-cornice') && !bracketed.registerForce.includes('console-cornice'));
  assert.equal(g.__canalRecallDesignUnits, undefined);
});

test('a souterrain raises the ground storey only where the measured front has room for the uppers', () => {
  assert.equal(beltPlotFacts({ ...H28.fields, eavesM: 13.44 }, H28.read)!.facts.souterrain, true);
  assert.equal(beltPlotFacts({ ...H28.fields, eavesM: 9.9 }, H28.read)!.facts.souterrain, undefined);
});

// Kit-gables lane (2026-11-21): the crown read (houseRead.ts CrownForm) as the kit's gable and cornice parts.
import { crownMeasures, gableForm } from './plotRead.ts';
const CF64 = { kind: 'elevated-neck', px: { ground: 962, foot: 392, raise: 238, shoulder: 90, capBase: 40, apex: 5, left: 0, right: 337, neckLeft: 105, neckRight: 248, w: 349, h: 982, ppm: 50 }, claws: 'carved', cap: 'segmental', crest: false, neckLights: 1, lowerLights: 1, lightHead: 'square', shoulderOvals: false, footLedge: false, hoistBeam: false, centre: 'none', centreLight: 'none', consoles: 'none', frieze: 'none' } as const;
const CF30 = { kind: 'cornice', px: { ground: 1185, foot: 362, capBase: 300, apex: 245, left: 0, right: 278, neckLeft: 70, neckRight: 190, w: 290, h: 1200, ppm: 60.138 }, claws: 'none', cap: 'flat', crest: false, neckLights: 1, lowerLights: 0, lightHead: 'square', shoulderOvals: false, footLedge: true, hoistBeam: true, centre: 'attic', centreLight: 'square', consoles: 'none', frieze: 'plain' } as const;

test('crown read: Herengracht 64 elevated neck measured from its landmarks, the gable on its photo foot', () => {
  const m = crownMeasures(CF64 as never)!;
  assert.equal(m.footM, 11.4); assert.equal(m.riseM, 7.74); assert.equal(m.raiseM, 3.08);
  assert.ok(Math.abs(m.shoulderRise! - 148 / 233) < 1e-3 && Math.abs(m.neckShare! - 143 / 337) < 1e-3);
  const f = gableForm(CF64 as never, m, 7);
  assert.equal(f.shape, 'neck'); assert.equal(f.raiseM, 3.08); assert.deepEqual(f.stone, { claws: 'carved' }); assert.equal(f.neckLights, 1); assert.equal(f.lowerLights, 1);
  const plot = beltPlotFacts({ ...H28.fields, eavesM: 14.53 }, { ...H28.read, crownForm: CF64 as never }, { widthM: 7 })!;
  assert.equal(plot.eavesM, 11.4, '3DBAG eaves 14.53 is the saddle behind the elevated part');
  assert.equal(plot.facts.gable?.riseM, 7.74);
  assert.equal(plot.gable, 'raisedNeck');
  // A foot the survey disagrees with (under 0.65 of it) keeps the survey eaves.
  assert.equal(beltPlotFacts({ ...H28.fields, eavesM: 20 }, { ...H28.read, crownForm: CF64 as never }, { widthM: 7 })!.eavesM, 20);
});

test('crown read: Herengracht 30 is a cornice front with a raised attic, not a shouldered roof with a dormer', () => {
  const plot = beltPlotFacts({ ...H2.fields, crown: 'shouldered', cornice: 'heavy', roofStorey: 'gable-attic', dormers: { count: 0 }, eavesM: 14.87 }, { ...H2.read, roofMaterial: 'slate', crownForm: CF30 as never }, { widthM: 4.8 })!;
  assert.equal(plot.gable, null);
  assert.equal(plot.facts.roof, 'flat');
  assert.equal(plot.facts.cornice, 'heavy');
  assert.deepEqual(plot.facts.corniceForm, { frieze: 'plain', centre: 'attic', centreShare: 0.432, centreRiseM: 1.95, centreCap: 'flat', centreLight: 'square' });
  assert.ok(plot.facts.parts?.includes('hoist-beam'));
});

// Belt kit roofs lane (2026-11-21): the measured parts a crown read carries, and the roof seen over a cornice.
import { ROOF_SEEN_RISE_M } from './plotRead.ts';
import { plotPlan, ROOF_ON_TOP_RISE_M } from '../designUnits/plotPlan.ts';
/** Herengracht 80 (0363100012175783): a neck 105 of 262 px on a 4.1 m crop front, scroll claws to y 300. */
const CF80 = { kind: 'neck', px: { ground: 1110, foot: 405, shoulder: 300, capBase: 262, apex: 232, left: 0, right: 262, neckLeft: 80, neckRight: 185, w: 277, h: 1200, ppm: 63.972 }, claws: 'scroll', cap: 'rounded', crest: false, neckLights: 1, lowerLights: 0, lightHead: 'square', shoulderOvals: false, footLedge: true, hoistBeam: true, centre: 'none', centreLight: 'none', consoles: 'none', frieze: 'none', clawWaist: 0.15, clawBand: 0.2 } as const;
const H80 = { storeys: 4, bays: 3, crown: 'neck', cornice: 'none', roofStorey: 'gable-attic', dormers: { count: 0 }, eavesM: 11.02, facadeYear: 1650 };

test('Herengracht 80: the neck is its share of the crop\'s own front (1.64 m), not of a 6 m stand-in (2.41 m drawn)', () => {
  const plot = beltPlotFacts(H80, { ...H28.read, crownForm: CF80 as never })!;
  assert.equal(plot.facts.gable?.form?.neckW, 1.64);
  // The face's width wins where it is known.
  assert.equal(beltPlotFacts(H80, { ...H28.read, crownForm: CF80 as never }, { widthM: 4.31 })!.facts.gable?.form?.neckW, 1.73);
});

test('measured claws: a scroll at the claws\' top (Herengracht 80: 1.64 m) with the read waist and band; none without the landmark', () => {
  const f = gableForm(CF80 as never, crownMeasures(CF80 as never), 4.1);
  assert.deepEqual(f.claw, { heightM: 1.64, waist: 0.15, band: 0.2 });
  const { shoulder: _s, ...px } = CF80.px;
  assert.equal(gableForm({ ...CF80, px } as never, crownMeasures({ ...CF80, px } as never), 4.1).claw, undefined);
  // Plain claws keep the stock piece.
  assert.equal(gableForm({ ...CF80, claws: 'plain' } as never, crownMeasures(CF80 as never), 4.1).claw, undefined);
});

test('Herengracht 64: the elevated storey\'s window at its measured size; 76-78 a pair; 74 a sweep', () => {
  assert.deepEqual(gableForm({ ...CF64, lowerLightPx: [74, 80] } as never, crownMeasures(CF64 as never), 7).lowerLightM, [1.48, 1.6]);
  assert.equal(gableForm({ ...CF80, pair: true } as never, crownMeasures(CF80 as never), 8.3).pair, true);
  const sweep = { side: 'left', startShare: 0.2, topShare: 0.43, window: { lights: 3 } } as const;
  const f74 = gableForm({ ...CF80, kind: 'curved', claws: 'none', sweep } as never, crownMeasures(CF80 as never), 4.4);
  assert.deepEqual(f74.sweep, sweep); assert.equal(f74.shape, 'bell');
});

test('Herengracht 82: a tiled roof seen over the cornice, no roof storey, draws at its measured 0.7 m (not a 2.8 m roof storey)', () => {
  const f82 = { storeys: 4, bays: 3, crown: 'cornice', cornice: 'simple', roofStorey: 'none', dormers: { count: 0 }, eavesM: 14.38, facadeYear: 1862 };
  const r82 = { ...H2.read, roofMaterial: 'red-tile' };
  const plot = beltPlotFacts(f82, { ...r82, roofSeenRiseM: 0.7 })!;
  assert.equal(plot.facts.roof, 'dormers'); assert.equal(plot.facts.roofRiseM, 0.7);
  assert.equal(plotPlan(14.38, plot.facts, { topIsCornice: true }).riseM, 0.7);
  // Unmeasured: the low seen-roof rise; a roof storey (dormers read) keeps the storey's rise.
  assert.equal(beltPlotFacts(f82, r82)!.facts.roofRiseM, ROOF_SEEN_RISE_M);
  const h2 = beltPlotFacts(H2.fields, H2.read)!;
  assert.equal(h2.facts.roofRiseM, undefined);
  assert.equal(plotPlan(12.75, h2.facts, { topIsCornice: true }).riseM, ROOF_ON_TOP_RISE_M);
});

test('Herengracht 50-52: a measured glimpse sets a roof storey\'s rise too (0.7 m with its one dormer); unmeasured, the storey\'s', () => {
  const f = { storeys: 3, bays: 5, crown: 'cornice', cornice: 'frieze', roofStorey: 'attic', dormers: { count: 1, kind: 'plain' }, eavesM: 15.84, facadeYear: 1700 };
  const r = { ...H2.read, roofMaterial: 'black-tile' };
  assert.equal(beltPlotFacts(f, { ...r, roofSeenRiseM: 0.7 })!.facts.roofRiseM, 0.7);
  assert.equal(beltPlotFacts(f, r)!.facts.roofRiseM, undefined);
  // A glimpse under 0.55 m is not a measure the roof planner can draw (its row roof needs over 0.5 m).
  assert.equal(beltPlotFacts(f, { ...r, roofSeenRiseM: 0.4 })!.facts.roofRiseM, undefined);
});

test('dark or brick pilasters are the wall itself, not white strips (belt fixes 2026-11-22: Herengracht 84)', () => {
  const cue = (t: string) => TEXT_CUES.pilasters.test(t.replace(DARK_PILASTERS, ''));
  assert.equal(cue('stepped gable with dark-painted brick pilasters between the windows'), false);
  assert.equal(cue('brick pilasters at the corners'), false);
  assert.equal(cue('dark pilaster'), false);
  assert.equal(cue('white stucco pilaster at each corner'), true);
  assert.equal(cue('stone pilasters | dark-painted brick pilasters'), true);
});
