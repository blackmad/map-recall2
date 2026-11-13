/**
 * Grachtengordel-Zuid canal houses (lane belt-gg-zuid, 2026-11-10; docs/reports/buurt-grachtengordel-zuid-20261110.md):
 *  - a souterrain-first storey list (one entry more than the storeys) resizes its storeys and keeps the souterrain weight;
 *    a house whose own shop replaces the type's stoop ground drops it (both failed validation before);
 *  - a gable crown with `cornice: "none"` drops the body's measured entablature (it failed validation before);
 *  - `sash-4-over-4`: two panes across and two up per sash;
 *  - `match.typeGround`: a trading register use under a type-drawn ground is recorded as residential, in conflict (Herengracht 520);
 *  - reviewer eaves pins with `countStoreys` give the line auto-place counts storeys from; plain pins do not.
 *   node --import tsx --test src/canalRecall/blockFace/grachtengordelZuid.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultTypeLoader} from './typeLibrary.ts';
import {resizePerStorey, resolvePlacement, type HouseTypeIntent} from './houseType.ts';
import {eavesPinProblems, storeyEaves} from './reviewEaves.ts';
import {typeGroundUse, type MatchableType} from './autoPlace.ts';
import {validateIntent, WINDOWS} from '../buildingRecipe/intent.ts';

const T = defaultTypeLoader('belt-1700-canal-house') as HouseTypeIntent;
const design = (place: Parameters<typeof resolvePlacement>[1]) => resolvePlacement(T, place, 'Keizersgracht', 7.5).design;
const intent = (d: ReturnType<typeof design>) => ({schemaVersion: 1, kind: 'canal-house', id: 'k', pandId: '0363100012175655', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2023-03-27'}], ...d} as unknown as Parameters<typeof validateIntent>[0]);

test('souterrain-first storey list: resized storeys keep the souterrain weight first', () => {
  const body = {...T.body, souterrain: true} as typeof T.body & {souterrain: true};
  const three = resizePerStorey(body, 4, 3), five = resizePerStorey(body, 4, 5);
  assert.deepEqual(three.storeyHeights, [2.8, 4.2, 3.7, 2.85]);
  assert.deepEqual(five.storeyHeights, [2.8, 4.2, 3.7, 3.35, 3.35, 2.85]);
  // A list of exactly `from` entries resizes as before.
  assert.deepEqual(resizePerStorey({...T.body, storeyHeights: [4, 3, 3, 2]}, 4, 3).storeyHeights, [4, 3, 2]);
});

test('belt-1700-canal-house resolves and validates at 3, 4 and 5 storeys, with the stoop ground and with a shop', () => {
  for (const storeys of [3, 4, 5]) {
    const d = design({type: T.id, storeys});
    assert.equal(d.fronts[0].storeyHeights!.length, storeys + 1);
    assert.doesNotThrow(() => validateIntent(intent(d)), `stoop ground, ${storeys} storeys`);
    const shop = design({type: T.id, storeys, ground: {shopfront: {colour: '#333333', fascia: true}}});
    assert.equal(shop.fronts[0].storeyHeights!.length, storeys, 'the shop ground drops the souterrain weight');
    assert.doesNotThrow(() => validateIntent(intent(shop)), `shop ground, ${storeys} storeys`);
  }
});

test('a neck crown drops the frieze entablature; the cornice crown keeps it', () => {
  assert.ok(design({type: T.id}).fronts[0].entablature);
  const neck = design({type: T.id, crown: 'neck'});
  assert.equal(neck.fronts[0].entablature, undefined);
  assert.doesNotThrow(() => validateIntent(intent(neck)));
});

test('sash-4-over-4 is a window kind', () => {
  assert.ok((WINDOWS as readonly string[]).includes('sash-4-over-4'));
});

test('countStoreys eaves pins: the storey line follows only pins that ask for it', () => {
  const pins = [{pandId: '0363100012175645', eavesM: 19.3, reason: 'r', countStoreys: true as const}, {pandId: '0363100012175655', eavesM: 19.3, reason: 'r'}];
  assert.deepEqual(eavesPinProblems(pins), []);
  assert.equal(storeyEaves(pins, '0363100012175645', 15.5), 19.3);
  assert.equal(storeyEaves(pins, '0363100012175655', 15.5), 15.5);
  assert.equal(storeyEaves(pins, '0363100012000000', 15.5), 15.5);
  assert.equal(eavesPinProblems([{...pins[0], countStoreys: false as unknown as true}]).length, 1);
});

test('typeGround: a register shop under the type ground is recorded as the residential ground the photo shows', () => {
  const use = {use: 'shop' as const, bag: ['winkelfunctie'], photoDate: '2023-02-27', agreement: 'bag-only' as const};
  const own = {...T, match: {typeGround: true}} as unknown as MatchableType, plain = {...T, match: {}} as unknown as MatchableType;
  const g = typeGroundUse(own, use, true);
  assert.equal(g.use, 'residential');
  assert.equal(g.agreement, 'conflict');
  assert.match(g.note!, /registers say shop/);
  assert.equal(typeGroundUse(plain, use, true), use);
  assert.equal(typeGroundUse(own, {...use, use: 'office'}, false).use, 'office');
});

test('override pins: body fields, a named ground and the roof land on the pinned type only; bad pins are refused', async () => {
  const {applyOverridePins, overridePinProblems} = await import('./reviewOverrides.ts');
  const types = [{id: T.id, grounds: T.grounds as Record<string, unknown>}];
  const pin = {pandId: '0363100012175655', type: T.id, ground: 'base-door-left', overrides: {windows: 'sash-6-over-6' as const}, roof: {form: 'flat' as const}, reason: 'r'};
  assert.deepEqual(overridePinProblems([pin], types), []);
  assert.equal(overridePinProblems([{...pin, ground: 'nope'}], types).length, 1);
  assert.equal(overridePinProblems([{pandId: pin.pandId, type: T.id, reason: 'r'}], types).length, 1);
  assert.equal(overridePinProblems([{...pin, type: 'other'}], types).length, 1);
  const placed = (typeId: string) => ({kind: 'placed' as const, pandId: pin.pandId, typeId, score: 1, notes: [], house: {pandId: pin.pandId, slug: 's', address: 'a', type: {type: typeId}} as never});
  const ds = [placed(T.id), placed('other')];
  assert.deepEqual(applyOverridePins(ds as never, [pin]), [pin.pandId]);
  const h = (ds[0].house as {type: Record<string, unknown>}).type;
  assert.deepEqual([h.ground, h.overrides, h.roof], ['base-door-left', {windows: 'sash-6-over-6'}, {form: 'flat'}]);
  assert.deepEqual((ds[1].house as {type: Record<string, unknown>}).type, {type: 'other'});
  // The base-door ground resolves and validates (no stoop door; the street door in the base).
  const d = design({type: T.id, ground: 'base-door-left'});
  assert.equal(d.fronts[0].doorBay, null);
  assert.equal(d.fronts[0].basementDoor, 0);
  assert.doesNotThrow(() => validateIntent(intent(d)));
});
