import test from 'node:test';
import assert from 'node:assert/strict';
import { allowIdsFor, cellsOfTiles, coversDelta, defaultBatchName, describeViolation, diffRecord, diffTiles, extraPands, classifyExtras, formatExtraTable, normaliseRecord, suppressionViolations, type AuditWall, type TileFile } from './publishPlan.ts';

const tile = (b: Record<string, Record<string, unknown>>): TileFile => ({ version: 1, buildings: b });
const F = (p: string) => `NL.IMBAG.Pand.${p}`;

test('diffRecord lists the leaf fields that moved', () => {
  assert.deepEqual(diffRecord({ d: { fronts: [{ gable: 'step', bays: 4 }] }, r: 'generic' }, { d: { fronts: [{ gable: 'bell', bays: 4 }] }, r: 'generic' }), ['d.fronts[0].gable: "step" -> "bell"']);
  assert.deepEqual(diffRecord({ a: 1 }, { a: 1, b: 2 }), ['b: (absent) -> 2']);
  assert.deepEqual(diffRecord({ a: 1 }, { a: 1 }), []);
});

test('diffTiles: added, changed, removed pands and the touched tiles only', () => {
  const published = new Map([['1/1', tile({ [F('1')]: { r: 'generic', v: { bays: 3 } }, [F('2')]: { r: 'generic' } })], ['1/2', tile({ [F('3')]: { r: 'generic' } })]]);
  const staged = new Map([['1/1', tile({ [F('1')]: { r: 'generic', v: { bays: 4 } }, [F('2')]: { r: 'generic' }, [F('4')]: { r: 'recipe' } })], ['1/2', tile({ [F('3')]: { r: 'generic' } })]]);
  const d = diffTiles(published, staged);
  assert.deepEqual(d.touchedTiles, ['1/1']);
  assert.deepEqual(d.pands.map(p => [p.pand, p.change]), [['1', 'changed'], ['4', 'added']]);
  assert.deepEqual(d.pands[0].fields, ['v.bays: 3 -> 4']);
  const gone = diffTiles(published, new Map([['1/1', tile({ [F('1')]: { r: 'generic', v: { bays: 3 } } })], ['1/2', tile({ [F('3')]: { r: 'generic' } })]]));
  assert.deepEqual(gone.pands.map(p => [p.pand, p.change]), [['2', 'removed']]);
});

test('extraPands: a changed pand nobody staged is named unless allowed', () => {
  const diff = diffTiles(new Map([['t', tile({ [F('1')]: { a: 1 }, [F('9')]: { a: 1 } })]]), new Map([['t', tile({ [F('1')]: { a: 2 }, [F('9')]: { a: 2 } })]])).pands;
  assert.deepEqual(extraPands(diff, new Set(['1']), new Set()).map(d => d.pand), ['9']);
  assert.deepEqual(extraPands(diff, new Set(['1']), new Set(['9'])), []);
});

test('cellsOfTiles joins the tiles to the cells that list them', () => {
  assert.deepEqual(cellsOfTiles({ a: ['3_4', '3_5'], b: ['3_5', '4_4'], c: ['9_9'] }, ['a', 'b', 'zzz']), ['3_4', '3_5', '4_4']);
});

test('coversDelta: pands a batch newly hides, releases or moves', () => {
  const before = { models: { 'chunk-a': { p: ['0363100012000001'] }, 'ordinary-b': { p: ['0363100012000002'] } } };
  const after = { models: { 'chunk-a': { p: ['0363100012000001', '0363100012000003'] }, 'ordinary-c': { p: ['0363100012000002'] } } };
  assert.deepEqual(coversDelta(before, after), { added: ['0363100012000003'], removed: [], moved: ['0363100012000002'] });
});

test('suppression guard: blank street walls of 4 m or more on a suppressed pand refuse; setbacks and short walls pass', () => {
  const w = (o: Partial<AuditWall>): AuditWall => ({ pand: 'p1', street: 'Nassaukade', lengthM: 6, cls: 'blank', model: 'chunk-x', ...o });
  const walls = [w({}), w({ pand: 'p2' }), w({ lengthM: 3.9 }), w({ cls: 'stops-short' }), w({ cls: 'drawn' }), w({ street: '' }), w({ lengthM: 9, street: 'Kinkerstraat' }), w({ lengthM: 4 })];
  const bad = suppressionViolations(walls, new Set(['p1']));
  assert.deepEqual(bad.map(b => [b.street, b.lengthM]), [['Kinkerstraat', 9], ['Nassaukade', 6], ['Nassaukade', 4]]);
  assert.equal(describeViolation(bad[0]), 'p1  Kinkerstraat  9 m blank (chunk-x)');
  assert.deepEqual(suppressionViolations(walls, new Set()), []);
});

