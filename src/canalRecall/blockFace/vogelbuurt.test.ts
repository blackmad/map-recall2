/**
 * Vogelbuurt-Noord (2026-11-10): one-storey cottages (eaves 3.2-4.1 m) and two-storey rows with crown gables. Named
 * regressions: the body bands of the strip measurers assumed a shopfront storey (4.4 m) and a 6 m minimum eaves, so a
 * low front read as 100 % void and every dark window as a balcony; the match gained `keepSurveyRoof` and
 * `frontEavesUnscored`. Taller fronts stay byte-identical.
 *   node --import tsx --test src/canalRecall/blockFace/vogelbuurt.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {bodyBandM, bodyShares} from './stripEvidence.ts';
import {bodyFromFor, STRIP_LIKENESS} from './stripLikeness.ts';
import {measureStripStructure} from './stripStructure.ts';
import {scoreType, type MatchableType} from './autoPlace.ts';
import {defaultTypeLoader} from './typeLibrary.ts';

test('body band: eaves over 6 m keep 4.4 m .. eaves - 1 m (byte-identical); a low front starts at 0.9 m', () => {
  assert.deepEqual(bodyBandM(12.7), [4.4, 11.7]);
  assert.deepEqual(bodyBandM(6.5), [4.4, 5.5]);
  const near = (a: number[], b: number[]) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-9));
  near(bodyBandM(4.1), [0.9, 3.7]);
  near(bodyBandM(3.2), [0.9, 2.8]);
  assert.equal(bodyFromFor(12.7), STRIP_LIKENESS.bodyFromM);
  assert.equal(bodyFromFor(3.4), 1.3);
});

test('a one-storey front reads a body (not 100 % void) and never a balcony', () => {
  const ppm = 40, W = 240, H = 300, rgb = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { rgb[i * 3] = 150; rgb[i * 3 + 1] = 100; rgb[i * 3 + 2] = 85; }
  // A dark window 2 m wide at 1.1-2.4 m, the kind of "open axis" that is a balcony door on a tall front.
  for (let y = H - Math.round(2.4 * ppm); y < H - Math.round(1.1 * ppm); y++) for (let x = 60; x < 140; x++) rgb.fill(30, (y * W + x) * 3, (y * W + x) * 3 + 3);
  const shares = bodyShares(rgb, W, H, [0, W], ppm, 3.4);
  assert.ok(shares.placeholder < 0.1, `placeholder share ${shares.placeholder}`);
  const s = measureStripStructure({rgb, width: W, height: H, x0: 0, x1: W, pixelsPerMetre: ppm, eavesM: 3.4});
  assert.ok(s);
  assert.equal(s!.balconies, false);
  assert.match(s!.balconyWhy, /one-storey/);
});

test('the Vogelbuurt library loads and its types carry measured evidence', () => {
  const dir = new URL('../../../scripts/block-face/types/vogelbuurt/', import.meta.url);
  const ids = readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
  assert.ok(ids.length >= 4);
  for (const t of ids) {
    assert.ok(t.evidence?.length, `${t.id}: evidence`);
    assert.ok(t.match?.frontEavesM !== undefined, `${t.id}: frontEavesM (3DBAG eaves is the roof's, not the gutter)`);
  }
  const row = ids.find(t => t.id === 'vogel-1921-two-storey-dormer-row');
  assert.equal(row.match.frontEavesUnscored, true);
});

test('frontEavesUnscored drops the eaves criterion; keepSurveyRoof is a plain flag', () => {
  const t = defaultTypeLoader('vogel-1921-two-storey-dormer-row') as MatchableType;
  assert.equal(t.match!.keepSurveyRoof, true);
  const ev = {pandId: 'p', address: 'a', builtYear: 1923, widthM: 6.4, eavesM: 7.2, roofMaxM: 11.8, storeys3dbag: 3, groundUses: [], osm: [], strip: null} as never;
  assert.ok(!scoreType(t, ev).criteria.some(c => c.key === 'eaves'));
  const scored = {...t, match: {...t.match!, frontEavesUnscored: undefined}} as MatchableType;
  assert.ok(scoreType(scored, ev).criteria.some(c => c.key === 'eaves'));
});

test('a type with a gable crown stays under its rakes: roof.rakeClear (the saddle was coplanar with the gable top, 1.0 m2 per gable at the audit)', () => {
  const t = defaultTypeLoader('vogel-1921-two-storey-dormer-row') as MatchableType & {roof?: {rakeClear?: boolean}; crowns: Record<string, {gable?: string}>};
  assert.ok(Object.values(t.crowns).some(c => c.gable === 'point'));
  assert.equal(t.roof?.rakeClear, true);
});

test('dormerLights: n lights = n-1 evenly spaced bars; absent keeps the single middle bar; validated 2..8', async () => {
  const {fitIntent} = await import('../buildingRecipe/fit.ts');
  const {validateIntent} = await import('../buildingRecipe/intent.ts');
  const {resolvePlacement} = await import('./houseType.ts');
  const t = defaultTypeLoader('vogel-1918-timber-band-cottage')!;
  const base = resolvePlacement(t, {type: t.id}, 'Lange Vogelstraat').design;
  const pand = ['vogel-1-15', '0363100012063241'];
  const facts = JSON.parse(readFileSync(`scripts/block-face/faces/${pand[0]}/pands/${pand[1]}/facts.json`, 'utf8'));
  const mk = (lights?: number) => validateIntent({schemaVersion: 1, kind: 'canal-house', id: 'test-dl', pandId: pand[1], address: 'Lange Vogelstraat', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2023-01-02'}], ...base, fronts: base.fronts.map(f => ({...f, dormers: 1, dormerLights: lights}))} as never);
  const bars = (lights?: number) => (fitIntent(mk(lights), facts).recipe.elevations[0] as {dormers?: {value: {verticalBars: number[]}[]}}).dormers?.value.map(d => d.verticalBars);
  const none = bars(), five = bars(5);
  assert.ok(none && none.length > 0, 'dormers built');
  { assert.ok(none.every(b => b.length === 1 && b[0] === 0.5)); assert.ok(five!.every(b => b.length === 4 && Math.abs(b[0] - 0.2) < 1e-9)); }
  assert.throws(() => mk(1), /dormerLights/);
  assert.throws(() => mk(9), /dormerLights/);
});
