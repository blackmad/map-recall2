/**
 * Transvaalbuurt round 3 (#152): the crown read and the ribbon era guard on the 1908-1914 rows.
 *  - `match.crownFromType`: a skyline that is unread, matches no variant, or is not sky-bounded (stripSkyline.ts
 *    `skylineBounded`) gives the type's crown ("crown from type"), not the first variant (a point gable). Named
 *    regressions from the 2020-2023 strips: Smitstraat 36A (flat top, the skyline's "crown" is the deep eaves bending at
 *    the left party wall), Transvaalstraat 56 (a 5.75 m "crown" over a 15.9 m 3DBAG roof: the neighbour and branches),
 *    Retiefstraat 69C (branches over the front: skyline eaves 17.7 m, 3DBAG max 15.8 m), Laing's Nekstraat 36 (unread);
 *    a sky-bounded wall dormer and a sky-bounded "no crown" are still the skyline's.
 *  - Types without the field (Albert Luthulistraat 25-39's 1923 portiek types, every Bellamy type) pick exactly as
 *    before, whatever the bound says.
 *  - Ribbon guard per pand: Transvaalstraat 7-41 (1913; ribbon on 33 and 35 of 13) and Pretoriusstraat 72A-90B (1913;
 *    ribbon on 82 of 10) hold the ribbon pands only; Gerard Doustraat 1-7 (1 of 4) still holds its row.
 *   node --import tsx --test src/canalRecall/blockFace/crownFromType.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {crownFor, ribbonRowHolds, RIBBON_GUARD, type Decision, type MatchableType, type PandEvidence, type StripEvidence} from './autoPlace.ts';
import {skylineBounded, type SkyBound, type Skyline} from './stripSkyline.ts';
import {defaultTypeLoader} from './typeLibrary.ts';
import type {StripPalette} from './stripPalette.ts';

const low = defaultTypeLoader('transvaal-1911-five-storey') as MatchableType, tall = defaultTypeLoader('transvaal-1911-five-storey-tall') as MatchableType;
const sky = (eavesM: number, confidence: number, crown: Skyline['crown']): Skyline => ({eavesM, eavesRow: 0, confidence, crown});
const bound = (spanM: number, leafTopShare = 0): SkyBound => ({leafTopShare, spanM});

test('1911 types: crownFromType is "none", one of their crowns', () => {
  for (const t of [low, tall]) { assert.equal(t.match?.crownFromType, 'none'); assert.ok(t.crowns.none); }
});

test('Smitstraat 36A (smit-34-40 2020-04-29): the eaves bend at the party wall is no crown; crown from type', () => {
  const s = sky(12.75, 1, {widthM: 1.02, riseM: 0.8, topWidthM: 0.97, centre: 0.09});
  // Without the bound the 0.8 m "crown" fits the white dormer rule (pointed white crowns on a flat front at review).
  assert.equal(crownFor(tall, s).name, 'dormer');
  const c = crownFor(tall, s, {roofMaxM: 14.7, skyBound: bound(5.6)});
  assert.equal(c.name, 'none');
  assert.match(c.why, /crown from type.*hugs the left party wall/);
  // Smitstraat 38C: the same bend at the right party wall.
  assert.equal(crownFor(tall, sky(12.75, 1, {widthM: 0.82, riseM: 0.8, topWidthM: 0.75, centre: 0.93}), {roofMaxM: 14.7, skyBound: bound(5.86)}).name, 'none');
});

test('Transvaalstraat 56, Retiefstraat 69C, Laing\'s Nekstraat 36: over the roof or unread: crown from type, never the point gable', () => {
  // Transvaalstraat 56 (transvaal-50-70 2023-01-02): rise 5.75 m over 14.38 m, 3DBAG max 15.9 m.
  const t56 = sky(14.38, 0.81, {widthM: 1.73, riseM: 5.75, topWidthM: 0.17, centre: 0.55});
  const c56 = crownFor(tall, t56, {roofMaxM: 15.9, skyBound: bound(5.4)});
  assert.equal(c56.name, 'none'); assert.match(c56.why, /over the 3DBAG roof max 15.9 m/);
  // Retiefstraat 69C (retief-45-75 2023-01-02): branches; skyline eaves 17.68 m, confidence 0.55, 3DBAG max 15.8 m.
  assert.match(crownFor(low, sky(17.68, 0.55, null), {roofMaxM: 15.8, skyBound: bound(5.7)}).why, /^crown none: crown from type \(skyline unread/);
  // Read with confidence but over the roof (Retiefstraat 71D: 17.68 m, confidence 0.66): not this front.
  assert.equal(crownFor(low, sky(17.68, 0.66, null), {roofMaxM: 16, skyBound: bound(6.2)}).name, 'none');
  // Laing's Nekstraat 36 (nek-34-56): unread at 0.3.
  assert.equal(crownFor(tall, sky(19.15, 0.3, null), {roofMaxM: 17.2, skyBound: bound(5.6)}).name, 'none');
  // Foliage over the front.
  assert.equal(crownFor(tall, sky(13.5, 0.9, {widthM: 3, riseM: 2.5, topWidthM: 0.3, centre: 0.5}), {roofMaxM: 16.5, skyBound: bound(6, 0.4)}).name, 'none');
});

test('a sky-bounded skyline still picks: a centred wall dormer, a full-width point gable, no crown', () => {
  // A brick wall dormer over the centre axis (Retiefstraat 45-51 class): 1.8 m wide, 2.3 m rise, flat 1.5 m top.
  assert.equal(crownFor(low, sky(13.4, 0.9, {widthM: 1.8, riseM: 2.3, topWidthM: 1.5, centre: 0.5}), {roofMaxM: 16, skyBound: bound(5.7)}).name, 'wall-dormer');
  // A pointed gable over the front (Pretoriusstraat 80-96 class): both party walls, narrow top, 2.7 m rise.
  assert.equal(crownFor(low, sky(13.5, 0.9, {widthM: 6.4, riseM: 2.7, topWidthM: 0.3, centre: 0.5}), {roofMaxM: 16.5, skyBound: bound(6.5)}).name, 'point-gable');
  // Transvaalstraat 54: no crown over a 14.35 m skyline, under the roof max.
  assert.equal(crownFor(tall, sky(14.35, 1, null), {roofMaxM: 18.3, skyBound: bound(5.4)}).name, 'none');
  // A crown that fits no variant under clean sky: the type's crown, not the first.
  assert.match(crownFor(low, sky(13.4, 0.9, {widthM: 4.4, riseM: 1.2, topWidthM: 3, centre: 0.5}), {roofMaxM: 16, skyBound: bound(6)}).why, /crown from type.*matches no variant/);
});

test('skylineBounded: a crown over both party walls is not "hugging" one', () => {
  assert.equal(skylineBounded(sky(13, 1, {widthM: 5.6, riseM: 2.5, topWidthM: 0.3, centre: 0.5}), bound(5.6), 16).ok, true);
  assert.equal(skylineBounded(sky(13, 1, {widthM: 1, riseM: 1, topWidthM: 1, centre: 0.5}), bound(5.6), 16).ok, true);
  assert.equal(skylineBounded(sky(13, 1, {widthM: 1, riseM: 1, topWidthM: 1, centre: 0.09}), bound(5.6), 16).ok, false);
});

test('types without crownFromType pick exactly as before (Albert Luthulistraat 21-41, Bellamy)', () => {
  const lib = ['transvaal-1923-portiek-tower', 'transvaal-1923-portiek', 'bellamy-1895-plain-three-axis', 'bellamy-1904-balcony-axis', 'bellamy-1915-green-tile', 'bellamy-1915-tile-bay', 'bellamy-1916-two-axis', 'bellamy-1937-flat-row'].map(id => defaultTypeLoader(id) as MatchableType);
  const recs: {face: string; pandId: string; skyline: Skyline | null}[] = [];
  for (const face of ['luthuli-21-41', 'bellamy-33-63', 'bellamy-64-102', 'bellamyplein-18-38']) {
    const doc = JSON.parse(readFileSync(`scripts/block-face/faces/${face}/auto-place.json`, 'utf8'));
    for (const p of doc.pands) if (p.strip?.skyline) recs.push({face, pandId: p.pandId, skyline: p.strip.skyline});
  }
  assert.ok(recs.length >= 20, `${recs.length} skyline records`);
  for (const t of lib) {
    assert.equal(t.match?.crownFromType, undefined, t.id);
    // The harshest bound (all foliage, a 1 m roof max, a 1 m span) changes nothing for these types.
    for (const r of recs) assert.deepEqual(crownFor(t, r.skyline, {roofMaxM: 1, skyBound: bound(1, 1)}), crownFor(t, r.skyline), `${t.id} ${r.face} ${r.pandId}`);
  }
});

const palette = (): StripPalette => ({wall: '#4a4140', accent: '#e0e0e0', frame: '#e0e0e0', band: null, cornice: '#dddddd', fascia: '#333333', shares: {wall: 0.8, accent: 0.05, glass: 0.15}, stucco: false, bandRunsM: [], wallHsl: null, pixels: 1000});
const strip = (o: Partial<StripEvidence> = {}): StripEvidence => ({date: '2023-01-02', px: [0, 240], palette: palette(), wall: '#6a4a3e', skyline: null, voidShare: 0, foliageShare: 0, columns: 3, doorSide: 'left', accentSide: null, ...o});
const pand = (id: string, address: string, year: number, fc: StripEvidence['frontClass'] | undefined): PandEvidence => ({pandId: id, address, builtYear: year, widthM: 6, eavesM: 13.4, roofMaxM: 16, storeys3dbag: 5, groundUses: ['woonfunctie'], osm: [], strip: strip(fc ? {frontClass: fc} : {})});

test('ribbon guard per pand: Transvaalstraat 7-41 and Pretoriusstraat 72A-90B hold the ribbon pands, not the row', () => {
  // transvaal-3-47 auto-place.json (round 2): 1914 3-5, 1913 7-41 (ribbon on 33 and 35), 1912 43B-45A.
  const tv: [string, string, number, StripEvidence['frontClass']][] = [['106051', '3', 1914, 'punched'], ['119703', '5', 1914, 'punched'], ['237385', '7', 1913, 'columns'], ['237327', '11', 1913, 'columns'], ['233613', '15', 1913, 'columns'], ['237070', '19', 1913, 'columns'], ['072312', '25', 1913, 'columns'], ['084571', '27', 1913, 'punched'], ['149583', '29', 1913, 'punched'], ['108858', '31', 1913, 'columns'], ['121884', '33', 1913, 'ribbon'], ['109266', '35', 1913, 'ribbon'], ['128319', '37', 1913, 'punched'], ['093192', '39', 1913, 'punched'], ['146296', '41', 1913, 'punched'], ['096110', '43B', 1912, 'columns'], ['140329', '45A', 1912, 'columns']];
  const evs = tv.map(([id, n, y, fc]) => pand(id, `Transvaalstraat ${n}`, y, fc));
  // Every pand placed with the tall type (the guard is what is tested, not the match).
  const placed: Decision[] = evs.map(e => ({kind: 'placed' as const, pandId: e.pandId, typeId: tall.id, score: 1, notes: [], house: {pandId: e.pandId, slug: e.pandId, address: e.address, type: {type: tall.id}} as never}));
  assert.deepEqual(ribbonRowHolds(placed, [tall], evs), ['121884', '109266']);
  assert.match((placed[10] as {reason?: string}).reason ?? '', /the strip reads ribbon/);
  assert.equal(placed[2].kind, 'placed');
  // pretorius-72-120 (round 2): 1913 row 90B-72A, ribbon on 82 only.
  const pr: [string, string, StripEvidence['frontClass']][] = [['149642', '90B', 'columns'], ['142310', '88', 'columns'], ['076819', '86', 'punched'], ['154820', '84', 'punched'], ['082556', '82', 'ribbon'], ['062960', '80', 'curtain'], ['072390', '78', 'columns'], ['072572', '76', 'columns'], ['064816', '74A', 'columns'], ['137732', '72A', 'curtain']];
  const evp = pr.map(([id, n, fc]) => pand(id, `Pretoriusstraat ${n}`, 1913, fc));
  const dp: Decision[] = evp.map(e => ({kind: 'placed' as const, pandId: e.pandId, typeId: low.id, score: 1, notes: [], house: {pandId: e.pandId, slug: e.pandId, address: e.address, type: {type: low.id}} as never}));
  assert.deepEqual(ribbonRowHolds(dp, [low], evp), ['082556']);
  assert.equal(RIBBON_GUARD.rowShare, 0.2);
  // A row where ribbon reads on a fifth or more is still held whole (Gerard Doustraat 1-7: 1 of 4).
  const dou = [pand('p1', 'Gerard Doustraat 1', 1904, 'punched'), pand('p3', 'Gerard Doustraat 3', 1904, 'ribbon'), pand('p5', 'Gerard Doustraat 5', 1904, undefined), pand('p7', 'Gerard Doustraat 7', 1904, undefined)];
  const dd: Decision[] = dou.map(e => ({kind: 'placed' as const, pandId: e.pandId, typeId: low.id, score: 1, notes: [], house: {pandId: e.pandId, slug: e.pandId, address: e.address, type: {type: low.id}} as never}));
  assert.deepEqual(ribbonRowHolds(dd, [low], dou), ['p1', 'p3', 'p5', 'p7']);
});
