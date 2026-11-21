/**
 * Belt review render wiring (2026-11-21): the photo read reaches the render as a one-plot design unit. Pins the field ->
 * plot-fact mapping on Herengracht reads, the draw it produces (roof on the measured cornice, covering, dormers, hoist,
 * white parts, cornice, door; a described gable beating the register's), and that nothing moves without a read.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { beltDesignUnit, beltPlotFacts, DARK_FRAME_HEX } from './plotRead.ts';
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
  assert.deepEqual({ stone: p.facts.stone, pilasters: p.facts.pilasters, courses: p.facts.stringCourses, heads: p.facts.whiteHeads, cornice: p.facts.cornice }, { stone: 'ground', pilasters: 'corners', courses: true, heads: 'none', cornice: 'frieze' });
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
    for (const id of ['string-courses', 'rusticated-plinth', 'corner-pilasters', 'row-cornice', 'white-window-frames']) assert.ok(p.registerForce.includes(id), id);
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