test('allowIdsFor adds the directories that mention a batch pand', () => {
  const mentions = new Map([['nassaukade-506', ['0363100012000001']], ['other', ['0363100012000009']]]);
  assert.deepEqual(allowIdsFor(new Set(['0363100012000001']), mentions), ['0363100012000001', 'nassaukade-506']);
});

test('defaultBatchName is sortable', () => assert.equal(defaultBatchName(new Date('2026-11-10T14:05:00Z')), 'batch-20261110-1405'));

import { mergeRecipeIntent, withHold } from './publishPlan.ts';
test('withHold adds a reason and keeps the other holds', () => {
  assert.deepEqual(withHold({ note: 'x', held: { a: 'old' } }, 'b', '2026-11-10'), { note: 'x', held: { a: 'old', b: 'staged spec 2026-11-10' } });
  assert.deepEqual(withHold({}, 'b', '2026-11-10'), { held: { b: 'staged spec 2026-11-10' } });
});

test('mergeRecipeIntent keeps the house id and its earlier sources', () => {
  const merged = mergeRecipeIntent({ id: 'bloemgracht-80', sources: [{ id: 'pano-1' }] }, { id: 'spec-0363', sources: [{ id: 'pano-1' }, { id: 'rce' }], roof: { form: 'gable' } }, 'bloemgracht-80');
  assert.equal(merged.id, 'bloemgracht-80');
  assert.deepEqual(merged.sources, [{ id: 'pano-1' }, { id: 'rce' }]);
  assert.deepEqual(mergeRecipeIntent(null, { id: 'spec-1', sources: [{ id: 'a' }] }, 'spec-1').sources, [{ id: 'a' }]);
});

test('classifyExtras: face-drawn and same-as-main are allowed, unexplained blocks, --allow-extra overrides', () => {
  const published = new Map([['t', tile({ [F('1')]: { a: 1 }, [F('2')]: { a: 1 }, [F('3')]: { a: 1 }, [F('4')]: { a: 1 }, [F('5')]: { a: 1 } })]]);
  const mergedTiles = new Map([['t', tile({
    [F('1')]: { a: 2 },                                    // staged
    [F('2')]: { a: 2, b: { y: 1, x: 2 } },                 // face-drawn (intent names it), main differs
    [F('3')]: { b: { x: 2, y: 1 }, a: 2, stamp: 'n2' },    // same as main apart from key order and stamp
    [F('4')]: { a: 9 },                                    // nobody explains it
    [F('5')]: { a: 7 },                                    // allow-extra
  })]]);
  const diff = diffTiles(published, mergedTiles).pands;
  const mainRecs: Record<string, unknown> = { [F('3')]: { a: 2, b: { y: 1, x: 2 }, stamp: 'n1' }, [F('2')]: { a: 5 } };
  const ctx = { faceDrawn: new Set(['2']), merged: (f: string, t: string) => mergedTiles.get(t)?.buildings[f], main: (f: string) => mainRecs[f] };
  const r = classifyExtras(diff, new Set(['1']), new Set(['5']), ctx);
  assert.deepEqual(r.classified.map(c => [c.diff.pand, c.cls]), [['2', 'face-drawn'], ['3', 'same-as-main'], ['4', 'unexplained']]);
  assert.deepEqual(r.allowed.map(d => d.pand), ['5']);
  assert.deepEqual(r.blocking.map(c => c.diff.pand), ['4']);
  // without a readable main, same-as-main never applies
  assert.equal(classifyExtras(diff, new Set(['1']), new Set(['5']), { ...ctx, main: undefined }).classified[1].cls, 'unexplained');
  // a face-drawn pand that is also equal to main reports the stronger same-as-main
  assert.equal(classifyExtras(diff, new Set(), new Set(), { ...ctx, faceDrawn: new Set(['3']) }).classified.find(c => c.diff.pand === '3')!.cls, 'same-as-main');
  const table = formatExtraTable(r.classified, r.allowed);
  assert.match(table, /face-drawn/); assert.match(table, /same-as-main/); assert.match(table, /UNEXPLAINED/); assert.match(table, /allow-extra/);
  console.log(table);
});

test('normaliseRecord sorts keys and drops stamps', () => {
  assert.equal(JSON.stringify(normaliseRecord({ b: [{ z: 1, a: 2 }], a: 1, stamp: 'x' })), '{"a":1,"b":[{"a":2,"z":1}]}');
});
